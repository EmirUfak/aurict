import 'mobile_agent_runtime.dart';
import 'mobile_skill_loader.dart';

enum MobileSkillRisk { normal, legal, finance, advisoryCode }

class MobileSkillPolicy {
  const MobileSkillPolicy({
    this.risk = MobileSkillRisk.normal,
    this.outputFormat = 'Use concise markdown with headings and bullets.',
    this.checklist = const [],
    this.caveat = '',
    this.requiredPhases = const [],
    this.requiredVerifier = false,
    this.artifactGates = const [],
    this.maxToolSteps = 6,
  });

  final MobileSkillRisk risk;
  final String outputFormat;
  final List<String> checklist;
  final String caveat;
  final List<String> requiredPhases;
  final bool requiredVerifier;
  final List<String> artifactGates;
  final int maxToolSteps;
}

class MobileSkillCatalogEntry {
  const MobileSkillCatalogEntry({
    required this.def,
    required this.instructions,
    this.context = MobileSkillContext.inline,
    this.policy = const MobileSkillPolicy(),
  });

  final MobileSkillDef def;
  final String instructions;
  final MobileSkillContext context;
  final MobileSkillPolicy policy;
}

class MobileSkillCatalog {
  const MobileSkillCatalog();

  static const entries = <MobileSkillCatalogEntry>[
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'research',
        name: 'Research',
        description:
            'Source-backed research with public fetch, source distillation, citations, and verification.',
        triggers: ['research', 'araştır', 'kaynak', 'citation', 'source'],
        tools: [
          'task_ledger',
          'web_search',
          'web_fetch_plus',
          'source_distill',
          'citation_manager',
          'answer_verifier',
          'research_outline',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.network],
        autoContinue: true,
      ),
      context: MobileSkillContext.fork,
      instructions:
          'Research operator loop: classify scope, gather public sources, distill claims into evidence, verify important claims, then draft with citations and uncertainty.',
      policy: MobileSkillPolicy(
        outputFormat:
            'Use markdown: summary, findings, evidence, limitations, next steps.',
        checklist: ['scope clear', 'sources cited', 'uncertainty stated'],
        requiredPhases: ['loadSkill', 'plan', 'gather', 'distill', 'verify'],
        requiredVerifier: true,
        maxToolSteps: 8,
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'professional-report-design',
        name: 'Professional Report Design',
        description:
            'IBM/McKinsey-style report structure, executive summaries, findings, evidence, and recommendations.',
        triggers: ['report', 'rapor', 'whitepaper', 'brief'],
        tools: [
          'task_ledger',
          'create_document_outline',
          'source_distill',
          'table_tool',
          'citation_manager',
          'answer_verifier',
          'document_export',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.exportPdf],
        autoContinue: true,
      ),
      instructions:
          'Create a decision-grade report: executive summary, scope, methodology, key findings, evidence, recommendations, risks, appendix.',
      policy: MobileSkillPolicy(
        outputFormat:
            'Use polished markdown with clear hierarchy, tables where useful, and no raw scanner/source dumps.',
        checklist: ['executive summary', 'findings', 'recommendations'],
        requiredPhases: [
          'loadSkill',
          'plan',
          'distill',
          'verify',
          'draft',
          'export',
        ],
        requiredVerifier: true,
        artifactGates: ['outline', 'draft', 'render', 'saved'],
        maxToolSteps: 8,
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'pdf',
        name: 'HTML to PDF',
        description:
            'PDF-ready document planning with pagination, print-safe structure, and export gates.',
        triggers: ['pdf', 'html-to-pdf', 'print', 'a4', 'letter'],
        tools: [
          'task_ledger',
          'create_document_outline',
          'document_reader',
          'file_intake_policy',
          'pdf_read',
          'ocr_read',
          'answer_verifier',
          'html_document_create',
          'html_sanitize',
          'html_to_pdf',
          'artifact_save',
          'artifact_share',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.exportPdf],
        autoContinue: true,
      ),
      instructions:
          'Plan PDF output with title page, sections, page-safe tables, appendix, and explicit save/export gate. Do not claim binary export unless an artifact tool confirms it.',
      policy: MobileSkillPolicy(
        requiredPhases: ['loadSkill', 'plan', 'draft', 'export'],
        requiredVerifier: true,
        artifactGates: ['outline', 'draft', 'render', 'saved'],
        maxToolSteps: 7,
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'professional-pptx-design',
        name: 'Professional PPTX Design',
        description:
            'Executive slide structure, one idea per slide, speaker notes, and chart/story flow.',
        triggers: ['presentation', 'sunum', 'deck', 'slides', 'pptx'],
        tools: [
          'task_ledger',
          'create_document_outline',
          'table_tool',
          'answer_verifier',
          'html_document_create',
          'html_to_pdf',
          'artifact_save',
          'artifact_share',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.exportSlides],
        autoContinue: true,
      ),
      instructions:
          'Build a slide story: audience, objective, storyline, slide titles, visual intent, speaker notes, and evidence slots.',
      policy: MobileSkillPolicy(
        requiredPhases: ['loadSkill', 'plan', 'draft', 'export'],
        requiredVerifier: true,
        artifactGates: ['outline', 'draft', 'render', 'saved'],
        maxToolSteps: 7,
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'proposal-writer',
        name: 'Proposal Writer',
        description:
            'B2B proposal structure with problem, solution, scope, timeline, pricing, and terms.',
        triggers: ['proposal', 'teklif', 'rfp', 'scope of work'],
        tools: [
          'task_ledger',
          'create_document_outline',
          'table_tool',
          'answer_verifier',
          'html_document_create',
          'html_to_pdf',
          'artifact_save',
          'artifact_share',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.fileWrite],
        autoContinue: true,
      ),
      instructions:
          'Write proposals with problem framing, proposed solution, deliverables, timeline, assumptions, pricing table, risks, and next steps.',
      policy: MobileSkillPolicy(
        requiredPhases: ['loadSkill', 'plan', 'verify', 'draft', 'export'],
        requiredVerifier: true,
        artifactGates: ['outline', 'draft', 'saved'],
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'resume-builder',
        name: 'Resume Builder',
        description:
            'ATS-friendly resume/CV structure with quantified achievements and role targeting.',
        triggers: ['resume', 'cv', 'özgeçmiş', 'ats'],
        tools: [
          'task_ledger',
          'document_reader',
          'file_intake_policy',
          'ocr_read',
          'create_document_outline',
          'answer_verifier',
          'html_document_create',
          'html_to_pdf',
          'artifact_save',
          'artifact_share',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.fileWrite],
        autoContinue: true,
      ),
      instructions:
          'Create an ATS-friendly resume: target role, summary, skills, experience bullets with impact metrics, projects, education, and keyword alignment.',
      policy: MobileSkillPolicy(
        requiredPhases: ['loadSkill', 'plan', 'verify', 'draft', 'export'],
        requiredVerifier: true,
        artifactGates: ['outline', 'draft', 'saved'],
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'market-researcher',
        name: 'Market Researcher',
        description:
            'Market sizing, competitors, customer segments, trends, SWOT/PESTLE, and source-backed analysis.',
        triggers: ['market', 'pazar', 'competitor', 'rakip', 'swot', 'pestle'],
        tools: [
          'task_ledger',
          'web_search',
          'web_fetch_plus',
          'source_distill',
          'table_tool',
          'citation_manager',
          'answer_verifier',
          'research_outline',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.network],
        autoContinue: true,
      ),
      instructions:
          'Produce market research with scope, target segment, trends, competitors, evidence, risks, and strategic recommendations.',
      policy: MobileSkillPolicy(
        requiredPhases: [
          'loadSkill',
          'plan',
          'gather',
          'distill',
          'verify',
          'draft',
        ],
        requiredVerifier: true,
        maxToolSteps: 8,
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'citation-formatter',
        name: 'Citation Formatter',
        description:
            'APA/MLA/Chicago/Harvard citation formatting and source hygiene.',
        triggers: ['apa', 'mla', 'chicago', 'harvard', 'bibliography'],
        tools: [
          'web_search',
          'web_fetch_plus',
          'source_distill',
          'citation_manager',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.network],
        autoContinue: false,
      ),
      instructions:
          'Format citations consistently. Include missing-field notes when author/date/title/publisher/URL are unavailable.',
      policy: MobileSkillPolicy(
        requiredPhases: ['loadSkill', 'distill', 'verify'],
        requiredVerifier: true,
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'meeting-summarizer',
        name: 'Meeting Summarizer',
        description:
            'Summaries, decisions, action items, owners, deadlines, and follow-up plans.',
        triggers: ['meeting', 'toplantı', 'transcript', 'minutes'],
        tools: [
          'document_reader',
          'file_intake_policy',
          'ocr_read',
          'create_document_outline',
          'table_tool',
          'html_document_create',
          'html_to_pdf',
          'artifact_save',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.fileWrite],
        autoContinue: false,
      ),
      instructions:
          'Summarize meetings into agenda, decisions, action items with owners, open questions, risks, and follow-up message.',
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'copywriting-frameworks',
        name: 'Copywriting Frameworks',
        description:
            'AIDA, PAS, hooks, CTAs, landing page copy, and conversion-oriented writing.',
        triggers: ['copy', 'copywriting', 'landing page', 'aida', 'pas'],
        tools: ['task_ledger', 'answer_verifier', 'load_mobile_skill'],
        permissions: [],
        autoContinue: false,
      ),
      instructions:
          'Use a clear framework: audience, pain, promise, proof, offer, CTA. Produce variants and explain when each fits.',
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'travel-planner',
        name: 'Travel Planner',
        description:
            'Itineraries, budgets, constraints, local tips, packing lists, and day-by-day plans.',
        triggers: ['travel', 'trip', 'itinerary', 'seyahat', 'gezi'],
        tools: [
          'web_search',
          'web_fetch_plus',
          'table_tool',
          'answer_verifier',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.network],
        autoContinue: false,
      ),
      instructions:
          'Build travel plans with dates, constraints, budget, day-by-day itinerary, transport, food, backups, and caveats for live prices/hours.',
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'study-guide-creator',
        name: 'Study Guide Creator',
        description:
            'Study guides, summaries, flashcards, quizzes, and learning checkpoints.',
        triggers: ['study', 'ders', 'quiz', 'flashcard', 'özet'],
        tools: [
          'document_reader',
          'file_intake_policy',
          'ocr_read',
          'create_document_outline',
          'table_tool',
          'document_export',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.fileWrite],
        autoContinue: false,
      ),
      instructions:
          'Create study material with objectives, chapter summaries, key terms, examples, quiz questions, and review schedule.',
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'contract-analyzer',
        name: 'Contract Analyzer',
        description:
            'Contract summaries, obligations, risks, missing clauses, and negotiation notes.',
        triggers: ['contract', 'agreement', 'sözleşme', 'nda', 'legal'],
        tools: [
          'task_ledger',
          'safety_classifier',
          'document_reader',
          'file_intake_policy',
          'web_fetch_plus',
          'create_document_outline',
          'answer_verifier',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.network],
        autoContinue: true,
      ),
      instructions:
          'Analyze contracts by parties, obligations, payment, term, termination, liability, IP, confidentiality, governing law, risk, and action items.',
      policy: MobileSkillPolicy(
        risk: MobileSkillRisk.legal,
        caveat:
            'Not legal advice. Ask the user to verify jurisdiction and consult a qualified lawyer for decisions.',
        checklist: [
          'jurisdiction noted',
          'risks separated',
          'not legal advice',
        ],
        requiredPhases: ['loadSkill', 'plan', 'verify', 'draft'],
        requiredVerifier: true,
        maxToolSteps: 7,
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'budget-planner',
        name: 'Budget Planner',
        description:
            'Income, expenses, savings goals, debt planning, scenarios, and variance analysis.',
        triggers: ['budget', 'bütçe', 'expense', 'gider', 'saving'],
        tools: [
          'safety_classifier',
          'calculator',
          'table_tool',
          'create_document_outline',
          'answer_verifier',
          'document_export',
          'load_mobile_skill',
        ],
        permissions: [MobileToolPermission.fileWrite],
        autoContinue: false,
      ),
      instructions:
          'Create budgets with income, fixed/variable expenses, savings targets, debt plan, emergency fund, scenarios, and review cadence.',
      policy: MobileSkillPolicy(
        risk: MobileSkillRisk.finance,
        caveat:
            'Not financial advice. State assumptions and recommend professional advice for major decisions.',
        requiredPhases: ['loadSkill', 'plan', 'verify', 'draft'],
        requiredVerifier: true,
      ),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'llm-integration',
        name: 'LLM Integration',
        description:
            'Streaming, tools, structured output, provider switching, prompt caching, and fallback patterns.',
        triggers: ['llm', 'ai sdk', 'streaming', 'tool use', 'prompt'],
        tools: ['document_reader', 'answer_verifier', 'load_mobile_skill'],
        permissions: [],
        autoContinue: false,
      ),
      instructions:
          'Advise on LLM integration patterns. In standalone mobile, do not claim to edit files or run tests unless remote CLI is connected.',
      policy: MobileSkillPolicy(risk: MobileSkillRisk.advisoryCode),
    ),
    MobileSkillCatalogEntry(
      def: MobileSkillDef(
        id: 'code-review-patterns',
        name: 'Code Review Patterns',
        description:
            'Correctness, security, maintainability, blocking findings, and missing test review format.',
        triggers: ['code review', 'review code', 'pr review', 'incele'],
        tools: ['load_mobile_skill'],
        permissions: [],
        autoContinue: false,
      ),
      instructions:
          'Review code by severity: bugs, security, regressions, missing tests, questions. Standalone mobile can review pasted code only.',
      policy: MobileSkillPolicy(risk: MobileSkillRisk.advisoryCode),
    ),
  ];

  static List<MobileSkillDef> get skills =>
      entries.map((entry) => entry.def).toList(growable: false);

  MobileSkillCatalogEntry? get(String id) {
    final normalized = id.trim().toLowerCase();
    if (normalized == 'html-to-pdf') return get('pdf');
    for (final entry in entries) {
      if (entry.def.id == normalized) return entry;
    }
    return null;
  }

  MobileSkillCatalogEntry? findBest(String query) {
    final normalized = query.trim().toLowerCase();
    if (normalized.isEmpty) return null;
    final exact = get(normalized);
    if (exact != null) return exact;
    MobileSkillCatalogEntry? best;
    var bestScore = 0;
    for (final entry in entries) {
      final haystack = [
        entry.def.id,
        entry.def.name,
        entry.def.description,
        ...entry.def.triggers,
      ].join(' ').toLowerCase();
      final score = _score(normalized, haystack, entry.def.id);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    return bestScore >= 2 ? best : null;
  }

  List<MobileSkillCatalogEntry> match(String input) {
    final text = input.toLowerCase();
    final matched = entries
        .where(
          (entry) =>
              entry.def.triggers.any((trigger) => text.contains(trigger)),
        )
        .toList();
    return matched;
  }

  int _score(String query, String haystack, String id) {
    if (id == query || id.contains(query)) return 10;
    if (haystack.contains(query)) return 8;
    final terms = query
        .split(RegExp(r'\s+|-|_'))
        .where((term) => term.length > 2);
    var score = 0;
    for (final term in terms) {
      if (haystack.contains(term)) score++;
    }
    return score;
  }
}
