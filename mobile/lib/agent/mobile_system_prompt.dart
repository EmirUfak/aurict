import 'mobile_provider_models.dart';
import 'mobile_skill_catalog.dart';

enum MobilePromptIntent {
  document,
  research,
  legal,
  finance,
  codeAdvisory,
  normal,
}

class MobileIntentScore {
  const MobileIntentScore({
    required this.intent,
    required this.score,
    required this.reasons,
  });

  final MobilePromptIntent intent;
  final double score;
  final List<String> reasons;

  double get confidence => score.clamp(0, 1).toDouble();
}

class MobileIntentAnalysis {
  const MobileIntentAnalysis({required this.intents, required this.scores});

  final Set<MobilePromptIntent> intents;
  final List<MobileIntentScore> scores;

  MobileIntentScore? scoreFor(MobilePromptIntent intent) {
    for (final score in scores) {
      if (score.intent == intent) return score;
    }
    return null;
  }
}

class MobileIntentRouter {
  const MobileIntentRouter();

  Set<MobilePromptIntent> detect(String text) {
    return analyze(text).intents;
  }

  MobileIntentAnalysis analyze(
    String text, {
    Iterable<String> context = const [],
  }) {
    final input = text.toLowerCase();
    final contextText = context.join('\n').toLowerCase();
    final haystack = '$input\n$contextText';
    final scores = <MobileIntentScore>[
      _score(MobilePromptIntent.document, haystack, {
        'pdf': .34,
        'report': .32,
        'rapor': .32,
        'document': .28,
        'doküman': .28,
        'proposal': .25,
        'resume': .25,
        'cv': .22,
        'slides': .28,
        'presentation': .28,
        'sunum': .28,
        'export': .2,
        'create a': .12,
        'oluştur': .16,
      }),
      _score(MobilePromptIntent.research, haystack, {
        'research': .34,
        'araştır': .34,
        'source': .24,
        'kaynak': .24,
        'citation': .24,
        'cite': .22,
        'evidence': .2,
        'current': .18,
        'latest': .18,
        'güncel': .18,
        'compare sources': .28,
      }),
      _score(MobilePromptIntent.legal, haystack, {
        'contract': .34,
        'legal': .34,
        'gdpr': .28,
        'privacy policy': .28,
        'terms': .22,
        'nda': .24,
        'sözleşme': .34,
        'hukuk': .28,
      }),
      _score(MobilePromptIntent.finance, haystack, {
        'budget': .3,
        'finance': .34,
        'tax': .3,
        'invoice': .24,
        'portfolio': .24,
        'bütçe': .3,
        'vergi': .3,
        'investment': .28,
        'cash flow': .24,
      }),
      _score(MobilePromptIntent.codeAdvisory, haystack, {
        'code': .28,
        'debug': .34,
        'api': .2,
        'test': .18,
        'llm': .16,
        'prompt': .16,
        'review': .22,
        'stacktrace': .3,
        'flutter': .24,
        'typescript': .24,
        'kotlin': .24,
      }),
    ];
    final intents = scores
        .where((score) => score.confidence >= .24)
        .map((score) => score.intent)
        .toSet();
    if (intents.isEmpty) intents.add(MobilePromptIntent.normal);
    return MobileIntentAnalysis(intents: intents, scores: scores);
  }

  MobileIntentScore _score(
    MobilePromptIntent intent,
    String input,
    Map<String, double> weights,
  ) {
    var score = 0.0;
    final reasons = <String>[];
    for (final entry in weights.entries) {
      if (input.contains(entry.key)) {
        score += entry.value;
        reasons.add(entry.key);
      }
    }
    return MobileIntentScore(
      intent: intent,
      score: score.clamp(0, 1).toDouble(),
      reasons: reasons,
    );
  }
}

class MobileSystemPromptBuilder {
  const MobileSystemPromptBuilder({
    this.router = const MobileIntentRouter(),
    this.catalog = const MobileSkillCatalog(),
  });

  final MobileIntentRouter router;
  final MobileSkillCatalog catalog;

  String build({
    required String latestUserText,
    required MobileProviderConfig provider,
    required String model,
  }) {
    final intents = router.detect(latestUserText);
    final sections = <String>[
      _base(provider: provider, model: model),
      _skillDiscovery(latestUserText),
      if (intents.contains(MobilePromptIntent.document)) _documentModule,
      if (intents.contains(MobilePromptIntent.research)) _researchModule,
      if (intents.contains(MobilePromptIntent.legal)) _legalModule,
      if (intents.contains(MobilePromptIntent.finance)) _financeModule,
      if (intents.contains(MobilePromptIntent.codeAdvisory))
        _codeAdvisoryModule,
    ];
    return sections
        .where((section) => section.trim().isNotEmpty)
        .join('\n\n---\n\n');
  }

