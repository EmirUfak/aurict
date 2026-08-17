import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:aurict_mobile/remote/mobile_remote_models.dart';

Map<String, dynamic> _readFixture(String filename) {
  final file = File('test/fixtures/remote/$filename');
  return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
}

void main() {
  group('MobileRemoteProtocol', () {
    test('parses valid protocol fixture correctly', () {
      final json = _readFixture('valid_protocol.json');
      final protocol = MobileRemoteProtocol.fromJson(json);

      expect(protocol.version, 1);
      expect(protocol.backendCarriesPayload, isFalse);
      expect(protocol.eventTypes, contains('prompt.submit'));
      expect(protocol.eventTypes.length, 10);
    });

    test(
      'strict validation rejects invalid version, backendCarriesPayload, or eventTypes',
      () {
        Map<String, dynamic> valid() => _readFixture('valid_protocol.json');

        final invalidCases = <String, Map<String, dynamic>>{
          'missing version': valid()..remove('version'),
          'string version': valid()..['version'] = '1',
          'double version': valid()..['version'] = 1.0,
          'zero version': valid()..['version'] = 0,
          'unsupported version': valid()..['version'] = 99,
          'missing backendCarriesPayload': valid()
            ..remove('backendCarriesPayload'),
          'non-bool backendCarriesPayload': valid()
            ..['backendCarriesPayload'] = 'false',
          'backendCarriesPayload true (security violation)': valid()
            ..['backendCarriesPayload'] = true,
          'missing eventTypes': valid()..remove('eventTypes'),
          'non-list eventTypes': valid()..['eventTypes'] = 'not-a-list',
          'empty eventTypes': valid()..['eventTypes'] = <dynamic>[],
          'non-string item in eventTypes': valid()
            ..['eventTypes'] = <dynamic>[123],
          'empty string item in eventTypes': valid()
            ..['eventTypes'] = <dynamic>[''],
        };

        for (final entry in invalidCases.entries) {
          expect(
            () => MobileRemoteProtocol.fromJson(entry.value),
            throwsFormatException,
            reason: 'Case "${entry.key}" should throw FormatException',
          );
        }
      },
    );

    test('rejects unsupported protocol fixture', () {
      final json = _readFixture('invalid_protocol_unsupported.json');
      expect(() => MobileRemoteProtocol.fromJson(json), throwsFormatException);
    });
  });

  group('MobileSignalEnvelope', () {
    test(
      'parses valid signal envelope fixture and executes toJson round-trip',
      () {
        final json = _readFixture('valid_signal_envelope.json');
        final envelope = MobileSignalEnvelope.fromJson(json);

        expect(envelope.version, 1);
        expect(envelope.sessionProtocolVersion, 1);
        expect(envelope.type, 'offer');
        expect(envelope.transport, 'webrtc');
        expect(envelope.payload, startsWith('v=0'));
        expect(envelope.signingKeyFingerprint, 'fp_test_device_001');
        expect(envelope.signature, 'synthetic-sig-offer-001');

        final serialized = envelope.toJson();
        final roundTrip = MobileSignalEnvelope.fromJson(serialized);
        expect(roundTrip.version, envelope.version);
        expect(
          roundTrip.sessionProtocolVersion,
          envelope.sessionProtocolVersion,
        );
        expect(roundTrip.type, envelope.type);
        expect(roundTrip.transport, envelope.transport);
        expect(roundTrip.payload, envelope.payload);
        expect(roundTrip.signingKeyFingerprint, envelope.signingKeyFingerprint);
        expect(roundTrip.signature, envelope.signature);
      },
    );

    test('accepts answer type', () {
      final json = _readFixture('valid_signal_envelope.json')
        ..['type'] = 'answer';
      final envelope = MobileSignalEnvelope.fromJson(json);
      expect(envelope.type, 'answer');
    });

    test('strict validation rejects invalid envelope fields', () {
      Map<String, dynamic> valid() =>
          _readFixture('valid_signal_envelope.json');

      final invalidCases = <String, Map<String, dynamic>>{
        'missing version': valid()..remove('version'),
        'unsupported version': valid()..['version'] = 2,
        'missing sessionProtocolVersion': valid()
          ..remove('sessionProtocolVersion'),
        'string sessionProtocolVersion': valid()
          ..['sessionProtocolVersion'] = '1',
        'unsupported sessionProtocolVersion': valid()
          ..['sessionProtocolVersion'] = 2,
        'missing type': valid()..remove('type'),
        'unsupported type': valid()..['type'] = 'candidate',
        'missing transport': valid()..remove('transport'),
        'tunnel transport': valid()..['transport'] = 'tunnel',
        'lan transport': valid()..['transport'] = 'lan',
        'unsupported transport': valid()..['transport'] = 'udp',
        'missing payload': valid()..remove('payload'),
        'empty payload': valid()..['payload'] = '',
        'whitespace-only payload': valid()..['payload'] = '   ',
        'missing signingKeyFingerprint': valid()
          ..remove('signingKeyFingerprint'),
        'empty signingKeyFingerprint': valid()..['signingKeyFingerprint'] = '',
        'missing signature': valid()..remove('signature'),
        'empty signature': valid()..['signature'] = '',
      };

      for (final entry in invalidCases.entries) {
        expect(
          () => MobileSignalEnvelope.fromJson(entry.value),
          throwsFormatException,
          reason: 'Case "${entry.key}" should throw FormatException',
        );
      }
    });

    test('rejects empty payload fixture', () {
      final json = _readFixture('invalid_signal_envelope_empty_payload.json');
      expect(() => MobileSignalEnvelope.fromJson(json), throwsFormatException);
    });
  });

  group('MobileRemoteSession', () {
    test('parses valid session fixture correctly', () {
      final json = _readFixture('valid_session.json');
      final session = MobileRemoteSession.fromJson(json);

      expect(session.id, 'session-test-001');
      expect(session.desktopDeviceId, 'device-test-cli-001');
      expect(session.protocolVersion, 1);
      expect(session.status, 'available');
      expect(session.connectionMode, 'webrtc');
      expect(session.signedOffer.type, 'offer');
      expect(session.signedOffer.transport, 'webrtc');
      expect(session.acceptedByDeviceId, isNull);
      expect(session.signedAnswer, isNull);
      expect(session.resumeAvailable, isFalse);
      expect(session.lastSequence, 0);
      expect(session.maxIdleSeconds, 90);
      expect(session.expiresAt, DateTime.parse('2026-08-17T12:00:00.000Z'));
      expect(
        session.lastHeartbeatAt,
        DateTime.parse('2026-08-17T11:55:00.000Z'),
      );
    });

    test(
      'parses session with optional acceptedByDeviceId, signedAnswer, and resumeAvailable',
      () {
        final json = _readFixture('valid_session.json')
          ..['acceptedByDeviceId'] = 'device-test-mobile-001'
          ..['signedAnswer'] = (_readFixture('valid_signal_envelope.json')
            ..['type'] = 'answer')
          ..['resumeAvailable'] = true;

        final session = MobileRemoteSession.fromJson(json);
        expect(session.acceptedByDeviceId, 'device-test-mobile-001');
        expect(session.signedAnswer?.type, 'answer');
        expect(session.resumeAvailable, isTrue);
      },
    );

    test('strict validation rejects invalid session fields', () {
      Map<String, dynamic> valid() => _readFixture('valid_session.json');

      final invalidCases = <String, Map<String, dynamic>>{
        'missing id': valid()..remove('id'),
        'empty id': valid()..['id'] = '',
        'whitespace id': valid()..['id'] = '   ',
        'missing desktopDeviceId': valid()..remove('desktopDeviceId'),
        'empty desktopDeviceId': valid()..['desktopDeviceId'] = '',
        'missing protocolVersion': valid()..remove('protocolVersion'),
        'unsupported protocolVersion': valid()..['protocolVersion'] = 2,
        'missing status': valid()..remove('status'),
        'empty status': valid()..['status'] = '',
        'missing connectionMode': valid()..remove('connectionMode'),
        'tunnel connectionMode': valid()..['connectionMode'] = 'tunnel',
        'lan connectionMode': valid()..['connectionMode'] = 'lan',
        'unsupported connectionMode': valid()..['connectionMode'] = 'bluetooth',
        'missing signedOffer': valid()..remove('signedOffer'),
        'null signedOffer': valid()..['signedOffer'] = null,
        'signedOffer with answer type': valid()
          ..['signedOffer'] = (_readFixture('valid_signal_envelope.json')
            ..['type'] = 'answer'),
        'empty acceptedByDeviceId': valid()..['acceptedByDeviceId'] = '',
        'signedAnswer with offer type': valid()
          ..['signedAnswer'] = _readFixture('valid_signal_envelope.json'),
        'non-bool resumeAvailable': valid()..['resumeAvailable'] = 'true',
        'negative lastSequence': valid()..['lastSequence'] = -1,
        'string lastSequence': valid()..['lastSequence'] = '0',
        'zero maxIdleSeconds': valid()..['maxIdleSeconds'] = 0,
        'negative maxIdleSeconds': valid()..['maxIdleSeconds'] = -5,
        'missing expiresAt': valid()..remove('expiresAt'),
        'invalid expiresAt': valid()..['expiresAt'] = 'not-a-date',
        'timezone-less expiresAt': valid()
          ..['expiresAt'] = '2026-08-17T12:00:00',
        'missing lastHeartbeatAt': valid()..remove('lastHeartbeatAt'),
        'timezone-less lastHeartbeatAt': valid()
          ..['lastHeartbeatAt'] = '2026-08-17T11:55:00',
      };

      for (final entry in invalidCases.entries) {
        expect(
          () => MobileRemoteSession.fromJson(entry.value),
          throwsFormatException,
          reason: 'Case "${entry.key}" should throw FormatException',
        );
      }
    });

    test('rejects missing signedOffer fixture', () {
      final json = _readFixture('invalid_session_missing_signed_offer.json');
      expect(() => MobileRemoteSession.fromJson(json), throwsFormatException);
    });
  });

  group('MobileTurnCredential', () {
    test('parses valid TURN credential fixture correctly', () {
      final json = _readFixture('valid_turn_credential.json');
      final credential = MobileTurnCredential.fromJson(json);

      expect(credential.urls.length, 2);
      expect(credential.urls[0], 'turn:turn.example.invalid:3478');
      expect(credential.urls[1], 'turns:turn.example.invalid:5349');
      expect(credential.username, 'synthetic-turn-user');
      expect(credential.credential, 'synthetic-turn-credential');
      expect(credential.expiresAt, DateTime.parse('2026-08-17T12:00:00.000Z'));
    });

    test('strict validation rejects invalid TURN credential fields', () {
      Map<String, dynamic> valid() =>
          _readFixture('valid_turn_credential.json');

      final invalidCases = <String, Map<String, dynamic>>{
        'missing urls': valid()..remove('urls'),
        'non-list urls': valid()..['urls'] = 'turn:turn.example.invalid:3478',
        'empty urls list': valid()..['urls'] = <dynamic>[],
        'non-string url item': valid()..['urls'] = <dynamic>[123],
        'empty string url item': valid()..['urls'] = <dynamic>[''],
        'missing username': valid()..remove('username'),
        'empty username': valid()..['username'] = '',
        'missing credential': valid()..remove('credential'),
        'empty credential': valid()..['credential'] = '',
        'missing expiresAt': valid()..remove('expiresAt'),
        'invalid expiresAt': valid()..['expiresAt'] = 'not-a-date',
        'timezone-less expiresAt': valid()
          ..['expiresAt'] = '2026-08-17T12:00:00',
      };

      for (final entry in invalidCases.entries) {
        expect(
          () => MobileTurnCredential.fromJson(entry.value),
          throwsFormatException,
          reason: 'Case "${entry.key}" should throw FormatException',
        );
      }
    });

    test('rejects invalid expiry fixture', () {
      final json = _readFixture('invalid_turn_credential_expiry.json');
      expect(() => MobileTurnCredential.fromJson(json), throwsFormatException);
    });
  });

  group('Deterministic timestamps and timezone handling', () {
    test('parses explicit UTC (Z) and offset timestamps deterministically', () {
      final jsonUtc = _readFixture('valid_turn_credential.json')
        ..['expiresAt'] = '2026-08-17T12:00:00.000Z';
      final credUtc = MobileTurnCredential.fromJson(jsonUtc);
      expect(credUtc.expiresAt.toUtc(), DateTime.utc(2026, 8, 17, 12, 0, 0));

      final jsonOffset = _readFixture('valid_turn_credential.json')
        ..['expiresAt'] = '2026-08-17T15:00:00+03:00';
      final credOffset = MobileTurnCredential.fromJson(jsonOffset);
      expect(credOffset.expiresAt.toUtc(), DateTime.utc(2026, 8, 17, 12, 0, 0));
    });
  });
}
