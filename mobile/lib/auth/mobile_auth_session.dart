import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

const aurictBackendBaseUrl = String.fromEnvironment(
  'AURICT_API_BASE_URL',
  defaultValue: 'https://api.aurict.com',
);

class AurictAccount {
  const AurictAccount({
    required this.userId,
    required this.email,
    required this.provider,
    required this.createdAt,
  });

  final String userId;
  final String email;
  final String provider;
  final DateTime createdAt;
}

class MobileAuthSession extends ChangeNotifier {
  MobileAuthSession({
    FirebaseAuth? firebaseAuth,
    FlutterSecureStorage? secureStorage,
    Uri? backendBaseUri,
  }) : _secureStorage = secureStorage ?? const FlutterSecureStorage(),
       _backendBaseUri = backendBaseUri ?? Uri.parse(aurictBackendBaseUrl) {
    _firebaseAuth =
        firebaseAuth ?? (Firebase.apps.isEmpty ? null : FirebaseAuth.instance);
    _authStateSubscription = _firebaseAuth?.authStateChanges().listen((_) {
      unawaited(_restore());
    });
    unawaited(_initialize());
  }

  late final FirebaseAuth? _firebaseAuth;
  final FlutterSecureStorage _secureStorage;
  final Uri _backendBaseUri;
  StreamSubscription<User?>? _authStateSubscription;

  AurictAccount? _account;
  String? _error;
  var _loading = true;
  var _googleInitialized = false;

  AurictAccount? get account => _account;
  String? get error => _error;
  bool get loading => _loading;
  bool get signedIn => _account != null;

  Future<void> signInWithGoogle() async {
    await _runAuthFlow(() async {
      final firebaseAuth = _requireFirebaseAuth();
      await _initializeGoogle();
      final googleAccount = await GoogleSignIn.instance.authenticate();
      final credential = GoogleAuthProvider.credential(
        idToken: googleAccount.authentication.idToken,
      );
      final userCredential = await firebaseAuth.signInWithCredential(
        credential,
      );
      await _exchangeFirebaseToken(userCredential.user, 'google');
    });
  }

  Future<void> signInWithGitHub() async {
    await _runAuthFlow(() async {
      final firebaseAuth = _requireFirebaseAuth();
      final provider = OAuthProvider('github.com')
        ..addScope('read:user')
        ..addScope('user:email');
      final userCredential = await firebaseAuth.signInWithProvider(provider);
      await _exchangeFirebaseToken(userCredential.user, 'github');
    });
  }

  Future<void> signOut() async {
    _setLoading(true);
    try {
      await _secureStorage.delete(key: _StorageKeys.accessToken);
      await _secureStorage.delete(key: _StorageKeys.refreshToken);
      await _secureStorage.delete(key: _StorageKeys.email);
      await _secureStorage.delete(key: _StorageKeys.userId);
      await _secureStorage.delete(key: _StorageKeys.provider);
      await _secureStorage.delete(key: _StorageKeys.createdAt);
      await _firebaseAuth?.signOut();
      if (_googleInitialized) {
        await GoogleSignIn.instance.signOut();
      }
      _account = null;
      _error = null;
    } catch (error) {
      _error = _friendlyError(error);
    } finally {
      _setLoading(false);
    }
  }

  Future<String?> accessToken() async {
    return _secureStorage.read(key: _StorageKeys.accessToken);
  }

  Future<String?> refreshToken() async {
    return _secureStorage.read(key: _StorageKeys.refreshToken);
  }

  @override
  void dispose() {
    _authStateSubscription?.cancel();
    super.dispose();
  }

  Future<void> _initialize() async {
    await _restore();
    _setLoading(false);
  }

  Future<void> _restore() async {
    final email = await _secureStorage.read(key: _StorageKeys.email);
    final userId = await _secureStorage.read(key: _StorageKeys.userId);
    final provider = await _secureStorage.read(key: _StorageKeys.provider);
    final createdAt = DateTime.tryParse(
      await _secureStorage.read(key: _StorageKeys.createdAt) ?? '',
    );
    if (email == null || userId == null || provider == null) {
      _account = null;
    } else {
      _account = AurictAccount(
        userId: userId,
        email: email,
        provider: provider,
        createdAt: createdAt ?? DateTime.now(),
      );
    }
    notifyListeners();
  }

