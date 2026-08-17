import 'dart:convert';

class MobileRemoteEventTypes {
  const MobileRemoteEventTypes._();

  static const promptSubmit = 'prompt.submit';
  static const terminalOutput = 'terminal.output';
  static const agentStatus = 'agent.status';
  static const toolCall = 'tool.call';
  static const toolResultSummary = 'tool.result.summary';
  static const interrupt = 'interrupt';
  static const resume = 'resume';
  static const heartbeat = 'heartbeat';
  static const close = 'close';
  static const error = 'error';
}

class MobileRemoteEvent {
  const MobileRemoteEvent({
    required this.sessionId,
    required this.seq,
    required this.timestamp,
    required this.senderDeviceId,
    required this.type,
    required this.payload,
    required this.signature,
  });

  final String sessionId;
  final int seq;
  final DateTime timestamp;
  final String senderDeviceId;
  final String type;
  final Map<String, Object?> payload;
  final String signature;

  String signingPayload() {
    return jsonEncode({
      'sessionId': sessionId,
      'seq': seq,
      'timestamp': timestamp.toUtc().toIso8601String(),
      'senderDeviceId': senderDeviceId,
      'type': type,
      'payload': payload,
    });
  }

  Map<String, Object?> toJson() {
    return {
      'sessionId': sessionId,
      'seq': seq,
      'timestamp': timestamp.toUtc().toIso8601String(),
      'senderDeviceId': senderDeviceId,
      'type': type,
      'payload': payload,
      'signature': signature,
    };
  }

  factory MobileRemoteEvent.fromJson(Map<String, dynamic> json) {
    final sessionId = json['sessionId'];
    if (sessionId is! String || sessionId.trim().isEmpty) {
      throw const FormatException(
        'MobileRemoteEvent: missing or empty sessionId',
      );
    }

    final seq = json['seq'];
    if (seq is! int || seq < 1) {
      throw const FormatException(
        'MobileRemoteEvent: seq must be a positive integer (>= 1)',
      );
    }

    final rawTimestamp = json['timestamp'];
    if (rawTimestamp is! String) {
      throw const FormatException(
        'MobileRemoteEvent: missing timestamp string',
      );
    }
    final trimmedTimestamp = rawTimestamp.trim();
    final hasTimezone = RegExp(
      r'(?:Z|[+-]\d{2}(?::?\d{2})?)$',
    ).hasMatch(trimmedTimestamp);
    if (!hasTimezone) {
      throw const FormatException(
        'MobileRemoteEvent: timestamp must include explicit timezone',
      );
    }
    final timestamp = DateTime.tryParse(trimmedTimestamp);
    if (timestamp == null) {
      throw const FormatException(
        'MobileRemoteEvent: invalid ISO-8601 timestamp',
      );
    }

    final senderDeviceId = json['senderDeviceId'];
    if (senderDeviceId is! String || senderDeviceId.trim().isEmpty) {
      throw const FormatException(
        'MobileRemoteEvent: missing or empty senderDeviceId',
      );
    }

    final type = json['type'];
    if (type is! String || type.trim().isEmpty) {
      throw const FormatException('MobileRemoteEvent: missing or empty type');
    }

    final payload = json['payload'];
    if (payload is! Map) {
      throw const FormatException(
        'MobileRemoteEvent: missing or invalid payload Map',
      );
    }

    final signature = json['signature'];
    if (signature is! String || signature.trim().isEmpty) {
      throw const FormatException(
        'MobileRemoteEvent: missing or empty signature',
      );
    }

    return MobileRemoteEvent(
      sessionId: sessionId,
      seq: seq,
      timestamp: timestamp,
      senderDeviceId: senderDeviceId,
      type: type,
      payload: Map<String, Object?>.from(payload),
      signature: signature,
    );
  }
}

class MobileRemoteEventLedger {
  var _outgoingSeq = 0;
  var _incomingSeq = 0;

  int get outgoingSeq => _outgoingSeq;
  int get incomingSeq => _incomingSeq;
  int get lastSequence =>
      _outgoingSeq > _incomingSeq ? _outgoingSeq : _incomingSeq;

  Future<MobileRemoteEvent> createSigned({
    required String sessionId,
    required String senderDeviceId,
    required String type,
    required Map<String, Object?> payload,
    required Future<String> Function(String payload) sign,
  }) async {
    final nextSeq = _outgoingSeq + 1;
    final unsigned = MobileRemoteEvent(
      sessionId: sessionId,
      seq: nextSeq,
      timestamp: DateTime.now().toUtc(),
      senderDeviceId: senderDeviceId,
      type: type,
      payload: payload,
      signature: '',
    );
    final signature = await sign(unsigned.signingPayload());
    _outgoingSeq = nextSeq;
    return MobileRemoteEvent(
      sessionId: unsigned.sessionId,
      seq: unsigned.seq,
      timestamp: unsigned.timestamp,
      senderDeviceId: unsigned.senderDeviceId,
      type: unsigned.type,
      payload: unsigned.payload,
      signature: signature,
    );
  }

  bool acceptIncoming(MobileRemoteEvent event) {
    if (event.seq <= _incomingSeq) return false;
    _incomingSeq = event.seq;
    return true;
  }

  void restore({int? outgoingSeq, int? incomingSeq}) {
    _outgoingSeq = outgoingSeq ?? _outgoingSeq;
    _incomingSeq = incomingSeq ?? _incomingSeq;
  }
}
