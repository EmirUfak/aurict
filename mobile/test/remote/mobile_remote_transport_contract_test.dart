import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:aurict_mobile/remote/mobile_device_identity.dart';
import 'package:aurict_mobile/remote/mobile_remote_event_codec.dart';
import 'package:aurict_mobile/remote/mobile_remote_models.dart';
import '../support/fake_mobile_remote_transport.dart';
import '../support/remote_event_fixtures.dart';

void main() {
  MobileRemoteSession testSession({String id = 'session-test-001'}) =>
      MobileRemoteSession(
        id: id,
        desktopDeviceId: 'device-test-desktop-001',
        protocolVersion: 1,
        status: 'available',
        connectionMode: 'webrtc',
        signedOffer: const MobileSignalEnvelope(
          version: 1,
          sessionProtocolVersion: 1,
          type: 'offer',
          transport: 'webrtc',
          payload: '{"sdp":"synthetic-offer-sdp"}',
          signingKeyFingerprint: 'fp-test-desktop',
          signature: 'sig-test-desktop',
        ),
        lastSequence: 0,
        maxIdleSeconds: 90,
        expiresAt: DateTime.parse('2026-08-17T12:00:00.000Z'),
        lastHeartbeatAt: DateTime.parse('2026-08-17T10:00:00.000Z'),
      );

  MobileDeviceIdentity testIdentity({String fp = 'fp-test-mobile-001'}) =>
      MobileDeviceIdentity(
        deviceId: 'device-test-mobile-001',
        signingPublicKey: 'pk-test-signing',
        signingKeyFingerprint: fp,
        encryptionPublicKey: 'pk-test-enc',
        verified: true,
      );

  void checkQueues(
    FakeMobileRemoteTransport t,
    List<String> c,
    List<String> o,
    List<String> d,
    List<String> f,
  ) => expect(
    [t.sendCalls, t.pendingOutbox, t.deliveredMessages, t.flushedMessages],
    [c, o, d, f],
  );

  group('FakeMobileRemoteTransport initial state', () {
    test(
      'starts with closed state, inactive channel, and empty collections',
      () {
        final t = FakeMobileRemoteTransport();
        expect([t.isChannelOpen, t.isClosed], [isFalse, isFalse]);
        expect([t.openHandlerCount, t.messageHandlerCount], [0, 0]);
        expect(
          [t.openHandlerRegistrationCount, t.messageHandlerRegistrationCount],
          [0, 0],
        );
        expect(
          [t.duplicateOpenBindingCount, t.duplicateMessageBindingCount],
          [0, 0],
        );
        expect([t.closeCount, t.buildAnswerCallCount], [0, 0]);
        expect(
          [t.capturedBuildAnswerCalls.isEmpty, t.lastBuildAnswerCall == null],
          [isTrue, isTrue],
        );
        checkQueues(t, [], [], [], []);
        expect(t.emittedIncomingMessages, isEmpty);
      },
    );
  });

  group('Channel open lifecycle & handlers', () {
    test(
      'simulateChannelOpen and simulateChannelClose update channel state without closing transport',
      () {
        final t = FakeMobileRemoteTransport();
        final order = <int>[];
        t.onChannelOpen(() => order.add(1));
        t.onChannelOpen(() => order.add(2));
        expect([t.isChannelOpen, t.isClosed], [isFalse, isFalse]);

        t.simulateChannelOpen();
        expect([t.isChannelOpen, t.isClosed], [isTrue, isFalse]);
        expect(order, [1, 2]);

        t.simulateChannelClose();
        expect(
          [t.isChannelOpen, t.isClosed, t.closeCount],
          [isFalse, isFalse, 0],
        );
        expect(
          [
            t.openHandlerCount,
            t.pendingOutbox.length,
            t.deliveredMessages.length,
          ],
          [2, 0, 0],
        );

        t.simulateChannelOpen();
        expect([t.isChannelOpen, t.isClosed], [isTrue, isFalse]);
        expect(order, [1, 2, 1, 2]);
      },
    );
  });

  group('Send & Outbox queue behavior', () {
    test('send while closed appends to pendingOutbox without delivery', () {
      final t = FakeMobileRemoteTransport();
      t.send('payload-A');
      checkQueues(t, ['payload-A'], ['payload-A'], [], []);
    });

    test('simulateChannelOpen flushes pending queue in strict FIFO order', () {
      final t = FakeMobileRemoteTransport();
      t.send('msg-1');
      t.send('msg-2');
      t.send('msg-3');
      checkQueues(
        t,
        ['msg-1', 'msg-2', 'msg-3'],
        ['msg-1', 'msg-2', 'msg-3'],
        [],
        [],
      );

      t.simulateChannelOpen();
      checkQueues(
        t,
        ['msg-1', 'msg-2', 'msg-3'],
        [],
        ['msg-1', 'msg-2', 'msg-3'],
        ['msg-1', 'msg-2', 'msg-3'],
      );
    });

    test(
      'open handler sees empty pendingOutbox and populated deliveredMessages',
      () {
        final t = FakeMobileRemoteTransport();
        t.send('queued-before-open');
        var outboxAtCb = -1, deliveredAtCb = -1;

        t.onChannelOpen(() {
          outboxAtCb = t.pendingOutbox.length;
          deliveredAtCb = t.deliveredMessages.length;
        });

        t.simulateChannelOpen();
        expect([outboxAtCb, deliveredAtCb], [0, 1]);
        expect(t.deliveredMessages, ['queued-before-open']);
      },
    );

    test(
      'send while open records to deliveredMessages immediately and preserves order',
      () {
        final t = FakeMobileRemoteTransport();
        t.send('A');
        checkQueues(t, ['A'], ['A'], [], []);

        t.simulateChannelOpen();
        checkQueues(t, ['A'], [], ['A'], ['A']);

        t.send('B');
        checkQueues(t, ['A', 'B'], [], ['A', 'B'], ['A']);
      },
    );
  });

  group('Incoming message handling', () {
    test(
      'emitIncomingMessage delivers unmodified payload sequentially to handlers',
      () {
        final t = FakeMobileRemoteTransport();
        final log = <String>[];
        t.onMessage((data) => log.add('h1:$data'));
        t.onMessage((data) => log.add('h2:$data'));

        const testPayload = '{"kind":"test.incoming","data":123}';
        t.emitIncomingMessage(testPayload);

        expect(t.emittedIncomingMessages, [testPayload]);
        expect(log, ['h1:$testPayload', 'h2:$testPayload']);
      },
    );

    test('emitIncomingMessage with no registered handlers is a safe no-op', () {
      final t = FakeMobileRemoteTransport();
      expect(() => t.emitIncomingMessage('unhandled'), returnsNormally);
      expect(t.emittedIncomingMessages, ['unhandled']);
    });

    test(
      'emitIncomingMessage propagates handler exception without swallowing',
      () {
        final t = FakeMobileRemoteTransport();
        t.onMessage((data) => throw FormatException('Malformed: $data'));
        expect(() => t.emitIncomingMessage('bad-data'), throwsFormatException);
      },
    );
  });

  group('buildAnswer contract & capture', () {
    test(
      'buildAnswer captures arguments, calls signPayload and returns valid envelope',
      () async {
        final t = FakeMobileRemoteTransport();
        final session = testSession();
        final identity = testIdentity();
        final turn = MobileTurnCredential(
          urls: const ['turn:test.turn.org:3478'],
          username: 'usr-test',
          credential: 'cred-test',
          expiresAt: DateTime.parse('2026-08-17T12:00:00.000Z'),
        );

        var signCalled = false;
        final envelope = await t.buildAnswer(
          session: session,
          identity: identity,
          signPayload: (payload) async {
            signCalled = true;
            return 'sig($payload)';
          },
          turnCredential: turn,
        );

        expect(t.buildAnswerCallCount, 1);
        expect(t.capturedBuildAnswerCalls, hasLength(1));
        expect(t.lastBuildAnswerCall?.session.id, session.id);
        expect(t.lastBuildAnswerCall?.identity.deviceId, identity.deviceId);
        expect(t.lastBuildAnswerCall?.turnCredential?.username, 'usr-test');
        expect(signCalled, isTrue);
        expect(envelope.type, 'answer');
        expect(envelope.sessionProtocolVersion, session.protocolVersion);
        expect(envelope.signingKeyFingerprint, identity.signingKeyFingerprint);
        expect(envelope.signature, startsWith('sig('));
      },
    );

    test(
      'buildAnswer returns configured answerToReturn when provided',
      () async {
        const customEnvelope = MobileSignalEnvelope(
          version: 1,
          sessionProtocolVersion: 1,
          type: 'answer',
          transport: 'webrtc',
          payload: '{"sdp":"custom-answer-sdp"}',
          signingKeyFingerprint: 'fp-custom',
          signature: 'sig-custom',
        );

        final t = FakeMobileRemoteTransport(answerToReturn: customEnvelope);
        final result = await t.buildAnswer(
          session: testSession(),
          identity: testIdentity(),
          signPayload: (payload) async => 'ignored',
        );

        expect(result, same(customEnvelope));
        expect(result.payload, '{"sdp":"custom-answer-sdp"}');
      },
    );

    test(
      'buildAnswer default path generates synthetic payload and captures calls on error',
      () async {
        final t = FakeMobileRemoteTransport();
        final session = testSession(id: 'session-answer-test');
        final identity = testIdentity(fp: 'fp-answer-test');

        String? signedPayloadReceived;
        final envelope = await t.buildAnswer(
          session: session,
          identity: identity,
          signPayload: (payload) async {
            signedPayloadReceived = payload;
            return 'signed-test-sha256-hash';
          },
        );

        final decoded =
            jsonDecode(signedPayloadReceived!) as Map<String, dynamic>;
        expect(decoded['sessionId'], 'session-answer-test');
        expect(envelope.signature, 'signed-test-sha256-hash');

        final errorTransport = FakeMobileRemoteTransport(
          buildAnswerError: StateError('failure'),
        );
        expect(
          () => errorTransport.buildAnswer(
            session: session,
            identity: identity,
            signPayload: (p) async => 'sig',
          ),
          throwsStateError,
        );
        expect(errorTransport.buildAnswerCallCount, 1);
      },
    );
  });

  group('Error injection & ordering', () {
    test(
      'send records to sendCalls before throwing sendError leaving queues untouched',
      () {
        final t = FakeMobileRemoteTransport(
          sendError: StateError('Synthetic send failure'),
        );
        expect(() => t.send('failed-msg'), throwsStateError);
        checkQueues(t, ['failed-msg'], [], [], []);
      },
    );

    test('close increments closeCount before throwing closeError', () async {
      final t = FakeMobileRemoteTransport(
        closeError: StateError('Synthetic close failure'),
      );
      t.simulateChannelOpen();
      expect(t.isChannelOpen, isTrue);

      await expectLater(() => t.close(), throwsStateError);
      expect([t.closeCount, t.isClosed, t.isChannelOpen], [1, isFalse, isTrue]);
    });
  });

  group('Close behavior & idempotence', () {
    test(
      'close sets isClosed, disables channel, and is safe on repeated calls',
      () async {
        final t = FakeMobileRemoteTransport();
        t.simulateChannelOpen();

        await t.close();
        expect(
          [t.isClosed, t.isChannelOpen, t.closeCount],
          [isTrue, isFalse, 1],
        );

        await t.close();
        await t.close();
        expect(
          [t.isClosed, t.isChannelOpen, t.closeCount],
          [isTrue, isFalse, 3],
        );
      },
    );

    test(
      'close preserves pendingOutbox and handlers, send-after-close queues to pendingOutbox',
      () async {
        final t = FakeMobileRemoteTransport();
        t.send('unflushed-msg');
        var openInvoked = false;
        t.onChannelOpen(() => openInvoked = true);

        await t.close();
        expect(
          [t.pendingOutbox, t.openHandlerCount, openInvoked],
          [
            ['unflushed-msg'],
            1,
            isFalse,
          ],
        );

        t.send('after-close-msg');
        checkQueues(
          t,
          ['unflushed-msg', 'after-close-msg'],
          ['unflushed-msg', 'after-close-msg'],
          [],
          [],
        );
      },
    );
  });

  group('Callback registration & duplicate guard', () {
    test(
      'registration counters track totals and duplicates beyond the first',
      () {
        final t = FakeMobileRemoteTransport();
        t.onChannelOpen(() {});
        t.onChannelOpen(() {});
        t.onMessage((_) {});
        t.onMessage((_) {});
        t.onMessage((_) {});

        expect(
          [t.openHandlerRegistrationCount, t.messageHandlerRegistrationCount],
          [2, 3],
        );
        expect(
          [t.duplicateOpenBindingCount, t.duplicateMessageBindingCount],
          [1, 2],
        );
        expect([t.openHandlerCount, t.messageHandlerCount], [2, 3]);
      },
    );

    test(
      'throwOnMultipleBindings throws StateError on multiple registrations without adding handler',
      () {
        final t = FakeMobileRemoteTransport(throwOnMultipleBindings: true);
        var open1 = false, open2 = false;
        t.onChannelOpen(() => open1 = true);
        expect(() => t.onChannelOpen(() => open2 = true), throwsStateError);
        expect(
          [
            t.openHandlerRegistrationCount,
            t.duplicateOpenBindingCount,
            t.openHandlerCount,
          ],
          [2, 1, 1],
        );
        t.simulateChannelOpen();
        expect([open1, open2], [isTrue, isFalse]);

        final msgs = <String>[];
        t.onMessage((d) => msgs.add('first:$d'));
        expect(
          () => t.onMessage((d) => msgs.add('second:$d')),
          throwsStateError,
        );
        expect(
          [
            t.messageHandlerRegistrationCount,
            t.duplicateMessageBindingCount,
            t.messageHandlerCount,
          ],
          [2, 1, 1],
        );
        t.emitIncomingMessage('test');
        expect(msgs, ['first:test']);
      },
    );
  });

  group('RC-01 event fixtures integration', () {
    test(
      'remote_event_fixtures produces valid JSON and decodes with MobileRemoteEvent.fromJson',
      () {
        final json = createTestRemoteEventJson(
          sessionId: 'session-contract-test',
          seq: 5,
          type: MobileRemoteEventTypes.terminalOutput,
          payload: {'data': 'stdout line\n', 'stream': 'stdout'},
        );

        final parsed = MobileRemoteEvent.fromJson(json);
        expect(parsed.sessionId, 'session-contract-test');
        expect(parsed.seq, 5);
        expect(parsed.type, MobileRemoteEventTypes.terminalOutput);
        expect(parsed.payload['stream'], 'stdout');
        expect(parsed.signature, syntheticTestSignature);
      },
    );

    test(
      'emitIncomingMessage dispatches synthetic RC-01 raw event string and decodes accurately',
      () {
        final t = FakeMobileRemoteTransport();
        MobileRemoteEvent? decoded;

        t.onMessage(
          (raw) => decoded = MobileRemoteEvent.fromJson(
            jsonDecode(raw) as Map<String, dynamic>,
          ),
        );

        final rawEvent = createTestRemoteEventRawString(
          sessionId: 'session-live-001',
          seq: 1,
          type: MobileRemoteEventTypes.promptSubmit,
          payload: {'prompt': 'synthetic test prompt'},
        );

        t.emitIncomingMessage(rawEvent);
        expect(decoded?.sessionId, 'session-live-001');
        expect(decoded?.seq, 1);
        expect(decoded?.type, MobileRemoteEventTypes.promptSubmit);
        expect(decoded?.payload['prompt'], 'synthetic test prompt');
      },
    );
  });
}
