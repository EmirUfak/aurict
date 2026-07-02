import 'mobile_artifacts.dart';
import 'mobile_artifact_renderer.dart';
import 'mobile_citations.dart';
import 'mobile_cli_skill_importer.dart';
import 'mobile_research_tools.dart';
import 'mobile_skill_catalog.dart';
import 'mobile_skill_loader.dart';
import 'mobile_task_ledger.dart';
import 'mobile_tool_policy.dart';

enum MobileToolPermission {
  network,
  fileRead,
  fileWrite,
  exportPdf,
  exportSlides,
}

enum MobileTaskStage {
  classify,
  loadSkill,
  plan,
  search,
  fetch,
  distill,
  verify,
  draft,
  export,
  complete,
}

class MobileSkillDef {
  const MobileSkillDef({
    required this.id,
    required this.name,
    required this.description,
    required this.triggers,
    required this.tools,
    required this.permissions,
    required this.autoContinue,
  });

  final String id;
  final String name;
  final String description;
  final List<String> triggers;
  final List<String> tools;
  final List<MobileToolPermission> permissions;
  final bool autoContinue;
}

class MobileToolEvent {
  const MobileToolEvent({
    required this.stage,
    required this.title,
    required this.detail,
    this.done = true,
  });

  final MobileTaskStage stage;
  final String title;
  final String detail;
  final bool done;
}

class MobileAgentResult {
  const MobileAgentResult({
    required this.text,
    required this.activeSkills,
    required this.loadedSkills,
    required this.events,
    required this.completed,
    required this.completion,
    required this.deniedPermissions,
    required this.searchRequests,
    required this.renderedArtifacts,
  });

  final String text;
  final List<MobileSkillDef> activeSkills;
  final List<MobileLoadedSkill> loadedSkills;
  final List<MobileToolEvent> events;
  final bool completed;
  final MobileCompletionDecision completion;
  final List<MobileToolPermission> deniedPermissions;
  final List<MobileSearchRequest> searchRequests;
  final List<MobileRenderedArtifact> renderedArtifacts;
}

class MobileSkillRegistry {
  const MobileSkillRegistry();

  static final skills = MobileSkillCatalog.skills;

  List<MobileSkillDef> match(String input) {
    return const MobileSkillCatalog()
        .match(input)
        .map((entry) => entry.def)
        .toList(growable: false);
  }
}

class MobileAgentRuntime {
  const MobileAgentRuntime({
    this.registry = const MobileSkillRegistry(),
    this.researchPlanner = const MobileResearchPlanner(),
    this.artifactPlanner = const MobileArtifactPlanner(),
    this.sourceDistiller = const MobileSourceDistiller(),
    this.skillLoader = const MobileSkillLoader(),
    this.completionGate = const MobileCompletionGate(),
    this.toolPolicy = MobileToolPolicy.allowAll,
    this.searchRequestBuilder = const MobileSearchRequestBuilder(),
    this.artifactRenderer = const MobileArtifactRenderer(),
    this.cliSkillImporter = const MobileCliSkillImporter(),
  });

  final MobileSkillRegistry registry;
  final MobileResearchPlanner researchPlanner;
  final MobileArtifactPlanner artifactPlanner;
  final MobileSourceDistiller sourceDistiller;
  final MobileSkillLoader skillLoader;
  final MobileCompletionGate completionGate;
  final MobileToolPolicy toolPolicy;
  final MobileSearchRequestBuilder searchRequestBuilder;
  final MobileArtifactRenderer artifactRenderer;
  final MobileCliSkillImporter cliSkillImporter;

