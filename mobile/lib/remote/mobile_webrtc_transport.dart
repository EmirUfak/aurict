import 'dart:async';

import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'mobile_device_identity.dart';
import 'mobile_remote_models.dart';
import 'mobile_remote_transport.dart';

const defaultIceServers = <Map<String, String>>[
  {'urls': 'stun:stun.l.google.com:19302'},
];

/// Backend'in TURN credential'ını (`urls`: birden fazla URI olabilir) `flutter_webrtc`'in
/// beklediği ICE server listesine çevirir — URI başına bir server (CLI tarafındaki
/// `toIceServers()` ile aynı fan-out mantığı). Platform kanalı gerektirmez, saf/test edilebilir.
List<Map<String, String>> iceServersForTurnCredential(
  MobileTurnCredential? turnCredential,
) {
  if (turnCredential == null) return defaultIceServers;
  return [
    for (final url in turnCredential.urls)
      {
        'urls': url,
        'username': turnCredential.username,
        'credential': turnCredential.credential,
      },
  ];
}

/// Gerçek WebRTC transport (answerer) — `MockMobileRemoteTransport`'un yerini alır.
///
/// CLI tarafının (offerer, `packages/cli/src/remote/webrtc-transport.ts`) SDP offer'ını
/// kabul edip cevap üretir. Sinyalleşme payload sözleşmesi CLI ile birebir aynı: `payload`
/// alanı HAM SDP metnidir (JSON sarmalı yok) — backend yalnızca opak bir string bekliyor.
///
/// Non-trickle ICE: CLI tarafı da adaylarını offer SDP'sine gömüyor (poll tabanlı
/// sinyalleşmede canlı ICE candidate soketi yok); bu yüzden mobil taraf da kendi
/// adaylarını cevap SDP'sine gömer — `setLocalDescription` sonrası ICE toplama bitene
/// kadar bekleyip nihai SDP'yi öyle okur (CLI tarafındaki `waitForIceGatheringComplete`
/// ile aynı desen, `flutter_webrtc`'in olay isimlerine uyarlanmış).
class WebRtcMobileTransport implements MobileRemoteTransport {
  RTCPeerConnection? _pc;
  RTCDataChannel? _channel;
  final List<void Function()> _openHandlers = [];
  final List<void Function(String data)> _messageHandlers = [];
  final List<String> _pendingOutbox = [];

  static const _iceGatherTimeout = Duration(seconds: 8);

  @override
  Future<MobileSignalEnvelope> buildAnswer({
    required MobileRemoteSession session,
    required MobileDeviceIdentity identity,
    required Future<String> Function(String payload) signPayload,
    MobileTurnCredential? turnCredential,
  }) async {
    final iceServers = iceServersForTurnCredential(turnCredential);
    final pc = await createPeerConnection({'iceServers': iceServers});
    _pc = pc;
    pc.onDataChannel = (channel) => _wireChannel(channel);

    await pc.setRemoteDescription(
      RTCSessionDescription(session.signedOffer.payload, 'offer'),
    );
    final answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await _waitForIceGatheringComplete(pc);
    final sdp = (await pc.getLocalDescription())!.sdp!;

    return MobileSignalEnvelope(
      version: 1,
      sessionProtocolVersion: session.protocolVersion,
      type: 'answer',
      transport: session.connectionMode,
      payload: sdp,
      signingKeyFingerprint: identity.signingKeyFingerprint,
      signature: await signPayload(sdp),
    );
  }

  void _wireChannel(RTCDataChannel channel) {
    _channel = channel;
    channel.onDataChannelState = (state) {
      if (state == RTCDataChannelState.RTCDataChannelOpen) {
        final queued = List<String>.from(_pendingOutbox);
        _pendingOutbox.clear();
        for (final raw in queued) {
          channel.send(RTCDataChannelMessage(raw));
        }
        for (final handler in _openHandlers) {
          handler();
        }
      }
    };
    channel.onMessage = (msg) {
      final data = msg.isBinary ? String.fromCharCodes(msg.binary) : msg.text;
      for (final handler in _messageHandlers) {
        handler(data);
      }
    };
  }

  @override
  void onChannelOpen(void Function() handler) => _openHandlers.add(handler);

  @override
  void onMessage(void Function(String data) handler) =>
      _messageHandlers.add(handler);

  @override
  void send(String data) {
    final channel = _channel;
    if (channel != null &&
        channel.state == RTCDataChannelState.RTCDataChannelOpen) {
      channel.send(RTCDataChannelMessage(data));
    } else {
      _pendingOutbox.add(data);
    }
  }

  Future<void> _waitForIceGatheringComplete(RTCPeerConnection pc) async {
    if (await pc.getIceGatheringState() ==
        RTCIceGatheringState.RTCIceGatheringStateComplete) {
      return;
    }
    final completer = Completer<void>();
    pc.onIceGatheringState = (state) {
      if (state == RTCIceGatheringState.RTCIceGatheringStateComplete &&
          !completer.isCompleted) {
        completer.complete();
      }
    };
    Timer(_iceGatherTimeout, () {
      if (!completer.isCompleted) completer.complete();
    });
    await completer.future;
  }

  @override
  Future<void> close() async {
    await _channel?.close();
    await _pc?.close();
    _pc = null;
    _channel = null;
  }
}
