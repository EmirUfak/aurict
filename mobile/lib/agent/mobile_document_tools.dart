import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'mobile_artifact_renderer.dart';
import 'mobile_artifacts.dart';

String _extractPdfTextFromBytesInIsolate(Uint8List bytes) {
  return const MobileDocumentReaderTool().extractTextFromPdfBytes(bytes);
}

class MobileDocumentReadResult {
  const MobileDocumentReadResult({
    required this.name,
    required this.mimeType,
    required this.text,
    required this.summary,
    required this.truncated,
    required this.wordCount,
    required this.readable,
    required this.recommendedAction,
  });

  final String name;
  final String mimeType;
  final String text;
  final String summary;
  final bool truncated;
  final int wordCount;
  final bool readable;
  final String recommendedAction;

  Map<String, Object?> toJson() => {
    'name': name,
    'mimeType': mimeType,
    'text': text,
    'summary': summary,
    'truncated': truncated,
    'wordCount': wordCount,
    'readable': readable,
    'recommendedAction': recommendedAction,
  };
}

class MobileDocumentReaderTool {
  const MobileDocumentReaderTool();

  MobileDocumentReadResult readText({
    required String name,
    required String mimeType,
    required String content,
  }) {
    final normalized = _normalize(content);
    final text = _limit(normalized);
    return MobileDocumentReadResult(
      name: name.isEmpty ? 'user-document.txt' : name,
      mimeType: mimeType.isEmpty ? 'text/plain' : mimeType,
      text: text,
      summary: _summary(normalized),
      truncated: normalized.length > text.length,
      wordCount: _wordCount(normalized),
      readable: normalized.isNotEmpty,
      recommendedAction: _recommendedAction(normalized, 'text'),
    );
  }

  MobileDocumentReadResult readPdfBase64({
    required String name,
    required String base64Pdf,
  }) {
    final bytes = base64Decode(base64Pdf);
    final text = extractTextFromPdfBytes(bytes);
    final normalized = _normalize(text);
    final limited = _limit(normalized);
    return MobileDocumentReadResult(
      name: name.isEmpty ? 'user-document.pdf' : name,
      mimeType: 'application/pdf',
      text: limited,
      summary: _summary(normalized),
      truncated: normalized.length > limited.length,
      wordCount: _wordCount(normalized),
      readable: normalized.isNotEmpty,
      recommendedAction: normalized.isEmpty
          ? 'No readable PDF text detected. Ask the user for OCR text or a text/Markdown export.'
          : _recommendedAction(normalized, 'pdf'),
    );
  }

  Future<MobileDocumentReadResult> readPdfBase64Async({
    required String name,
    required String base64Pdf,
  }) async {
    final bytes = base64Decode(base64Pdf);
    final text = await compute(_extractPdfTextFromBytesInIsolate, bytes);
    final normalized = _normalize(text);
    final limited = _limit(normalized);
    return MobileDocumentReadResult(
      name: name.isEmpty ? 'user-document.pdf' : name,
      mimeType: 'application/pdf',
      text: limited,
      summary: _summary(normalized),
      truncated: normalized.length > limited.length,
      wordCount: _wordCount(normalized),
      readable: normalized.isNotEmpty,
      recommendedAction: normalized.isEmpty
          ? 'No readable PDF text detected. Ask the user for OCR text or a text/Markdown export.'
          : _recommendedAction(normalized, 'pdf'),
    );
  }

  String extractTextFromPdfBytes(Uint8List bytes) {
    final raw = latin1.decode(bytes, allowInvalid: true);
    final candidates = <String>[
      _extractPdfTextOperators(raw),
      ..._inflatePdfTextStreams(raw),
    ];
    final best = candidates
        .map(_decodePdfEscapes)
        .map(_normalize)
        .where((value) => value.length > 3)
        .fold<String>(
          '',
          (best, value) => value.length > best.length ? value : best,
        );
    if (best.isNotEmpty) return best;
    return raw.replaceAll(RegExp(r'[^\x20-\x7E]+'), ' ');
  }

  List<String> _inflatePdfTextStreams(String raw) {
    final streams = <String>[];
    final streamPattern = RegExp(
      r'<<(?:.|\n|\r)*?/FlateDecode(?:.|\n|\r)*?>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream',
      caseSensitive: false,
    );
    for (final match in streamPattern.allMatches(raw)) {
      final encoded = match.group(1);
      if (encoded == null || encoded.isEmpty) continue;
      try {
        final inflated = zlib.decode(latin1.encode(encoded));
        streams.add(
          _extractPdfTextOperators(latin1.decode(inflated, allowInvalid: true)),
        );
      } catch (_) {
        // Some PDFs use predictors or object streams; keep extraction best-effort.
      }
    }
    return streams;
  }

