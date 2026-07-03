import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class MobileDiagnosticEvent {
  const MobileDiagnosticEvent({
    required this.id,
    required this.level,
    required this.message,
    required this.createdAt,
    this.source = 'app',
    this.details,
  });

  final String id;
  final String level;
  final String source;
  final String message;
  final String? details;
  final DateTime createdAt;

  Map<String, Object?> toJson() => {
    'id': id,
    'level': level,
    'source': source,
    'message': message,
    'details': details,
    'createdAt': createdAt.toIso8601String(),
  };

  static MobileDiagnosticEvent fromJson(Map<String, Object?> json) {
    return MobileDiagnosticEvent(
      id: json['id']?.toString() ?? 'diagnostic',
      level: json['level']?.toString() ?? 'info',
      source: json['source']?.toString() ?? 'app',
      message: json['message']?.toString() ?? '',
      details: json['details']?.toString(),
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

abstract class MobileDiagnosticsStore {
  Future<List<MobileDiagnosticEvent>> readEvents();
  Future<void> writeEvent(MobileDiagnosticEvent event);
  Future<void> clear();
}

class MemoryMobileDiagnosticsStore implements MobileDiagnosticsStore {
  final _events = <MobileDiagnosticEvent>[];

  @override
  Future<List<MobileDiagnosticEvent>> readEvents() async {
    return _events.toList(growable: false)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  @override
  Future<void> writeEvent(MobileDiagnosticEvent event) async {
    _events
      ..removeWhere((item) => item.id == event.id)
      ..insert(0, event);
    if (_events.length > 80) {
      _events.removeRange(80, _events.length);
    }
  }

  @override
  Future<void> clear() async {
    _events.clear();
  }
}

class MethodChannelMobileDiagnosticsStore implements MobileDiagnosticsStore {
  MethodChannelMobileDiagnosticsStore({
    this.channel = const MethodChannel('dev.aurict.mobile/diagnostics'),
    MobileDiagnosticsStore? fallback,
  }) : _fallback = fallback ?? MemoryMobileDiagnosticsStore();

  final MethodChannel channel;
  final MobileDiagnosticsStore _fallback;

  @override
  Future<List<MobileDiagnosticEvent>> readEvents() async {
    try {
      final raw = await channel.invokeMethod<String>('readDiagnostics');
      final decoded = jsonDecode(raw ?? '[]');
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map<String, Object?>>()
          .map(MobileDiagnosticEvent.fromJson)
          .toList(growable: false)
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } on MissingPluginException {
      return _fallback.readEvents();
    }
  }

  @override
  Future<void> writeEvent(MobileDiagnosticEvent event) async {
    try {
      await channel.invokeMethod<void>('writeDiagnostic', {
        'payload': jsonEncode(event.toJson()),
      });
    } on MissingPluginException {
      await _fallback.writeEvent(event);
    }
  }

  @override
  Future<void> clear() async {
    try {
      await channel.invokeMethod<void>('clearDiagnostics');
    } on MissingPluginException {
      await _fallback.clear();
    }
  }
}

class MobileDiagnosticsController extends ChangeNotifier {
  MobileDiagnosticsController({MobileDiagnosticsStore? store})
    : _store = store ?? MethodChannelMobileDiagnosticsStore();

  final MobileDiagnosticsStore _store;
  final _events = <MobileDiagnosticEvent>[];
  var _loaded = false;

  List<MobileDiagnosticEvent> get events => List.unmodifiable(_events);
  bool get loaded => _loaded;

  Future<void> load() async {
    if (_loaded) return;
    final events = await _store.readEvents();
    _events
      ..clear()
      ..addAll(events);
    _loaded = true;
    notifyListeners();
  }

  Future<void> record(
    Object error, {
    StackTrace? stackTrace,
    String source = 'app',
    String level = 'error',
  }) async {
    final now = DateTime.now();
    final event = MobileDiagnosticEvent(
      id: 'diag-${now.microsecondsSinceEpoch}',
      level: level,
      source: source,
      message: _short(error.toString(), 260),
      details: stackTrace == null ? null : _short(stackTrace.toString(), 2400),
      createdAt: now,
    );
    _events.insert(0, event);
    if (_events.length > 80) {
      _events.removeRange(80, _events.length);
    }
    notifyListeners();
    await _store.writeEvent(event);
  }

  Future<void> clear() async {
    _events.clear();
    notifyListeners();
    await _store.clear();
  }

  static String _short(String value, int limit) {
    final compact = value.replaceAll(RegExp(r'\s+'), ' ').trim();
    return compact.length <= limit
        ? compact
        : '${compact.substring(0, limit)}...';
  }
}

final mobileDiagnostics = MobileDiagnosticsController();
