import 'dart:convert';

import 'package:flutter/services.dart';

class MobileHtmlDocument {
  const MobileHtmlDocument({
    required this.title,
    required this.html,
    required this.css,
    required this.pageSize,
    required this.theme,
  });

  final String title;
  final String html;
  final String css;
  final String pageSize;
  final String theme;

  String get fullHtml =>
      '''
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${_escape(title)}</title>
  <style>$css</style>
</head>
<body>$html</body>
</html>
''';

  Map<String, Object?> toJson() => {
    'title': title,
    'html': html,
    'css': css,
    'pageSize': pageSize,
    'theme': theme,
    'fullHtml': fullHtml,
  };

  static String _escape(String value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
  }
}

class MobileHtmlSanitizerResult {
  const MobileHtmlSanitizerResult({
    required this.ok,
    required this.html,
    required this.css,
    required this.issues,
  });

  final bool ok;
  final String html;
  final String css;
  final List<String> issues;

  Map<String, Object?> toJson() => {
    'ok': ok,
    'html': html,
    'css': css,
    'issues': issues,
  };
}

class MobileHtmlDocumentTool {
  const MobileHtmlDocumentTool();

  MobileHtmlDocument create({
    required String title,
    required String html,
    required String css,
    String pageSize = 'A4',
    String theme = 'executive',
  }) {
    final sanitized = sanitize(html: html, css: css);
    return MobileHtmlDocument(
      title: title.trim().isEmpty ? 'Aurict Document' : title.trim(),
      html: sanitized.html,
      css: '${_baseCss(pageSize, theme)}\n${sanitized.css}',
      pageSize: pageSize.trim().isEmpty ? 'A4' : pageSize.trim(),
      theme: theme.trim().isEmpty ? 'executive' : theme.trim(),
    );
  }

  MobileHtmlSanitizerResult sanitize({
    required String html,
    required String css,
  }) {
    final issues = <String>[];
    var safeHtml = html;
    var safeCss = css;
    final blockedPatterns = <RegExp>[
      RegExp(r'<script[\s\S]*?</script>', caseSensitive: false),
      RegExp(r'<iframe[\s\S]*?</iframe>', caseSensitive: false),
      RegExp(r'<form[\s\S]*?</form>', caseSensitive: false),
      RegExp(r'''\son[a-z]+\s*=\s*["'][\s\S]*?["']''', caseSensitive: false),
      RegExp(r'javascript:', caseSensitive: false),
    ];
    for (final pattern in blockedPatterns) {
      if (pattern.hasMatch(safeHtml)) {
        issues.add('Removed unsafe HTML pattern: ${pattern.pattern}');
        safeHtml = safeHtml.replaceAll(pattern, ' ');
      }
    }
    final remoteUrl = RegExp(
      r'''url\(\s*["']?https?://''',
      caseSensitive: false,
    );
    if (remoteUrl.hasMatch(safeCss)) {
      issues.add('Removed remote CSS url() resource.');
      safeCss = safeCss.replaceAll(remoteUrl, 'url(');
    }
    if (safeHtml.length > 180000) {
      issues.add('HTML truncated to 180000 characters.');
      safeHtml = safeHtml.substring(0, 180000);
    }
    if (safeCss.length > 50000) {
      issues.add('CSS truncated to 50000 characters.');
      safeCss = safeCss.substring(0, 50000);
    }
    return MobileHtmlSanitizerResult(
      ok: true,
      html: safeHtml.trim(),
      css: safeCss.trim(),
      issues: issues,
    );
  }

  String _baseCss(String pageSize, String theme) {
    final accent = switch (theme.toLowerCase()) {
      'academic' => '#1f4f46',
      'proposal' => '#9a4f16',
      'minimal' => '#222222',
      _ => '#155e75',
    };
    return '''
@page { size: $pageSize; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Avenir Next", sans-serif; color: #172026; line-height: 1.45; }
h1 { font-size: 30px; letter-spacing: -0.03em; margin: 0 0 18px; color: $accent; }
h2 { font-size: 19px; margin: 26px 0 10px; color: #1f2933; page-break-after: avoid; }
p { margin: 0 0 10px; }
table { width: 100%; border-collapse: collapse; margin: 14px 0; page-break-inside: avoid; }
th, td { border: 1px solid #d8dee4; padding: 8px 10px; text-align: left; vertical-align: top; }
th { background: #eef6f8; color: #102a33; }
.callout { border-left: 4px solid $accent; background: #f4fafb; padding: 12px 14px; border-radius: 10px; margin: 14px 0; }
.cover { min-height: 220px; display: flex; flex-direction: column; justify-content: center; border-bottom: 2px solid $accent; margin-bottom: 24px; }
.muted { color: #64748b; }
''';
  }
}

