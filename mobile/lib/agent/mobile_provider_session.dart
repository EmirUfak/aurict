// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:flutter/widgets.dart';

import 'mobile_model_cache_store.dart';
import 'mobile_provider_models.dart';
import 'mobile_secure_key_store.dart';

class MobileProviderEntry {
  const MobileProviderEntry({
    required this.name,
    required this.model,
    required this.config,
  });

  final String name;
  final String model;
  final MobileProviderConfig config;
}

class MobileProviderSession extends ChangeNotifier {
  // Public constructor keeps the external parameter readable while storing it privately.
  MobileProviderSession({
    MobileProviderModelService? modelService,
    MobileSecureKeyStore? keyStore,
    MobileModelCacheStore? modelCacheStore,
    Future<void> Function(Object error, String source)? errorReporter,
  }) : _modelService = modelService ?? const MobileProviderModelService(),
       _keyStore = keyStore ?? MethodChannelMobileSecureKeyStore(),
       _modelCacheStore =
           modelCacheStore ?? MethodChannelMobileModelCacheStore(),
       _errorReporter = errorReporter {
    unawaited(_hydrateInitialState());
  }

  final MobileProviderModelService _modelService;
  final MobileSecureKeyStore _keyStore;
  final MobileModelCacheStore _modelCacheStore;
  final Future<void> Function(Object error, String source)? _errorReporter;
  final _storedKeys = <String, MobileStoredProviderKey>{};
  final _models = <String, List<String>>{};
  final _modelFetchedAt = <String, DateTime>{};
  final _errors = <String, String>{};
  final _loading = <String>{};
  final _fetching = <String>{};
  final _favoriteModels = <String, Set<String>>{};
  final _recentModels = <String, List<String>>{};
  var _modelCacheGeneration = 0;

  String _selectedProvider = 'OpenCode';
  String? _selectedModel;

  static final providers = <MobileProviderEntry>[
    MobileProviderEntry(
      name: 'OpenAI',
      model: 'Fetch real models',
      config: MobileProviderModelService.openAI,
    ),
    MobileProviderEntry(
      name: 'Anthropic',
      model: 'Fetch real models',
      config: MobileProviderModelService.anthropic,
    ),
    MobileProviderEntry(
      name: 'Google',
      model: 'Fetch real models',
      config: MobileProviderModelService.google,
    ),
    MobileProviderEntry(
      name: 'OpenRouter',
      model: '100+ models',
      config: MobileProviderModelService.openRouter,
    ),
    MobileProviderEntry(
      name: 'OpenCode',
      model: 'OpenCode / Zenmux models',
      config: MobileProviderModelService.openCode,
    ),
    MobileProviderEntry(
      name: 'NVIDIA NIM',
      model: 'Nemotron, Qwen, DeepSeek, Kimi',
      config: MobileProviderModelService.nvidia,
    ),
    MobileProviderEntry(
      name: 'Z.ai',
      model: 'GLM reasoning and coding models',
      config: MobileProviderModelService.zai,
    ),
    MobileProviderEntry(
      name: 'Alibaba DashScope',
      model: 'Qwen OpenAI-compatible models',
      config: MobileProviderModelService.alibaba,
    ),
    MobileProviderEntry(
      name: 'Mistral',
      model: 'Mistral API models',
      config: MobileProviderModelService.mistral,
    ),
    MobileProviderEntry(
      name: 'Groq',
      model: 'Fast OpenAI-compatible inference',
      config: MobileProviderModelService.groq,
    ),
    MobileProviderEntry(
      name: 'Together AI',
      model: 'Open model inference',
      config: MobileProviderModelService.together,
    ),
    MobileProviderEntry(
      name: 'Fireworks',
      model: 'OpenAI-compatible serverless models',
      config: MobileProviderModelService.fireworks,
    ),
    MobileProviderEntry(
      name: 'xAI',
      model: 'Grok models',
      config: MobileProviderModelService.xai,
    ),
    MobileProviderEntry(
      name: 'Perplexity',
      model: 'Sonar search/reasoning models',
      config: MobileProviderModelService.perplexity,
    ),
    MobileProviderEntry(
      name: 'Custom compatible',
      model: 'OpenAI-compatible',
      config: MobileProviderModelService.openRouter,
    ),
  ];

