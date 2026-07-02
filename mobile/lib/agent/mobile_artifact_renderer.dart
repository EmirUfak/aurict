import 'dart:convert';
import 'dart:typed_data';

import 'mobile_artifacts.dart';
import 'mobile_citations.dart';

class MobileRenderedArtifact {
  const MobileRenderedArtifact({
    required this.plan,
    required this.mimeType,
    required this.bytes,
    required this.preview,
  });

  final MobileArtifactPlan plan;
  final String mimeType;
  final Uint8List bytes;
  final String preview;

  int get sizeBytes => bytes.length;
}

class MobileArtifactRenderer {
  const MobileArtifactRenderer();

  MobileRenderedArtifact render({
    required MobileArtifactPlan plan,
    required String objective,
    MobileCitationLedger citations = const MobileCitationLedger(citations: []),
  }) {
    final markdown = _markdownFor(plan, objective, citations);
    return switch (plan.kind) {
      MobileArtifactKind.markdown => MobileRenderedArtifact(
        plan: plan,
        mimeType: 'text/markdown',
        bytes: Uint8List.fromList(utf8.encode(markdown)),
        preview: markdown,
      ),
      MobileArtifactKind.pdfReport ||
      MobileArtifactKind.slideDeck => MobileRenderedArtifact(
        plan: plan,
        mimeType: 'application/pdf',
        bytes: _minimalPdfBytes(markdown),
        preview: markdown,
      ),
    };
  }

  String _markdownFor(
    MobileArtifactPlan plan,
    String objective,
    MobileCitationLedger citations,
  ) {
    final title = switch (plan.kind) {
      MobileArtifactKind.markdown => 'Aurict Document',
      MobileArtifactKind.pdfReport => 'Aurict Research Report',
      MobileArtifactKind.slideDeck => 'Aurict Slide Deck',
    };
    return [
      '# $title',
      '',
      'Objective: $objective',
      '',
      'Artifact: ${plan.outputName}',
      'Gates: ${plan.gateSummary}',
      '',
      '## Citations',
      citations.hasVerifiableSources
          ? citations.summary
          : 'No citations attached yet.',
    ].join('\n');
  }

  Uint8List _minimalPdfBytes(String text) {
    final escaped = text
        .replaceAll(r'\', r'\\')
        .replaceAll('(', r'\(')
        .replaceAll(')', r'\)')
        .replaceAll('\n', r'\n');
    final stream = 'BT /F1 11 Tf 40 780 Td ($escaped) Tj ET';
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
}
