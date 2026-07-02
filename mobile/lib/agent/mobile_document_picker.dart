import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class MobilePickedDocument {
  const MobilePickedDocument({
    required this.name,
    required this.mimeType,
    required this.sizeBytes,
    required this.sourceUri,
    required this.textPreview,
  });

  final String name;
  final String mimeType;
  final int sizeBytes;
  final String sourceUri;
  final String textPreview;

  bool get hasTextPreview => textPreview.trim().isNotEmpty;

  factory MobilePickedDocument.fromJson(Map<String, Object?> json) {
    return MobilePickedDocument(
      name: json['name']?.toString() ?? 'document',
      mimeType: json['mimeType']?.toString() ?? 'application/octet-stream',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
      sourceUri: json['sourceUri']?.toString() ?? '',
      textPreview: json['textPreview']?.toString() ?? '',
    );
  }

  Map<String, Object?> toJson() => {
    'name': name,
    'mimeType': mimeType,
    'sizeBytes': sizeBytes,
    'sourceUri': sourceUri,
    'textPreview': textPreview,
  };
}

class MobileDocumentPickResult {
  const MobileDocumentPickResult({
    required this.ok,
    this.document,
    this.message,
  });

  final bool ok;
  final MobilePickedDocument? document;
  final String? message;

  factory MobileDocumentPickResult.fromJson(Map<String, Object?> json) {
    final rawDocument = json['document'];
    final document = rawDocument is Map
        ? MobilePickedDocument.fromJson(Map<String, Object?>.from(rawDocument))
        : null;
    return MobileDocumentPickResult(
      ok: json['ok'] == true,
      document: document,
      message: json['message']?.toString(),
    );
  }
}

class MobileDocumentPicker {
  const MobileDocumentPicker([
    this._channel = const MethodChannel('dev.aurict.mobile/document_picker'),
  ]);

  final MethodChannel _channel;

  Future<MobileDocumentPickResult> pickDocument() async {
    try {
      final result = await _channel.invokeMapMethod<String, Object?>(
        'pickDocument',
      );
      if (result == null) {
        return const MobileDocumentPickResult(
          ok: false,
          message: 'Document picker returned no result.',
        );
      }
      return MobileDocumentPickResult.fromJson(result);
    } on MissingPluginException {
      return const MobileDocumentPickResult(
        ok: false,
        message: 'Native document picker is not available in this build.',
      );
    } on PlatformException catch (error) {
      return MobileDocumentPickResult(
        ok: false,
        message: error.message ?? 'Document picker failed.',
      );
    }
  }
}

class MobileDocumentContextStore extends ChangeNotifier {
  final _documents = <MobilePickedDocument>[];

  List<MobilePickedDocument> get documents => List.unmodifiable(_documents);
  bool get hasDocuments => _documents.isNotEmpty;

  void attach(MobilePickedDocument document) {
    _documents.removeWhere(
      (item) =>
          item.sourceUri == document.sourceUri && item.name == document.name,
    );
    _documents.insert(0, document);
    if (_documents.length > 6) {
      _documents.removeRange(6, _documents.length);
    }
    notifyListeners();
  }

  void detach(MobilePickedDocument document) {
    _documents.removeWhere(
      (item) =>
          item.sourceUri == document.sourceUri && item.name == document.name,
    );
    notifyListeners();
  }

  void clear() {
    if (_documents.isEmpty) return;
    _documents.clear();
    notifyListeners();
  }

  String promptContext() {
    if (_documents.isEmpty) return '';
    final buffer = StringBuffer()
      ..writeln()
      ..writeln('User-selected document context:')
      ..writeln(
        'Use only this bounded preview/metadata unless the user explicitly imports more content. Do not claim access to full file bytes.',
      );
    for (var i = 0; i < _documents.length; i++) {
      final document = _documents[i];
      buffer
        ..writeln('Document ${i + 1}: ${document.name}')
        ..writeln('- mimeType: ${document.mimeType}')
        ..writeln('- sizeBytes: ${document.sizeBytes}');
      final preview = document.textPreview
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();
      if (preview.isNotEmpty) {
        buffer.writeln('- preview: ${_limit(preview)}');
      } else {
        buffer.writeln('- preview: No readable text preview available.');
      }
    }
    return buffer.toString();
  }

  static String _limit(String value) {
    const maxChars = 2400;
    return value.length <= maxChars
        ? value
        : '${value.substring(0, maxChars)}...';
  }
}
