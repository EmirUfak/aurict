import 'dart:io';

import 'mobile_provider_models.dart';

enum MobileChatStreamProtocol { openAiCompatible, anthropic, google }

class MobileChatHttpRequest {
  const MobileChatHttpRequest({
    required this.uri,
    required this.headers,
    required this.body,
    required this.protocol,
    required this.supportsToolLoop,
  });

  final Uri uri;
  final Map<String, String> headers;
  final Map<String, Object?> body;
  final MobileChatStreamProtocol protocol;
  final bool supportsToolLoop;
}

class MobileChatProviderAdapter {
  const MobileChatProviderAdapter({
    this.modelService = const MobileProviderModelService(),
  });

  final MobileProviderModelService modelService;

  MobileChatHttpRequest build({
    required MobileProviderConfig config,
    required String apiKey,
    required String model,
    required List<Map<String, Object?>> conversation,
    required List<Map<String, Object?>> toolSchemas,
    required bool includeTools,
  }) {
    return switch (config.provider) {
      MobileModelProvider.anthropic => _buildAnthropic(
        config: config,
        apiKey: apiKey,
        model: model,
        conversation: conversation,
      ),
      MobileModelProvider.google => _buildGoogle(
        config: config,
        apiKey: apiKey,
        model: model,
        conversation: conversation,
      ),
      _ => _buildOpenAiCompatible(
        config: config,
        apiKey: apiKey,
        model: model,
        conversation: conversation,
        toolSchemas: toolSchemas,
        includeTools: includeTools,
      ),
    };
  }

  bool supportsChat(MobileProviderConfig config) {
    return switch (config.provider) {
      MobileModelProvider.openai ||
      MobileModelProvider.openrouter ||
      MobileModelProvider.opencode ||
      MobileModelProvider.nvidia ||
      MobileModelProvider.zai ||
      MobileModelProvider.alibaba ||
      MobileModelProvider.mistral ||
      MobileModelProvider.groq ||
      MobileModelProvider.together ||
      MobileModelProvider.fireworks ||
      MobileModelProvider.xai ||
      MobileModelProvider.perplexity ||
      MobileModelProvider.compatible ||
      MobileModelProvider.anthropic ||
      MobileModelProvider.google => true,
    };
  }

  MobileChatHttpRequest _buildOpenAiCompatible({
    required MobileProviderConfig config,
    required String apiKey,
    required String model,
    required List<Map<String, Object?>> conversation,
    required List<Map<String, Object?>> toolSchemas,
    required bool includeTools,
  }) {
    final modelRequest = modelService.buildRequest(config, apiKey);
    final uri = _chatCompletionsUri(config.modelsEndpoint);
    return MobileChatHttpRequest(
      uri: uri,
      headers: {
        ...modelRequest.headers,
        HttpHeaders.acceptHeader: 'text/event-stream',
      },
      protocol: MobileChatStreamProtocol.openAiCompatible,
      supportsToolLoop: true,
      body: {
        'model': model,
        'stream': true,
        'messages': conversation,
        if (includeTools && toolSchemas.isNotEmpty) 'tools': toolSchemas,
        if (includeTools && toolSchemas.isNotEmpty) 'tool_choice': 'auto',
      },
    );
  }

  MobileChatHttpRequest _buildAnthropic({
    required MobileProviderConfig config,
    required String apiKey,
    required String model,
    required List<Map<String, Object?>> conversation,
  }) {
    final system = _systemText(conversation);
    return MobileChatHttpRequest(
      uri: Uri.parse('https://api.anthropic.com/v1/messages'),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        HttpHeaders.acceptHeader: 'text/event-stream',
      },
      protocol: MobileChatStreamProtocol.anthropic,
      supportsToolLoop: false,
      body: {
        'model': model,
        'max_tokens': 4096,
        'stream': true,
        if (system.isNotEmpty) 'system': system,
        'messages': _anthropicMessages(conversation),
      },
    );
  }

  MobileChatHttpRequest _buildGoogle({
    required MobileProviderConfig config,
    required String apiKey,
    required String model,
    required List<Map<String, Object?>> conversation,
  }) {
    final normalizedModel = model.startsWith('models/')
        ? model
        : 'models/$model';
    final uri = config.modelsEndpoint.replace(
      path: '/v1beta/$normalizedModel:streamGenerateContent',
      queryParameters: {'alt': 'sse', 'key': apiKey},
    );
    final system = _systemText(conversation);
    return MobileChatHttpRequest(
      uri: uri,
      headers: {HttpHeaders.acceptHeader: 'text/event-stream'},
      protocol: MobileChatStreamProtocol.google,
      supportsToolLoop: false,
      body: {
        if (system.isNotEmpty)
          'systemInstruction': {
            'parts': [
              {'text': system},
            ],
          },
        'contents': _googleContents(conversation),
      },
    );
  }

  Uri _chatCompletionsUri(Uri modelsEndpoint) {
    final path = modelsEndpoint.path.replaceFirst(
      RegExp(r'/models/?$'),
      '/chat/completions',
    );
    return modelsEndpoint.replace(path: path);
  }

  String _systemText(List<Map<String, Object?>> conversation) {
    final first = conversation.isEmpty ? null : conversation.first;
    if (first?['role'] != 'system') return '';
    return first?['content']?.toString() ?? '';
  }

  List<Map<String, Object?>> _anthropicMessages(
    List<Map<String, Object?>> conversation,
  ) {
    return conversation
        .where((message) => message['role'] != 'system')
        .map((message) {
          final role = message['role'] == 'assistant' ? 'assistant' : 'user';
          return {'role': role, 'content': _messageText(message)};
        })
        .where((message) => (message['content'] as String).trim().isNotEmpty)
        .toList(growable: false);
  }

  List<Map<String, Object?>> _googleContents(
    List<Map<String, Object?>> conversation,
  ) {
    return conversation
        .where((message) => message['role'] != 'system')
        .map((message) {
          final role = message['role'] == 'assistant' ? 'model' : 'user';
          return {
            'role': role,
            'parts': [
              {'text': _messageText(message)},
            ],
          };
        })
        .where((message) {
          final parts = message['parts'];
          if (parts is! List || parts.isEmpty) return false;
          final first = parts.first;
          return first is Map && first['text'].toString().trim().isNotEmpty;
        })
        .toList(growable: false);
  }

  String _messageText(Map<String, Object?> message) {
    final content = message['content'];
    if (content is String) return content;
    final toolCalls = message['tool_calls'];
    if (toolCalls is List && toolCalls.isNotEmpty) {
      return '[Aurict mobile tool request omitted for this provider adapter.]';
    }
    if (message['role'] == 'tool') {
      return '[Tool result ${message['tool_call_id'] ?? ''}]\n${content ?? ''}';
    }
    return content?.toString() ?? '';
  }
}
