import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

enum MobileModelProvider {
  openai,
  anthropic,
  google,
  openrouter,
  opencode,
  nvidia,
  zai,
  alibaba,
  mistral,
  groq,
  together,
  fireworks,
  xai,
  perplexity,
  compatible,
}

class MobileProviderConfig {
  const MobileProviderConfig({
    required this.provider,
    required this.name,
    required this.modelsEndpoint,
    this.requiresBetaHeader = false,
    this.supportsModelList = true,
    this.supportsStreamingTools = true,
    this.defaultModels = const [],
  });

  final MobileModelProvider provider;
  final String name;
  final Uri modelsEndpoint;
  final bool requiresBetaHeader;
  final bool supportsModelList;
  final bool supportsStreamingTools;
  final List<String> defaultModels;
}

class MobileModelRequest {
  const MobileModelRequest({required this.uri, required this.headers});

  final Uri uri;
  final Map<String, String> headers;
}

class MobileModelListResult {
  const MobileModelListResult({
    required this.provider,
    required this.models,
    required this.request,
  });

  final MobileModelProvider provider;
  final List<String> models;
  final MobileModelRequest request;
}

class MobileProviderModelService {
  const MobileProviderModelService();

  static final openAI = MobileProviderConfig(
    provider: MobileModelProvider.openai,
    name: 'OpenAI',
    modelsEndpoint: Uri.parse('https://api.openai.com/v1/models'),
  );

  static final anthropic = MobileProviderConfig(
    provider: MobileModelProvider.anthropic,
    name: 'Anthropic',
    modelsEndpoint: Uri.parse('https://api.anthropic.com/v1/models'),
    requiresBetaHeader: true,
  );

