import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'mobile_agent_runtime.dart';
import 'mobile_citations.dart';
import 'mobile_document_tools.dart';
import 'mobile_html_pdf_tools.dart';
import 'mobile_ocr_tools.dart';
import 'mobile_productivity_tools.dart';
import 'mobile_provider_models.dart';
import 'mobile_research_tools.dart';
import 'mobile_skill_loader.dart';
import 'mobile_system_prompt.dart';
import 'mobile_task_ledger.dart';
import 'mobile_tool_contracts.dart';
import 'mobile_verification_tools.dart';

enum MobileChatEventType {
  queued,
  thinkingDelta,
  textDelta,
  toolCallStarted,
  toolCallDelta,
  toolCallCompleted,
  done,
  error,
}

class MobileChatMessage {
  const MobileChatMessage({required this.role, required this.content});

  final String role;
  final String content;

  Map<String, String> toJson() => {'role': role, 'content': content};
}

class MobileChatRequest {
  const MobileChatRequest({
    required this.config,
    required this.apiKey,
    required this.model,
    required this.messages,
    this.latestUserText = '',
    this.enableTools = true,
    this.maxToolSteps = 8,
  });

  final MobileProviderConfig config;
  final String apiKey;
  final String model;
  final List<MobileChatMessage> messages;
  final String latestUserText;
  final bool enableTools;
  final int maxToolSteps;
}

class MobileToolStreamBlock {
  const MobileToolStreamBlock({
    required this.id,
    required this.name,
    this.providerId,
    this.arguments = '',
    this.result,
    this.pending = true,
  });

  final String id;
  final String name;
  final String? providerId;
  final String arguments;
  final String? result;
  final bool pending;

  MobileToolStreamBlock copyWith({
    String? arguments,
    String? result,
    bool? pending,
  }) {
    return MobileToolStreamBlock(
      id: id,
      name: name,
      providerId: providerId,
      arguments: arguments ?? this.arguments,
      result: result ?? this.result,
      pending: pending ?? this.pending,
    );
  }
}

class MobileChatStreamEvent {
  const MobileChatStreamEvent({
    required this.type,
    this.delta = '',
    this.tool,
    this.error,
  });

  final MobileChatEventType type;
  final String delta;
  final MobileToolStreamBlock? tool;
  final Object? error;
}

class MobileChatStreamingService {
  const MobileChatStreamingService({
    this.modelService = const MobileProviderModelService(),
    this.promptBuilder = const MobileSystemPromptBuilder(),
    this.skillLoader = const MobileSkillLoader(),
    this.webSearchTool = const MobileWebSearchTool(),
    this.sourceDistiller = const MobileSourceDistiller(),
    this.documentReader = const MobileDocumentReaderTool(),
    this.documentExporter = const MobileDocumentExportTool(),
    this.htmlDocumentTool = const MobileHtmlDocumentTool(),
    this.htmlToPdfRenderer = const MobileHtmlToPdfRenderer(),
    this.fileIntakePolicy = const MobileFileIntakePolicy(),
    this.ocrTool = const MobileOcrTool(),
    this.reasoningLedger = const MobileReasoningLedgerPlanner(),
    this.safetyClassifier = const MobileSafetyClassifier(),
    this.answerVerifier = const MobileAnswerVerifier(),
    this.calculator = const MobileCalculatorTool(),
    this.tableTool = const MobileTableTool(),
    this.citationManager = const MobileCitationManagerTool(),
  });

  final MobileProviderModelService modelService;
  final MobileSystemPromptBuilder promptBuilder;
  final MobileSkillLoader skillLoader;
  final MobileWebSearchTool webSearchTool;
  final MobileSourceDistiller sourceDistiller;
  final MobileDocumentReaderTool documentReader;
  final MobileDocumentExportTool documentExporter;
  final MobileHtmlDocumentTool htmlDocumentTool;
  final MobileHtmlToPdfRenderer htmlToPdfRenderer;
  final MobileFileIntakePolicy fileIntakePolicy;
  final MobileOcrTool ocrTool;
  final MobileReasoningLedgerPlanner reasoningLedger;
  final MobileSafetyClassifier safetyClassifier;
  final MobileAnswerVerifier answerVerifier;
  final MobileCalculatorTool calculator;
  final MobileTableTool tableTool;
  final MobileCitationManagerTool citationManager;
  static final _artifactRegistry = <String, MobileHtmlToPdfArtifact>{};

