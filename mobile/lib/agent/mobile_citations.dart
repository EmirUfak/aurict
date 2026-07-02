import 'mobile_research_tools.dart';

enum MobileSourceConfidence { low, medium, high }

class MobileCitation {
  const MobileCitation({
    required this.id,
    required this.title,
    required this.url,
    required this.claim,
    required this.evidence,
    required this.confidence,
  });

  final String id;
  final String title;
  final Uri url;
  final String claim;
  final String evidence;
  final MobileSourceConfidence confidence;
}

class MobileCitationLedger {
  const MobileCitationLedger({required this.citations});

  final List<MobileCitation> citations;

  bool get hasVerifiableSources => citations.isNotEmpty;

  String get summary {
    if (citations.isEmpty) return 'No citations available.';
    return citations
        .map(
          (citation) => '[${citation.id}] ${citation.title}: ${citation.claim}',
        )
        .join('\n');
  }
}

class MobileSourceDistiller {
  const MobileSourceDistiller();

  MobileCitationLedger distill(List<MobileSourceRecord> sources) {
    final citations = <MobileCitation>[];
    for (var i = 0; i < sources.length; i++) {
      final source = sources[i];
      final evidence = _firstUsefulSentence(source.text);
      if (evidence.isEmpty) continue;
      citations.add(
        MobileCitation(
          id: 'S${i + 1}',
          title: source.title,
          url: source.url,
          claim: _claimFromEvidence(evidence),
          evidence: evidence,
          confidence: _confidenceFor(source, evidence),
        ),
      );
    }
    return MobileCitationLedger(citations: citations);
  }

  String _firstUsefulSentence(String text) {
    final normalized = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (normalized.isEmpty) return '';
    final candidates = normalized
        .split(RegExp(r'(?<=[.!?])\s+'))
        .where((sentence) => sentence.length >= 40)
        .toList();
    final selected = candidates.isNotEmpty ? candidates.first : normalized;
    return selected.length <= 260
        ? selected
        : '${selected.substring(0, 257)}...';
  }

  String _claimFromEvidence(String evidence) {
    final trimmed = evidence.trim();
    if (trimmed.length <= 120) return trimmed;
    return '${trimmed.substring(0, 117)}...';
  }

  MobileSourceConfidence _confidenceFor(
    MobileSourceRecord source,
    String evidence,
  ) {
    if (source.statusCode != null && source.statusCode! >= 400) {
      return MobileSourceConfidence.low;
    }
    if (evidence.length > 140 && source.title.isNotEmpty) {
      return MobileSourceConfidence.high;
    }
    return MobileSourceConfidence.medium;
  }
}
