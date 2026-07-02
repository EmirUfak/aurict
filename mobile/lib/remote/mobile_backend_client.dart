// ignore_for_file: prefer_initializing_formals

import 'dart:convert';
import 'dart:io';

import '../auth/mobile_auth_session.dart';

class MobileBackendClient {
  MobileBackendClient({
    required MobileAuthSession auth,
    Uri? baseUri,
    HttpClient? httpClient,
  }) : _auth = auth,
       _baseUri = baseUri ?? Uri.parse(aurictBackendBaseUrl),
       _httpClient = httpClient ?? HttpClient();

  final MobileAuthSession _auth;
  final Uri _baseUri;
  final HttpClient _httpClient;

  Future<Map<String, dynamic>> getJson(String path) async {
    return _sendJson('GET', path);
  }

  Future<Map<String, dynamic>> postJson(
    String path, [
    Map<String, Object?> body = const {},
  ]) async {
    return _sendJson('POST', path, body);
  }

  Future<Map<String, dynamic>> _sendJson(
    String method,
    String path, [
    Map<String, Object?>? body,
  ]) async {
    final accessToken = await _auth.accessToken();
    if (accessToken == null || accessToken.isEmpty) {
      throw const MobileBackendException(
        'Sign in before using remote control.',
      );
    }
    final request = await _httpClient
        .openUrl(method, _baseUri.resolve(path))
        .timeout(const Duration(seconds: 12));
    request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $accessToken');
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    if (body != null) {
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(body));
    }
    final response = await request.close().timeout(const Duration(seconds: 20));
    final text = await response.transform(utf8.decoder).join();
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
    final payload = decoded is Map<String, dynamic>
        ? decoded
        : <String, dynamic>{};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = payload['error'] is Map
          ? payload['error']['message']?.toString()
          : null;
      final code = payload['error'] is Map
          ? payload['error']['code']?.toString()
          : null;
      throw MobileBackendException(
        message ?? 'Backend request failed.',
        statusCode: response.statusCode,
        code: code,
      );
    }
    return payload;
  }

  void close() {
    _httpClient.close(force: true);
  }
}

class MobileBackendException implements Exception {
  const MobileBackendException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() {
    final parts = [
      if (statusCode != null) 'HTTP $statusCode',
      if (code != null) code,
      message,
    ];
    return parts.join(' · ');
  }
}
