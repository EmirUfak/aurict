import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class MobileCachedModelList {
  const MobileCachedModelList({
    required this.provider,
    required this.models,
    required this.fetchedAt,
    this.favoriteModels = const [],
    this.recentModels = const [],
  });

  final String provider;
  final List<String> models;
  final DateTime fetchedAt;
  final List<String> favoriteModels;
  final List<String> recentModels;

  Map<String, Object?> toJson() => {
    'provider': provider,
    'models': models,
    'fetchedAt': fetchedAt.toIso8601String(),
    'favoriteModels': favoriteModels,
    'recentModels': recentModels,
  };

  static MobileCachedModelList? fromJson(Map<String, Object?> json) {
    final provider = json['provider']?.toString() ?? '';
    final rawModels = json['models'];
    final fetchedAt = DateTime.tryParse(json['fetchedAt']?.toString() ?? '');
    if (provider.isEmpty || rawModels is! List || fetchedAt == null) {
      return null;
    }
    return MobileCachedModelList(
      provider: provider,
      models: rawModels
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList(growable: false),
      fetchedAt: fetchedAt,
      favoriteModels: _stringList(json['favoriteModels']),
      recentModels: _stringList(json['recentModels']),
    );
  }

  static List<String> _stringList(Object? raw) {
    if (raw is! List) return const [];
    return raw
        .map((item) => item.toString())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
}

abstract class MobileModelCacheStore {
  Future<Map<String, MobileCachedModelList>> readAll();
  Future<void> write(MobileCachedModelList cached);
  Future<void> clear();
}

class MemoryMobileModelCacheStore implements MobileModelCacheStore {
  final _cache = <String, MobileCachedModelList>{};

  @override
  Future<Map<String, MobileCachedModelList>> readAll() async {
    return Map.unmodifiable(_cache);
  }

  @override
  Future<void> write(MobileCachedModelList cached) async {
    _cache[cached.provider] = cached;
  }

  @override
  Future<void> clear() async {
    _cache.clear();
  }
}

class MethodChannelMobileModelCacheStore implements MobileModelCacheStore {
  MethodChannelMobileModelCacheStore({
    this.channel = const MethodChannel('dev.aurict.mobile/model_cache'),
    MobileModelCacheStore? fallback,
  }) : _fallback = fallback ?? MemoryMobileModelCacheStore();

  final MethodChannel channel;
  final MobileModelCacheStore _fallback;

  @override
  Future<Map<String, MobileCachedModelList>> readAll() async {
    try {
      final raw = await channel.invokeMethod<String>('readModelCache');
      if (raw == null || raw.trim().isEmpty || raw.trim() == '{}') {
        return const {};
      }
      return compute(parseMobileModelCachePayload, raw);
    } on MissingPluginException {
      return _fallback.readAll();
    }
  }

  @override
  Future<void> write(MobileCachedModelList cached) async {
    try {
      await channel.invokeMethod<void>('writeModelCache', {
        'provider': cached.provider,
        'payload': jsonEncode(cached.toJson()),
      });
    } on MissingPluginException {
      await _fallback.write(cached);
    }
  }

  @override
  Future<void> clear() async {
    try {
      await channel.invokeMethod<void>('clearModelCache');
    } on MissingPluginException {
      await _fallback.clear();
    }
  }
}

Map<String, MobileCachedModelList> parseMobileModelCachePayload(String raw) {
  final decoded = jsonDecode(raw);
  if (decoded is! Map<String, Object?>) return const {};
  final result = <String, MobileCachedModelList>{};
  for (final entry in decoded.entries) {
    final value = entry.value;
    if (value is! Map<String, Object?>) continue;
    final cached = MobileCachedModelList.fromJson(value);
    if (cached != null) result[entry.key] = cached;
  }
  return result;
}