  List<MobileProviderEntry> get entries => providers;
  String get selectedProvider => _selectedProvider;
  String? get selectedModel => _selectedModel;

  MobileProviderEntry get selectedEntry => providers.firstWhere(
    (entry) => entry.name == _selectedProvider,
    orElse: () => providers.firstWhere((entry) => entry.name == 'OpenCode'),
  );

  String? keyFor(String provider) => _storedKeys[provider]?.key;
  String? maskedKeyFor(String provider) => _storedKeys[provider]?.masked;
  String? keyFingerprintFor(String provider) =>
      _storedKeys[provider]?.fingerprint;
  List<String> modelsFor(String provider) => _models[provider] ?? const [];
  String? errorFor(String provider) => _errors[provider];
  bool isLoading(String provider) => _loading.contains(provider);
  bool hasKey(String provider) => _storedKeys.containsKey(provider);
  List<String> favoriteModelsFor(String provider) =>
      List.unmodifiable(_favoriteModels[provider] ?? const <String>{});
  List<String> recentModelsFor(String provider) =>
      List.unmodifiable(_recentModels[provider] ?? const <String>[]);
  bool isFavoriteModel(String provider, String model) {
    return _favoriteModels[provider]?.contains(model) == true;
  }

  String? get selectedKey => keyFor(_selectedProvider);
  List<String> get selectedModels => modelsFor(_selectedProvider);
  bool get canUseSelectedModel {
    final key = selectedKey?.trim();
    final model = selectedModel?.trim();
    return key != null && key.isNotEmpty && model != null && model.isNotEmpty;
  }

  Future<void> _hydrateInitialState() async {
    final cacheFuture = _modelCacheStore.readAll();
    final keyFuture = _keyStore.readAll(
      providers.map((provider) => provider.name).toList(growable: false),
    );
    try {
      final loadedCache = await cacheFuture;
      final loadedKeys = await keyFuture;
      var changed = false;
      changed = _applyModelCache(loadedCache) || changed;
      changed = _applyStoredKeys(loadedKeys) || changed;
      if (changed) notifyListeners();
    } catch (error) {
      unawaited(
        _errorReporter?.call(error, 'provider_hydrate') ?? Future.value(),
      );
    }
  }

  bool _applyStoredKeys(Map<String, MobileStoredProviderKey> loaded) {
    if (loaded.isEmpty) return false;
    _storedKeys
      ..clear()
      ..addAll(loaded);
    if (!_storedKeys.containsKey(_selectedProvider)) {
      _selectedProvider = _storedKeys.keys.first;
    }
    return true;
  }

  bool _applyModelCache(Map<String, MobileCachedModelList> loaded) {
    if (loaded.isEmpty) return false;
    final lastSelection = loaded[kLastSelectionCacheKey];
    for (final entry in loaded.entries) {
      if (entry.key == kLastSelectionCacheKey) continue;
      final cached = entry.value;
      if (cached.models.isEmpty) continue;
      _models[entry.key] = cached.models;
      _modelFetchedAt[entry.key] = cached.fetchedAt;
      _favoriteModels[entry.key] = cached.favoriteModels.toSet();
      _recentModels[entry.key] = cached.recentModels
          .where(
            (model) => cached.models.isEmpty || cached.models.contains(model),
          )
          .toList(growable: false);
    }
    // Son gerçekten seçilen provider/model hâlâ geçerliyse (cache'de duruyorsa)
    // onu geri yükle — aksi halde eski davranışa (ilk model) düş.
    final restoredProvider = lastSelection?.selectedProvider;
    final restoredModel = lastSelection?.selectedModel;
    if (restoredProvider != null &&
        restoredModel != null &&
        (_models[restoredProvider]?.contains(restoredModel) ?? false)) {
      _selectedProvider = restoredProvider;
      _selectedModel = restoredModel;
    } else if (_models[_selectedProvider]?.isNotEmpty == true) {
      _selectedModel = _models[_selectedProvider]!.first;
    }
    return true;
  }