class MobileHtmlToPdfArtifact {
  const MobileHtmlToPdfArtifact({
    required this.artifactId,
    required this.fileName,
    required this.mimeType,
    required this.bytes,
    required this.htmlPreview,
    required this.saved,
    required this.shared,
  });

  final String artifactId;
  final String fileName;
  final String mimeType;
  final Uint8List bytes;
  final String htmlPreview;
  final bool saved;
  final bool shared;

  Map<String, Object?> toJson() => {
    'artifactId': artifactId,
    'artifactName': fileName,
    'mimeType': mimeType,
    'sizeBytes': bytes.length,
    'htmlPreview': htmlPreview,
    'saved': saved,
    'shared': shared,
    'saveGate':
        'PDF rendered locally. User must tap Save or Share before claiming phone export completion.',
  };
}

class MobileArtifactRegistry {
  MobileArtifactRegistry._();

  static final _artifacts = <String, MobileHtmlToPdfArtifact>{};

  static void put(MobileHtmlToPdfArtifact artifact) {
    _artifacts[artifact.artifactId] = artifact;
  }

  static MobileHtmlToPdfArtifact? get(String artifactId) {
    return _artifacts[artifactId];
  }

  static void remove(String artifactId) {
    _artifacts.remove(artifactId);
  }

  static void clear() {
    _artifacts.clear();
  }
}

class MobileHtmlToPdfRenderer {
  const MobileHtmlToPdfRenderer([
    this._channel = const MethodChannel('dev.aurict.mobile/artifacts'),
  ]);

  final MethodChannel _channel;

  Future<MobileHtmlToPdfArtifact> render({
    required MobileHtmlDocument document,
    required String fileName,
  }) async {
    final artifactId =
        'artifact-${DateTime.now().microsecondsSinceEpoch}-${fileName.hashCode.abs()}';
    try {
      final bytes = await _channel.invokeMethod<Uint8List>('renderHtmlToPdf', {
        'artifactId': artifactId,
        'fileName': fileName,
        'html': document.fullHtml,
        'pageSize': document.pageSize,
      });
      final artifact = MobileHtmlToPdfArtifact(
        artifactId: artifactId,
        fileName: fileName,
        mimeType: 'application/pdf',
        bytes: bytes ?? _fallbackPdfBytes(document.fullHtml),
        htmlPreview: document.fullHtml,
        saved: false,
        shared: false,
      );
      MobileArtifactRegistry.put(artifact);
      return artifact;
    } on MissingPluginException {
      final artifact = MobileHtmlToPdfArtifact(
        artifactId: artifactId,
        fileName: fileName,
        mimeType: 'application/pdf',
        bytes: _fallbackPdfBytes(document.fullHtml),
        htmlPreview: document.fullHtml,
        saved: false,
        shared: false,
      );
      MobileArtifactRegistry.put(artifact);
      return artifact;
    } on PlatformException {
      final artifact = MobileHtmlToPdfArtifact(
        artifactId: artifactId,
        fileName: fileName,
        mimeType: 'application/pdf',
        bytes: _fallbackPdfBytes(document.fullHtml),
        htmlPreview: document.fullHtml,
        saved: false,
        shared: false,
      );
      MobileArtifactRegistry.put(artifact);
      return artifact;
    }
  }

