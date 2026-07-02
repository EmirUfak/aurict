enum MobileSafetyRisk { normal, legal, finance, medical, safety, privateData }

class MobileSafetyClassification {
  const MobileSafetyClassification({
    required this.risks,
    required this.requiresVerifier,
    required this.requiredCaveats,
    required this.reason,
  });

  final List<MobileSafetyRisk> risks;
  final bool requiresVerifier;
  final List<String> requiredCaveats;
  final String reason;

  Map<String, Object?> toJson() => {
    'risks': risks.map((risk) => risk.name).toList(growable: false),
    'requiresVerifier': requiresVerifier,
    'requiredCaveats': requiredCaveats,
    'reason': reason,
  };
}

class MobileSafetyClassifier {
  const MobileSafetyClassifier();

  MobileSafetyClassification classify(String text) {
    final input = text.toLowerCase();
    final risks = <MobileSafetyRisk>{};
    if (_has(input, [
      'contract',
      'legal',
      'lawyer',
      'gdpr',
      'privacy',
      'nda',
      'sözleşme',
    ])) {
      risks.add(MobileSafetyRisk.legal);
    }
    if (_has(input, [
      'finance',
      'budget',
      'tax',
      'investment',
      'portfolio',
      'loan',
      'bütçe',
      'vergi',
    ])) {
      risks.add(MobileSafetyRisk.finance);
    }
    if (_has(input, [
      'medical',
      'diagnosis',
      'symptom',
      'medicine',
      'doctor',
      'health',
      'ilaç',
      'sağlık',
    ])) {
      risks.add(MobileSafetyRisk.medical);
    }
    if (_has(input, [
      'password',
      'api key',
      'secret key',
      'token',
      'private key',
    ])) {
      risks.add(MobileSafetyRisk.privateData);
    }
    if (_has(input, [
      'dangerous',
      'weapon',
      'self harm',
      'suicide',
      'explosive',
    ])) {
      risks.add(MobileSafetyRisk.safety);
    }
    if (risks.isEmpty) risks.add(MobileSafetyRisk.normal);
    final caveats = <String>[
      if (risks.contains(MobileSafetyRisk.legal))
        'Not legal advice; verify jurisdiction and consult a qualified lawyer for decisions.',
      if (risks.contains(MobileSafetyRisk.finance))
        'Not financial, tax, or investment advice; state assumptions and uncertainty.',
      if (risks.contains(MobileSafetyRisk.medical))
        'Not medical advice; recommend qualified medical review for health decisions.',
      if (risks.contains(MobileSafetyRisk.privateData))
        'Do not expose secrets; redact sensitive values before sharing or storing.',
    ];
    return MobileSafetyClassification(
      risks: risks.toList(growable: false),
      requiresVerifier: risks.any((risk) => risk != MobileSafetyRisk.normal),
      requiredCaveats: caveats,
      reason: risks.length == 1 && risks.single == MobileSafetyRisk.normal
          ? 'No high-risk category detected.'
          : 'High-risk category detected; verifier pass and caveats required.',
    );
  }

  bool _has(String input, List<String> terms) => terms.any(input.contains);
}

enum MobileVerificationVerdict { pass, revise, blocked }

class MobileAnswerVerification {
  const MobileAnswerVerification({
    required this.verdict,
    required this.issues,
    required this.requiredFixes,
    required this.confidence,
  });

  final MobileVerificationVerdict verdict;
  final List<String> issues;
  final List<String> requiredFixes;
  final String confidence;

  Map<String, Object?> toJson() => {
    'verdict': verdict.name,
    'issues': issues,
    'requiredFixes': requiredFixes,
    'confidence': confidence,
  };
}

class MobileAnswerVerifier {
  const MobileAnswerVerifier({
    this.classifier = const MobileSafetyClassifier(),
  });

  final MobileSafetyClassifier classifier;

  MobileAnswerVerification verify({
    required String objective,
    required String answer,
    bool sourcesRequired = false,
    bool hasCitations = false,
    bool artifactRequired = false,
    bool artifactExported = false,
  }) {
    final issues = <String>[];
    final fixes = <String>[];
    final safety = classifier.classify('$objective\n$answer');
    if (answer.trim().isEmpty) {
      issues.add('empty_answer');
      fixes.add('Draft a user-facing answer before finalizing.');
    }
    if (sourcesRequired && !hasCitations) {
      issues.add('missing_citations');
      fixes.add(
        'Distill at least one source and cite it before making source-backed claims.',
      );
    }
    if (artifactRequired && !artifactExported) {
      issues.add('artifact_gate_open');
      fixes.add('Run document_export and keep the save/share gate explicit.');
    }
    for (final caveat in safety.requiredCaveats) {
      final caveatKey = caveat.split(';').first.toLowerCase();
      if (!answer.toLowerCase().contains(caveatKey)) {
        issues.add(
          'missing_caveat:${safety.risks.map((risk) => risk.name).join(",")}',
        );
        fixes.add(caveat);
      }
    }
    if (safety.risks.contains(MobileSafetyRisk.privateData) &&
        RegExp(
          r'(sk-[a-z0-9_-]{8,}|api[_ -]?key\s*[:=])',
          caseSensitive: false,
        ).hasMatch(answer)) {
      return MobileAnswerVerification(
        verdict: MobileVerificationVerdict.blocked,
        issues: [...issues, 'secret_exposure_risk'],
        requiredFixes: [...fixes, 'Redact secrets and explain safe handling.'],
        confidence: 'high',
      );
    }
    return MobileAnswerVerification(
      verdict: issues.isEmpty
          ? MobileVerificationVerdict.pass
          : MobileVerificationVerdict.revise,
      issues: issues,
      requiredFixes: fixes,
      confidence: issues.isEmpty ? 'high' : 'medium',
    );
  }
}