  Stream<MobileChatStreamEvent> stream(MobileChatRequest request) async* {
    final conversation = <Map<String, Object?>>[
      {
        'role': 'system',
        'content': promptBuilder.build(
          latestUserText: request.latestUserText.isEmpty
              ? (request.messages.isEmpty ? '' : request.messages.last.content)
              : request.latestUserText,
          provider: request.config,
          model: request.model,
        ),
      },
      for (final message in request.messages) message.toJson(),
    ];

    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 20)
      ..userAgent = 'AurictMobile/1.0 chat-stream';
    try {
      yield const MobileChatStreamEvent(type: MobileChatEventType.queued);
      final toolResultCache = <String, String>{};
      var forceFinalAnswer = false;
      for (var step = 0; step <= request.maxToolSteps; step++) {
        final includeTools =
            request.enableTools &&
            request.config.supportsStreamingTools &&
            !forceFinalAnswer &&
            step < request.maxToolSteps;
        final chatRequest = _buildChatRequest(
          request,
          conversationOverride: conversation,
          includeTools: includeTools,
        );
        final toolCalls = <String, _PendingToolCall>{};
        final toolOrder = <String>[];
        final httpRequest = await client.postUrl(chatRequest.uri);
        chatRequest.headers.forEach(httpRequest.headers.set);
        httpRequest.headers.contentType = ContentType.json;
        httpRequest.write(jsonEncode(chatRequest.body));
        final response = await httpRequest.close();
        if (response.statusCode < 200 || response.statusCode >= 300) {
          final body = await response.transform(utf8.decoder).join();
          throw HttpException(
            'Chat request failed with HTTP ${response.statusCode}: ${_short(body)}',
            uri: chatRequest.uri,
          );
        }

        var buffer = '';
        await for (final chunk
            in response
                .transform(utf8.decoder)
                .timeout(const Duration(seconds: 90))) {
          buffer += chunk;
          while (true) {
            final split = buffer.indexOf('\n\n');
            if (split == -1) break;
            final frame = buffer.substring(0, split);
            buffer = buffer.substring(split + 2);
            final event = _parseSseFrame(frame);
            if (event == null) continue;
            if (event == '[DONE]') break;
            for (final parsed in _eventsFromJson(event)) {
              _collectToolDelta(parsed, toolCalls, toolOrder);
              yield parsed;
            }
          }
        }

        if (buffer.trim().isNotEmpty) {
          final event = _parseSseFrame(buffer);
          if (event != null && event != '[DONE]') {
            for (final parsed in _eventsFromJson(event)) {
              _collectToolDelta(parsed, toolCalls, toolOrder);
              yield parsed;
            }
          }
        }

        final calls = [
          for (final id in toolOrder)
            if (toolCalls[id] != null && toolCalls[id]!.name.isNotEmpty)
              toolCalls[id]!,
        ];
        if (calls.isEmpty) {
          yield const MobileChatStreamEvent(type: MobileChatEventType.done);
          return;
        }
        if (step == request.maxToolSteps) {
          yield const MobileChatStreamEvent(
            type: MobileChatEventType.textDelta,
            delta:
                '\n\nI reached the mobile tool limit before the model produced a final answer. I stopped tool execution to avoid a loop.',
          );
          yield const MobileChatStreamEvent(type: MobileChatEventType.done);
          return;
        }

        conversation.add({
          'role': 'assistant',
          'content': null,
          'tool_calls': [
            for (final call in calls)
              {
                'id': call.providerId,
                'type': 'function',
                'function': {'name': call.name, 'arguments': call.arguments},
              },
          ],
        });
        final pendingBySignature = <String, Future<String>>{};
        final executed = await Future.wait(
          calls.map((call) async {
            final signature = _toolSignature(call);
            final cached = toolResultCache[signature];
            if (cached != null) {
              forceFinalAnswer = true;
              return _ExecutedToolCall(
                call: call,
                result: _duplicateToolResult(call.name, cached),
              );
            }
            final future = pendingBySignature.putIfAbsent(
              signature,
              () => _executeMobileTool(call),
            );
            final result = await future;
            toolResultCache[signature] = result;
            return _ExecutedToolCall(call: call, result: result);
          }),
        );

        for (final item in executed) {
          yield MobileChatStreamEvent(
            type: MobileChatEventType.toolCallCompleted,
            tool: MobileToolStreamBlock(
              id: item.call.id,
              name: item.call.name,
              arguments: item.call.arguments,
              result: item.result,
              pending: false,
            ),
          );
          conversation.add({
            'role': 'tool',
            'tool_call_id': item.call.providerId,
            'content': item.result,
          });
        }
      }
      yield const MobileChatStreamEvent(
        type: MobileChatEventType.textDelta,
        delta:
            '\n\nI stopped because the model exceeded the mobile tool loop budget.',
      );
      yield const MobileChatStreamEvent(type: MobileChatEventType.done);
    } catch (error) {
      yield MobileChatStreamEvent(
        type: MobileChatEventType.error,
        error: error,
      );
    } finally {
      client.close(force: true);
    }
  }

  MobileChatHttpRequest buildChatRequest(MobileChatRequest request) {
    return _buildChatRequest(
      request,
      conversationOverride: null,
      includeTools: request.enableTools,
    );
  }

  MobileChatHttpRequest _buildChatRequest(
    MobileChatRequest request, {
    List<Map<String, Object?>>? conversationOverride,
    bool includeTools = true,
  }) {
    if (!_supportsChatCompletions(request.config.provider)) {
      throw UnsupportedError(
        '${request.config.name} chat streaming is not wired yet. Use OpenCode, OpenRouter, OpenAI, or a compatible endpoint.',
      );
    }
    final modelRequest = modelService.buildRequest(
      request.config,
      request.apiKey,
    );
    final uri = _chatCompletionsUri(request.config.modelsEndpoint);
    return MobileChatHttpRequest(
      uri: uri,
      headers: {
        ...modelRequest.headers,
        HttpHeaders.acceptHeader: 'text/event-stream',
      },
      body: {
        'model': request.model,
        'stream': true,
        'messages':
            conversationOverride ??
            [
              {
                'role': 'system',
                'content': promptBuilder.build(
                  latestUserText: request.latestUserText.isEmpty
                      ? (request.messages.isEmpty
                            ? ''
                            : request.messages.last.content)
                      : request.latestUserText,
                  provider: request.config,
                  model: request.model,
                ),
              },
              for (final message in request.messages) message.toJson(),
            ],
        if (includeTools && request.config.supportsStreamingTools)
          'tools': _mobileToolSchemas,
        if (includeTools && request.config.supportsStreamingTools)
          'tool_choice': 'auto',
      },
    );
  }

  bool _supportsChatCompletions(MobileModelProvider provider) {
    return provider == MobileModelProvider.openai ||
        provider == MobileModelProvider.openrouter ||
        provider == MobileModelProvider.opencode ||
        provider == MobileModelProvider.nvidia ||
        provider == MobileModelProvider.zai ||
        provider == MobileModelProvider.alibaba ||
        provider == MobileModelProvider.mistral ||
        provider == MobileModelProvider.groq ||
        provider == MobileModelProvider.together ||
        provider == MobileModelProvider.fireworks ||
        provider == MobileModelProvider.xai ||
        provider == MobileModelProvider.perplexity ||
        provider == MobileModelProvider.compatible;
  }

  Uri _chatCompletionsUri(Uri modelsEndpoint) {
    final path = modelsEndpoint.path.replaceFirst(
      RegExp(r'/models/?$'),
      '/chat/completions',
    );
    return modelsEndpoint.replace(path: path);
  }

  String? _parseSseFrame(String frame) {
    final lines = const LineSplitter().convert(frame);
    final data = lines
        .where((line) => line.startsWith('data:'))
        .map((line) => line.substring(5).trimLeft())
        .join('\n')
        .trim();
    return data.isEmpty ? null : data;
  }

  List<MobileChatStreamEvent> _eventsFromJson(String data) {
    final decoded = jsonDecode(data);
    if (decoded is! Map<String, Object?>) return const [];
    final choices = decoded['choices'];
    if (choices is! List || choices.isEmpty) return const [];
    final first = choices.first;
    if (first is! Map<String, Object?>) return const [];
    final delta = first['delta'];
    if (delta is! Map<String, Object?>) return const [];

    final events = <MobileChatStreamEvent>[];
    final reasoning = delta['reasoning_content'] ?? delta['thinking'];
    if (reasoning is String && reasoning.isNotEmpty) {
      events.add(
        MobileChatStreamEvent(
          type: MobileChatEventType.thinkingDelta,
          delta: reasoning,
        ),
      );
    }

    final content = delta['content'] ?? delta['text'] ?? delta['message'];
    if (content is String && content.isNotEmpty) {
      events.add(
        MobileChatStreamEvent(
          type: MobileChatEventType.textDelta,
          delta: content,
        ),
      );
    }

    final toolCalls = delta['tool_calls'];
    if (toolCalls is List) {
      for (final call in toolCalls) {
        if (call is! Map<String, Object?>) continue;
        final providerId = call['id']?.toString();
        final id = call['index'] == null
            ? (call['id']?.toString() ?? 'tool-0')
            : 'tool-${call['index']}';
        final function = call['function'];
        if (function is! Map<String, Object?>) continue;
        final name = function['name']?.toString();
        final args = function['arguments']?.toString() ?? '';
        if (name != null && name.isNotEmpty) {
          events.add(
            MobileChatStreamEvent(
              type: MobileChatEventType.toolCallStarted,
              tool: MobileToolStreamBlock(
                id: id,
                name: name,
                providerId: providerId,
                arguments: args,
              ),
            ),
          );
        } else if (args.isNotEmpty) {
          events.add(
            MobileChatStreamEvent(
              type: MobileChatEventType.toolCallDelta,
              tool: MobileToolStreamBlock(
                id: id,
                name: 'tool',
                providerId: providerId,
                arguments: args,
              ),
            ),
          );
        }
      }
    }
    return events;
  }

  @visibleForTesting
  List<MobileChatStreamEvent> parseStreamFrameForTest(String data) {
    return _eventsFromJson(data);
  }

  @visibleForTesting
  Future<String> webFetchForTest(String url) {
    return _webFetch(url);
  }

  void _collectToolDelta(
    MobileChatStreamEvent event,
    Map<String, _PendingToolCall> calls,
    List<String> order,
  ) {
    final tool = event.tool;
    if (tool == null) return;
    if (!calls.containsKey(tool.id)) order.add(tool.id);
    final previous = calls[tool.id];
    calls[tool.id] = _PendingToolCall(
      id: tool.id,
      providerId: tool.providerId ?? previous?.providerId ?? tool.id,
      name: tool.name == 'tool' ? previous?.name ?? '' : tool.name,
      arguments: (previous?.arguments ?? '') + tool.arguments,
    );
  }

  Future<String> _executeMobileTool(_PendingToolCall call) async {
    final args = _decodeArgs(call.arguments);
    switch (call.name) {
      case 'web_search':
        return _webSearch(args);
      case 'web_fetch':
      case 'web_fetch_plus':
        return _webFetch(args['url']?.toString() ?? '');
      case 'source_distill':
        return _sourceDistill(args);
      case 'document_reader':
        return _documentReader(args);
      case 'pdf_read':
        return _pdfRead(args);
      case 'document_export':
        return _documentExport(args);
      case 'html_document_create':
        return _htmlDocumentCreate(args);
      case 'html_sanitize':
        return _htmlSanitize(args);
      case 'html_to_pdf':
        return _htmlToPdf(args);
      case 'artifact_save':
        return _artifactSave(args);
      case 'artifact_share':
        return _artifactShare(args);
      case 'file_intake_policy':
        return _fileIntakePolicy(args);
      case 'ocr_read':
        return _ocrRead(args);
      case 'task_ledger':
        return _taskLedger(args);
      case 'safety_classifier':
        return _safetyClassifier(args);
      case 'answer_verifier':
        return _answerVerifier(args);
      case 'calculator':
        return _calculator(args);
      case 'table_tool':
        return _tableTool(args);
      case 'citation_manager':
        return _citationManager(args);
      case 'research_outline':
        return MobileToolResult.success(
          tool: 'research_outline',
          risk: MobileToolRisk.low,
          policy: mobileLocalPolicy,
          cacheKey: MobileToolCache.key('research_outline', args),
          data: {
            'topic': args['topic']?.toString() ?? 'Untitled research task',
            'steps': [
              'Clarify scope and target audience',
              'Gather sources with web_search, web_fetch_plus, or user-provided documents',
              'Distill claims into cited notes with source_distill',
              'Draft final answer with limitations and next actions',
            ],
            'status': 'planned',
          },
        ).encode();
      case 'create_document_outline':
        return MobileToolResult.success(
          tool: 'create_document_outline',
          risk: MobileToolRisk.document,
          policy: mobileLocalPolicy,
          cacheKey: MobileToolCache.key('create_document_outline', args),
          data: {
            'title': args['title']?.toString() ?? 'Aurict document',
            'format': args['format']?.toString() ?? 'markdown',
            'sections': [
              'Executive summary',
              'Key findings',
              'Evidence and citations',
              'Recommendations',
              'Appendix',
            ],
            'status': 'outline_ready',
          },
        ).encode();
      case 'load_mobile_skill':
        final skill =
            args['skill_id']?.toString() ??
            args['skill']?.toString() ??
            args['query']?.toString() ??
            '';
        final loaded = skillLoader.loadByQuery(skill);
        if (loaded == null) {
          return MobileToolResult.failure(
            tool: 'load_mobile_skill',
            risk: MobileToolRisk.low,
            policy: mobileLocalPolicy,
            error: 'Skill not found',
            data: {
              'query': skill,
              'sampleSkills': MobileSkillRegistry.skills
                  .take(12)
                  .map((skill) => skill.id)
                  .toList(growable: false),
            },
          ).encode();
        }
        return MobileToolResult.success(
          tool: 'load_mobile_skill',
          risk: MobileToolRisk.low,
          policy: mobileLocalPolicy,
          cacheKey: MobileToolCache.key('load_mobile_skill', {'skill': skill}),
          data: {
            'skill': loaded.skillId,
            'name': loaded.name,
            'instructions': skillLoader.formatLoadedSkill(loaded),
            'allowedTools': loaded.allowedTools,
            'context': loaded.context.name,
            'autoContinue': loaded.autoContinue,
            'risk': loaded.policy.risk.name,
          },
        ).encode();
      default:
        return MobileToolResult.failure(
          tool: call.name,
          risk: MobileToolRisk.low,
          policy: mobileLocalPolicy,
          error: 'Unknown mobile tool: ${call.name}',
          data: {'availableTools': _mobileToolNames},
        ).encode();
    }
  }

  Map<String, Object?> _decodeArgs(String raw) {
    if (raw.trim().isEmpty) return const {};
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, Object?> ? decoded : const {};
    } catch (_) {
      return {'raw': raw};
    }
  }

  Future<String> _webFetch(String url) async {
    final args = {'url': url};
    final uri = Uri.tryParse(url);
    if (uri == null || !(uri.scheme == 'https' || uri.scheme == 'http')) {
      return MobileToolResult.failure(
        tool: 'web_fetch_plus',
        risk: MobileToolRisk.network,
        policy: mobilePublicNetworkPolicy,
        error: 'web_fetch requires an http(s) URL.',
        cacheKey: MobileToolCache.key('web_fetch_plus', args),
      ).encode();
    }
    if (!_isPublicHttpTarget(uri)) {
      return MobileToolResult.failure(
        tool: 'web_fetch_plus',
        risk: MobileToolRisk.network,
        policy: mobilePublicNetworkPolicy,
        error:
            'Blocked by mobile safety policy. web_fetch only supports public HTTP/HTTPS targets, not local/private hosts.',
        data: {'url': url},
        cacheKey: MobileToolCache.key('web_fetch_plus', args),
      ).encode();
    }
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 15)
      ..userAgent = 'AurictMobile/1.0 web-fetch';
    try {
      final request = await client.getUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'text/html,text/plain,*/*');
      request.followRedirects = true;
      request.maxRedirects = 5;
      final response = await request.close().timeout(
        const Duration(seconds: 30),
      );
      final limited = await response
          .take(256)
          .expand((chunk) => chunk)
          .take(512 * 1024)
          .toList()
          .timeout(const Duration(seconds: 30));
      final body = utf8.decode(limited, allowMalformed: true);
      final text = body
          .replaceAll(
            RegExp(r'<script[\s\S]*?</script>', caseSensitive: false),
            ' ',
          )
          .replaceAll(
            RegExp(r'<style[\s\S]*?</style>', caseSensitive: false),
            ' ',
          )
          .replaceAll(RegExp(r'<[^>]+>'), ' ')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();
      final ok = response.statusCode >= 200 && response.statusCode < 400;
      final data = {
        'url': url,
        'finalUrl': response.redirects.isEmpty
            ? url
            : response.redirects.last.location.toString(),
        'statusCode': response.statusCode,
        'contentType': response.headers.contentType?.mimeType,
        'title': _extractTitle(body),
        'text': text.length > 14000 ? '${text.substring(0, 14000)}...' : text,
        'truncated': text.length > 14000,
        'distillationHint':
            'Call source_distill on important fetched text before making source-backed claims.',
      };
      return ok
          ? MobileToolResult.success(
              tool: 'web_fetch_plus',
              risk: MobileToolRisk.network,
              policy: mobilePublicNetworkPolicy,
              cacheKey: MobileToolCache.key('web_fetch_plus', args),
              data: data,
            ).encode()
          : MobileToolResult.failure(
              tool: 'web_fetch_plus',
              risk: MobileToolRisk.network,
              policy: mobilePublicNetworkPolicy,
              error: 'HTTP ${response.statusCode}',
              cacheKey: MobileToolCache.key('web_fetch_plus', args),
              data: data,
            ).encode();
    } catch (error) {
      return MobileToolResult.failure(
        tool: 'web_fetch_plus',
        risk: MobileToolRisk.network,
        policy: mobilePublicNetworkPolicy,
        error: error.toString(),
        data: {'url': url},
        cacheKey: MobileToolCache.key('web_fetch_plus', args),
      ).encode();
    } finally {
      client.close(force: true);
    }
  }

  Future<String> _webSearch(Map<String, Object?> args) async {
    final query = args['query']?.toString().trim() ?? '';
    if (query.isEmpty) {
      return MobileToolResult.failure(
        tool: 'web_search',
        risk: MobileToolRisk.network,
        policy: mobilePublicNetworkPolicy,
        error: 'web_search requires a non-empty query.',
      ).encode();
    }
    try {
      final result = await webSearchTool.search(query);
      return MobileToolResult.success(
        tool: 'web_search',
        risk: MobileToolRisk.network,
        policy: mobilePublicNetworkPolicy,
        cacheKey: MobileToolCache.key('web_search', {'query': query}),
        data: {
          ...result.toJson(),
          'distillationHint':
              'Fetch and distill important sources before making strong claims.',
        },
      ).encode();
    } catch (error) {
      return MobileToolResult.failure(
        tool: 'web_search',
        risk: MobileToolRisk.network,
        policy: mobilePublicNetworkPolicy,
        error: error.toString(),
        data: {'query': query},
        cacheKey: MobileToolCache.key('web_search', {'query': query}),
      ).encode();
    }
  }

  String _sourceDistill(Map<String, Object?> args) {
    final sources = <MobileSourceRecord>[];
    final rawSources = args['sources'];
    if (rawSources is List) {
      for (final item in rawSources) {
        if (item is! Map<String, Object?>) continue;
        final url =
            Uri.tryParse(item['url']?.toString() ?? '') ??
            Uri.https('local.source');
        sources.add(
          MobileSourceRecord(
            url: url,
            title: item['title']?.toString() ?? url.host,
            text: item['text']?.toString() ?? item['content']?.toString() ?? '',
            sourceType: item['sourceType']?.toString() ?? 'tool',
            statusCode: int.tryParse(item['statusCode']?.toString() ?? ''),
          ),
        );
      }
    }
    final text = args['text']?.toString() ?? '';
    if (sources.isEmpty && text.trim().isNotEmpty) {
      final url =
          Uri.tryParse(args['url']?.toString() ?? '') ??
          Uri.https('local.source');
      sources.add(
        MobileSourceRecord(
          url: url,
          title: args['title']?.toString() ?? url.host,
          text: text,
          sourceType: 'user_or_tool_text',
        ),
      );
    }
    if (sources.isEmpty) {
      return MobileToolResult.failure(
        tool: 'source_distill',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: 'source_distill requires text or a sources array.',
      ).encode();
    }
    final ledger = sourceDistiller.distill(sources);
    return MobileToolResult.success(
      tool: 'source_distill',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('source_distill', args),
      data: {
        'citationCount': ledger.citations.length,
        'summary': ledger.summary,
        'citations': ledger.citations
            .map(
              (citation) => {
                'id': citation.id,
                'title': citation.title,
                'url': citation.url.toString(),
                'claim': citation.claim,
                'evidence': citation.evidence,
                'confidence': citation.confidence.name,
              },
            )
            .toList(growable: false),
      },
    ).encode();
  }

  String _documentReader(Map<String, Object?> args) {
    final content = args['content']?.toString() ?? '';
    if (content.trim().isEmpty) {
      return MobileToolResult.failure(
        tool: 'document_reader',
        risk: MobileToolRisk.document,
        policy: mobileLocalPolicy,
        error:
            'document_reader requires user-provided text content. It does not read arbitrary filesystem paths.',
      ).encode();
    }
    final result = documentReader.readText(
      name: args['name']?.toString() ?? 'user-document.txt',
      mimeType: args['mime_type']?.toString() ?? 'text/plain',
      content: content,
    );
    return MobileToolResult.success(
      tool: 'document_reader',
      risk: MobileToolRisk.document,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('document_reader', {
        'name': result.name,
        'length': content.length,
      }),
      data: result.toJson(),
    ).encode();
  }

  Future<String> _pdfRead(Map<String, Object?> args) async {
    final base64Pdf =
        args['base64_pdf']?.toString() ?? args['base64']?.toString() ?? '';
    if (base64Pdf.trim().isEmpty) {
      return MobileToolResult.failure(
        tool: 'pdf_read',
        risk: MobileToolRisk.document,
        policy: mobileLocalPolicy,
        error:
            'pdf_read requires base64_pdf from a user-selected file. It does not access files by path.',
      ).encode();
    }
    try {
      final result = await documentReader.readPdfBase64Async(
        name: args['name']?.toString() ?? 'user-document.pdf',
        base64Pdf: base64Pdf,
      );
      return MobileToolResult.success(
        tool: 'pdf_read',
        risk: MobileToolRisk.document,
        policy: mobileLocalPolicy,
        cacheKey: MobileToolCache.key('pdf_read', {
          'name': result.name,
          'length': base64Pdf.length,
        }),
        data: result.toJson(),
      ).encode();
    } catch (error) {
      return MobileToolResult.failure(
        tool: 'pdf_read',
        risk: MobileToolRisk.document,
        policy: mobileLocalPolicy,
        error: error.toString(),
      ).encode();
    }
  }

  String _documentExport(Map<String, Object?> args) {
    final title = args['title']?.toString() ?? 'Aurict document';
    final markdown = args['markdown']?.toString() ?? '';
    final format = args['format']?.toString() ?? 'pdf';
    if (markdown.trim().isEmpty) {
      return MobileToolResult.failure(
        tool: 'document_export',
        risk: MobileToolRisk.generatedArtifact,
        policy: mobileLocalPolicy,
        error: 'document_export requires markdown content.',
      ).encode();
    }
    final result = documentExporter.export(
      title: title,
      markdown: markdown,
      format: format,
    );
    return MobileToolResult.success(
      tool: 'document_export',
      risk: MobileToolRisk.generatedArtifact,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('document_export', {
        'title': title,
        'format': format,
        'length': markdown.length,
      }),
      data: result,
    ).encode();
  }

  String _htmlDocumentCreate(Map<String, Object?> args) {
    final title = args['title']?.toString() ?? 'Aurict document';
    final html = args['html']?.toString() ?? '';
    final css = args['css']?.toString() ?? '';
    if (html.trim().isEmpty) {
      return MobileToolResult.failure(
        tool: 'html_document_create',
        risk: MobileToolRisk.generatedArtifact,
        policy: mobileLocalPolicy,
        error: 'html_document_create requires HTML body content.',
      ).encode();
    }
    final document = htmlDocumentTool.create(
      title: title,
      html: html,
      css: css,
      pageSize: args['page_size']?.toString() ?? 'A4',
      theme: args['theme']?.toString() ?? 'executive',
    );
    return MobileToolResult.success(
      tool: 'html_document_create',
      risk: MobileToolRisk.generatedArtifact,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('html_document_create', {
        'title': title,
        'htmlLength': html.length,
      }),
      data: {
        ...document.toJson(),
        'nextTool': 'html_to_pdf',
        'htmlPolicy':
            'HTML is sanitized locally. Scripts, event handlers, iframes, forms, javascript URLs, and remote CSS url() resources are blocked.',
      },
    ).encode();
  }

  String _htmlSanitize(Map<String, Object?> args) {
    final result = htmlDocumentTool.sanitize(
      html: args['html']?.toString() ?? '',
      css: args['css']?.toString() ?? '',
    );
    return MobileToolResult.success(
      tool: 'html_sanitize',
      risk: MobileToolRisk.generatedArtifact,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('html_sanitize', {
        'htmlLength': args['html']?.toString().length ?? 0,
      }),
      data: result.toJson(),
    ).encode();
  }

  Future<String> _htmlToPdf(Map<String, Object?> args) async {
    final title = args['title']?.toString() ?? 'Aurict document';
    final html = args['html']?.toString() ?? '';
    if (html.trim().isEmpty) {
      return MobileToolResult.failure(
        tool: 'html_to_pdf',
        risk: MobileToolRisk.generatedArtifact,
        policy: mobileLocalPolicy,
        error: 'html_to_pdf requires HTML body content.',
      ).encode();
    }
    final document = htmlDocumentTool.create(
      title: title,
      html: html,
      css: args['css']?.toString() ?? '',
      pageSize: args['page_size']?.toString() ?? 'A4',
      theme: args['theme']?.toString() ?? 'executive',
    );
    final artifact = await htmlToPdfRenderer.render(
      document: document,
      fileName:
          args['file_name']?.toString() ?? mobileSafeArtifactName(title, 'pdf'),
    );
    _artifactRegistry[artifact.artifactId] = artifact;
    return MobileToolResult.success(
      tool: 'html_to_pdf',
      risk: MobileToolRisk.generatedArtifact,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('html_to_pdf', {
        'title': title,
        'htmlLength': html.length,
      }),
      data: artifact.toJson(),
    ).encode();
  }

  Future<String> _artifactSave(Map<String, Object?> args) async {
    final artifactId = args['artifact_id']?.toString() ?? '';
    final artifact = _artifactRegistry[artifactId];
    if (artifact == null) {
      return MobileToolResult.failure(
        tool: 'artifact_save',
        risk: MobileToolRisk.generatedArtifact,
        policy: mobileLocalPolicy,
        error:
            'Unknown artifact_id. Render the artifact with html_to_pdf first.',
      ).encode();
    }
    final result = await htmlToPdfRenderer.save(artifact);
    return MobileToolResult.success(
      tool: 'artifact_save',
      risk: MobileToolRisk.generatedArtifact,
      policy: mobileLocalPolicy,
      data: {'artifactId': artifactId, ...result},
    ).encode();
  }

  Future<String> _artifactShare(Map<String, Object?> args) async {
    final artifactId = args['artifact_id']?.toString() ?? '';
    final artifact = _artifactRegistry[artifactId];
    if (artifact == null) {
      return MobileToolResult.failure(
        tool: 'artifact_share',
        risk: MobileToolRisk.generatedArtifact,
        policy: mobileLocalPolicy,
        error:
            'Unknown artifact_id. Render the artifact with html_to_pdf first.',
      ).encode();
    }
    final result = await htmlToPdfRenderer.share(artifact);
    return MobileToolResult.success(
      tool: 'artifact_share',
      risk: MobileToolRisk.generatedArtifact,
      policy: mobileLocalPolicy,
      data: {'artifactId': artifactId, ...result},
    ).encode();
  }

  String _fileIntakePolicy(Map<String, Object?> args) {
    final result = fileIntakePolicy.describe(
      requestedAction: args['requested_action']?.toString() ?? '',
      mimeType: args['mime_type']?.toString() ?? '',
    );
    return MobileToolResult.success(
      tool: 'file_intake_policy',
      risk: MobileToolRisk.document,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('file_intake_policy', args),
      data: result,
    ).encode();
  }

  String _ocrRead(Map<String, Object?> args) {
    final recognizedText =
        args['recognized_text']?.toString() ?? args['text']?.toString() ?? '';
    final result = ocrTool.read(
      name: args['name']?.toString() ?? 'user-image',
      recognizedText: recognizedText,
      languageHint: args['language_hint']?.toString() ?? '',
    );
    if (result.requiresOcrEngine) {
      return MobileToolResult.failure(
        tool: 'ocr_read',
        risk: MobileToolRisk.document,
        policy: mobileLocalPolicy,
        error:
            'ocr_read requires recognized_text from the device OCR layer. It does not upload images or pretend to OCR without engine output.',
        data: result.toJson(),
      ).encode();
    }
    return MobileToolResult.success(
      tool: 'ocr_read',
      risk: MobileToolRisk.document,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('ocr_read', {
        'name': result.name,
        'length': recognizedText.length,
      }),
      data: result.toJson(),
    ).encode();
  }

  String _taskLedger(Map<String, Object?> args) {
    final objective = args['objective']?.toString() ?? 'Untitled mobile task';
    final ledger = reasoningLedger.plan(
      objective: objective,
      requiresResearch: _boolArg(args, 'requires_research'),
      requiresDocument: _boolArg(args, 'requires_document'),
      requiresExport: _boolArg(args, 'requires_export'),
      hasLoadedSkill: _boolArg(args, 'has_loaded_skill'),
      hasPlan: _boolArg(args, 'has_plan'),
      hasEvidence: _boolArg(args, 'has_evidence'),
      hasVerification: _boolArg(args, 'has_verification'),
      hasDraft: _boolArg(args, 'has_draft'),
      hasExport: _boolArg(args, 'has_export'),
    );
    return MobileToolResult.success(
      tool: 'task_ledger',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('task_ledger', args),
      data: ledger.toJson(),
    ).encode();
  }

  String _safetyClassifier(Map<String, Object?> args) {
    final text = args['text']?.toString() ?? '';
    if (text.trim().isEmpty) {
      return MobileToolResult.failure(
        tool: 'safety_classifier',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: 'safety_classifier requires text.',
      ).encode();
    }
    final classification = safetyClassifier.classify(text);
    return MobileToolResult.success(
      tool: 'safety_classifier',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('safety_classifier', {
        'length': text.length,
      }),
      data: classification.toJson(),
    ).encode();
  }

  String _answerVerifier(Map<String, Object?> args) {
    final objective = args['objective']?.toString() ?? '';
    final answer = args['answer']?.toString() ?? '';
    final verification = answerVerifier.verify(
      objective: objective,
      answer: answer,
      sourcesRequired: _boolArg(args, 'sources_required'),
      hasCitations: _boolArg(args, 'has_citations'),
      artifactRequired: _boolArg(args, 'artifact_required'),
      artifactExported: _boolArg(args, 'artifact_exported'),
    );
    return MobileToolResult.success(
      tool: 'answer_verifier',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('answer_verifier', {
        'objectiveLength': objective.length,
        'answerLength': answer.length,
      }),
      data: verification.toJson(),
    ).encode();
  }

  String _calculator(Map<String, Object?> args) {
    final expression = args['expression']?.toString() ?? '';
    if (expression.trim().isEmpty) {
      return MobileToolResult.failure(
        tool: 'calculator',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: 'calculator requires an expression.',
      ).encode();
    }
    try {
      return MobileToolResult.success(
        tool: 'calculator',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        cacheKey: MobileToolCache.key('calculator', {'expression': expression}),
        data: calculator.calculate(expression),
      ).encode();
    } catch (error) {
      return MobileToolResult.failure(
        tool: 'calculator',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: error.toString(),
        data: {'expression': expression},
      ).encode();
    }
  }

  String _tableTool(Map<String, Object?> args) {
    final columns = _stringList(args['columns']);
    final rawRows = args['rows'];
    final rows = <List<String>>[];
    if (rawRows is List) {
      for (final row in rawRows) {
        if (row is List) rows.add(_stringList(row));
      }
    }
    final result = tableTool.buildMarkdownTable(columns: columns, rows: rows);
    return MobileToolResult.success(
      tool: 'table_tool',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('table_tool', {
        'columns': columns,
        'rows': rows.length,
      }),
      data: result,
    ).encode();
  }

  String _citationManager(Map<String, Object?> args) {
    final rawSources = args['sources'];
    final sources = <Map<String, Object?>>[];
    if (rawSources is List) {
      for (final item in rawSources) {
        if (item is Map<String, Object?>) sources.add(item);
      }
    }
    if (sources.isEmpty) {
      return MobileToolResult.failure(
        tool: 'citation_manager',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: 'citation_manager requires a sources array.',
      ).encode();
    }
    final result = citationManager.format(
      style: args['style']?.toString() ?? 'apa',
      sources: sources,
    );
    return MobileToolResult.success(
      tool: 'citation_manager',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('citation_manager', {
        'style': args['style']?.toString() ?? 'apa',
        'sources': sources.length,
      }),
      data: result,
    ).encode();
  }

  bool _boolArg(Map<String, Object?> args, String key) {
    final value = args[key];
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) return value.toLowerCase() == 'true';
    return false;
  }

  List<String> _stringList(Object? value) {
    if (value is! List) return const [];
    return value.map((item) => item.toString()).toList(growable: false);
  }

  bool _isPublicHttpTarget(Uri uri) {
    final host = uri.host.toLowerCase();
    if (host.isEmpty ||
        host == 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local')) {
      return false;
    }
    final ip = InternetAddress.tryParse(host);
    if (ip == null) return true;
    if (ip.isLoopback || ip.isLinkLocal || ip.isMulticast) return false;
    if (ip.type == InternetAddressType.IPv4) {
      final parts = host.split('.').map(int.tryParse).toList();
      if (parts.length != 4 || parts.any((part) => part == null)) return false;
      final a = parts[0]!;
      final b = parts[1]!;
      if (a == 10 || a == 127) return false;
      if (a == 172 && b >= 16 && b <= 31) return false;
      if (a == 192 && b == 168) return false;
      if (a == 169 && b == 254) return false;
      if (a == 100 && b >= 64 && b <= 127) return false;
      if (a == 0) return false;
    } else if (ip.type == InternetAddressType.IPv6) {
      final compact = host.replaceAll(':', '').toLowerCase();
      if (compact.startsWith('fc') || compact.startsWith('fd')) return false;
    }
    return true;
  }

  String? _extractTitle(String body) {
    final match = RegExp(
      r'<title[^>]*>([\s\S]*?)</title>',
      caseSensitive: false,
    ).firstMatch(body);
    if (match == null) return null;
    return match
        .group(1)
        ?.replaceAll(RegExp(r'\s+'), ' ')
        .trim()
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>');
  }

  String _toolSignature(_PendingToolCall call) {
    return '${call.name}:${call.arguments.trim()}';
  }

  String _duplicateToolResult(String tool, String previousResult) {
    return jsonEncode({
      'ok': true,
      'duplicateToolCall': true,
      'tool': tool,
      'message':
          'This exact tool call was already executed in this turn. Use the previous result and provide the final answer instead of calling the tool again.',
      'previousResult': previousResult,
    });
  }

  static String _short(String body) {
    final compact = body.replaceAll(RegExp(r'\s+'), ' ').trim();
    return compact.length > 240 ? '${compact.substring(0, 240)}...' : compact;
  }
}

