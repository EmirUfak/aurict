import 'dart:convert';

import 'mobile_tool_contracts.dart';

enum MobileCitationAuditVerdict { pass, revise, blocked }

class MobileCitationAuditTool {
  const MobileCitationAuditTool();

  String run(Map<String, Object?> args) {
    final answer = args['answer']?.toString() ?? '';
    final strict = _boolArg(args, 'strict');
    final citations = _parseCitations(args['citations']);
    final citedIds = _idsInAnswer(answer);
    final knownIds = citations.map((citation) => citation.id).toSet();
    final unknownCitationIds = [
      for (final id in citedIds)
        if (!knownIds.contains(id)) id,
    ];
    final missingCitationIds = [
      for (final citation in citations)
        if (!citedIds.contains(citation.id)) citation.id,
    ];
    final uncitedClaims = _uncitedClaimCandidates(answer, citedIds);
    final lowConfidence = [
      for (final citation in citations)
        if (_isLowConfidence(citation.confidence)) citation.id,
    ];
    final issues = <String>[
      if (answer.trim().isEmpty) 'empty_answer',
      if (citations.isEmpty) 'no_source_ledger',
      if (citedIds.isEmpty && citations.isNotEmpty) 'answer_has_no_citations',
      if (unknownCitationIds.isNotEmpty) 'unknown_citation_ids',
      if (strict && missingCitationIds.isNotEmpty) 'unused_source_ids',
      if (uncitedClaims.isNotEmpty) 'possible_uncited_claims',
      if (lowConfidence.isNotEmpty) 'low_confidence_sources',
    ];
    final verdict = answer.trim().isEmpty || citations.isEmpty
        ? MobileCitationAuditVerdict.blocked
        : issues.isEmpty
        ? MobileCitationAuditVerdict.pass
        : MobileCitationAuditVerdict.revise;
    return MobileToolResult.success(
      tool: 'citation_audit',
      risk: MobileToolRisk.low,
      policy: mobileLocalPolicy,
      cacheKey: MobileToolCache.key('citation_audit', {
        'answerLength': answer.length,
        'citations': citations.length,
        'strict': strict,
      }),
      data: {
        'verdict': verdict.name,
        'issues': issues,
        'knownCitationIds': knownIds.toList(growable: false),
        'usedCitationIds': citedIds.toList(growable: false),
        'unknownCitationIds': unknownCitationIds,
        'missingCitationIds': missingCitationIds,
        'uncitedClaims': uncitedClaims,
        'lowConfidenceCitationIds': lowConfidence,
        'requiredFixes': _requiredFixes(
          verdict: verdict,
          unknownCitationIds: unknownCitationIds,
          missingCitationIds: missingCitationIds,
          uncitedClaims: uncitedClaims,
          lowConfidence: lowConfidence,
          hasCitations: citations.isNotEmpty,
          hasAnswerCitations: citedIds.isNotEmpty,
        ),
      },
    ).encode();
  }

  List<_AuditCitation> _parseCitations(Object? raw) {
    if (raw is String && raw.trim().isNotEmpty) {
      try {
        return _parseCitations(jsonDecode(raw));
      } catch (_) {
        return const [];
      }
    }
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((json) => _AuditCitation.fromJson(_objectMap(json)))
        .where((citation) => citation.id.isNotEmpty)
        .toList(growable: false);
  }

  Set<String> _idsInAnswer(String answer) {
    return RegExp(r'\[S\d+\]').allMatches(answer).map((match) {
      final value = match.group(0) ?? '';
      return value.substring(1, value.length - 1);
    }).toSet();
  }

  List<String> _uncitedClaimCandidates(String answer, Set<String> citedIds) {
    if (answer.trim().isEmpty) return const [];
    final sentences = answer
        .split(RegExp(r'(?<=[.!?])\s+'))
        .map((sentence) => sentence.trim())
        .where((sentence) => sentence.length > 45)
        .toList(growable: false);
    final claimSignals = RegExp(
      r'\b(according to|research|study|data|evidence|shows|proves|increased|decreased|current|latest|market|users?|cost|revenue|risk|security|compliance)\b',
      caseSensitive: false,
    );
    return sentences
        .where((sentence) => claimSignals.hasMatch(sentence))
        .where((sentence) => !RegExp(r'\[S\d+\]').hasMatch(sentence))
        .take(5)
        .toList(growable: false);
  }

  bool _isLowConfidence(String confidence) {
    final normalized = confidence.toLowerCase();
    return normalized == 'low' || normalized == 'weak';
  }

  List<String> _requiredFixes({
    required MobileCitationAuditVerdict verdict,
    required List<String> unknownCitationIds,
    required List<String> missingCitationIds,
    required List<String> uncitedClaims,
    required List<String> lowConfidence,
    required bool hasCitations,
    required bool hasAnswerCitations,
  }) {
    if (verdict == MobileCitationAuditVerdict.pass) return const [];
    return [
      if (!hasCitations)
        'Run source_distill first and pass its citation ledger into citation_audit.',
      if (!hasAnswerCitations && hasCitations)
        'Attach source ids like [S1] to source-backed claims in the answer.',
      if (unknownCitationIds.isNotEmpty)
        'Remove or replace unknown citation ids: ${unknownCitationIds.join(", ")}.',
      if (missingCitationIds.isNotEmpty)
        'Either cite or remove unused source ids: ${missingCitationIds.join(", ")}.',
      if (uncitedClaims.isNotEmpty)
        'Add citations to the flagged source-backed claims or soften them as unsourced.',
      if (lowConfidence.isNotEmpty)
        'Treat low-confidence source ids cautiously: ${lowConfidence.join(", ")}.',
    ];
  }

  bool _boolArg(Map<String, Object?> args, String key) {
    final value = args[key];
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) return value.toLowerCase() == 'true';
    return false;
  }

  Map<String, Object?> _objectMap(Map<dynamic, dynamic> json) {
    return json.map((key, value) => MapEntry(key.toString(), value));
  }
}

class _AuditCitation {
  const _AuditCitation({required this.id, required this.confidence});

  final String id;
  final String confidence;

  static _AuditCitation fromJson(Map<String, Object?> json) {
    return _AuditCitation(
      id: json['id']?.toString() ?? '',
      confidence: json['confidence']?.toString() ?? 'medium',
    );
  }
}
