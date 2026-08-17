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
    final version = json['version'];
    if (version is! int || version != 1) {
      throw const FormatException(
        'MobileRemoteProtocol: version must be integer 1',
      );
    }

    final backendCarriesPayload = json['backendCarriesPayload'];
    if (backendCarriesPayload is! bool) {
      throw const FormatException(
        'MobileRemoteProtocol: backendCarriesPayload must be a boolean',
      );
    }
    if (backendCarriesPayload) {
      throw const FormatException(
        'MobileRemoteProtocol: backendCarriesPayload must be false for P2P data plane',
      );
    }

    final rawEventTypes = json['eventTypes'];
    if (rawEventTypes is! List || rawEventTypes.isEmpty) {
      throw const FormatException(
        'MobileRemoteProtocol: eventTypes must be a non-empty list',
      );
    }

    final eventTypes = <String>[];
    for (final item in rawEventTypes) {
      if (item is! String || item.trim().isEmpty) {
        throw const FormatException(
          'MobileRemoteProtocol: eventTypes items must be non-empty strings',
        );
      }
      eventTypes.add(item);
    }

    return MobileRemoteProtocol(
      version: version,
      backendCarriesPayload: backendCarriesPayload,
      eventTypes: List<String>.unmodifiable(eventTypes),
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
    final id = json['id'];
    if (id is! String || id.trim().isEmpty) {
      throw const FormatException('MobileRemoteSession: missing or empty id');
    }

    final desktopDeviceId = json['desktopDeviceId'];
    if (desktopDeviceId is! String || desktopDeviceId.trim().isEmpty) {
      throw const FormatException(
        'MobileRemoteSession: missing or empty desktopDeviceId',
      );
    }

    final protocolVersion = json['protocolVersion'];
    if (protocolVersion is! int || protocolVersion != 1) {
      throw const FormatException(
        'MobileRemoteSession: protocolVersion must be integer 1',
      );
    }

    final status = json['status'];
    if (status is! String || status.trim().isEmpty) {
      throw const FormatException(
        'MobileRemoteSession: missing or empty status',
      );
    }

    final connectionMode = json['connectionMode'];
    if (connectionMode is! String || connectionMode != 'webrtc') {
      throw const FormatException(
        'MobileRemoteSession: connectionMode must be "webrtc"',
      );
    }

    final rawSignedOffer = json['signedOffer'];
    if (rawSignedOffer is! Map<String, dynamic>) {
      throw const FormatException(
        'MobileRemoteSession: missing or invalid signedOffer Map',
      );
    }
    final signedOffer = MobileSignalEnvelope.fromJson(rawSignedOffer);
    if (signedOffer.type != 'offer') {
      throw const FormatException(
        'MobileRemoteSession: signedOffer type must be "offer"',
      );
    }

    String? acceptedByDeviceId;
    final rawAcceptedByDeviceId = json['acceptedByDeviceId'];
    if (rawAcceptedByDeviceId != null) {
      if (rawAcceptedByDeviceId is! String ||
          rawAcceptedByDeviceId.trim().isEmpty) {
        throw const FormatException(
          'MobileRemoteSession: acceptedByDeviceId must be a non-empty string when present',
        );
      }
      acceptedByDeviceId = rawAcceptedByDeviceId;
    }

    MobileSignalEnvelope? signedAnswer;
    final rawSignedAnswer = json['signedAnswer'];
    if (rawSignedAnswer != null) {
      if (rawSignedAnswer is! Map<String, dynamic>) {
        throw const FormatException(
          'MobileRemoteSession: signedAnswer must be a Map when present',
        );
      }
      signedAnswer = MobileSignalEnvelope.fromJson(rawSignedAnswer);
      if (signedAnswer.type != 'answer') {
        throw const FormatException(
          'MobileRemoteSession: signedAnswer type must be "answer"',
        );
      }
    }

    final rawResumeAvailable = json['resumeAvailable'];
    final bool resumeAvailable;
    if (rawResumeAvailable != null) {
      if (rawResumeAvailable is! bool) {
        throw const FormatException(
          'MobileRemoteSession: resumeAvailable must be a boolean when present',
        );
      }
      resumeAvailable = rawResumeAvailable;
    } else {
      resumeAvailable = false;
    }

    final lastSequence = json['lastSequence'];
    if (lastSequence is! int || lastSequence < 0) {
      throw const FormatException(
        'MobileRemoteSession: lastSequence must be a non-negative integer',
      );
    }

    final maxIdleSeconds = json['maxIdleSeconds'];
    if (maxIdleSeconds is! int || maxIdleSeconds <= 0) {
      throw const FormatException(
        'MobileRemoteSession: maxIdleSeconds must be a positive integer',
      );
    }

    final rawExpiresAt = json['expiresAt'];
    if (rawExpiresAt is! String) {
      throw const FormatException(
        'MobileRemoteSession: missing expiresAt timestamp string',
      );
    }
    final trimmedExpiresAt = rawExpiresAt.trim();
    if (!RegExp(r'(?:Z|[+-]\d{2}(?::?\d{2})?)$').hasMatch(trimmedExpiresAt)) {
      throw const FormatException(
        'MobileRemoteSession: expiresAt must include explicit timezone',
      );
    }
    final expiresAt = DateTime.tryParse(trimmedExpiresAt);
    if (expiresAt == null) {
      throw const FormatException(
        'MobileRemoteSession: invalid expiresAt timestamp',
      );
    }

    final rawLastHeartbeatAt = json['lastHeartbeatAt'];
    if (rawLastHeartbeatAt is! String) {
      throw const FormatException(
        'MobileRemoteSession: missing lastHeartbeatAt timestamp string',
      );
    }
    final trimmedLastHeartbeatAt = rawLastHeartbeatAt.trim();
    if (!RegExp(
      r'(?:Z|[+-]\d{2}(?::?\d{2})?)$',
    ).hasMatch(trimmedLastHeartbeatAt)) {
      throw const FormatException(
        'MobileRemoteSession: lastHeartbeatAt must include explicit timezone',
      );
    }
    final lastHeartbeatAt = DateTime.tryParse(trimmedLastHeartbeatAt);
    if (lastHeartbeatAt == null) {
      throw const FormatException(
        'MobileRemoteSession: invalid lastHeartbeatAt timestamp',
      );
    }

    return MobileRemoteSession(
      id: id,
      desktopDeviceId: desktopDeviceId,
      protocolVersion: protocolVersion,
      status: status,
      connectionMode: connectionMode,
      signedOffer: signedOffer,
      acceptedByDeviceId: acceptedByDeviceId,
      signedAnswer: signedAnswer,
      resumeAvailable: resumeAvailable,
      lastSequence: lastSequence,
      maxIdleSeconds: maxIdleSeconds,
      expiresAt: expiresAt,
      lastHeartbeatAt: lastHeartbeatAt,
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
    final version = json['version'];
    if (version is! int || version != 1) {
      throw const FormatException(
        'MobileSignalEnvelope: version must be integer 1',
      );
    }

    final sessionProtocolVersion = json['sessionProtocolVersion'];
    if (sessionProtocolVersion is! int || sessionProtocolVersion != 1) {
      throw const FormatException(
        'MobileSignalEnvelope: sessionProtocolVersion must be integer 1',
      );
    }

    final type = json['type'];
    if (type is! String || (type != 'offer' && type != 'answer')) {
      throw const FormatException(
        'MobileSignalEnvelope: type must be "offer" or "answer"',
      );
    }

    final transport = json['transport'];
    if (transport is! String || transport != 'webrtc') {
      throw const FormatException(
        'MobileSignalEnvelope: transport must be "webrtc"',
      );
    }

    final payload = json['payload'];
    if (payload is! String || payload.trim().isEmpty) {
      throw const FormatException(
        'MobileSignalEnvelope: payload must be a non-empty string',
      );
    }

    final signingKeyFingerprint = json['signingKeyFingerprint'];
    if (signingKeyFingerprint is! String ||
        signingKeyFingerprint.trim().isEmpty) {
      throw const FormatException(
        'MobileSignalEnvelope: missing or empty signingKeyFingerprint',
      );
    }

    final signature = json['signature'];
    if (signature is! String || signature.trim().isEmpty) {
      throw const FormatException(
        'MobileSignalEnvelope: missing or empty signature',
      );
    }

    return MobileSignalEnvelope(
      version: version,
      sessionProtocolVersion: sessionProtocolVersion,
      type: type,
      transport: transport,
      payload: payload,
      signingKeyFingerprint: signingKeyFingerprint,
      signature: signature,
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
    final rawUrls = json['urls'];
    if (rawUrls is! List || rawUrls.isEmpty) {
      throw const FormatException(
        'MobileTurnCredential: urls must be a non-empty list',
      );
    }

    final urls = <String>[];
    for (final item in rawUrls) {
      if (item is! String || item.trim().isEmpty) {
        throw const FormatException(
          'MobileTurnCredential: url items must be non-empty strings',
        );
      }
      urls.add(item);
    }

    final username = json['username'];
    if (username is! String || username.trim().isEmpty) {
      throw const FormatException(
        'MobileTurnCredential: missing or empty username',
      );
    }

    final credential = json['credential'];
    if (credential is! String || credential.trim().isEmpty) {
      throw const FormatException(
        'MobileTurnCredential: missing or empty credential',
      );
    }

    final rawExpiresAt = json['expiresAt'];
    if (rawExpiresAt is! String) {
      throw const FormatException(
        'MobileTurnCredential: missing expiresAt timestamp string',
      );
    }
    final trimmedExpiresAt = rawExpiresAt.trim();
    if (!RegExp(r'(?:Z|[+-]\d{2}(?::?\d{2})?)$').hasMatch(trimmedExpiresAt)) {
      throw const FormatException(
        'MobileTurnCredential: expiresAt must include explicit timezone',
      );
    }
    final expiresAt = DateTime.tryParse(trimmedExpiresAt);
    if (expiresAt == null) {
      throw const FormatException(
        'MobileTurnCredential: invalid expiresAt timestamp',
      );
    }

    return MobileTurnCredential(
      urls: List<String>.unmodifiable(urls),
      username: username,
      credential: credential,
      expiresAt: expiresAt,
    );
  }
}
