import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aurict_mobile/remote/mobile_remote_event_codec.dart';

void main() {
  const syntheticSessionId = 'session-test-001';
  const syntheticDeviceId = 'device-test-001';
  const syntheticType = MobileRemoteEventTypes.promptSubmit;
  const syntheticPayload = <String, Object?>{'prompt': 'synthetic prompt'};
  const syntheticSignature = 'synthetic-test-signature';
  const syntheticTimestampIso = '2026-08-17T10:00:00.000Z';

  Map<String, dynamic> validEventJson({
    Object? sessionId = syntheticSessionId,
    Object? seq = 1,
    Object? timestamp = syntheticTimestampIso,
    Object? senderDeviceId = syntheticDeviceId,
    Object? type = syntheticType,
    Object? payload = syntheticPayload,
    Object? signature = syntheticSignature,
  }) {
    final map = <String, dynamic>{};
    if (sessionId != null) map['sessionId'] = sessionId;
    if (seq != null) map['seq'] = seq;
    if (timestamp != null) map['timestamp'] = timestamp;
    if (senderDeviceId != null) map['senderDeviceId'] = senderDeviceId;
    if (type != null) map['type'] = type;
    if (payload != null) map['payload'] = payload;
    if (signature != null) map['signature'] = signature;
    return map;
  }

  group('MobileRemoteEventTypes', () {
    test('defines all standard event type string constants', () {
      expect(MobileRemoteEventTypes.promptSubmit, 'prompt.submit');
      expect(MobileRemoteEventTypes.terminalOutput, 'terminal.output');
      expect(MobileRemoteEventTypes.agentStatus, 'agent.status');
      expect(MobileRemoteEventTypes.toolCall, 'tool.call');
      expect(MobileRemoteEventTypes.toolResultSummary, 'tool.result.summary');
      expect(MobileRemoteEventTypes.interrupt, 'interrupt');
      expect(MobileRemoteEventTypes.resume, 'resume');
      expect(MobileRemoteEventTypes.heartbeat, 'heartbeat');
      expect(MobileRemoteEventTypes.close, 'close');
      expect(MobileRemoteEventTypes.error, 'error');
    });
  });

  group('MobileRemoteEvent serialization & deserialization', () {
    test('parses a complete valid JSON structure correctly', () {
      final json = validEventJson();
      final event = MobileRemoteEvent.fromJson(json);

      expect(event.sessionId, syntheticSessionId);
      expect(event.seq, 1);
      expect(event.timestamp, DateTime.parse(syntheticTimestampIso));
      expect(event.senderDeviceId, syntheticDeviceId);
      expect(event.type, syntheticType);
      expect(event.payload, syntheticPayload);
      expect(event.signature, syntheticSignature);
    });

    test(
      'toJson produces expected structure with UTC ISO timestamp and number seq',
      () {
        final event = MobileRemoteEvent(
          sessionId: syntheticSessionId,
          seq: 1,
          timestamp: DateTime.parse(syntheticTimestampIso),
          senderDeviceId: syntheticDeviceId,
          type: syntheticType,
          payload: syntheticPayload,
          signature: syntheticSignature,
        );

        final json = event.toJson();
        expect(json['sessionId'], syntheticSessionId);
        expect(json['seq'], 1);
        expect(json['seq'], isA<int>());
        expect(json['timestamp'], syntheticTimestampIso);
        expect(json['senderDeviceId'], syntheticDeviceId);
        expect(json['type'], syntheticType);
        expect(json['payload'], syntheticPayload);
        expect(json['signature'], syntheticSignature);
      },
    );

    test('round-trip preserves all fields without data loss', () {
      final original = MobileRemoteEvent(
        sessionId: syntheticSessionId,
        seq: 42,
        timestamp: DateTime.parse('2026-08-17T12:34:56.789Z'),
        senderDeviceId: syntheticDeviceId,
        type: MobileRemoteEventTypes.terminalOutput,
        payload: const {'data': 'test terminal chunk', 'stream': 'stdout'},
        signature: syntheticSignature,
      );

      final serialized = original.toJson();
      final decoded = MobileRemoteEvent.fromJson(serialized);

      expect(decoded.sessionId, original.sessionId);
      expect(decoded.seq, original.seq);
      expect(decoded.timestamp.toUtc(), original.timestamp.toUtc());
      expect(decoded.senderDeviceId, original.senderDeviceId);
      expect(decoded.type, original.type);
      expect(mapEquals(decoded.payload, original.payload), isTrue);
      expect(decoded.signature, original.signature);
    });

    test(
      'parses different sessionId without loss for runtime verification',
      () {
        const distinctSession = 'session-test-distinct-999';
        final json = validEventJson(sessionId: distinctSession);
        final event = MobileRemoteEvent.fromJson(json);

        expect(event.sessionId, distinctSession);
      },
    );
  });

  group('MobileRemoteEvent.fromJson strict validation', () {
    test('throws FormatException when sessionId is missing', () {
      final json = validEventJson()..remove('sessionId');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when sessionId has wrong type', () {
      final json = validEventJson(sessionId: 12345);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when sessionId is empty string', () {
      final json = validEventJson(sessionId: '');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when sessionId is whitespace-only', () {
      final json = validEventJson(sessionId: '   ');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when seq is missing', () {
      final json = validEventJson()..remove('seq');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when seq is zero', () {
      final json = validEventJson(seq: 0);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when seq is negative', () {
      final json = validEventJson(seq: -1);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when seq is string representation', () {
      final json = validEventJson(seq: '1');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when seq is double', () {
      final json = validEventJson(seq: 1.5);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when seq is boolean', () {
      final json = validEventJson(seq: true);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when timestamp is missing', () {
      final json = validEventJson()..remove('timestamp');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when timestamp has wrong type', () {
      final json = validEventJson(timestamp: 1723888800000);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when timestamp is invalid string', () {
      final json = validEventJson(timestamp: 'not-a-valid-timestamp');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when timestamp lacks timezone specifier', () {
      final json = validEventJson(timestamp: '2026-08-17T10:00:00');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when senderDeviceId is missing', () {
      final json = validEventJson()..remove('senderDeviceId');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when senderDeviceId has wrong type', () {
      final json = validEventJson(senderDeviceId: 42);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when senderDeviceId is empty', () {
      final json = validEventJson(senderDeviceId: '');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when senderDeviceId is whitespace-only', () {
      final json = validEventJson(senderDeviceId: '   ');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when type is missing', () {
      final json = validEventJson()..remove('type');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when type has wrong type', () {
      final json = validEventJson(type: true);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when type is empty', () {
      final json = validEventJson(type: '');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when type is whitespace-only', () {
      final json = validEventJson(type: '   ');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when payload is missing', () {
      final json = validEventJson()..remove('payload');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when payload is null', () {
      final json = validEventJson()..['payload'] = null;
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when payload is a List', () {
      final json = validEventJson(payload: <dynamic>['item1', 'item2']);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when payload is a String', () {
      final json = validEventJson(payload: 'invalid-string-payload');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when payload is a number', () {
      final json = validEventJson(payload: 100);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when payload is a boolean', () {
      final json = validEventJson(payload: false);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when signature is missing', () {
      final json = validEventJson()..remove('signature');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when signature has wrong type', () {
      final json = validEventJson(signature: 9999);
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when signature is empty', () {
      final json = validEventJson(signature: '');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });

    test('throws FormatException when signature is whitespace-only', () {
      final json = validEventJson(signature: '   ');
      expect(() => MobileRemoteEvent.fromJson(json), throwsFormatException);
    });
  });

  group('MobileRemoteEvent.signingPayload determinism & CLI contract', () {
    test(
      'matches exact canonical JSON string literal fixture from TypeScript CLI',
      () {
        final event = MobileRemoteEvent(
          sessionId: syntheticSessionId,
          seq: 1,
          timestamp: DateTime.parse(syntheticTimestampIso),
          senderDeviceId: syntheticDeviceId,
          type: syntheticType,
          payload: syntheticPayload,
          signature: syntheticSignature,
        );

        const expectedCanonicalJson =
            '{"sessionId":"session-test-001","seq":1,"timestamp":"2026-08-17T10:00:00.000Z","senderDeviceId":"device-test-001","type":"prompt.submit","payload":{"prompt":"synthetic prompt"}}';

        final output = event.signingPayload();
        expect(output, expectedCanonicalJson);

        final decodedMap = jsonDecode(output) as Map<String, dynamic>;
        expect(decodedMap.containsKey('signature'), isFalse);
        expect(decodedMap['seq'], isA<int>());
        expect(decodedMap['seq'], 1);

        // Verify key ordering
        final keys = decodedMap.keys.toList();
        expect(keys, [
          'sessionId',
          'seq',
          'timestamp',
          'senderDeviceId',
          'type',
          'payload',
        ]);
      },
    );

    test('produces deterministic output on repeated invocations', () {
      final event = MobileRemoteEvent(
        sessionId: syntheticSessionId,
        seq: 7,
        timestamp: DateTime.parse('2026-08-17T15:30:00.000Z'),
        senderDeviceId: syntheticDeviceId,
        type: MobileRemoteEventTypes.agentStatus,
        payload: const {'state': 'running'},
        signature: syntheticSignature,
      );

      final first = event.signingPayload();
      final second = event.signingPayload();
      expect(first, second);
    });
  });

  group('MobileRemoteEventLedger', () {
    test('initial ledger state starts at sequence 0', () {
      final ledger = MobileRemoteEventLedger();
      expect(ledger.outgoingSeq, 0);
      expect(ledger.incomingSeq, 0);
      expect(ledger.lastSequence, 0);
    });

    test(
      'createSigned monotonically increments seq and passes exact signingPayload to sign callback',
      () async {
        final ledger = MobileRemoteEventLedger();
        final capturedPayloads = <String>[];

        final firstEvent = await ledger.createSigned(
          sessionId: syntheticSessionId,
          senderDeviceId: syntheticDeviceId,
          type: MobileRemoteEventTypes.promptSubmit,
          payload: const {'prompt': 'step 1'},
          sign: (payload) async {
            capturedPayloads.add(payload);
            return 'sig-for-1';
          },
        );

        expect(firstEvent.seq, 1);
        expect(firstEvent.signature, 'sig-for-1');
        expect(firstEvent.signingPayload(), capturedPayloads[0]);
        expect(ledger.outgoingSeq, 1);
        expect(ledger.lastSequence, 1);

        final secondEvent = await ledger.createSigned(
          sessionId: syntheticSessionId,
          senderDeviceId: syntheticDeviceId,
          type: MobileRemoteEventTypes.promptSubmit,
          payload: const {'prompt': 'step 2'},
          sign: (payload) async {
            capturedPayloads.add(payload);
            return 'sig-for-2';
          },
        );

        expect(secondEvent.seq, 2);
        expect(secondEvent.signature, 'sig-for-2');
        expect(secondEvent.signingPayload(), capturedPayloads[1]);
        expect(ledger.outgoingSeq, 2);
        expect(ledger.lastSequence, 2);

        final thirdEvent = await ledger.createSigned(
          sessionId: syntheticSessionId,
          senderDeviceId: syntheticDeviceId,
          type: MobileRemoteEventTypes.promptSubmit,
          payload: const {'prompt': 'step 3'},
          sign: (payload) async => 'sig-for-3',
        );

        expect(thirdEvent.seq, 3);
        expect(thirdEvent.signature, 'sig-for-3');
        expect(ledger.outgoingSeq, 3);
        expect(ledger.lastSequence, 3);
      },
    );

    test(
      'acceptIncoming accepts strictly increasing sequences and rejects duplicates / stale sequences',
      () {
        final ledger = MobileRemoteEventLedger();

        MobileRemoteEvent makeEvent(int seq) {
          return MobileRemoteEvent(
            sessionId: syntheticSessionId,
            seq: seq,
            timestamp: DateTime.parse(syntheticTimestampIso),
            senderDeviceId: syntheticDeviceId,
            type: MobileRemoteEventTypes.terminalOutput,
            payload: const {'text': 'chunk'},
            signature: syntheticSignature,
          );
        }

        // Initial valid event
        expect(ledger.acceptIncoming(makeEvent(1)), isTrue);
        expect(ledger.incomingSeq, 1);
        expect(ledger.lastSequence, 1);

        // Higher sequence accepted
        expect(ledger.acceptIncoming(makeEvent(5)), isTrue);
        expect(ledger.incomingSeq, 5);
        expect(ledger.lastSequence, 5);

        // Duplicate sequence rejected (replay protection)
        expect(ledger.acceptIncoming(makeEvent(5)), isFalse);
        expect(ledger.incomingSeq, 5);
        expect(ledger.lastSequence, 5);

        // Lower/stale sequence rejected
        expect(ledger.acceptIncoming(makeEvent(3)), isFalse);
        expect(ledger.acceptIncoming(makeEvent(1)), isFalse);
        expect(ledger.incomingSeq, 5);
        expect(ledger.lastSequence, 5);

        // Higher sequence accepted again
        expect(ledger.acceptIncoming(makeEvent(6)), isTrue);
        expect(ledger.incomingSeq, 6);
        expect(ledger.lastSequence, 6);
      },
    );

    test(
      'restore updates sequence counters and lastSequence calculates max correctly',
      () {
        final ledger = MobileRemoteEventLedger();

        ledger.restore(outgoingSeq: 5, incomingSeq: 10);
        expect(ledger.outgoingSeq, 5);
        expect(ledger.incomingSeq, 10);
        expect(ledger.lastSequence, 10);

        ledger.restore(outgoingSeq: 15, incomingSeq: 8);
        expect(ledger.outgoingSeq, 15);
        expect(ledger.incomingSeq, 8);
        expect(ledger.lastSequence, 15);

        ledger.restore(outgoingSeq: 20, incomingSeq: 20);
        expect(ledger.outgoingSeq, 20);
        expect(ledger.incomingSeq, 20);
        expect(ledger.lastSequence, 20);
      },
    );
  });
}
