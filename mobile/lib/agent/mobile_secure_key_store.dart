import 'package:flutter/services.dart';

class MobileStoredProviderKey {
  const MobileStoredProviderKey({
    required this.provider,
    required this.key,
    required this.createdAt,
    required this.lastUsedAt,
  });

  final String provider;
  final String key;
  final DateTime createdAt;
  final DateTime lastUsedAt;

  String get last4 => key.length <= 4 ? key : key.substring(key.length - 4);
  String get fingerprint => '${key.length}:$last4';
  String get masked => key.isEmpty ? 'not set' : '•••• $last4';
}

abstract class MobileSecureKeyStore {
  Future<void> save(MobileStoredProviderKey key);
  Future<MobileStoredProviderKey?> read(String provider);
  Future<Map<String, MobileStoredProviderKey>> readAll(List<String> providers);
  Future<void> delete(String provider);
}

class MemoryMobileSecureKeyStore implements MobileSecureKeyStore {
  MemoryMobileSecureKeyStore();

  final _keys = <String, MobileStoredProviderKey>{};

  @override
  Future<void> save(MobileStoredProviderKey key) async {
    _keys[key.provider] = key;
  }

  @override
  Future<MobileStoredProviderKey?> read(String provider) async {
    return _keys[provider];
  }

  @override
  Future<Map<String, MobileStoredProviderKey>> readAll(
    List<String> providers,
  ) async {
    return {
      for (final provider in providers)
        if (_keys[provider] != null) provider: _keys[provider]!,
    };
  }

  @override
  Future<void> delete(String provider) async {
    _keys.remove(provider);
  }
}

class MethodChannelMobileSecureKeyStore implements MobileSecureKeyStore {
  MethodChannelMobileSecureKeyStore({
    this.channel = const MethodChannel('dev.aurict.mobile/secure_keys'),
    MobileSecureKeyStore? fallback,
  }) : _fallback = fallback ?? MemoryMobileSecureKeyStore();

  final MethodChannel channel;
  final MobileSecureKeyStore _fallback;

  @override
  Future<void> save(MobileStoredProviderKey key) async {
    try {
      await channel.invokeMethod<void>('saveProviderKey', {
        'provider': key.provider,
        'key': key.key,
        'createdAt': key.createdAt.toIso8601String(),
        'lastUsedAt': key.lastUsedAt.toIso8601String(),
      });
    } on MissingPluginException {
      await _fallback.save(key);
    }
  }

  @override
  Future<MobileStoredProviderKey?> read(String provider) async {
    try {
      final value = await channel.invokeMapMethod<String, Object?>(
        'readProviderKey',
        {'provider': provider},
      );
      if (value == null) return null;
      return _fromMap(value);
    } on MissingPluginException {
      return _fallback.read(provider);
    }
  }

  @override
  Future<Map<String, MobileStoredProviderKey>> readAll(
    List<String> providers,
  ) async {
    final result = <String, MobileStoredProviderKey>{};
    for (final provider in providers) {
      final key = await read(provider);
      if (key != null) result[provider] = key;
    }
    return result;
  }

  @override
  Future<void> delete(String provider) async {
    try {
      await channel.invokeMethod<void>('deleteProviderKey', {
        'provider': provider,
      });
    } on MissingPluginException {
      await _fallback.delete(provider);
    }
  }

  MobileStoredProviderKey _fromMap(Map<String, Object?> value) {
    final provider = value['provider']?.toString() ?? '';
    final key = value['key']?.toString() ?? '';
    return MobileStoredProviderKey(
      provider: provider,
      key: key,
      createdAt:
          DateTime.tryParse(value['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      lastUsedAt:
          DateTime.tryParse(value['lastUsedAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}
