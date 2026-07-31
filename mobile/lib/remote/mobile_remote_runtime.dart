import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../auth/mobile_auth_session.dart';
import 'mobile_backend_client.dart';
import 'mobile_device_identity.dart';
import 'mobile_remote_event_codec.dart';
import 'mobile_remote_models.dart';
import 'mobile_remote_transport.dart';
import 'mobile_webrtc_transport.dart';

enum MobileRemoteStatus {
  signedOut,
  registeringDevice,
  discovering,
  empty,
  available,
  accepting,
  connected,
  reconnecting,
  expired,
  error,
}

class MobileRemoteRuntime extends ChangeNotifier {
  MobileRemoteRuntime({
    required MobileAuthSession auth,
    MobileBackendClient? backend,
    MobileDeviceIdentityStore? identityStore,
    MobileRemoteTransport? transport,
    FlutterSecureStorage? secureStorage,
  }) : _auth = auth,
       _backend = backend ?? MobileBackendClient(auth: auth),
       _transport = transport ?? WebRtcMobileTransport(),
       _secureStorage = secureStorage ?? const FlutterSecureStorage() {
    _identityStore =
        identityStore ?? MobileDeviceIdentityStore(backend: _backend);
  }

  final MobileAuthSession _auth;
  final MobileBackendClient _backend;
  late final MobileDeviceIdentityStore _identityStore;
  final MobileRemoteTransport _transport;
  final FlutterSecureStorage _secureStorage;
  final MobileRemoteEventLedger _ledger = MobileRemoteEventLedger();

  Timer? _heartbeatTimer;
  // Uygulama arka plana geçtiğinde heartbeat durdurulur; geri dönüşte
  // yalnızca arka plana geçerken bağlantı hâlâ 'connected' idiyse ve
  // heartbeat gerçekten aktifken tekrar başlatılır.
  bool _heartbeatPausedForBackground = false;
  MobileRemoteStatus _status = MobileRemoteStatus.signedOut;
  MobileRemoteProtocol? _protocol;
  MobileDeviceIdentity? _identity;
  MobileRemoteSession? _currentSession;
  List<MobileRemoteSession> _sessions = const [];
  String? _error;

  MobileRemoteStatus get status => _status;
  MobileRemoteProtocol? get protocol => _protocol;
  MobileDeviceIdentity? get identity => _identity;
  MobileRemoteSession? get currentSession => _currentSession;
  List<MobileRemoteSession> get sessions => _sessions;
  String? get error => _error;
  bool get connected => _status == MobileRemoteStatus.connected;
  int get lastSequence => _ledger.lastSequence;

  Future<void> bootstrap() async {
    _stopHeartbeat();
    _error = null;
    final token = await _auth.accessToken();
    if (token == null || token.isEmpty) {
      _setStatus(MobileRemoteStatus.signedOut);
      return;
    }
    try {
      _setStatus(MobileRemoteStatus.registeringDevice);
      _identity = await _identityStore.ensureRegistered();
      _setStatus(MobileRemoteStatus.discovering);
      final protocolPayload = await _backend.getJson('/remote/protocol');
      _protocol = MobileRemoteProtocol.fromJson(
        protocolPayload['protocol'] as Map<String, dynamic>? ?? const {},
      );
      await _preflightTurnCredential();
      await refreshSessions();
    } catch (error) {
      _fail(error);
    }
  }

  Future<void> refreshSessions() async {
    try {
      _setStatus(MobileRemoteStatus.discovering);
      final payload = await _backend.getJson('/remote/sessions');
      final protocol = payload['protocol'];
      if (protocol is Map<String, dynamic>) {
        _protocol = MobileRemoteProtocol.fromJson(protocol);
      }
      final rawSessions = payload['sessions'] as List? ?? const [];
      _sessions = [
        for (final item in rawSessions)
          if (item is Map<String, dynamic>) MobileRemoteSession.fromJson(item),
      ];
      _setStatus(
        _sessions.isEmpty
            ? MobileRemoteStatus.empty
            : MobileRemoteStatus.available,
      );
    } catch (error) {
      _fail(error);
    }
  }

  Future<void> accept(MobileRemoteSession session) async {
    final identity = _identity ?? await _identityStore.ensureRegistered();
    try {
      _setStatus(MobileRemoteStatus.accepting);
      final turnCredential = await _sessionTurnCredential(session, identity);
      final answer = await _transport.buildAnswer(
        session: session,
        identity: identity,
        signPayload: _identityStore.signPayload,
        turnCredential: turnCredential,
      );
      final payload = await _backend.postJson(
        '/remote/sessions/${session.id}/accept',
        {'mobileDeviceId': identity.deviceId, 'signedAnswer': answer.toJson()},
      );
      final acceptedSession = MobileRemoteSession.fromJson(
        payload['session'] as Map<String, dynamic>,
      );
      final resumeToken = payload['resumeToken']?.toString();
      if (resumeToken != null && resumeToken.isNotEmpty) {
        await _secureStorage.write(
          key: _resumeTokenKey(acceptedSession.id),
          value: resumeToken,
        );
      }
      _identity = identity;
      _currentSession = acceptedSession;
      _sessions = const [];
      _ledger.restore(
        outgoingSeq: acceptedSession.lastSequence,
        incomingSeq: acceptedSession.lastSequence,
      );
      _setStatus(MobileRemoteStatus.connected);
      _startHeartbeat();
    } catch (error) {
      _fail(error);
    }
  }

