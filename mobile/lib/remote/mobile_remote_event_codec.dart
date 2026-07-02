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
    final payload = json['payload'];
    return MobileRemoteEvent(
      sessionId: json['sessionId']?.toString() ?? '',
      seq: int.tryParse(json['seq']?.toString() ?? '') ?? 0,
      timestamp:
          DateTime.tryParse(json['timestamp']?.toString() ?? '') ??
          DateTime.now(),
      senderDeviceId: json['senderDeviceId']?.toString() ?? '',
      type: json['type']?.toString() ?? MobileRemoteEventTypes.error,
      payload: payload is Map
          ? Map<String, Object?>.from(payload)
          : <String, Object?>{},
      signature: json['signature']?.toString() ?? '',
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
