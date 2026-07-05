import 'package:flutter_test/flutter_test.dart';

import 'package:aurict_mobile/remote/mobile_remote_models.dart';
import 'package:aurict_mobile/remote/mobile_webrtc_transport.dart';

/// `WebRtcMobileTransport.buildAnswer()`'ın kendisi native platform kanalı
/// (gerçek Android/iOS libwebrtc) gerektirdiği için burada test edilmez — bu,
/// yalnızca platform kanalından bağımsız, saf mantığı kapsar: TURN credential'ının
/// ICE server listesine çevrilmesi (CLI tarafındaki `toIceServers()` testinin eşi).
void main() {
  group('iceServersForTurnCredential', () {
    test('returns the default STUN server when there is no TURN credential', () {
      final result = iceServersForTurnCredential(null);
      expect(result, defaultIceServers);
      expect(result, [
        {'urls': 'stun:stun.l.google.com:19302'},
      ]);
    });

    test('fans out a multi-URI TURN credential into one ICE server per URL', () {
      final credential = MobileTurnCredential(
        urls: ['turn:turn.aurict.com:3478', 'turns:turn.aurict.com:5349'],
        username: '1234:aurict:usr_1:rmt_1',
        credential: 'hmac-sig',
        expiresAt: DateTime.now(),
      );
      final result = iceServersForTurnCredential(credential);
      expect(result, [
        {
          'urls': 'turn:turn.aurict.com:3478',
          'username': '1234:aurict:usr_1:rmt_1',
          'credential': 'hmac-sig',
        },
        {
          'urls': 'turns:turn.aurict.com:5349',
          'username': '1234:aurict:usr_1:rmt_1',
          'credential': 'hmac-sig',
        },
      ]);
    });

    test('handles a single-URI credential', () {
      final credential = MobileTurnCredential(
        urls: ['turn:turn.aurict.com:3478'],
        username: 'u',
        credential: 'c',
        expiresAt: DateTime.now(),
      );
      final result = iceServersForTurnCredential(credential);
      expect(result.length, 1);
      expect(result.single['urls'], 'turn:turn.aurict.com:3478');
    });
  });
}
