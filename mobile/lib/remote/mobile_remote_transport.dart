import 'dart:convert';

import 'mobile_device_identity.dart';
import 'mobile_remote_models.dart';

abstract class MobileRemoteTransport {
  Future<MobileSignalEnvelope> buildAnswer({
    required MobileRemoteSession session,
    required MobileDeviceIdentity identity,
    required Future<String> Function(String payload) signPayload,
    MobileTurnCredential? turnCredential,
  });

  /// Veri kanalı açıldığında (P2P bağlantı kullanıma hazır) tetiklenir.
  void onChannelOpen(void Function() handler);

  /// Karşı taraftan (CLI) gelen ham mesaj — event-codec ile çözülür.
  void onMessage(void Function(String data) handler);

  /// Açık kanaldan ham mesaj gönderir; kanal henüz açık değilse kuyruklanır.
  void send(String data);

  Future<void> close();
}

class MockMobileRemoteTransport implements MobileRemoteTransport {
  @override
  Future<MobileSignalEnvelope> buildAnswer({
    required MobileRemoteSession session,
    required MobileDeviceIdentity identity,
    required Future<String> Function(String payload) signPayload,
    MobileTurnCredential? turnCredential,
  }) async {
    final payload = jsonEncode({
      'kind': 'aurict.mobile.remote.placeholder-answer',
      'sessionId': session.id,
      'desktopDeviceId': session.desktopDeviceId,
      'connectionMode': session.connectionMode,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'turn': turnCredential == null
          ? null
          : {
              'urls': turnCredential.urls,
              'expiresAt': turnCredential.expiresAt.toUtc().toIso8601String(),
            },
    });
    return MobileSignalEnvelope(
      version: 1,
      sessionProtocolVersion: session.protocolVersion,
      type: 'answer',
      transport: session.connectionMode,
      payload: payload,
      signingKeyFingerprint: identity.signingKeyFingerprint,
      signature: await signPayload(payload),
    );
  }

  @override
  void onChannelOpen(void Function() handler) {
    // no-op — gerçek kanal yok
  }

  @override
  void onMessage(void Function(String data) handler) {
    // no-op
  }

  @override
  void send(String data) {
    // no-op — gönderilecek gerçek bir kanal yok
  }

  @override
  Future<void> close() async {}
}
