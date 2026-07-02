import 'mobile_artifacts.dart';

enum MobileCompletionStatus { complete, continueRequired, blocked }

enum MobileTaskPhase {
  classify,
  loadSkill,
  plan,
  gather,
  distill,
  verify,
  draft,
  export,
  finalAnswer,
}

class MobileCompletionDecision {
  const MobileCompletionDecision({
    required this.status,
    required this.reason,
    required this.openGates,
  });

  final MobileCompletionStatus status;
  final String reason;
  final List<String> openGates;

  bool get canFinish => status == MobileCompletionStatus.complete;
}

class MobileTaskLedger {
  const MobileTaskLedger({
    required this.objective,
    required this.requiredArtifacts,
    required this.sourceVerificationRequired,
    this.savedArtifacts = const {},
    this.sourcesVerified = false,
  });

  final String objective;
  final List<MobileArtifactPlan> requiredArtifacts;
  final bool sourceVerificationRequired;
  final Set<String> savedArtifacts;
  final bool sourcesVerified;

  List<String> get openGates {
    final gates = <String>[];
    if (sourceVerificationRequired && !sourcesVerified) {
      gates.add('source_verification');
    }
    for (final artifact in requiredArtifacts) {
      if (!savedArtifacts.contains(artifact.outputName)) {
        gates.add('${artifact.outputName}:${artifact.gates.last.name}');
      }
    }
    return gates;
  }

  MobileCompletionDecision evaluate() {
    final gates = openGates;
    if (gates.isEmpty) {
      return const MobileCompletionDecision(
        status: MobileCompletionStatus.complete,
        reason: 'All required source and artifact gates are satisfied.',
        openGates: [],
      );
    }
    return MobileCompletionDecision(
      status: MobileCompletionStatus.continueRequired,
      reason:
          'Task cannot finish while ${gates.length} required gate(s) remain open.',
      openGates: gates,
    );
  }
}

class MobileReasoningLedger {
  const MobileReasoningLedger({
    required this.objective,
    required this.phases,
    required this.currentPhase,
    required this.openGates,
    required this.autoContinue,
    required this.reason,
  });

  final String objective;
  final List<MobileTaskPhase> phases;
  final MobileTaskPhase currentPhase;
  final List<String> openGates;
  final bool autoContinue;
  final String reason;

  bool get canFinish =>
      openGates.isEmpty && currentPhase == MobileTaskPhase.finalAnswer;

  Map<String, Object?> toJson() => {
    'objective': objective,
    'phases': phases.map((phase) => phase.name).toList(growable: false),
    'currentPhase': currentPhase.name,
    'openGates': openGates,
    'autoContinue': autoContinue,
    'canFinish': canFinish,
    'reason': reason,
  };
}

class MobileReasoningLedgerPlanner {
  const MobileReasoningLedgerPlanner();

  MobileReasoningLedger plan({
    required String objective,
    bool requiresResearch = false,
    bool requiresDocument = false,
    bool requiresExport = false,
    bool hasLoadedSkill = false,
    bool hasPlan = false,
    bool hasEvidence = false,
    bool hasVerification = false,
    bool hasDraft = false,
    bool hasExport = false,
  }) {
    final phases = <MobileTaskPhase>[
      MobileTaskPhase.classify,
      MobileTaskPhase.loadSkill,
      MobileTaskPhase.plan,
      if (requiresResearch) MobileTaskPhase.gather,
      if (requiresResearch) MobileTaskPhase.distill,
      MobileTaskPhase.verify,
      MobileTaskPhase.draft,
      if (requiresDocument || requiresExport) MobileTaskPhase.export,
      MobileTaskPhase.finalAnswer,
    ];
    final gates = <String>[
      if (!hasLoadedSkill) 'skill_loaded',
      if (!hasPlan) 'plan_ready',
      if (requiresResearch && !hasEvidence) 'evidence_distilled',
      if (!hasVerification) 'verification_passed',
      if (!hasDraft) 'draft_ready',
      if ((requiresDocument || requiresExport) && !hasExport)
        'artifact_exported',
    ];
    return MobileReasoningLedger(
      objective: objective.trim().isEmpty
          ? 'Untitled mobile task'
          : objective.trim(),
      phases: phases,
      currentPhase: _currentPhase(
        phases: phases,
        requiresResearch: requiresResearch,
        requiresDocument: requiresDocument || requiresExport,
        hasLoadedSkill: hasLoadedSkill,
        hasPlan: hasPlan,
        hasEvidence: hasEvidence,
        hasVerification: hasVerification,
        hasDraft: hasDraft,
        hasExport: hasExport,
      ),
      openGates: gates,
      autoContinue: gates.isNotEmpty,
      reason: gates.isEmpty
          ? 'All required reasoning gates are satisfied.'
          : 'Continue required while ${gates.length} reasoning gate(s) remain open.',
    );
  }

  MobileTaskPhase _currentPhase({
    required List<MobileTaskPhase> phases,
    required bool requiresResearch,
    required bool requiresDocument,
    required bool hasLoadedSkill,
    required bool hasPlan,
    required bool hasEvidence,
    required bool hasVerification,
    required bool hasDraft,
    required bool hasExport,
  }) {
    if (!hasLoadedSkill) return MobileTaskPhase.loadSkill;
    if (!hasPlan) return MobileTaskPhase.plan;
    if (requiresResearch && !hasEvidence) return MobileTaskPhase.gather;
    if (!hasVerification) return MobileTaskPhase.verify;
    if (!hasDraft) return MobileTaskPhase.draft;
    if (requiresDocument && !hasExport) return MobileTaskPhase.export;
    return MobileTaskPhase.finalAnswer;
  }
}

class MobileCompletionGate {
  const MobileCompletionGate();

  MobileCompletionDecision evaluate({
    required String objective,
    required List<MobileArtifactPlan> artifactPlans,
    required bool sourceVerificationRequired,
    Set<String> savedArtifacts = const {},
    bool sourcesVerified = false,
  }) {
    return MobileTaskLedger(
      objective: objective,
      requiredArtifacts: artifactPlans,
      sourceVerificationRequired: sourceVerificationRequired,
      savedArtifacts: savedArtifacts,
      sourcesVerified: sourcesVerified,
    ).evaluate();
  }
}
