import 'dart:async';
import 'dart:convert';

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
  });

  final MobileChatThreadMeta meta;
  final List<Map<String, Object?>> messages;
  final List<MobilePickedDocument> documents;

  Map<String, Object?> toJson() => {
    'meta': meta.toJson(),
    'messages': messages,
    'documents': [for (final document in documents) document.toJson()],
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