  Future<void> _runAuthFlow(Future<void> Function() action) async {
    _setLoading(true);
    _error = null;
    try {
      await action();
    } catch (error) {
      _error = _friendlyError(error);
    } finally {
      _setLoading(false);
    }
  }

  Future<void> _initializeGoogle() async {
    if (_googleInitialized) return;
    await GoogleSignIn.instance.initialize();
    _googleInitialized = true;
  }

  FirebaseAuth _requireFirebaseAuth() {
    final firebaseAuth = _firebaseAuth;
    if (firebaseAuth == null) {
      throw StateError('Firebase is not initialized for this app instance.');
    }
    return firebaseAuth;
  }

  Future<void> _exchangeFirebaseToken(
    User? firebaseUser,
    String provider,
  ) async {
    final idToken = await firebaseUser?.getIdToken(true);
    if (idToken == null || idToken.isEmpty) {
      throw const FormatException('Firebase did not return an ID token.');
    }

    final response = await _postJson(
      _backendBaseUri.resolve('/auth/firebase'),
      {'idToken': idToken},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = response.body['error'] is Map
          ? response.body['error']['message']?.toString()
          : null;
      throw HttpException(message ?? 'Aurict backend rejected sign-in.');
    }
    final body = response.body;
    final user = body['user'] is Map<String, dynamic>
        ? body['user'] as Map<String, dynamic>
        : <String, dynamic>{};
    final now = DateTime.now();
    await _secureStorage.write(
      key: _StorageKeys.accessToken,
      value: body['accessToken']?.toString() ?? '',
    );
    await _secureStorage.write(
      key: _StorageKeys.refreshToken,
      value: body['refreshToken']?.toString() ?? '',
    );
    await _secureStorage.write(
      key: _StorageKeys.email,
      value: user['email']?.toString() ?? firebaseUser?.email ?? '',
    );
    await _secureStorage.write(
      key: _StorageKeys.userId,
      value: user['id']?.toString() ?? '',
    );
    await _secureStorage.write(key: _StorageKeys.provider, value: provider);
    await _secureStorage.write(
      key: _StorageKeys.createdAt,
      value: now.toIso8601String(),
    );
    _account = AurictAccount(
      userId: user['id']?.toString() ?? '',
      email: user['email']?.toString() ?? firebaseUser?.email ?? '',
      provider: provider,
      createdAt: now,
    );
  }

  Future<_BackendResponse> _postJson(Uri uri, Map<String, Object?> body) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 10);
    try {
      final request = await client
          .postUrl(uri)
          .timeout(const Duration(seconds: 12));
      request.headers.contentType = ContentType.json;
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.write(jsonEncode(body));
      final response = await request.close().timeout(
        const Duration(seconds: 20),
      );
      return _BackendResponse(
        statusCode: response.statusCode,
        body: await _decodeBody(response),
      );
    } finally {
      client.close(force: true);
    }
  }

  Future<Map<String, dynamic>> _decodeBody(HttpClientResponse response) async {
    final text = await response.transform(utf8.decoder).join();
    if (text.isEmpty) return <String, dynamic>{};
    final decoded = jsonDecode(text);
    return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
  }

  void _setLoading(bool value) {
    _loading = value;
    notifyListeners();
  }

  String _friendlyError(Object error) {
    if (error is FirebaseAuthException) {
      return error.message ?? error.code;
    }
    if (error is GoogleSignInException) {
      return error.description ?? error.code.name;
    }
    if (error is HttpException) return error.message;
    return error.toString();
  }
}

class _BackendResponse {
  const _BackendResponse({required this.statusCode, required this.body});

  final int statusCode;
  final Map<String, dynamic> body;
}

class MobileAuthScope extends InheritedNotifier<MobileAuthSession> {
  const MobileAuthScope({
    required MobileAuthSession session,
    required super.child,
    super.key,
  }) : super(notifier: session);

  static MobileAuthSession of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<MobileAuthScope>();
    assert(scope != null, 'MobileAuthScope not found');
    return scope!.notifier!;
  }
}

final class _StorageKeys {
  static const accessToken = 'aurict.auth.accessToken';
  static const refreshToken = 'aurict.auth.refreshToken';
  static const email = 'aurict.auth.email';
  static const userId = 'aurict.auth.userId';
  static const provider = 'aurict.auth.provider';
  static const createdAt = 'aurict.auth.createdAt';
}