  Future<Map<String, Object?>> save(MobileHtmlToPdfArtifact artifact) async {
    try {
      final result = await _channel
          .invokeMapMethod<String, Object?>('saveArtifact', {
            'artifactId': artifact.artifactId,
            'fileName': artifact.fileName,
            'mimeType': artifact.mimeType,
            'bytes': artifact.bytes,
          });
      return result ?? {'saved': true, 'artifactId': artifact.artifactId};
    } on MissingPluginException {
      return {
        'saved': false,
        'requiresNativeHandler': true,
        'message':
            'Native save handler is not registered yet. Use iOS Files / Android SAF implementation.',
      };
    }
  }

  Future<Map<String, Object?>> share(MobileHtmlToPdfArtifact artifact) async {
    try {
      final result = await _channel
          .invokeMapMethod<String, Object?>('shareArtifact', {
            'artifactId': artifact.artifactId,
            'fileName': artifact.fileName,
            'mimeType': artifact.mimeType,
            'bytes': artifact.bytes,
          });
      return result ?? {'shared': true, 'artifactId': artifact.artifactId};
    } on MissingPluginException {
      return {
        'shared': false,
        'requiresNativeHandler': true,
        'message':
            'Native share handler is not registered yet. Use iOS share sheet / Android share intent implementation.',
      };
    }
  }

  Future<Map<String, Object?>> open(MobileHtmlToPdfArtifact artifact) async {
    try {
      final result = await _channel
          .invokeMapMethod<String, Object?>('openArtifact', {
            'artifactId': artifact.artifactId,
            'fileName': artifact.fileName,
            'mimeType': artifact.mimeType,
            'bytes': artifact.bytes,
          });
      return result ?? {'opened': true, 'artifactId': artifact.artifactId};
    } on MissingPluginException {
      return {
        'opened': false,
        'requiresNativeHandler': true,
        'message': 'Native open handler is not registered yet.',
      };
    }
  }

  Future<Map<String, Object?>> delete(MobileHtmlToPdfArtifact artifact) async {
    MobileArtifactRegistry.remove(artifact.artifactId);
    try {
      final result = await _channel.invokeMapMethod<String, Object?>(
        'deleteArtifact',
        {'artifactId': artifact.artifactId, 'fileName': artifact.fileName},
      );
      return result ?? {'deleted': true, 'artifactId': artifact.artifactId};
    } on MissingPluginException {
      return {'deleted': true, 'native': false};
    }
  }

  Future<Map<String, Object?>> clearCache() async {
    MobileArtifactRegistry.clear();
    try {
      final result = await _channel.invokeMapMethod<String, Object?>(
        'clearArtifactCache',
      );
      return result ?? {'cleared': true};
    } on MissingPluginException {
      return {'cleared': true, 'native': false};
    }
  }

  Uint8List _fallbackPdfBytes(String html) {
    final encoded = base64Encode(utf8.encode(html));
    final payload = encoded.length <= 120 ? encoded : encoded.substring(0, 120);
    final text = 'Aurict HTML PDF artifact preview: $payload';
    final stream = 'BT /F1 10 Tf 40 760 Td (${_pdfEscape(text)}) Tj ET';
    final objects = <String>[
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      '5 0 obj << /Length ${stream.length} >> stream\n$stream\nendstream endobj',
    ];
    final buffer = StringBuffer('%PDF-1.4\n');
    final offsets = <int>[0];
    for (final object in objects) {
      offsets.add(buffer.length);
      buffer.writeln(object);
    }
    final xrefOffset = buffer.length;
    buffer.writeln('xref');
    buffer.writeln('0 ${objects.length + 1}');
    buffer.writeln('0000000000 65535 f ');
    for (final offset in offsets.skip(1)) {
      buffer.writeln('${offset.toString().padLeft(10, '0')} 00000 n ');
    }
    buffer.writeln('trailer << /Size ${objects.length + 1} /Root 1 0 R >>');
    buffer.writeln('startxref');
    buffer.writeln(xrefOffset);
    buffer.writeln('%%EOF');
    return Uint8List.fromList(utf8.encode(buffer.toString()));
  }

  String _pdfEscape(String value) {
    return value
        .replaceAll(r'\', r'\\')
        .replaceAll('(', r'\(')
        .replaceAll(')', r'\)');
  }
}

String mobileSafeArtifactName(String title, String extension) {
  final slug = title
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
  return '${slug.isEmpty ? 'aurict-document' : slug}.$extension';
}