  static final google = MobileProviderConfig(
    provider: MobileModelProvider.google,
    name: 'Google',
    modelsEndpoint: Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models',
    ),
  );

  static final openRouter = MobileProviderConfig(
    provider: MobileModelProvider.openrouter,
    name: 'OpenRouter',
    modelsEndpoint: Uri.parse('https://openrouter.ai/api/v1/models'),
  );

  static final openCode = MobileProviderConfig(
    provider: MobileModelProvider.opencode,
    name: 'OpenCode (Zen)',
    modelsEndpoint: Uri.parse('https://opencode.ai/zen/v1/models'),
  );

  static final nvidia = MobileProviderConfig(
    provider: MobileModelProvider.nvidia,
    name: 'NVIDIA NIM',
    modelsEndpoint: Uri.parse('https://integrate.api.nvidia.com/v1/models'),
    defaultModels: [
      'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      'nvidia/nemotron-3-ultra-550b-a55b',
      'deepseek-ai/deepseek-v4-pro',
      'deepseek-ai/deepseek-v4-flash',
      'qwen/qwen3-coder-480b-a35b-instruct',
      'moonshotai/kimi-k2-instruct',
      'z-ai/glm5.1',
      'openai/gpt-oss-120b',
    ],
  );

  static final zai = MobileProviderConfig(
    provider: MobileModelProvider.zai,
    name: 'Z.ai',
    modelsEndpoint: Uri.parse('https://api.z.ai/api/paas/v4/models'),
    defaultModels: [
      'glm-5.2',
      'glm-5.1',
      'glm-5',
      'glm-4.7',
      'glm-4.6',
      'glm-4.5',
      'glm-4.5-air',
      'glm-4.5-flash',
    ],
  );

  static final alibaba = MobileProviderConfig(
    provider: MobileModelProvider.alibaba,
    name: 'Alibaba DashScope',
    modelsEndpoint: Uri.parse(
      'https://dashscope-us.aliyuncs.com/compatible-mode/v1/models',
    ),
    supportsModelList: false,
    supportsStreamingTools: false,
    defaultModels: [
      'qwen-plus',
      'qwen-turbo',
      'qwen-max',
      'qwen-long',
      'qwen-coder-plus',
      'qwen-coder-turbo',
      'qwen3-coder-plus',
      'qwen3-max',
    ],
  );

  static final mistral = MobileProviderConfig(
    provider: MobileModelProvider.mistral,
    name: 'Mistral',
    modelsEndpoint: Uri.parse('https://api.mistral.ai/v1/models'),
  );

  static final groq = MobileProviderConfig(
    provider: MobileModelProvider.groq,
    name: 'Groq',
    modelsEndpoint: Uri.parse('https://api.groq.com/openai/v1/models'),
  );

  static final together = MobileProviderConfig(
    provider: MobileModelProvider.together,
    name: 'Together AI',
    modelsEndpoint: Uri.parse('https://api.together.xyz/v1/models'),
  );

  static final fireworks = MobileProviderConfig(
    provider: MobileModelProvider.fireworks,
    name: 'Fireworks',
    modelsEndpoint: Uri.parse('https://api.fireworks.ai/inference/v1/models'),
  );

  static final xai = MobileProviderConfig(
    provider: MobileModelProvider.xai,
    name: 'xAI',
    modelsEndpoint: Uri.parse('https://api.x.ai/v1/models'),
  );

  static final perplexity = MobileProviderConfig(
    provider: MobileModelProvider.perplexity,
    name: 'Perplexity',
    modelsEndpoint: Uri.parse('https://api.perplexity.ai/models'),
    supportsModelList: false,
    supportsStreamingTools: false,
    defaultModels: [
      'sonar',
      'sonar-pro',
      'sonar-reasoning',
      'sonar-reasoning-pro',
      'sonar-deep-research',
    ],
  );

  static MobileProviderConfig compatible({required Uri baseUrl}) {
    final normalized = baseUrl.path.endsWith('/models')
        ? baseUrl
        : baseUrl.replace(
            path: [
              baseUrl.path.replaceAll(RegExp(r'/+$'), ''),
              'models',
            ].where((part) => part.isNotEmpty).join('/'),
          );
    return MobileProviderConfig(
      provider: MobileModelProvider.compatible,
      name: 'OpenAI-compatible',
      modelsEndpoint: normalized,
    );
  }

  static MobileProviderConfig configForName(String provider) {
    return switch (provider.toLowerCase()) {
      'openai' => openAI,
      'anthropic' => anthropic,
      'google' => google,
      'openrouter' => openRouter,
      'opencode' => openCode,
      'opencode (zen)' => openCode,
      'nvidia' => nvidia,
      'nvidia nim' => nvidia,
      'z.ai' => zai,
      'zai' => zai,
      'zhipu' => zai,
      'alibaba' => alibaba,
      'alibaba dashscope' => alibaba,
      'dashscope' => alibaba,
      'mistral' => mistral,
      'groq' => groq,
      'together' => together,
      'together ai' => together,
      'fireworks' => fireworks,
      'xai' => xai,
      'x.ai' => xai,
      'perplexity' => perplexity,
      _ => openRouter,
    };
  }

  MobileModelRequest buildRequest(MobileProviderConfig config, String apiKey) {
    final headers = <String, String>{
      HttpHeaders.acceptHeader: 'application/json',
      if (config.provider != MobileModelProvider.google)
        HttpHeaders.authorizationHeader: 'Bearer $apiKey',
      if (config.provider == MobileModelProvider.anthropic)
        'anthropic-version': '2023-06-01',
      if (config.provider == MobileModelProvider.openrouter)
        'HTTP-Referer': 'https://aurict.dev',
      if (config.provider == MobileModelProvider.openrouter)
        'X-Title': 'Aurict Mobile',
    };
    final uri = config.provider == MobileModelProvider.google
        ? config.modelsEndpoint.replace(queryParameters: {'key': apiKey})
        : config.modelsEndpoint;
    return MobileModelRequest(uri: uri, headers: headers);
  }

  Future<MobileModelListResult> fetchModels({
    required MobileProviderConfig config,
    required String apiKey,
  }) async {
    final request = buildRequest(config, apiKey);
    if (!config.supportsModelList) {
      return MobileModelListResult(
        provider: config.provider,
        models: config.defaultModels,
        request: request,
      );
    }
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 15)
      ..userAgent = 'AurictMobile/1.0 model-list';
    try {
      final httpRequest = await client.getUrl(request.uri);
      request.headers.forEach(httpRequest.headers.set);
      final response = await httpRequest.close();
      final body = await response.transform(utf8.decoder).join();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (config.defaultModels.isNotEmpty) {
          return MobileModelListResult(
            provider: config.provider,
            models: config.defaultModels,
            request: request,
          );
        }
        throw HttpException(
          'Model list request failed with HTTP ${response.statusCode}',
          uri: request.uri,
        );
      }
      final parsedModels = await compute(parseMobileModelListResponse, {
        'provider': config.provider.index,
        'body': body,
      });
      return MobileModelListResult(
        provider: config.provider,
        models: parsedModels.isEmpty && config.defaultModels.isNotEmpty
            ? config.defaultModels
            : parsedModels,
        request: request,
      );
    } finally {
      client.close(force: true);
    }
  }

  List<String> parseModels(MobileModelProvider provider, Object? jsonBody) {
    if (jsonBody is! Map<String, Object?>) return const [];
    final data = jsonBody['data'] ?? jsonBody['models'];
    if (data is List) {
      return data
          .map((item) {
            if (item is String) return item;
            if (item is Map<String, Object?>) {
              return (item['id'] ?? item['name'])?.toString();
            }
            return null;
          })
          .whereType<String>()
          .where((id) => id.isNotEmpty)
          .toList(growable: false);
    }
    return const [];
  }
}

List<String> parseMobileModelListResponse(Map<String, Object?> payload) {
  final providerIndex = payload['provider'];
  final body = payload['body'];
  if (providerIndex is! int || body is! String) return const [];
  final provider = MobileModelProvider.values[providerIndex];
  final jsonBody = jsonDecode(body);
  return const MobileProviderModelService().parseModels(provider, jsonBody);
}