class _PendingToolCall {
  const _PendingToolCall({
    required this.id,
    required this.providerId,
    required this.name,
    required this.arguments,
  });

  final String id;
  final String providerId;
  final String name;
  final String arguments;
}

class _ExecutedToolCall {
  const _ExecutedToolCall({required this.call, required this.result});

  final _PendingToolCall call;
  final String result;
}

const _mobileToolSchemas = [
  {
    'type': 'function',
    'function': {
      'name': 'task_ledger',
      'description':
          'Create or update a bounded reasoning ledger for multi-step mobile tasks. Use for research, documents, exports, or any task that must not stop at a summary.',
      'parameters': {
        'type': 'object',
        'properties': {
          'objective': {'type': 'string'},
          'requires_research': {'type': 'boolean'},
          'requires_document': {'type': 'boolean'},
          'requires_export': {'type': 'boolean'},
          'has_loaded_skill': {'type': 'boolean'},
          'has_plan': {'type': 'boolean'},
          'has_evidence': {'type': 'boolean'},
          'has_verification': {'type': 'boolean'},
          'has_draft': {'type': 'boolean'},
          'has_export': {'type': 'boolean'},
        },
        'required': ['objective'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'safety_classifier',
      'description':
          'Classify legal, finance, medical, private-data, or safety risk before high-stakes answers. Use locally; it does not send content to Aurict servers.',
      'parameters': {
        'type': 'object',
        'properties': {
          'text': {'type': 'string'},
        },
        'required': ['text'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'answer_verifier',
      'description':
          'Verify a draft answer before finalizing. Checks citations, artifact gates, high-risk caveats, and secret exposure risk.',
      'parameters': {
        'type': 'object',
        'properties': {
          'objective': {'type': 'string'},
          'answer': {'type': 'string'},
          'sources_required': {'type': 'boolean'},
          'has_citations': {'type': 'boolean'},
          'artifact_required': {'type': 'boolean'},
          'artifact_exported': {'type': 'boolean'},
        },
        'required': ['objective', 'answer'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'calculator',
      'description':
          'Deterministically evaluate arithmetic expressions with +, -, *, /, %, ^, and parentheses. Use instead of mental math.',
      'parameters': {
        'type': 'object',
        'properties': {
          'expression': {'type': 'string'},
        },
        'required': ['expression'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'table_tool',
      'description':
          'Create a clean markdown table from columns and rows. Use for structured comparisons, budgets, schedules, and summaries.',
      'parameters': {
        'type': 'object',
        'properties': {
          'columns': {
            'type': 'array',
            'items': {'type': 'string'},
          },
          'rows': {
            'type': 'array',
            'items': {
              'type': 'array',
              'items': {'type': 'string'},
            },
          },
        },
        'required': ['columns', 'rows'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'citation_manager',
      'description':
          'Format source metadata as APA, MLA, Chicago, or Harvard citations and report missing fields.',
      'parameters': {
        'type': 'object',
        'properties': {
          'style': {'type': 'string'},
          'sources': {
            'type': 'array',
            'items': {
              'type': 'object',
              'properties': {
                'author': {'type': 'string'},
                'title': {'type': 'string'},
                'year': {'type': 'string'},
                'url': {'type': 'string'},
              },
            },
          },
        },
        'required': ['sources'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'web_search',
      'description':
          'Search public no-key knowledge APIs from the device. Use for research discovery, then fetch/distill important sources before strong claims. Do not use for private/local targets.',
      'parameters': {
        'type': 'object',
        'properties': {
          'query': {'type': 'string', 'description': 'Research query'},
        },
        'required': ['query'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'web_fetch',
      'description':
          'Fetch one exact public HTTP/HTTPS URL directly from the device. Do not use for search. Do not repeat the same URL; answer from the returned result.',
      'parameters': {
        'type': 'object',
        'properties': {
          'url': {'type': 'string', 'description': 'HTTP or HTTPS URL'},
        },
        'required': ['url'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'web_fetch_plus',
      'description':
          'Fetch one exact public HTTP/HTTPS URL directly from the device with readability extraction, redirect metadata, size limits, and private-network blocking.',
      'parameters': {
        'type': 'object',
        'properties': {
          'url': {'type': 'string', 'description': 'Public HTTP or HTTPS URL'},
        },
        'required': ['url'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'source_distill',
      'description':
          'Turn fetched/user-provided source text into citation-ready claims, evidence snippets, confidence, and limitations. Use before source-backed conclusions.',
      'parameters': {
        'type': 'object',
        'properties': {
          'text': {'type': 'string'},
          'title': {'type': 'string'},
          'url': {'type': 'string'},
          'sources': {
            'type': 'array',
            'items': {
              'type': 'object',
              'properties': {
                'title': {'type': 'string'},
                'url': {'type': 'string'},
                'text': {'type': 'string'},
                'statusCode': {'type': 'integer'},
              },
            },
          },
        },
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'research_outline',
      'description':
          'Create a structured research workflow before writing a research-heavy answer. This is planning only, not final research.',
      'parameters': {
        'type': 'object',
        'properties': {
          'topic': {'type': 'string'},
        },
        'required': ['topic'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'document_reader',
      'description':
          'Read and summarize user-provided document text. It cannot read arbitrary filesystem paths; content must come from the user/file picker.',
      'parameters': {
        'type': 'object',
        'properties': {
          'name': {'type': 'string'},
          'mime_type': {'type': 'string'},
          'content': {'type': 'string'},
        },
        'required': ['content'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'file_intake_policy',
      'description':
          'Explain safe local file intake before reading PDFs, documents, or images. It only allows explicit user-selected content and blocks arbitrary path access.',
      'parameters': {
        'type': 'object',
        'properties': {
          'requested_action': {'type': 'string'},
          'mime_type': {'type': 'string'},
        },
        'required': ['requested_action'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'ocr_read',
      'description':
          'Process OCR text from a user-selected image. The OCR engine must provide recognized_text; this tool does not upload images or access the camera by itself.',
      'parameters': {
        'type': 'object',
        'properties': {
          'name': {'type': 'string'},
          'recognized_text': {'type': 'string'},
          'language_hint': {'type': 'string'},
        },
        'required': ['recognized_text'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'pdf_read',
      'description':
          'Extract readable text from a user-selected PDF provided as base64_pdf. Does not access files by path.',
      'parameters': {
        'type': 'object',
        'properties': {
          'name': {'type': 'string'},
          'base64_pdf': {'type': 'string'},
        },
        'required': ['base64_pdf'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'document_export',
      'description':
          'Render markdown into a local artifact preview such as PDF or markdown. The UI must explicitly save/share before claiming final export completion.',
      'parameters': {
        'type': 'object',
        'properties': {
          'title': {'type': 'string'},
          'markdown': {'type': 'string'},
          'format': {
            'type': 'string',
            'description': 'pdf, markdown, or slides',
          },
        },
        'required': ['title', 'markdown', 'format'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'html_document_create',
      'description':
          'Create a sanitized HTML/CSS document for professional PDF output. Model should provide semantic HTML body and CSS, not markdown.',
      'parameters': {
        'type': 'object',
        'properties': {
          'title': {'type': 'string'},
          'html': {'type': 'string'},
          'css': {'type': 'string'},
          'page_size': {'type': 'string', 'description': 'A4 or Letter'},
          'theme': {
            'type': 'string',
            'description': 'executive, academic, minimal, proposal, report',
          },
        },
        'required': ['title', 'html'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'html_sanitize',
      'description':
          'Validate/sanitize HTML and CSS before rendering. Removes scripts, event handlers, iframes, forms, javascript URLs, and unsafe remote CSS resources.',
      'parameters': {
        'type': 'object',
        'properties': {
          'html': {'type': 'string'},
          'css': {'type': 'string'},
        },
        'required': ['html'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'html_to_pdf',
      'description':
          'Render sanitized HTML/CSS to a local PDF artifact preview. User must still tap Save or Share before claiming phone export completion.',
      'parameters': {
        'type': 'object',
        'properties': {
          'title': {'type': 'string'},
          'html': {'type': 'string'},
          'css': {'type': 'string'},
          'page_size': {'type': 'string'},
          'theme': {'type': 'string'},
          'file_name': {'type': 'string'},
        },
        'required': ['title', 'html'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'artifact_save',
      'description':
          'Request saving a rendered artifact to the phone through the native save/files handler. Requires artifact_id from html_to_pdf.',
      'parameters': {
        'type': 'object',
        'properties': {
          'artifact_id': {'type': 'string'},
        },
        'required': ['artifact_id'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'artifact_share',
      'description':
          'Request sharing a rendered artifact through the native share sheet. Requires artifact_id from html_to_pdf.',
      'parameters': {
        'type': 'object',
        'properties': {
          'artifact_id': {'type': 'string'},
        },
        'required': ['artifact_id'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'create_document_outline',
      'description':
          'Create a document/PDF/slides outline. This does not export a binary file by itself and must not be described as a completed export.',
      'parameters': {
        'type': 'object',
        'properties': {
          'title': {'type': 'string'},
          'format': {'type': 'string'},
        },
        'required': ['title'],
      },
    },
  },
  {
    'type': 'function',
    'function': {
      'name': 'load_mobile_skill',
      'description':
          'Load a mobile skill before specialized work such as reports, resumes, proposals, research, contracts, finance, education, marketing, or code advisory. Do not call repeatedly for the same skill.',
      'parameters': {
        'type': 'object',
        'properties': {
          'skill_id': {
            'type': 'string',
            'description':
                'Exact or close skill ID, e.g. resume-builder, market-researcher, contract-analyzer',
          },
        },
        'required': ['skill_id'],
      },
    },
  },
];

const _mobileToolNames = [
  'task_ledger',
  'safety_classifier',
  'answer_verifier',
  'calculator',
  'table_tool',
  'citation_manager',
  'web_search',
  'web_fetch',
  'web_fetch_plus',
  'source_distill',
  'research_outline',
  'document_reader',
  'file_intake_policy',
  'ocr_read',
  'pdf_read',
  'document_export',
  'html_document_create',
  'html_sanitize',
  'html_to_pdf',
  'artifact_save',
  'artifact_share',
  'create_document_outline',
  'load_mobile_skill',
];

class MobileChatHttpRequest {
  const MobileChatHttpRequest({
    required this.uri,
    required this.headers,
    required this.body,
  });

  final Uri uri;
  final Map<String, String> headers;
  final Map<String, Object?> body;
}
