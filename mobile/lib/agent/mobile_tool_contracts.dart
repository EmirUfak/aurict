import 'dart:convert';

enum MobileToolRisk { low, network, document, generatedArtifact }

class MobileToolPolicyNote {
  const MobileToolPolicyNote({
    required this.localFirst,
    required this.networkUsed,
    required this.userProvidedContentOnly,
    required this.note,
  });

  final bool localFirst;
  final bool networkUsed;
  final bool userProvidedContentOnly;
  final String note;

  Map<String, Object?> toJson() => {
    'localFirst': localFirst,
    'networkUsed': networkUsed,
    'userProvidedContentOnly': userProvidedContentOnly,
    'note': note,
  };
}

class MobileToolResult {
  const MobileToolResult({
    required this.tool,
    required this.ok,
    required this.risk,
    required this.policy,
    this.data = const {},
    this.error,
    this.cacheKey,
  });

  final String tool;
  final bool ok;
  final MobileToolRisk risk;
  final MobileToolPolicyNote policy;
  final Map<String, Object?> data;
  final String? error;
  final String? cacheKey;

  String encode() {
    return jsonEncode({
      'ok': ok,
      'tool': tool,
      'risk': risk.name,
      if (cacheKey != null) 'cacheKey': cacheKey,
      'policy': policy.toJson(),
      if (error != null) 'error': error,
      ...data,
    });
  }

  static MobileToolResult success({
    required String tool,
    required MobileToolRisk risk,
    required MobileToolPolicyNote policy,
    required Map<String, Object?> data,
    String? cacheKey,
  }) {
    return MobileToolResult(
      tool: tool,
      ok: true,
      risk: risk,
      policy: policy,
      data: data,
      cacheKey: cacheKey,
    );
  }

  static MobileToolResult failure({
    required String tool,
    required MobileToolRisk risk,
    required MobileToolPolicyNote policy,
    required String error,
    Map<String, Object?> data = const {},
    String? cacheKey,
  }) {
    return MobileToolResult(
      tool: tool,
      ok: false,
      risk: risk,
      policy: policy,
      error: error,
      data: data,
      cacheKey: cacheKey,
    );
  }
}

class MobileToolCache {
  const MobileToolCache();

  static String key(String tool, Map<String, Object?> args) {
    final sorted = Map.fromEntries(
      args.entries.toList()..sort((a, b) => a.key.compareTo(b.key)),
    );
    return '$tool:${jsonEncode(sorted)}';
  }
}

const mobileLocalPolicy = MobileToolPolicyNote(
  localFirst: true,
  networkUsed: false,
  userProvidedContentOnly: true,
  note:
      'Processed locally on device from user-provided content. No Aurict server is involved.',
);

const mobilePublicNetworkPolicy = MobileToolPolicyNote(
  localFirst: true,
  networkUsed: true,
  userProvidedContentOnly: false,
  note:
      'Uses public HTTP/HTTPS resources directly from the device. Private/local network targets are blocked.',
);
