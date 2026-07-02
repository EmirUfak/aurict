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

class MobileIntentRouter {
  const MobileIntentRouter();

  Set<MobilePromptIntent> detect(String text) {
    final input = text.toLowerCase();
    final intents = <MobilePromptIntent>{};
    if (_matches(input, [
      'pdf',
      'report',
      'rapor',
      'document',
      'doküman',
      'proposal',
      'resume',
      'cv',
      'slides',
      'presentation',
      'sunum',
    ])) {
      intents.add(MobilePromptIntent.document);
    }
    if (_matches(input, [
      'research',
      'araştır',
      'source',
      'kaynak',
      'citation',
    ])) {
      intents.add(MobilePromptIntent.research);
    }
    if (_matches(input, [
      'contract',
      'legal',
      'gdpr',
      'privacy',
      'nda',
      'sözleşme',
    ])) {
      intents.add(MobilePromptIntent.legal);
    }
    if (_matches(input, [
      'budget',
      'finance',
      'tax',
      'invoice',
      'portfolio',
      'bütçe',
      'vergi',
    ])) {
      intents.add(MobilePromptIntent.finance);
    }
    if (_matches(input, [
      'code',
      'debug',
      'api',
      'test',
      'llm',
      'prompt',
      'review',
    ])) {
      intents.add(MobilePromptIntent.codeAdvisory);
    }
    if (intents.isEmpty) intents.add(MobilePromptIntent.normal);
    return intents;
  }

  bool _matches(String input, List<String> terms) {
    return terms.any(input.contains);
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
- Final answers must be clear markdown with headings, bullets, tables, or code blocks when useful.
- Use tools only when they materially improve the answer.
- Never repeat the same tool call. If a tool result exists, use it.
- If a tool fails, explain the limitation and answer with available evidence instead of looping.
- For multi-step research/document/export tasks, open task_ledger and keep going until ledger gates are satisfied.
- For legal, finance, medical, safety, private-data, or source-backed claims, use safety_classifier and answer_verifier before finalizing.
- Use calculator for arithmetic, table_tool for structured tables, and citation_manager for bibliography formatting.
- For research: discover with web_search, fetch exact important URLs with web_fetch_plus, then call source_distill before strong source-backed claims.
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
Do not load every skill. Pick the most relevant one.

$lines
''';
  }

  static const _documentModule = '''
# Document / Report Module
- Open task_ledger for document/export tasks.
- Load the relevant skill before drafting.
- Use file_intake_policy before asking for PDF/image/document content when intake rules matter.
- For PDF output, produce HTML/CSS first with strong hierarchy, tables, callouts, page-safe structure, and print CSS.
- Do not claim PDF/PPTX binary export unless an artifact tool confirms it.
- Use html_to_pdf for high-quality PDF artifact preview, then state that save/share is a separate UI gate.
- Run answer_verifier before final output if sources or artifact gates are involved.
- For professional reports: executive summary, scope, findings, evidence, recommendations, risks, appendix.
''';

  static const _researchModule = '''
# Research Module
- Open task_ledger for source-backed research tasks.
- Prefer source-backed claims.
- Use web_search for discovery and web_fetch_plus only for exact public URLs.
- Distill evidence instead of dumping raw source text.
- Call source_distill before citing or relying on fetched/user-provided source text.
- Run answer_verifier with sources_required=true before finalizing.
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
