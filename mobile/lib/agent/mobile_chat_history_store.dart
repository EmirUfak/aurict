import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/services.dart';

import 'mobile_document_picker.dart';

class MobileChatThreadMeta {
  const MobileChatThreadMeta({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    required this.messageCount,
    required this.preview,
    this.provider,
    this.model,
  });

  final String id;
  final String title;
  final DateTime createdAt;
  final DateTime updatedAt;
  final int messageCount;
  final String preview;
  final String? provider;
  final String? model;

  MobileChatThreadMeta copyWith({
    String? title,
    DateTime? updatedAt,
    int? messageCount,
    String? preview,
    String? provider,
    String? model,
  }) {
    return MobileChatThreadMeta(
      id: id,
      title: title ?? this.title,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      messageCount: messageCount ?? this.messageCount,
      preview: preview ?? this.preview,
      provider: provider ?? this.provider,
      model: model ?? this.model,
    );
  }

  Map<String, Object?> toJson() => {
    'id': id,
    'title': title,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'messageCount': messageCount,
    'preview': preview,
    'provider': provider,
    'model': model,
  };

  static MobileChatThreadMeta fromJson(Map<String, Object?> json) {
    return MobileChatThreadMeta(
      id: json['id']?.toString() ?? 'chat',
      title: json['title']?.toString() ?? 'Untitled chat',
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      updatedAt:
          DateTime.tryParse(json['updatedAt']?.toString() ?? '') ??
          DateTime.now(),
      messageCount: int.tryParse(json['messageCount']?.toString() ?? '') ?? 0,
      preview: json['preview']?.toString() ?? '',
      provider: json['provider']?.toString(),
      model: json['model']?.toString(),
    );
  }
}

class MobileChatThreadSnapshot {
  const MobileChatThreadSnapshot({
    required this.meta,
    required this.messages,
    this.documents = const [],
    this.encryptedPayload,
  });

  final MobileChatThreadMeta meta;
  final List<Map<String, Object?>> messages;
  final List<MobilePickedDocument> documents;
  final String? encryptedPayload;

  Map<String, Object?> toJson() => {
    'meta': meta.toJson(),
    'messages': messages,
    'documents': [for (final document in documents) document.toJson()],
    if (encryptedPayload != null) 'encryptedPayload': encryptedPayload,
  };

  static MobileChatThreadSnapshot fromJson(Map<String, Object?> json) {
    final metaJson = json['meta'];
    final messagesJson = json['messages'];
    final documentsJson = json['documents'];
    return MobileChatThreadSnapshot(
      meta: metaJson is Map<String, Object?>
          ? MobileChatThreadMeta.fromJson(metaJson)
          : MobileChatThreadMeta(
              id: 'chat',
              title: 'Untitled chat',
              createdAt: DateTime.now(),
              updatedAt: DateTime.now(),
              messageCount: 0,
              preview: '',
            ),
      messages: messagesJson is List
          ? messagesJson.whereType<Map<String, Object?>>().toList(
              growable: false,
            )
          : const [],
      documents: documentsJson is List
          ? documentsJson
                .whereType<Map<String, Object?>>()
                .map(MobilePickedDocument.fromJson)
                .toList(growable: false)
          : const [],
      encryptedPayload: json['encryptedPayload']?.toString(),
    );
  }
}

abstract class MobileChatHistoryStore {
  Future<List<MobileChatThreadMeta>> listThreads();
  Future<MobileChatThreadSnapshot?> readThread(String id);
  Future<void> writeThread(MobileChatThreadSnapshot snapshot);
  Future<void> deleteThread(String id);
  Future<void> clearAllThreads();
}

class MemoryMobileChatHistoryStore implements MobileChatHistoryStore {
  final _threads = <String, MobileChatThreadSnapshot>{};

  @override
  Future<List<MobileChatThreadMeta>> listThreads() async {
    final threads = _threads.values.map((thread) => thread.meta).toList();
    threads.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return threads;
  }

  @override
  Future<MobileChatThreadSnapshot?> readThread(String id) async {
    return _threads[id];
  }

  @override
  Future<void> writeThread(MobileChatThreadSnapshot snapshot) async {
    _threads[snapshot.meta.id] = snapshot;
  }

  @override
  Future<void> deleteThread(String id) async {
    _threads.remove(id);
  }

  @override
  Future<void> clearAllThreads() async {
    _threads.clear();
  }
}

class MethodChannelMobileChatHistoryStore implements MobileChatHistoryStore {
  MethodChannelMobileChatHistoryStore({
    this.channel = const MethodChannel('dev.aurict.mobile/chat_history'),
    MobileChatHistoryStore? fallback,
  }) : _fallback = fallback ?? MemoryMobileChatHistoryStore();

  final MethodChannel channel;
  final MobileChatHistoryStore _fallback;

  @override
  Future<List<MobileChatThreadMeta>> listThreads() async {
    try {
      final raw = await channel.invokeMethod<String>('listThreads');
      final decoded = jsonDecode(raw ?? '[]');
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map<String, Object?>>()
          .map(MobileChatThreadMeta.fromJson)
          .toList(growable: false)
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    } on MissingPluginException {
      return _fallback.listThreads();
    }
  }

