class MobileRemoteProtocol {
  const MobileRemoteProtocol({
    required this.version,
    required this.backendCarriesPayload,
    required this.eventTypes,
  });

  final int version;
  final bool backendCarriesPayload;
  final List<String> eventTypes;

  factory MobileRemoteProtocol.fromJson(Map<String, dynamic> json) {
    return MobileRemoteProtocol(
      version: int.tryParse(json['version']?.toString() ?? '') ?? 1,
      backendCarriesPayload: json['backendCarriesPayload'] == true,
      eventTypes: [
        for (final item in (json['eventTypes'] as List? ?? const []))
          item.toString(),
      ],
    );
  }
}

class MobileRemoteSession {
  const MobileRemoteSession({
    required this.id,
    required this.desktopDeviceId,
    required this.protocolVersion,
    required this.status,
    required this.connectionMode,
    required this.signedOffer,
    required this.lastSequence,
    required this.maxIdleSeconds,
    required this.expiresAt,
    required this.lastHeartbeatAt,
    this.acceptedByDeviceId,
    this.signedAnswer,
    this.resumeAvailable = false,
  });

  final String id;
  final String desktopDeviceId;
  final int protocolVersion;
  final String status;
  final String connectionMode;
  final MobileSignalEnvelope signedOffer;
  final String? acceptedByDeviceId;
  final MobileSignalEnvelope? signedAnswer;
  final bool resumeAvailable;
  final int lastSequence;
  final int maxIdleSeconds;
  final DateTime expiresAt;
  final DateTime lastHeartbeatAt;

  factory MobileRemoteSession.fromJson(Map<String, dynamic> json) {
    return MobileRemoteSession(
      id: json['id'].toString(),
      desktopDeviceId: json['desktopDeviceId'].toString(),
      protocolVersion:
          int.tryParse(json['protocolVersion']?.toString() ?? '') ?? 1,
      status: json['status']?.toString() ?? 'unknown',
      connectionMode: json['connectionMode']?.toString() ?? 'webrtc',
      signedOffer: MobileSignalEnvelope.fromJson(
        json['signedOffer'] as Map<String, dynamic>,
      ),
      acceptedByDeviceId: json['acceptedByDeviceId']?.toString(),
      signedAnswer: json['signedAnswer'] is Map<String, dynamic>
          ? MobileSignalEnvelope.fromJson(
              json['signedAnswer'] as Map<String, dynamic>,
            )
          : null,
      resumeAvailable: json['resumeAvailable'] == true,
      lastSequence: int.tryParse(json['lastSequence']?.toString() ?? '') ?? 0,
      maxIdleSeconds:
          int.tryParse(json['maxIdleSeconds']?.toString() ?? '') ?? 90,
      expiresAt:
          DateTime.tryParse(json['expiresAt']?.toString() ?? '') ??
          DateTime.now(),
      lastHeartbeatAt:
          DateTime.tryParse(json['lastHeartbeatAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class MobileSignalEnvelope {
  const MobileSignalEnvelope({
    required this.version,
    required this.type,
    required this.transport,
    required this.payload,
    required this.signingKeyFingerprint,
    required this.signature,
    this.sessionProtocolVersion = 1,
  });

  final int version;
  final int sessionProtocolVersion;
  final String type;
  final String transport;
  final String payload;
  final String signingKeyFingerprint;
  final String signature;

  factory MobileSignalEnvelope.fromJson(Map<String, dynamic> json) {
    return MobileSignalEnvelope(
      version: int.tryParse(json['version']?.toString() ?? '') ?? 1,
      sessionProtocolVersion:
          int.tryParse(json['sessionProtocolVersion']?.toString() ?? '') ?? 1,
      type: json['type']?.toString() ?? 'offer',
      transport: json['transport']?.toString() ?? 'webrtc',
      payload: json['payload']?.toString() ?? '',
      signingKeyFingerprint: json['signingKeyFingerprint']?.toString() ?? '',
      signature: json['signature']?.toString() ?? '',
    );
  }

  Map<String, Object?> toJson() {
    return {
      'version': version,
      'sessionProtocolVersion': sessionProtocolVersion,
      'type': type,
      'transport': transport,
      'payload': payload,
      'signingKeyFingerprint': signingKeyFingerprint,
      'signature': signature,
    };
  }
}

class MobileTurnCredential {
  const MobileTurnCredential({
    required this.urls,
    required this.username,
    required this.credential,
    required this.expiresAt,
  });

  final List<String> urls;
  final String username;
  final String credential;
  final DateTime expiresAt;

  factory MobileTurnCredential.fromJson(Map<String, dynamic> json) {
    return MobileTurnCredential(
      urls: [
        for (final item in (json['urls'] as List? ?? const [])) item.toString(),
      ],
      username: json['username']?.toString() ?? '',
      credential: json['credential']?.toString() ?? '',
      expiresAt:
          DateTime.tryParse(json['expiresAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}