  String _extractPdfTextOperators(String raw) {
    final chunks = <String>[];
    final literalPattern = RegExp(
      r'''\((?:\\.|[^\\()]){1,4000}\)\s*(?:Tj|TJ|'|")''',
    );
    for (final match in literalPattern.allMatches(raw)) {
      final value = match.group(0);
      if (value == null) continue;
      final start = value.indexOf('(');
      final end = value.lastIndexOf(')');
      if (start >= 0 && end > start) {
        chunks.add(value.substring(start + 1, end));
      }
    }
    final arrayPattern = RegExp(r'\[((?:.|\n|\r){1,8000}?)\]\s*TJ');
    for (final match in arrayPattern.allMatches(raw)) {
      final array = match.group(1) ?? '';
      chunks.addAll(
        RegExp(r'\((?:\\.|[^\\()]){1,1000}\)').allMatches(array).map((item) {
          final value = item.group(0) ?? '';
          return value.substring(1, value.length - 1);
        }),
      );
    }
    final hexPattern = RegExp(r'<([0-9A-Fa-f]{4,8000})>\s*Tj');
    for (final match in hexPattern.allMatches(raw)) {
      final hex = match.group(1) ?? '';
      chunks.add(_decodePdfHex(hex));
    }
    return chunks.join(' ');
  }

  String _decodePdfEscapes(String value) {
    return value
        .replaceAll(r'\(', '(')
        .replaceAll(r'\)', ')')
        .replaceAll(r'\\', '\\')
        .replaceAll(r'\n', ' ')
        .replaceAll(r'\r', ' ')
        .replaceAll(r'\t', ' ');
  }

  String _decodePdfHex(String hex) {
    final bytes = <int>[];
    for (var i = 0; i + 1 < hex.length; i += 2) {
      final byte = int.tryParse(hex.substring(i, i + 2), radix: 16);
      if (byte != null) bytes.add(byte);
    }
    if (bytes.length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF) {
      final codes = <int>[];
      for (var i = 2; i + 1 < bytes.length; i += 2) {
        codes.add((bytes[i] << 8) + bytes[i + 1]);
      }
      return String.fromCharCodes(codes);
    }
    return latin1.decode(bytes, allowInvalid: true);
  }

  static String _normalize(String value) {
    return value.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  static String _limit(String value) {
    const maxChars = 18000;
    return value.length <= maxChars
        ? value
        : '${value.substring(0, maxChars)}...';
  }

  static String _summary(String value) {
    final normalized = _normalize(value);
    if (normalized.isEmpty) return 'No readable text detected.';
    final first = normalized.length <= 420
        ? normalized
        : '${normalized.substring(0, 417)}...';
    return first;
  }

  static int _wordCount(String value) {
    final normalized = _normalize(value);
    if (normalized.isEmpty) return 0;
    return normalized.split(RegExp(r'\s+')).length;
  }

  static String _recommendedAction(String value, String kind) {
    final normalized = _normalize(value);
    if (normalized.isEmpty) {
      return 'Ask the user to provide readable text before summarizing or answering questions.';
    }
    if (normalized.length < 500) {
      return 'Use the full bounded text for direct question answering.';
    }
    if (kind == 'pdf') {
      return 'Summarize the extracted PDF text first, then answer with extraction caveats if evidence is weak.';
    }
    return 'Create a short document summary before using it in a longer task.';
  }
}

class MobileDocumentExportTool {
  const MobileDocumentExportTool({
    this.planner = const MobileArtifactPlanner(),
    this.renderer = const MobileArtifactRenderer(),
  });

  final MobileArtifactPlanner planner;
  final MobileArtifactRenderer renderer;

  Map<String, Object?> export({
    required String title,
    required String markdown,
    required String format,
  }) {
    final objective = title.trim().isEmpty ? 'Aurict document' : title.trim();
    final normalizedFormat = format.toLowerCase().trim();
    final plan = _planFor(objective, normalizedFormat);
    final rendered = renderer.render(
      plan: plan,
      objective: markdown.trim().isEmpty ? objective : markdown.trim(),
    );
    return {
      'artifactName': plan.outputName,
      'mimeType': rendered.mimeType,
      'sizeBytes': rendered.sizeBytes,
      'preview': rendered.preview,
      'saved': false,
      'saveGate':
          'Generated locally as bytes. The UI must explicitly save/share the artifact before claiming completion.',
    };
  }

  MobileArtifactPlan _planFor(String title, String format) {
    if (format.contains('pdf')) {
      return MobileArtifactPlan(
        kind: MobileArtifactKind.pdfReport,
        title: title,
        outputName: _safeName(title, 'pdf'),
        gates: const [
          MobileArtifactGate.outline,
          MobileArtifactGate.draft,
          MobileArtifactGate.render,
          MobileArtifactGate.saved,
        ],
        localOnly: true,
      );
    }
    if (format.contains('slide') || format.contains('ppt')) {
      return MobileArtifactPlan(
        kind: MobileArtifactKind.slideDeck,
        title: title,
        outputName: _safeName(title, 'pdf'),
        gates: const [
          MobileArtifactGate.outline,
          MobileArtifactGate.draft,
          MobileArtifactGate.render,
          MobileArtifactGate.saved,
        ],
        localOnly: true,
      );
    }
    return MobileArtifactPlan(
      kind: MobileArtifactKind.markdown,
      title: title,
      outputName: _safeName(title, 'md'),
      gates: const [
        MobileArtifactGate.outline,
        MobileArtifactGate.draft,
        MobileArtifactGate.saved,
      ],
      localOnly: true,
    );
  }

  static String _safeName(String title, String extension) {
    final slug = title
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    return '${slug.isEmpty ? 'aurict-document' : slug}.$extension';
  }
}