  Future<void> resume(MobileRemoteSession session) async {
    final identity = _identity ?? await _identityStore.ensureRegistered();
    final resumeToken = await _secureStorage.read(
      key: _resumeTokenKey(session.id),
    );
    if (resumeToken == null || resumeToken.isEmpty) {
      _fail(
        const MobileBackendException('No resume token stored for session.'),
      );
      return;
    }
    try {
      _setStatus(MobileRemoteStatus.reconnecting);
      final payload = await _backend
          .postJson('/remote/sessions/${session.id}/resume', {
            'deviceId': identity.deviceId,
            'resumeToken': resumeToken,
            'lastSeenSequence': _ledger.lastSequence,
          });
      _currentSession = MobileRemoteSession.fromJson(
        payload['session'] as Map<String, dynamic>,
      );
      _setStatus(MobileRemoteStatus.connected);
      _startHeartbeat();
    } catch (error) {
      _fail(error);
    }
  }

  Future<MobileRemoteEvent?> createPromptEvent(String prompt) async {
    final session = _currentSession;
    final identity = _identity;
    if (session == null || identity == null || prompt.trim().isEmpty) {
      return null;
    }
    return _ledger.createSigned(
      sessionId: session.id,
      senderDeviceId: identity.deviceId,
      type: MobileRemoteEventTypes.promptSubmit,
      payload: {'prompt': prompt.trim()},
      sign: _identityStore.signPayload,
    );
  }

  Future<void> heartbeat() async {
    final session = _currentSession;
    final identity = _identity;
    if (session == null || identity == null) return;
    try {
      final payload = await _backend.postJson(
        '/remote/sessions/${session.id}/heartbeat',
        {'deviceId': identity.deviceId, 'lastSequence': _ledger.lastSequence},
      );
      _currentSession = MobileRemoteSession.fromJson(
        payload['session'] as Map<String, dynamic>,
      );
      if (_currentSession?.status == 'expired') {
        _setStatus(MobileRemoteStatus.expired);
        _stopHeartbeat();
      } else {
        notifyListeners();
      }
    } catch (error) {
      if (error is MobileBackendException && error.statusCode == 410) {
        _setStatus(MobileRemoteStatus.expired);
        _stopHeartbeat();
        return;
      }
      _fail(error);
    }
  }

  Future<void> disconnect() async {
    final session = _currentSession;
    _stopHeartbeat();
    if (session != null) {
      try {
        await _backend.postJson('/remote/sessions/${session.id}/close');
      } catch (_) {
        // A closed or expired backend session should not block local teardown.
      }
    }
    _currentSession = null;
    await _transport.close();
    await refreshSessions();
  }

  @override
  void dispose() {
    _stopHeartbeat();
    _backend.close();
    _identityStore.dispose();
    _transport.close();
    super.dispose();
  }

  Future<void> _preflightTurnCredential() async {
    final identity = _identity;
    if (identity == null) return;
    try {
      await _backend.postJson('/remote/turn-credentials', {
        'deviceId': identity.deviceId,
      });
    } catch (error) {
      if (error is MobileBackendException &&
          error.code == 'turn_not_configured') {
        return;
      }
      rethrow;
    }
  }

  Future<MobileTurnCredential?> _sessionTurnCredential(
    MobileRemoteSession session,
    MobileDeviceIdentity identity,
  ) async {
    try {
      final payload = await _backend.postJson('/remote/turn-credentials', {
        'deviceId': identity.deviceId,
        'sessionId': session.id,
      });
      final credential = payload['credential'];
      return credential is Map<String, dynamic>
          ? MobileTurnCredential.fromJson(credential)
          : null;
    } catch (error) {
      if (error is MobileBackendException &&
          error.code == 'turn_not_configured') {
        return null;
      }
      rethrow;
    }
  }

  void _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => unawaited(heartbeat()),
    );
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  /// Uygulama arka plana geçtiğinde çağrılır. Arka planda heartbeat isteği
  /// gönderilmemesi için timer'ı durdurur; yalnızca durdurma anında gerçekten
  /// aktif bir heartbeat varsa bunu hatırlar (böylece resume'da yalnızca
  /// gerçekten kesintiye uğramış bir heartbeat geri başlatılır).
  void pauseForBackground() {
    _heartbeatPausedForBackground = _heartbeatTimer != null;
    _stopHeartbeat();
  }

  /// Uygulama ön plana döndüğünde çağrılır. Bağlantı hâlâ 'connected'
  /// durumundaysa TEK bir heartbeat timer ile devam eder (_startHeartbeat
  /// zaten önce mevcut timer'ı durdurur, bu yüzden çoğaltma oluşmaz).
  void resumeFromBackground() {
    final shouldResume = _heartbeatPausedForBackground;
    _heartbeatPausedForBackground = false;
    if (shouldResume && _status == MobileRemoteStatus.connected) {
      _startHeartbeat();
    }
  }

  void _fail(Object error) {
    _error = error.toString();
    _setStatus(MobileRemoteStatus.error);
  }

  void _setStatus(MobileRemoteStatus value) {
    _status = value;
    notifyListeners();
  }

  String _resumeTokenKey(String sessionId) {
    return 'aurict.remote.resume.$sessionId';
  }
}