  Future<void> _persistLastSelection() {
    final provider = _selectedProvider;
    final model = _selectedModel;
    if (model == null) return Future.value();
    return _modelCacheStore.write(
      MobileCachedModelList(
        provider: kLastSelectionCacheKey,
        models: const [],
        fetchedAt: DateTime.now(),
        selectedProvider: provider,
        selectedModel: model,
      ),
    );
  }

  Future<void> saveTemporaryKey(String provider, String key) {
    return saveProviderKey(provider, key);
  }

  Future<void> saveProviderKey(
    String provider,
    String key, {
    bool autoFetchModels = true,
  }) async {
    final normalized = key.trim();
    if (normalized.isEmpty) {
      _storedKeys.remove(provider);
      _models.remove(provider);
      _modelFetchedAt.remove(provider);
      _modelCacheGeneration++;
      _errors.remove(provider);
      if (_selectedProvider == provider) _selectedModel = null;
      notifyListeners();
      await _keyStore.delete(provider);
    } else {
      final existing = _storedKeys[provider];
      final stored = MobileStoredProviderKey(
        provider: provider,
        key: normalized,
        createdAt: existing?.createdAt ?? DateTime.now(),
        lastUsedAt: DateTime.now(),
      );
      _storedKeys[provider] = stored;
      _selectedProvider = provider;
      _errors.remove(provider);
      notifyListeners();
      await _keyStore.save(stored);
      if (autoFetchModels) {
        final entry = _entryFor(provider);
        if (entry != null) unawaited(fetchModels(entry));
      }
    }
  }

  Future<void> clearProvider(String provider) async {
    await _keyStore.delete(provider);
    _storedKeys.remove(provider);
    _models.remove(provider);
    _modelFetchedAt.remove(provider);
    _modelCacheGeneration++;
    _errors.remove(provider);
    _loading.remove(provider);
    _fetching.remove(provider);
    _favoriteModels.remove(provider);
    _recentModels.remove(provider);
    if (_selectedProvider == provider) _selectedModel = null;
    notifyListeners();
  }

  Future<void> clearAllProviders() async {
    final names = providers.map((provider) => provider.name).toList();
    for (final provider in names) {
      await _keyStore.delete(provider);
    }
    _storedKeys.clear();
    _models.clear();
    _modelFetchedAt.clear();
    _favoriteModels.clear();
    _recentModels.clear();
    _modelCacheGeneration++;
    await _modelCacheStore.clear();
    _errors.clear();
    _loading.clear();
    _fetching.clear();
    _selectedModel = null;
    notifyListeners();
  }

  Future<void> clearModelCache() async {
    _models.clear();
    _modelFetchedAt.clear();
    _favoriteModels.clear();
    _recentModels.clear();
    _modelCacheGeneration++;
    _errors.clear();
    _loading.clear();
    _fetching.clear();
    _selectedModel = null;
    notifyListeners();
    await _modelCacheStore.clear();
  }

  void selectProvider(String provider) {
    if (_selectedProvider == provider) return;
    _selectedProvider = provider;
    final available = modelsFor(provider);
    _selectedModel = available.contains(_selectedModel) ? _selectedModel : null;
    notifyListeners();
  }

  void selectModel(String provider, String model) {
    _selectedProvider = provider;
    _selectedModel = model;
    _recordRecentModel(provider, model);
    unawaited(_persistModelMetadata(provider));
    unawaited(_persistLastSelection());
    notifyListeners();
  }

  void toggleFavoriteModel(String provider, String model) {
    final favorites = _favoriteModels.putIfAbsent(provider, () => <String>{});
    if (!favorites.add(model)) {
      favorites.remove(model);
    }
    unawaited(_persistModelMetadata(provider));
    notifyListeners();
  }