  @override
  Future<MobileChatThreadSnapshot?> readThread(String id) async {
    try {
      final raw = await channel.invokeMethod<String>('readThread', {'id': id});
      if (raw == null || raw.trim().isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, Object?>) return null;
      return MobileChatThreadSnapshot.fromJson(decoded);
    } on MissingPluginException {
      return _fallback.readThread(id);
    }
  }

  @override
  Future<void> writeThread(MobileChatThreadSnapshot snapshot) async {
    try {
      await channel.invokeMethod<void>('writeThread', {
        'id': snapshot.meta.id,
        'payload': jsonEncode(snapshot.toJson()),
      });
    } on MissingPluginException {
      await _fallback.writeThread(snapshot);
    }
  }

  @override
  Future<void> deleteThread(String id) async {
    try {
      await channel.invokeMethod<void>('deleteThread', {'id': id});
    } on MissingPluginException {
      await _fallback.deleteThread(id);
    }
  }

  @override
  Future<void> clearAllThreads() async {
    try {
      await channel.invokeMethod<void>('clearAllThreads');
    } on MissingPluginException {
      await _fallback.clearAllThreads();
    }
  }
}

class EncryptedMobileChatHistoryStore implements MobileChatHistoryStore {
  EncryptedMobileChatHistoryStore({
    MobileChatHistoryStore? inner,
    FlutterSecureStorage? secureStorage,
  }) : _inner = inner ?? MethodChannelMobileChatHistoryStore(),
       _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _keyName = 'aurict.chat_history.aes_gcm_key';
  static final _algorithm = AesGcm.with256bits();
  static final _random = Random.secure();
  static List<int>? _memoryKey;

  final MobileChatHistoryStore _inner;
  final FlutterSecureStorage _secureStorage;

  @override
  Future<List<MobileChatThreadMeta>> listThreads() {
    return _inner.listThreads();
  }

  @override
  Future<MobileChatThreadSnapshot?> readThread(String id) async {
    final snapshot = await _inner.readThread(id);
    if (snapshot == null) return null;
    final encrypted = snapshot.encryptedPayload;
    if (encrypted == null || encrypted.trim().isEmpty) {
      return snapshot;
    }
    final decoded = await _decryptJson(encrypted);
    final messages = decoded['messages'];
    final documents = decoded['documents'];
    return MobileChatThreadSnapshot(
      meta: snapshot.meta,
      messages: messages is List
          ? messages.whereType<Map<String, Object?>>().toList(growable: false)
          : const [],
      documents: documents is List
          ? documents
                .whereType<Map<String, Object?>>()
                .map(MobilePickedDocument.fromJson)
                .toList(growable: false)
          : const [],
    );
  }

  @override
  Future<void> writeThread(MobileChatThreadSnapshot snapshot) async {
    final encryptedPayload = await _encryptJson({
      'messages': snapshot.messages,
      'documents': [
        for (final document in snapshot.documents) document.toJson(),
      ],
    });
    await _inner.writeThread(
      MobileChatThreadSnapshot(
        meta: snapshot.meta,
        messages: const [],
        documents: const [],
        encryptedPayload: encryptedPayload,
      ),
    );
  }

  @override
  Future<void> deleteThread(String id) {
    return _inner.deleteThread(id);
  }

  @override
  Future<void> clearAllThreads() {
    return _inner.clearAllThreads();
  }

  Future<String> _encryptJson(Map<String, Object?> payload) async {
    final key = await _readOrCreateKey();
    final nonce = _randomBytes(12);
    final secretBox = await _algorithm.encrypt(
      utf8.encode(jsonEncode(payload)),
      secretKey: key,
      nonce: nonce,
    );
    return jsonEncode({
      'v': 1,
      'alg': 'AES-GCM-256',
      'nonce': base64Encode(secretBox.nonce),
      'ciphertext': base64Encode(secretBox.cipherText),
      'mac': base64Encode(secretBox.mac.bytes),
    });
  }

  Future<Map<String, Object?>> _decryptJson(String raw) async {
    final envelope = jsonDecode(raw);
    if (envelope is! Map<String, Object?>) return const {};
    final key = await _readOrCreateKey();
    final clear = await _algorithm.decrypt(
      SecretBox(
        base64Decode(envelope['ciphertext']?.toString() ?? ''),
        nonce: base64Decode(envelope['nonce']?.toString() ?? ''),
        mac: Mac(base64Decode(envelope['mac']?.toString() ?? '')),
      ),
      secretKey: key,
    );
    final decoded = jsonDecode(utf8.decode(clear));
    return decoded is Map<String, Object?> ? decoded : const {};
  }

  Future<SecretKey> _readOrCreateKey() async {
    try {
      final existing = await _secureStorage.read(key: _keyName);
      if (existing != null && existing.isNotEmpty) {
        return SecretKey(base64Decode(existing));
      }
      final bytes = _randomBytes(32);
      await _secureStorage.write(key: _keyName, value: base64Encode(bytes));
      return SecretKey(bytes);
    } on MissingPluginException {
      _memoryKey ??= _randomBytes(32);
      return SecretKey(_memoryKey!);
    }
  }

  static List<int> _randomBytes(int length) {
    return List<int>.generate(length, (_) => _random.nextInt(256));
  }
}
