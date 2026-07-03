import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'mobile_tool_contracts.dart';

Map<String, Object?> _mobileMemoryObjectMap(Map<dynamic, dynamic> json) {
  return json.map((key, value) => MapEntry(key.toString(), value));
}

enum MobileMemoryCategory { preference, project, style, fact, other }

class MobileMemoryRecord {
  const MobileMemoryRecord({
    required this.id,
    required this.text,
    required this.category,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String text;
  final MobileMemoryCategory category;
  final DateTime createdAt;
  final DateTime updatedAt;

  Map<String, Object?> toJson() => {
    'id': id,
    'text': text,
    'category': category.name,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  static MobileMemoryRecord fromJson(Map<String, Object?> json) {
    final category = MobileMemoryCategory.values.firstWhere(
      (item) => item.name == json['category']?.toString(),
      orElse: () => MobileMemoryCategory.other,
    );
    return MobileMemoryRecord(
      id: json['id']?.toString() ?? 'memory',
      text: json['text']?.toString() ?? '',
      category: category,
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      updatedAt:
          DateTime.tryParse(json['updatedAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

abstract class MobileNoteMemoryStore {
  Future<List<MobileMemoryRecord>> readAll();
  Future<void> writeAll(List<MobileMemoryRecord> records);
}

class MemoryMobileNoteMemoryStore implements MobileNoteMemoryStore {
  final _records = <MobileMemoryRecord>[];

  @override
  Future<List<MobileMemoryRecord>> readAll() async {
    return [..._records]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  @override
  Future<void> writeAll(List<MobileMemoryRecord> records) async {
    _records
      ..clear()
      ..addAll(records);
  }
}

class SecureStorageMobileNoteMemoryStore implements MobileNoteMemoryStore {
  SecureStorageMobileNoteMemoryStore({
    FlutterSecureStorage? secureStorage,
    MobileNoteMemoryStore? fallback,
  }) : _secureStorage = secureStorage ?? const FlutterSecureStorage(),
       _fallback = fallback ?? MemoryMobileNoteMemoryStore();

  static const _storageKey = 'aurict.mobile.note_memory.v1';

  final FlutterSecureStorage _secureStorage;
  final MobileNoteMemoryStore _fallback;

  @override
  Future<List<MobileMemoryRecord>> readAll() async {
    try {
      final raw = await _secureStorage.read(key: _storageKey);
      if (raw == null || raw.trim().isEmpty) return const [];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map>()
          .map(
            (json) => MobileMemoryRecord.fromJson(_mobileMemoryObjectMap(json)),
          )
          .where((record) => record.text.trim().isNotEmpty)
          .toList(growable: false)
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    } on MissingPluginException {
      return _fallback.readAll();
    }
  }

  @override
  Future<void> writeAll(List<MobileMemoryRecord> records) async {
    try {
      await _secureStorage.write(
        key: _storageKey,
        value: jsonEncode([for (final record in records) record.toJson()]),
      );
    } on MissingPluginException {
      await _fallback.writeAll(records);
    }
  }
}

class MobileNoteMemoryTool {
  const MobileNoteMemoryTool({
    this.store,
    this.maxRecords = 100,
    this.maxTextChars = 1200,
  });

  final MobileNoteMemoryStore? store;
  final int maxRecords;
  final int maxTextChars;

  Future<String> run(Map<String, Object?> args) async {
    final action = args['action']?.toString().trim().toLowerCase() ?? 'list';
    final activeStore = store ?? SecureStorageMobileNoteMemoryStore();
    switch (action) {
      case 'remember':
        return _remember(activeStore, args);
      case 'list':
        return _list(activeStore);
      case 'search':
        return _search(activeStore, args);
      case 'forget':
        return _forget(activeStore, args);
      default:
        return MobileToolResult.failure(
          tool: 'note_memory',
          risk: MobileToolRisk.low,
          policy: mobileLocalPolicy,
          error: 'Unsupported note_memory action: $action',
          data: {
            'supportedActions': ['remember', 'list', 'search', 'forget'],
          },
        ).encode();
    }
  }

  Future<String> _remember(
    MobileNoteMemoryStore store,
    Map<String, Object?> args,
  ) async {
    final text = _normalize(args['text']?.toString() ?? '');
    if (text.isEmpty) {
      return MobileToolResult.failure(
        tool: 'note_memory',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: 'note_memory remember requires text.',
      ).encode();
    }
    final secretReason = _secretReason(text);
    if (secretReason != null) {
      return MobileToolResult.failure(
        tool: 'note_memory',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: 'Refused to store likely secret material: $secretReason.',
        data: {'redactionRequired': true},
      ).encode();
    }
    final now = DateTime.now();
    final category = _category(args['category']?.toString());
    final record = MobileMemoryRecord(
      id: 'mem-${now.microsecondsSinceEpoch}',
      text: text.length <= maxTextChars
          ? text
          : '${text.substring(0, maxTextChars)}...',
      category: category,
      createdAt: now,
      updatedAt: now,
    );
    final records = [record, ...await store.readAll()];
    await store.writeAll(records.take(maxRecords).toList(growable: false));
    return MobileToolResult.success(
      tool: 'note_memory',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('note_memory', {
        'action': 'remember',
        'category': category.name,
        'length': record.text.length,
      }),
      data: {
        'record': record.toJson(),
        'stored': true,
        'truncated': text.length > maxTextChars,
      },
    ).encode();
  }

  Future<String> _list(MobileNoteMemoryStore store) async {
    final records = await store.readAll();
    return MobileToolResult.success(
      tool: 'note_memory',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      data: {
        'count': records.length,
        'records': [for (final record in records) record.toJson()],
      },
    ).encode();
  }

  Future<String> _search(
    MobileNoteMemoryStore store,
    Map<String, Object?> args,
  ) async {
    final query = _normalize(args['query']?.toString() ?? '').toLowerCase();
    if (query.isEmpty) {
      return MobileToolResult.failure(
        tool: 'note_memory',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: 'note_memory search requires query.',
      ).encode();
    }
    final records = (await store.readAll())
        .where(
          (record) =>
              record.text.toLowerCase().contains(query) ||
              record.category.name.contains(query),
        )
        .toList(growable: false);
    return MobileToolResult.success(
      tool: 'note_memory',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('note_memory', {
        'action': 'search',
        'query': query,
      }),
      data: {
        'query': query,
        'count': records.length,
        'records': [for (final record in records) record.toJson()],
      },
    ).encode();
  }

  Future<String> _forget(
    MobileNoteMemoryStore store,
    Map<String, Object?> args,
  ) async {
    final id = args['id']?.toString().trim() ?? '';
    if (id.isEmpty) {
      return MobileToolResult.failure(
        tool: 'note_memory',
        risk: MobileToolRisk.low,
        policy: mobileLocalPolicy,
        error: 'note_memory forget requires id.',
      ).encode();
    }
    final records = await store.readAll();
    final next = [
      for (final record in records)
        if (record.id != id) record,
    ];
    await store.writeAll(next);
    return MobileToolResult.success(
      tool: 'note_memory',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      data: {
        'forgotten': records.length != next.length,
        'id': id,
        'count': next.length,
      },
    ).encode();
  }

  MobileMemoryCategory _category(String? value) {
    return MobileMemoryCategory.values.firstWhere(
      (category) => category.name == value?.trim().toLowerCase(),
      orElse: () => MobileMemoryCategory.other,
    );
  }

  String _normalize(String value) {
    return value.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  String? _secretReason(String value) {
    final patterns = <String, RegExp>{
      'api_key': RegExp(
        r'\b(api[_ -]?key|secret[_ -]?key)\b\s*[:=]',
        caseSensitive: false,
      ),
      'bearer_token': RegExp(
        r'\bBearer\s+[A-Za-z0-9._~+/=-]{12,}',
        caseSensitive: false,
      ),
      'openai_style_key': RegExp(
        r'\bsk-[A-Za-z0-9_-]{16,}\b',
        caseSensitive: false,
      ),
      'private_key': RegExp(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
      'password': RegExp(r'\bpassword\b\s*[:=]', caseSensitive: false),
    };
    for (final entry in patterns.entries) {
      if (entry.value.hasMatch(value)) return entry.key;
    }
    return null;
  }
}