  Future<void> fetchModels(
    MobileProviderEntry provider, {
    bool force = false,
  }) async {
    final key = keyFor(provider.name)?.trim();
    if (key == null || key.isEmpty) {
      _errors[provider.name] = 'Paste a temporary API key first.';
      notifyListeners();
      return;
    }
    if (!force &&
        _models.containsKey(provider.name) &&
        !_modelsExpired(provider.name)) {
      _selectedProvider = provider.name;
      if (_selectedModel == null && _models[provider.name]!.isNotEmpty) {
        _selectedModel = _models[provider.name]!.first;
        unawaited(_persistLastSelection());
      }
      notifyListeners();
      return;
    }
    if (_fetching.contains(provider.name)) return;
    _fetching.add(provider.name);
    final generation = _modelCacheGeneration;
    _loading.add(provider.name);
    _errors.remove(provider.name);
    notifyListeners();
    try {
      final result = await _modelService.fetchModels(
        config: provider.config,
        apiKey: key,
      );
      if (generation != _modelCacheGeneration) return;
      _models[provider.name] = result.models;
      _modelFetchedAt[provider.name] = DateTime.now();
      await _modelCacheStore.write(
        MobileCachedModelList(
          provider: provider.name,
          models: result.models,
          fetchedAt: _modelFetchedAt[provider.name]!,
          favoriteModels: favoriteModelsFor(provider.name),
          recentModels: recentModelsFor(provider.name),
        ),
      );
      _selectedProvider = provider.name;
      if (result.models.isNotEmpty) {
        _selectedModel = result.models.contains(_selectedModel)
            ? _selectedModel
            : result.models.first;
        _recordRecentModel(provider.name, _selectedModel!);
        unawaited(_persistLastSelection());
      }
    } catch (error) {
      _errors[provider.name] = error.toString();
      unawaited(_errorReporter?.call(error, 'model_fetch') ?? Future.value());
    } finally {
      _fetching.remove(provider.name);
      _loading.remove(provider.name);
      notifyListeners();
    }
  }

  bool _modelsExpired(String provider) {
    final fetchedAt = _modelFetchedAt[provider];
    if (fetchedAt == null) return true;
    return DateTime.now().difference(fetchedAt) > const Duration(hours: 6);
  }

  MobileProviderEntry? _entryFor(String provider) {
    for (final entry in providers) {
      if (entry.name == provider) return entry;
    }
    return null;
  }

  void _recordRecentModel(String provider, String model) {
    final recent = _recentModels.putIfAbsent(provider, () => <String>[]);
    recent
      ..remove(model)
      ..insert(0, model);
    if (recent.length > 8) {
      recent.removeRange(8, recent.length);
    }
  }

  Future<void> _persistModelMetadata(String provider) async {
    final models = _models[provider] ?? const <String>[];
    if (models.isEmpty &&
        (_favoriteModels[provider]?.isEmpty ?? true) &&
        (_recentModels[provider]?.isEmpty ?? true)) {
      return;
    }
    await _modelCacheStore.write(
      MobileCachedModelList(
        provider: provider,
        models: models,
        fetchedAt: _modelFetchedAt[provider] ?? DateTime.now(),
        favoriteModels: favoriteModelsFor(provider),
        recentModels: recentModelsFor(provider),
      ),
    );
  }
}

class MobileProviderSessionScope
    extends InheritedNotifier<MobileProviderSession> {
  const MobileProviderSessionScope({
    required MobileProviderSession session,
    required super.child,
    super.key,
  }) : super(notifier: session);

  static MobileProviderSession of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<MobileProviderSessionScope>();
    assert(scope != null, 'MobileProviderSessionScope not found');
    return scope!.notifier!;
  }

  static MobileProviderSession read(BuildContext context) {
    final element = context
        .getElementForInheritedWidgetOfExactType<MobileProviderSessionScope>();
    final scope = element?.widget as MobileProviderSessionScope?;
    assert(scope != null, 'MobileProviderSessionScope not found');
    return scope!.notifier!;
  }
}
