enum MobileArtifactKind { markdown, pdfReport, slideDeck }

enum MobileArtifactGate { outline, citations, draft, render, saved }

class MobileArtifactPlan {
  const MobileArtifactPlan({
    required this.kind,
    required this.title,
    required this.outputName,
    required this.gates,
    required this.localOnly,
  });

  final MobileArtifactKind kind;
  final String title;
  final String outputName;
  final List<MobileArtifactGate> gates;
  final bool localOnly;

  String get gateSummary => gates.map((gate) => gate.name).join(' → ');
}

class MobileArtifactPlanner {
  const MobileArtifactPlanner();

  List<MobileArtifactPlan> plan(String input) {
    final text = input.toLowerCase();
    final artifacts = <MobileArtifactPlan>[];
    if (_wantsPdf(text)) {
      artifacts.add(
        MobileArtifactPlan(
          kind: MobileArtifactKind.pdfReport,
          title: 'Source-backed PDF report',
          outputName: 'aurict-research-report.pdf',
          gates: const [
            MobileArtifactGate.outline,
            MobileArtifactGate.citations,
            MobileArtifactGate.draft,
            MobileArtifactGate.render,
            MobileArtifactGate.saved,
          ],
          localOnly: true,
        ),
      );
    }
    if (_wantsSlides(text)) {
      artifacts.add(
        MobileArtifactPlan(
          kind: MobileArtifactKind.slideDeck,
          title: 'Presentation deck',
          outputName: 'aurict-slide-deck.pdf',
          gates: const [
            MobileArtifactGate.outline,
            MobileArtifactGate.citations,
            MobileArtifactGate.draft,
            MobileArtifactGate.render,
            MobileArtifactGate.saved,
          ],
          localOnly: true,
        ),
      );
    }
    if (artifacts.isEmpty && _wantsDocument(text)) {
      artifacts.add(
        MobileArtifactPlan(
          kind: MobileArtifactKind.markdown,
          title: 'Markdown document',
          outputName: 'aurict-document.md',
          gates: const [
            MobileArtifactGate.outline,
            MobileArtifactGate.draft,
            MobileArtifactGate.saved,
          ],
          localOnly: true,
        ),
      );
    }
    return artifacts;
  }

  bool _wantsPdf(String text) {
    return text.contains('pdf') ||
        text.contains('report') ||
        text.contains('rapor');
  }

  bool _wantsSlides(String text) {
    return text.contains('slide') ||
        text.contains('slides') ||
        text.contains('deck') ||
        text.contains('presentation') ||
        text.contains('sunum');
  }

  bool _wantsDocument(String text) {
    return text.contains('document') ||
        text.contains('doc') ||
        text.contains('doküman') ||
        text.contains('belge') ||
        text.contains('write') ||
        text.contains('hazırla');
  }
}
