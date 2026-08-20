import 'dart:convert';

import 'package:aurict_mobile/remote/mobile_remote_event_codec.dart';

const syntheticTestSessionId = 'session-test-001';
const syntheticTestDeviceId = 'device-test-mobile-001';
const syntheticTestSignature = 'synthetic-test-signature';
final syntheticTestTimestampUtc = DateTime.parse('2026-08-17T10:00:00.000Z');

/// Creates a synthetic, contract-compliant [MobileRemoteEvent] for testing.
///
/// Uses fixed UTC timestamps and explicit synthetic values compliant with the
/// MOB-RC-01 event contract.
MobileRemoteEvent createTestRemoteEvent({
  String sessionId = syntheticTestSessionId,
  int seq = 1,
  DateTime? timestamp,
  String senderDeviceId = syntheticTestDeviceId,
  String type = MobileRemoteEventTypes.promptSubmit,
  Map<String, Object?> payload = const {'prompt': 'synthetic test prompt'},
  String signature = syntheticTestSignature,
}) {
  return MobileRemoteEvent(
    sessionId: sessionId,
    seq: seq,
    timestamp: timestamp ?? syntheticTestTimestampUtc,
    senderDeviceId: senderDeviceId,
    type: type,
    payload: payload,
    signature: signature,
  );
}

/// Returns the serialized JSON map of a synthetic [MobileRemoteEvent].
///
/// Derived directly from [createTestRemoteEvent] to ensure single-source-of-truth.
Map<String, Object?> createTestRemoteEventJson({
  String sessionId = syntheticTestSessionId,
  int seq = 1,
  DateTime? timestamp,
  String senderDeviceId = syntheticTestDeviceId,
  String type = MobileRemoteEventTypes.promptSubmit,
  Map<String, Object?> payload = const {'prompt': 'synthetic test prompt'},
  String signature = syntheticTestSignature,
}) {
  return createTestRemoteEvent(
    sessionId: sessionId,
    seq: seq,
    timestamp: timestamp,
    senderDeviceId: senderDeviceId,
    type: type,
    payload: payload,
    signature: signature,
  ).toJson();
}

/// Returns the raw JSON encoded string of a synthetic [MobileRemoteEvent].
///
/// Derived directly from [createTestRemoteEventJson]. Suitable for incoming
/// transport simulation in [FakeMobileRemoteTransport.emitIncomingMessage].
String createTestRemoteEventRawString({
  String sessionId = syntheticTestSessionId,
  int seq = 1,
  DateTime? timestamp,
  String senderDeviceId = syntheticTestDeviceId,
  String type = MobileRemoteEventTypes.promptSubmit,
  Map<String, Object?> payload = const {'prompt': 'synthetic test prompt'},
  String signature = syntheticTestSignature,
}) {
  return jsonEncode(
    createTestRemoteEventJson(
      sessionId: sessionId,
      seq: seq,
      timestamp: timestamp,
      senderDeviceId: senderDeviceId,
      type: type,
      payload: payload,
      signature: signature,
    ),
  );
}
