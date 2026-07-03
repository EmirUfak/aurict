import 'dart:convert';

import 'package:flutter/services.dart';

class MobileArtifactIndexRecord {
  const MobileArtifactIndexRecord({
    required this.artifact,
    required this.threadId,
    required this.threadTitle,
    required this.updatedAt,
  });

  final Map<String, Object?> artifact;
  final String threadId;
  final String threadTitle;
  final DateTime updatedAt;

  String get artifactId => artifact['id']?.toString() ?? 'artifact';

  Map<String, Object?> toJson() => {
    'artifact': artifact,
    'threadId': threadId,
    'threadTitle': threadTitle,
    'updatedAt': updatedAt.toIso8601String(),
  };

  static MobileArtifactIndexRecord fromJson(Map<String, Object?> json) {
    final artifact = json['artifact'];
    return MobileArtifactIndexRecord(
      artifact: artifact is Map<String, Object?>
          ? artifact
          : const <String, Object?>{},
      threadId: json['threadId']?.toString() ?? '',
      threadTitle: json['threadTitle']?.toString() ?? 'Untitled chat',
      updatedAt:
          DateTime.tryParse(json['updatedAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

abstract class MobileArtifactIndexStore {
  Future<List<MobileArtifactIndexRecord>> readAll();
  Future<void> writeAll(List<MobileArtifactIndexRecord> records);
  Future<void> upsertThreadArtifacts({
    required String threadId,
    required String threadTitle,
    required DateTime updatedAt,
    required List<Map<String, Object?>> artifacts,
  });
  Future<void> removeArtifact(String artifactId);
  Future<void> removeThread(String threadId);
  Future<void> clear();
}

class MemoryMobileArtifactIndexStore implements MobileArtifactIndexStore {
  final _records = <MobileArtifactIndexRecord>[];

  @override
  Future<List<MobileArtifactIndexRecord>> readAll() async {
    return [..._records]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  @override
  Future<void> writeAll(List<MobileArtifactIndexRecord> records) async {
    _records
      ..clear()
      ..addAll(records);
  }

  @override
  Future<void> upsertThreadArtifacts({
    required String threadId,
    required String threadTitle,
    required DateTime updatedAt,
    required List<Map<String, Object?>> artifacts,
  }) async {
    _records.removeWhere((record) => record.threadId == threadId);
    _records.addAll(
      artifacts.map(
        (artifact) => MobileArtifactIndexRecord(
          artifact: artifact,
          threadId: threadId,
          threadTitle: threadTitle,
          updatedAt: updatedAt,
        ),
      ),
    );
  }

  @override
  Future<void> removeArtifact(String artifactId) async {
    _records.removeWhere((record) => record.artifactId == artifactId);
  }

  @override
  Future<void> removeThread(String threadId) async {
    _records.removeWhere((record) => record.threadId == threadId);
  }

  @override
  Future<void> clear() async {
    _records.clear();
  }
}

class MethodChannelMobileArtifactIndexStore
    implements MobileArtifactIndexStore {
  MethodChannelMobileArtifactIndexStore({
    this.channel = const MethodChannel('dev.aurict.mobile/artifact_index'),
    MobileArtifactIndexStore? fallback,
  }) : _fallback = fallback ?? MemoryMobileArtifactIndexStore();

  final MethodChannel channel;
  final MobileArtifactIndexStore _fallback;

  @override
  Future<List<MobileArtifactIndexRecord>> readAll() async {
    try {
      final raw = await channel.invokeMethod<String>('readArtifactIndex');
      final decoded = jsonDecode(raw ?? '[]');
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map<String, Object?>>()
          .map(MobileArtifactIndexRecord.fromJson)
          .toList(growable: false)
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    } on MissingPluginException {
      return _fallback.readAll();
    }
  }

  @override
  Future<void> writeAll(List<MobileArtifactIndexRecord> records) async {
    try {
      await channel.invokeMethod<void>('writeArtifactIndex', {
        'payload': jsonEncode([for (final record in records) record.toJson()]),
      });
    } on MissingPluginException {
      await _fallback.writeAll(records);
    }
  }

  @override
  Future<void> upsertThreadArtifacts({
    required String threadId,
    required String threadTitle,
    required DateTime updatedAt,
    required List<Map<String, Object?>> artifacts,
  }) async {
    final current = await readAll();
    final next = [
      for (final record in current)
        if (record.threadId != threadId) record,
      for (final artifact in artifacts)
        MobileArtifactIndexRecord(
          artifact: artifact,
          threadId: threadId,
          threadTitle: threadTitle,
          updatedAt: updatedAt,
        ),
    ]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    await writeAll(next);
  }

  @override
  Future<void> removeArtifact(String artifactId) async {
    final next = [
      for (final record in await readAll())
        if (record.artifactId != artifactId) record,
    ];
    await writeAll(next);
  }

  @override
  Future<void> removeThread(String threadId) async {
    final next = [
      for (final record in await readAll())
        if (record.threadId != threadId) record,
    ];
    await writeAll(next);
  }

  @override
  Future<void> clear() async {
    try {
      await channel.invokeMethod<void>('clearArtifactIndex');
    } on MissingPluginException {
      await _fallback.clear();
    }
  }
}