  MobileAgentResult run(
    String input, {
    bool sourcesVerified = false,
    Set<String> savedArtifacts = const {},
  }) {
    final skills = registry.match(input);
    if (skills.isEmpty) {
      return const MobileAgentResult(
        activeSkills: [],
        loadedSkills: [],
        events: [],
        completed: true,
        completion: MobileCompletionDecision(
          status: MobileCompletionStatus.complete,
          reason: 'No tool workflow required.',
          openGates: [],
        ),
        deniedPermissions: [],
        searchRequests: [],
        renderedArtifacts: [],
        text: 'I’ll turn that into a focused response with clear next steps.',
      );
    }

    final deniedPermissions = toolPolicy.deniedFor(skills);
    final loadedSkills = skills.map(skillLoader.load).toList(growable: false);
    final wantsResearch = skills.any((skill) => skill.id == 'research');
    final wantsPdf = skills.any((skill) => skill.id == 'pdf');
    final wantsSlides = skills.any((skill) => skill.id == 'slides');
    final researchPlan = wantsResearch ? researchPlanner.plan(input) : null;
    final artifactPlans = artifactPlanner.plan(input);
    final searchRequests = researchPlan == null
        ? const <MobileSearchRequest>[]
        : searchRequestBuilder.build(researchPlan);
    final renderedArtifacts = artifactPlans
        .map((plan) => artifactRenderer.render(plan: plan, objective: input))
        .toList(growable: false);
    final events = <MobileToolEvent>[
      const MobileToolEvent(
        stage: MobileTaskStage.classify,
        title: 'Classified task',
        detail: 'Detected a tool-first artifact workflow.',
      ),
      MobileToolEvent(
        stage: MobileTaskStage.loadSkill,
        title: 'Loaded skills',
        detail: loadedSkills
            .map(
              (skill) =>
                  '${skill.name} (${skill.context.name}, tools: ${skill.allowedTools.join(", ")})',
            )
            .join('; '),
      ),
      const MobileToolEvent(
        stage: MobileTaskStage.plan,
        title: 'Task ledger opened',
        detail:
            'Auto-continue remains active until required artifacts are complete.',
      ),
    ];

    if (deniedPermissions.isNotEmpty) {
      final completion = MobileCompletionDecision(
        status: MobileCompletionStatus.blocked,
        reason:
            'Required mobile permissions are disabled: ${deniedPermissions.map((p) => p.name).join(", ")}.',
        openGates: deniedPermissions
            .map((p) => 'permission:${p.name}')
            .toList(),
      );
      return MobileAgentResult(
        activeSkills: skills,
        loadedSkills: loadedSkills,
        events: [
          ...events,
          MobileToolEvent(
            stage: MobileTaskStage.complete,
            title: 'Permission blocked',
            detail: completion.reason,
            done: false,
          ),
        ],
        completed: false,
        completion: completion,
        deniedPermissions: deniedPermissions,
        searchRequests: searchRequests,
        renderedArtifacts: renderedArtifacts,
        text:
            'This task needs permissions before it can continue: ${deniedPermissions.map((p) => p.name).join(", ")}.',
      );
    }

    if (wantsResearch) {
      events.addAll([
        MobileToolEvent(
          stage: MobileTaskStage.search,
          title: 'Research plan',
          detail: [
            'Free providers: ${researchPlan!.providerSummary}.',
            'Prepared requests: ${searchRequests.length}.',
            researchPlan.exactUrls.isEmpty
                ? 'No exact URLs detected.'
                : 'Exact URLs: ${researchPlan.exactUrls.length}.',
          ].join(' '),
        ),
        const MobileToolEvent(
          stage: MobileTaskStage.distill,
          title: 'Source distillation',
          detail:
              'Raw pages will become claims, evidence snippets, dates, and confidence.',
        ),
        MobileToolEvent(
          stage: MobileTaskStage.verify,
          title: 'Verification pass',
          detail:
              'Medium/high claims require cross-source validation before final output.',
        ),
      ]);
    }

    if (wantsPdf || wantsSlides) {
      final primaryArtifact = artifactPlans.isNotEmpty
          ? artifactPlans.first
          : null;
      events.add(
        MobileToolEvent(
          stage: wantsSlides ? MobileTaskStage.draft : MobileTaskStage.draft,
          title: wantsSlides ? 'Deck schema' : 'Report outline',
          detail: primaryArtifact == null
              ? wantsSlides
                    ? 'Create slide titles, speaker notes, visuals, and citation slots.'
                    : 'Create executive summary, sections, findings, citations, and appendix.'
              : '${primaryArtifact.title}: ${primaryArtifact.gateSummary}.',
        ),
      );
      for (final artifact in artifactPlans) {
        events.add(
          MobileToolEvent(
            stage: MobileTaskStage.export,
            title: artifact.kind == MobileArtifactKind.slideDeck
                ? 'Deck export gate'
                : artifact.kind == MobileArtifactKind.pdfReport
                ? 'PDF export gate'
                : 'Document export gate',
            detail:
                'Local-only artifact: ${artifact.outputName}. Task cannot finish before ${artifact.gates.last.name}.',
          ),
        );
      }
      if (renderedArtifacts.isNotEmpty) {
        events.add(
          MobileToolEvent(
            stage: MobileTaskStage.export,
            title: 'Local render preview',
            detail:
                '${renderedArtifacts.length} artifact preview(s) generated locally; save gate remains explicit.',
          ),
        );
      }
    }

    final completion = completionGate.evaluate(
      objective: input,
      artifactPlans: artifactPlans,
      sourceVerificationRequired: wantsResearch,
      sourcesVerified: sourcesVerified,
      savedArtifacts: savedArtifacts,
    );
    if (!completion.canFinish) {
      events.add(
        MobileToolEvent(
          stage: MobileTaskStage.complete,
          title: 'Continuation required',
          detail:
              '${completion.reason} Open gates: ${completion.openGates.join(", ")}.',
          done: false,
        ),
      );
    }

    events.add(
      MobileToolEvent(
        stage: MobileTaskStage.complete,
        title: completion.canFinish ? 'Complete' : 'Ready for next action',
        detail: completion.canFinish
            ? completion.reason
            : 'Free research adapters and artifact gates are registered. Continue with network fetch/render adapters.',
        done: completion.canFinish,
      ),
    );

    return MobileAgentResult(
      activeSkills: skills,
      loadedSkills: loadedSkills,
      events: events,
      completed: completion.canFinish,
      completion: completion,
      deniedPermissions: deniedPermissions,
      searchRequests: searchRequests,
      renderedArtifacts: renderedArtifacts,
      text: _responseFor(skills, researchPlan, artifactPlans, completion),
    );
  }

  String _responseFor(
    List<MobileSkillDef> skills,
    MobileResearchPlan? researchPlan,
    List<MobileArtifactPlan> artifactPlans,
    MobileCompletionDecision completion,
  ) {
    final names = skills.map((skill) => skill.name).join(' + ');
    final providers = researchPlan == null
        ? ''
        : '\n\nResearch will use free/local adapters first: ${researchPlan.providerSummary}.';
    final artifacts = artifactPlans.isEmpty
        ? ''
        : '\n\nArtifact gates: ${artifactPlans.map((plan) => '${plan.outputName} (${plan.gateSummary})').join('; ')}.';
    return [
      'Activated mobile skill workflow: $names.',
      'I will not stop at a summary for artifact tasks; the ledger keeps running until sources are checked and required exports exist.',
      'Free search/webfetch planning and local artifact gates are now registered.$providers$artifacts',
      completion.canFinish
          ? 'Completion gate: satisfied.'
          : 'Completion gate: continue required (${completion.openGates.join(", ")}).',
    ].join('\n\n');
  }
}