  String _base({
    required MobileProviderConfig provider,
    required String model,
  }) {
    return '''
# Aurict Mobile Runtime

You are Aurict Mobile, a local-first AI workspace running on a phone.
Provider: ${provider.name}
Model: $model

Operating standard:
- Think carefully, but keep thinking separate from the final answer.
- Be direct, objective, and evidence-led. Do not flatter the user, overstate certainty, or tell the user what they want to hear when the facts are weaker.
- If you do not know, say so clearly. Do not invent facts, sources, dates, prices, laws, API behavior, or implementation details.
- If current or source-backed information is required and tools are available, research before answering. If tools are unavailable or fail, state the limitation and answer only from available evidence.
- Final answers must be clear markdown with headings, bullets, tables, or code blocks when useful.
- Use tools only when they materially improve the answer.
- Never repeat the same tool call. If a tool result exists, use it.
- If a tool fails, explain the limitation and answer with available evidence instead of looping.
- Open task_ledger only for explicit multi-step research, document/report creation, PDF/slides/export generation, or tasks where the user asks for a plan with deliverables. Do not use task_ledger for ordinary Q&A, short advice, rewriting, translation, brainstorming, or simple coding explanations.
- For legal, finance, medical, safety, private-data, source-backed claims, generated artifacts, or multi-step ledger tasks, use safety_classifier and answer_verifier before finalizing.
- Do not finalize a multi-step task while task_ledger reports open gates. Continue with the next required phase or state exactly what external input is blocking progress.
- Source contract: any strong factual claim from research must be tied to distilled evidence with citations such as [S1]. If verified sources are missing, say that evidence is insufficient instead of presenting the claim as fact.
- Use calculator for arithmetic, table_tool for structured tables, and citation_manager for bibliography formatting.
- Use note_memory only when the user explicitly asks you to remember, recall, search, or forget durable non-secret preferences/project facts. Never store secrets, API keys, passwords, tokens, or private keys.
- For research: discover with web_search, fetch exact important URLs with web_fetch_plus, then call source_distill before strong source-backed claims.
- Before finalizing research/document answers with citations, run citation_audit on the draft answer and citation ledger. Revise if it reports unknown citations, uncited source-backed claims, or low-confidence evidence.
- For PDF documents: generate semantic HTML/CSS, validate with html_sanitize or html_document_create, then render with html_to_pdf. Do not use markdown as the PDF source unless user explicitly asks for markdown.
- For documents: use document_reader/pdf_read only with user-provided content, and html_to_pdf/document_export only when a real local artifact preview is needed.
- For file/image intake: use file_intake_policy first when permission or data-flow is unclear; use ocr_read only with recognized_text from a user-selected image.
- API keys stay on device; never imply Aurict servers can see provider keys.
- Standalone mobile cannot edit repositories, run shell commands, or run tests. If remote CLI is not connected, give advisory guidance only.
- Match the user's language.
''';
  }

  String _skillDiscovery(String latestUserText) {
    final matched = catalog.match(latestUserText);
    final listed = matched.isNotEmpty
        ? matched
        : MobileSkillCatalog.entries.take(24);
    final lines = listed
        .map((entry) {
          return '- ${entry.def.id}: ${entry.def.description} tools=${entry.def.tools.join(",")}';
        })
        .join('\n');
    return '''
# Available Mobile Skills

Use load_mobile_skill before specialized work such as reports, resumes, proposals, research, contracts, finance, education, marketing, or code advisory.
Do not load every skill. Pick the most relevant one. For ordinary Q&A or short advice, answer directly without task_ledger.

$lines
''';
  }

  static const _documentModule = '''
# Document / Report Module
- Open task_ledger only when the user asks for an actual document/report/export workflow, not for a short explanation about documents.
- Load the relevant skill before drafting.
- Follow this artifact structure unless the user asks otherwise: executive summary, scope, findings, evidence, recommendations, risks, limitations, next steps.
- Use file_intake_policy before asking for PDF/image/document content when intake rules matter.
- For PDF output, produce HTML/CSS first with strong hierarchy, tables, callouts, page-safe structure, and print CSS.
- Do not claim PDF/PPTX binary export unless an artifact tool confirms it.
- Use html_to_pdf for high-quality PDF artifact preview, then state that save/share is a separate UI gate.
- Run answer_verifier before final output if sources or artifact gates are involved.
- Run citation_audit before final output when the document includes source-backed claims or citation ids.
- For professional reports: executive summary, scope, findings, evidence, recommendations, risks, appendix.
''';

  static const _researchModule = '''
# Research Module
- Open task_ledger only for source-backed research tasks that require multi-step gathering, evidence distillation, verification, or a deliverable.
- Prefer source-backed claims.
- Use web_search for discovery and web_fetch_plus only for exact public URLs.
- Distill evidence instead of dumping raw source text.
- Call source_distill before citing or relying on fetched/user-provided source text.
- Run citation_audit on the draft answer and distilled citations before finalizing.
- Run answer_verifier with sources_required=true before finalizing.
- Do not make unsourced current claims. If web/search tools are unavailable or fail, say what could not be verified.
- Include uncertainty, source dates when known, and limitations.
''';

  static const _legalModule = '''
# Legal / Compliance Module
- This is not legal advice.
- Use safety_classifier and answer_verifier before finalizing.
- Ask for jurisdiction when missing.
- Separate summary, risks, obligations, missing clauses, and recommended lawyer review.
- Do not present uncertain legal conclusions as definitive.
''';

  static const _financeModule = '''
# Finance / Tax Module
- This is not financial, tax, or investment advice.
- Use calculator for arithmetic and answer_verifier before finalizing.
- State assumptions and uncertainty.
- Use scenarios and ranges instead of false precision.
- Recommend qualified professional review for consequential decisions.
''';

  static const _codeAdvisoryModule = '''
# Code Advisory Module
- Standalone mobile can analyze pasted code and design solutions.
- Do not claim you edited files, ran tests, or inspected a repository unless remote CLI provides that evidence.
- Give implementation steps, edge cases, and verification guidance.
''';
}
