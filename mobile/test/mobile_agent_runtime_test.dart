import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

import 'package:aurict_mobile/agent/mobile_agent_runtime.dart';
import 'package:aurict_mobile/agent/mobile_artifact_index_store.dart';
import 'package:aurict_mobile/agent/mobile_artifact_renderer.dart';
import 'package:aurict_mobile/agent/mobile_artifacts.dart';
import 'package:aurict_mobile/agent/mobile_chat_history_store.dart';
import 'package:aurict_mobile/agent/mobile_chat_stream.dart';
import 'package:aurict_mobile/agent/mobile_citation_audit_tool.dart';
import 'package:aurict_mobile/agent/mobile_citations.dart';
import 'package:aurict_mobile/agent/mobile_cli_skill_importer.dart';
import 'package:aurict_mobile/agent/mobile_diagnostics.dart';
import 'package:aurict_mobile/agent/mobile_document_picker.dart';
import 'package:aurict_mobile/agent/mobile_document_tools.dart';
import 'package:aurict_mobile/agent/mobile_html_pdf_tools.dart';
import 'package:aurict_mobile/agent/mobile_memory_tools.dart';
import 'package:aurict_mobile/agent/mobile_model_cache_store.dart';
import 'package:aurict_mobile/agent/mobile_ocr_tools.dart';
import 'package:aurict_mobile/agent/mobile_productivity_tools.dart';
import 'package:aurict_mobile/agent/mobile_provider_models.dart';
import 'package:aurict_mobile/agent/mobile_provider_session.dart';
import 'package:aurict_mobile/agent/mobile_research_tools.dart';
import 'package:aurict_mobile/agent/mobile_secure_key_store.dart';
import 'package:aurict_mobile/agent/mobile_skill_catalog.dart';
import 'package:aurict_mobile/agent/mobile_skill_loader.dart';
import 'package:aurict_mobile/agent/mobile_system_prompt.dart';
import 'package:aurict_mobile/agent/mobile_task_ledger.dart';
import 'package:aurict_mobile/agent/mobile_tool_policy.dart';
import 'package:aurict_mobile/agent/mobile_verification_tools.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('research planner uses free no-key providers and exact URLs', () {
    final plan = const MobileResearchPlanner().plan(
      'Research https://example.com/private-ai and cite academic sources',
    );

    expect(plan.requiresNetwork, isTrue);
    expect(plan.exactUrls, hasLength(1));
    expect(plan.providers.every((provider) => provider.isFree), isTrue);
    expect(
      plan.providers.every((provider) => !provider.requiresApiKey),
      isTrue,
    );
    expect(plan.providerSummary, contains('Wikimedia'));
    expect(plan.providerSummary, contains('arXiv'));
    expect(plan.providerSummary, contains('Crossref'));
  });

  test('search request builder creates free provider requests', () {
    final plan = const MobileResearchPlanner().plan('local first ai tools');
    final requests = const MobileSearchRequestBuilder().build(plan);

    expect(requests, isNotEmpty);
    expect(requests.every((request) => request.method == 'GET'), isTrue);
    expect(
      requests.map((request) => request.provider.name),
      contains('Wikimedia'),
    );
    expect(
      requests.map((request) => request.uri.toString()).join('\n'),
      contains('local+first+ai+tools'),
    );
  });

  test('web search parser distills public provider results', () {
    const tool = MobileWebSearchTool();
    final provider = MobileSearchProvider(
      kind: MobileSearchProviderKind.wikimedia,
      name: 'Wikimedia',
      endpoint: Uri.https(
        'api.wikimedia.org',
        '/core/v1/wikipedia/en/search/page',
      ),
      requiresApiKey: false,
      isFree: true,
      notes: 'test provider',
    );
    final hits = tool.parseProviderBody(
      provider,
      jsonEncode({
        'pages': [
          {
            'title': 'Local-first software',
            'key': 'Local-first_software',
            'description': 'Software collaboration pattern',
            'excerpt': 'Keeps primary data local.',
          },
        ],
      }),
    );

    expect(hits.single.title, 'Local-first software');
    expect(hits.single.url.toString(), contains('Local-first_software'));
    expect(hits.single.snippet, contains('Software collaboration pattern'));
  });

  test('webfetch extractor strips scripts and keeps readable text', () {
    const html = '''
      <html>
        <head><title>Source Title</title><script>bad()</script></head>
        <body><h1>Useful Heading</h1><p>Useful &amp; readable text.</p></body>
      </html>
    ''';

    expect(MobileWebFetchTool.extractTitle(html), 'Source Title');
    expect(
      MobileWebFetchTool.extractReadableText(html),
      contains('Useful Heading'),
    );
    expect(
      MobileWebFetchTool.extractReadableText(html),
      isNot(contains('bad()')),
    );
  });

  test('source distiller creates citation ledger instead of raw source dump', () {
    final ledger = const MobileSourceDistiller().distill([
      MobileSourceRecord(
        url: Uri.parse('https://example.com/research'),
        title: 'Example Research',
        text:
            'This source explains that local-first AI tools can keep sensitive keys on device while still using network fetch for public sources. Extra raw HTML should not be copied directly into model context.',
        sourceType: 'webfetch',
        statusCode: 200,
      ),
    ]);

    expect(ledger.hasVerifiableSources, isTrue);
    expect(ledger.citations.single.id, 'S1');
    expect(ledger.citations.single.evidence, contains('local-first AI tools'));
    expect(ledger.citations.single.evidence.length, lessThanOrEqualTo(263));
    expect(ledger.summary, contains('[S1] Example Research'));
  });

  test('document reader and exporter keep local artifact gates explicit', () {
    final reader = const MobileDocumentReaderTool().readText(
      name: 'notes.md',
      mimeType: 'text/markdown',
      content:
          '# Notes\nAurict mobile should process user documents locally and keep export gates explicit.',
    );
    final exported = const MobileDocumentExportTool().export(
      title: 'Aurict Mobile Report',
      markdown: '# Report\nEvidence-backed mobile workflow.',
      format: 'pdf',
    );

    expect(reader.name, 'notes.md');
    expect(reader.summary, contains('Aurict mobile'));
    expect(reader.wordCount, greaterThan(5));
    expect(reader.readable, isTrue);
    expect(reader.recommendedAction, contains('bounded text'));
    expect(exported['artifactName'], 'aurict-mobile-report.pdf');
    expect(exported['mimeType'], 'application/pdf');
    expect(exported['saved'], isFalse);
    expect(exported['saveGate'].toString(), contains('explicitly save'));
  });

  test('picked document parser preserves local metadata and preview only', () {
    final picked = MobilePickedDocument.fromJson({
      'name': 'brief.md',
      'mimeType': 'text/markdown',
      'sizeBytes': 2048,
      'sourceUri': 'content://documents/brief.md',
      'textPreview': '# Brief\nLocal preview',
    });
    final result = MobileDocumentPickResult.fromJson({
      'ok': true,
      'document': picked.toJson(),
    });

    expect(result.ok, isTrue);
    expect(result.document?.name, 'brief.md');
    expect(result.document?.hasTextPreview, isTrue);
    expect(result.document?.toJson(), isNot(containsPair('bytes', anything)));
  });

  test('diagnostics store caps local events and sorts newest first', () async {
    final store = MemoryMobileDiagnosticsStore();
    for (var i = 0; i < 85; i++) {
      await store.writeEvent(
        MobileDiagnosticEvent(
          id: 'event-$i',
          level: 'error',
          source: 'test',
          message: 'failure $i',
          createdAt: DateTime.utc(2026, 1, 1).add(Duration(minutes: i)),
        ),
      );
    }

    final events = await store.readEvents();

    expect(events, hasLength(80));
    expect(events.first.id, 'event-84');
    expect(events.last.id, 'event-5');
  });

  test('document context store creates bounded prompt context', () {
    final store = MobileDocumentContextStore();
    store.attach(
      const MobilePickedDocument(
        name: 'brief.md',
        mimeType: 'text/markdown',
        sizeBytes: 1200,
        sourceUri: 'content://brief',
        textPreview: '',
      ),
    );
    store.clear();
    store.attach(
      MobilePickedDocument(
        name: 'brief.md',
        mimeType: 'text/markdown',
        sizeBytes: 1200,
        sourceUri: 'content://brief',
        textPreview: List.filled(3200, 'A').join(),
      ),
    );

    final context = store.promptContext();

    expect(context, contains('User-selected document context'));
    expect(context, contains('brief.md'));
    expect(context.length, lessThan(2900));
  });

  test('pdf reader extracts common literal and hex text operators', () {
    final literalPdf = '''
      %PDF-1.4
      1 0 obj <<>> stream
      BT /F1 12 Tf 72 720 Td (Aurict PDF literal text) Tj ET
      endstream endobj
    ''';
    final hexPdf = '''
      %PDF-1.4
      1 0 obj <<>> stream
      BT <48657820746578742073616d706c65> Tj ET
      endstream endobj
    ''';
    final reader = const MobileDocumentReaderTool();

    expect(
      reader.extractTextFromPdfBytes(
        Uint8List.fromList(latin1.encode(literalPdf)),
      ),
      contains('Aurict PDF literal text'),
    );
    expect(
      reader.extractTextFromPdfBytes(Uint8List.fromList(latin1.encode(hexPdf))),
      contains('Hex text sample'),
    );
  });

  test(
    'html document pipeline sanitizes unsafe html and renders pdf artifact',
    () async {
      const tool = MobileHtmlDocumentTool();
      final sanitized = tool.sanitize(
        html: '<h1 onclick="bad()">Report</h1><script>bad()</script>',
        css: 'body{background:url("https://tracker.example/x")}',
      );
      final document = tool.create(
        title: 'Board Report',
        html: sanitized.html,
        css: sanitized.css,
        pageSize: 'A4',
        theme: 'executive',
      );
      final artifact = await const MobileHtmlToPdfRenderer().render(
        document: document,
        fileName: 'board-report.pdf',
      );

      expect(sanitized.issues, isNotEmpty);
      expect(document.fullHtml, isNot(contains('<script>')));
      expect(document.fullHtml, contains('@page'));
      expect(artifact.fileName, 'board-report.pdf');
      expect(artifact.mimeType, 'application/pdf');
      expect(String.fromCharCodes(artifact.bytes.take(8)), startsWith('%PDF-'));
      expect(artifact.saved, isFalse);
    },
  );

  test(
    'provider session stores keys through secure store abstraction',
    () async {
      final store = MemoryMobileSecureKeyStore();
      final session = MobileProviderSession(keyStore: store);
      await session.saveProviderKey('OpenCode', 'oc-secret-123456');
      final stored = await store.read('OpenCode');

      expect(session.hasKey('OpenCode'), isTrue);
      expect(session.keyFor('OpenCode'), 'oc-secret-123456');
      expect(session.maskedKeyFor('OpenCode'), contains('3456'));
      expect(stored?.fingerprint, session.keyFingerprintFor('OpenCode'));

      await session.clearProvider('OpenCode');
      expect(session.hasKey('OpenCode'), isFalse);
      expect(await store.read('OpenCode'), isNull);
    },
  );

  test('provider session can clear every stored provider key', () async {
    final store = MemoryMobileSecureKeyStore();
    final session = MobileProviderSession(keyStore: store);
    await session.saveProviderKey('OpenCode', 'oc-secret-123456');
    await session.saveProviderKey('OpenAI', 'sk-secret-123456');

    expect(session.hasKey('OpenCode'), isTrue);
    expect(session.hasKey('OpenAI'), isTrue);

    await session.clearAllProviders();

    expect(session.hasKey('OpenCode'), isFalse);
    expect(session.hasKey('OpenAI'), isFalse);
    expect(await store.read('OpenCode'), isNull);
    expect(await store.read('OpenAI'), isNull);
  });

  test(
    'provider session auto-fetches models after key save and caches list',
    () async {
      final service = _FakeModelService();
      final session = MobileProviderSession(
        keyStore: MemoryMobileSecureKeyStore(),
        modelService: service,
      );

      await session.saveProviderKey('OpenCode', 'oc-secret-123456');
      await _waitFor(() => session.selectedModel == 'zen-a');

      expect(service.fetchCount, 1);
      expect(session.modelsFor('OpenCode'), ['zen-a', 'zen-b']);
      expect(session.selectedModel, 'zen-a');

      await session.fetchModels(
        MobileProviderSession.providers.firstWhere(
          (provider) => provider.name == 'OpenCode',
        ),
      );

      expect(service.fetchCount, 1);
    },
  );

  test('provider session tracks recent and favorite models', () {
    final session = MobileProviderSession(
      keyStore: MemoryMobileSecureKeyStore(),
      modelService: _FakeModelService(),
    );

    session.selectModel('OpenCode', 'zen-a');
    session.selectModel('OpenCode', 'zen-b');
    session.toggleFavoriteModel('OpenCode', 'zen-a');

    expect(session.recentModelsFor('OpenCode'), ['zen-b', 'zen-a']);
    expect(session.favoriteModelsFor('OpenCode'), ['zen-a']);
    expect(session.isFavoriteModel('OpenCode', 'zen-a'), isTrue);

    session.toggleFavoriteModel('OpenCode', 'zen-a');
    expect(session.favoriteModelsFor('OpenCode'), isEmpty);
  });

  test(
    'provider session can clear cached model lists without clearing keys',
    () async {
      final service = _FakeModelService();
      final session = MobileProviderSession(
        keyStore: MemoryMobileSecureKeyStore(),
        modelService: service,
      );
      await session.saveProviderKey('OpenCode', 'oc-secret-123456');
      await _waitFor(() => session.modelsFor('OpenCode').isNotEmpty);

      expect(session.hasKey('OpenCode'), isTrue);
      expect(session.modelsFor('OpenCode'), isNotEmpty);

      await session.clearModelCache();

      expect(session.hasKey('OpenCode'), isTrue);
      expect(session.modelsFor('OpenCode'), isEmpty);
      expect(session.selectedModel, isNull);
    },
  );

  test('provider session restores persisted model cache on startup', () async {
    final cacheStore = MemoryMobileModelCacheStore();
    await cacheStore.write(
      MobileCachedModelList(
        provider: 'OpenCode',
        models: const ['cached-a', 'cached-b'],
        fetchedAt: DateTime.now(),
        favoriteModels: const ['cached-b'],
        recentModels: const ['cached-b', 'cached-a'],
      ),
    );

    final session = MobileProviderSession(
      keyStore: MemoryMobileSecureKeyStore(),
      modelCacheStore: cacheStore,
    );
    await _waitFor(() => session.modelsFor('OpenCode').isNotEmpty);

    expect(session.modelsFor('OpenCode'), ['cached-a', 'cached-b']);
    expect(session.selectedModel, 'cached-a');
    expect(session.favoriteModelsFor('OpenCode'), ['cached-b']);
    expect(session.recentModelsFor('OpenCode'), ['cached-b', 'cached-a']);
  });

  test('memory chat history store lists reads and clears threads', () async {
    final store = MemoryMobileChatHistoryStore();
    final meta = MobileChatThreadMeta(
      id: 'chat-1',
      title: 'Research plan',
      createdAt: DateTime.utc(2026, 1, 1),
      updatedAt: DateTime.utc(2026, 1, 2),
      messageCount: 2,
      preview: 'Plan',
    );
    await store.writeThread(
      MobileChatThreadSnapshot(
        meta: meta,
        documents: const [
          MobilePickedDocument(
            name: 'brief.md',
            mimeType: 'text/markdown',
            sizeBytes: 42,
            sourceUri: 'content://brief',
            textPreview: 'Brief preview',
          ),
        ],
        messages: const [
          {'role': 'user', 'text': 'Plan this'},
        ],
      ),
    );

    expect((await store.listThreads()).single.id, 'chat-1');
    expect(
      (await store.readThread('chat-1'))?.messages.single['text'],
      'Plan this',
    );
    expect(
      (await store.readThread('chat-1'))?.documents.single.name,
      'brief.md',
    );

    await store.clearAllThreads();

    expect(await store.listThreads(), isEmpty);
  });

  test('file intake and OCR tools require explicit user-provided content', () {
    final policy = const MobileFileIntakePolicy().describe(
      requestedAction: 'read receipt image',
      mimeType: 'image/png',
    );
    final emptyOcr = const MobileOcrTool().read(
      name: 'receipt.png',
      recognizedText: '',
    );
    final ocr = const MobileOcrTool().read(
      name: 'receipt.png',
      recognizedText: 'Total 42.00 USD paid by card.',
      languageHint: 'en',
    );

    expect(policy['needsRuntimePermission'], isTrue);
    expect(
      policy['blockedInputs'].toString(),
      contains('arbitrary filesystem'),
    );
    expect(emptyOcr.requiresOcrEngine, isTrue);
    expect(ocr.requiresOcrEngine, isFalse);
    expect(ocr.summary, contains('42.00'));
  });

  test('artifact planner creates local pdf and slide gates', () {
    final plans = const MobileArtifactPlanner().plan(
      'Research the market and create a PDF report and slide deck',
    );

    expect(
      plans.map((plan) => plan.kind),
      contains(MobileArtifactKind.pdfReport),
    );
    expect(
      plans.map((plan) => plan.kind),
      contains(MobileArtifactKind.slideDeck),
    );
    expect(plans.every((plan) => plan.localOnly), isTrue);
    expect(
      plans.every((plan) => plan.gates.last == MobileArtifactGate.saved),
      isTrue,
    );
  });

  test('artifact renderer creates local markdown and pdf bytes', () {
    final plan = const MobileArtifactPlanner()
        .plan('Create a PDF report about local AI')
        .single;
    final rendered = const MobileArtifactRenderer().render(
      plan: plan,
      objective: 'Create a PDF report about local AI',
    );

    expect(rendered.mimeType, 'application/pdf');
    expect(rendered.bytes.length, greaterThan(100));
    expect(String.fromCharCodes(rendered.bytes.take(8)), startsWith('%PDF-'));
    expect(rendered.preview, contains('Aurict Research Report'));
  });

  test('agent runtime registers provider plan and export gates', () {
    final result = const MobileAgentRuntime().run(
      'Research private AI search and create a PDF report',
    );

    expect(result.completed, isFalse);
    expect(result.activeSkills.map((skill) => skill.id), contains('research'));
    expect(result.activeSkills.map((skill) => skill.id), contains('pdf'));
    expect(
      result.loadedSkills.map((skill) => skill.skillId),
      contains('research'),
    );
    expect(
      result.events.map((event) => event.title),
      contains('Research plan'),
    );
    expect(
      result.events.map((event) => event.title),
      contains('PDF export gate'),
    );
    expect(result.text, contains('Wikimedia'));
    expect(result.text, contains('aurict-research-report.pdf'));
    expect(result.text, contains('Completion gate: continue required'));
    expect(result.searchRequests, isNotEmpty);
    expect(result.renderedArtifacts.single.mimeType, 'application/pdf');
  });

  test(
    'agent runtime can satisfy completion gate when artifacts are saved',
    () {
      final result = const MobileAgentRuntime().run(
        'Research private AI search and create a PDF report',
        sourcesVerified: true,
        savedArtifacts: {'aurict-research-report.pdf'},
      );

      expect(result.completed, isTrue);
      expect(result.completion.canFinish, isTrue);
      expect(result.events.map((event) => event.title), contains('Complete'));
    },
  );

  test('agent runtime blocks disabled mobile permissions', () {
    final result = const MobileAgentRuntime(
      toolPolicy: MobileToolPolicy(networkEnabled: false),
    ).run('Research private AI search and create a PDF report');

    expect(result.completed, isFalse);
    expect(result.completion.status, MobileCompletionStatus.blocked);
    expect(result.deniedPermissions, contains(MobileToolPermission.network));
    expect(
      result.events.map((event) => event.title),
      contains('Permission blocked'),
    );
  });

  test('skill discovery is metadata only until skill is loaded', () {
    const loader = MobileSkillLoader();
    final discovery = loader.buildDiscoveryPrompt(MobileSkillRegistry.skills);
    final research = loader.load(MobileSkillRegistry.skills.first);

    expect(discovery, contains('research'));
    expect(discovery, isNot(contains('Research operator loop')));
    expect(research.instructions, contains('Research operator loop'));
    expect(research.allowedTools, contains('web_search'));
    expect(research.context, MobileSkillContext.fork);
  });

  test('mobile skill loader supports expanded exact and fuzzy lookup', () {
    const loader = MobileSkillLoader();
    final resume = loader.loadByQuery('resume');
    final market = loader.loadByQuery('market research');

    expect(MobileSkillRegistry.skills.length, greaterThan(12));
    expect(resume?.skillId, 'resume-builder');
    expect(resume?.instructions, contains('ATS-friendly'));
    expect(market?.skillId, 'market-researcher');
  });

  test('mobile skill loader adds legal and finance policies', () {
    const loader = MobileSkillLoader();
    final contract = loader.loadByQuery('contract');
    final budget = loader.loadByQuery('budget');

    expect(contract?.policy.risk, MobileSkillRisk.legal);
    expect(contract?.policy.caveat, contains('Not legal advice'));
    expect(budget?.policy.risk, MobileSkillRisk.finance);
    expect(budget?.policy.caveat, contains('Not financial advice'));
  });

  test('skill policy v2 exposes gates verifier and max tool steps', () {
    const loader = MobileSkillLoader();
    final research = loader.loadByQuery('research');
    final pdf = loader.loadByQuery('pdf');

    expect(research?.policy.requiredVerifier, isTrue);
    expect(research?.policy.requiredPhases, contains('distill'));
    expect(research?.policy.maxToolSteps, greaterThanOrEqualTo(8));
    expect(pdf?.policy.artifactGates, contains('saved'));
    expect(
      loader.formatLoadedSkill(research!),
      contains('Required phases: loadSkill -> plan -> gather'),
    );
  });

  test('mobile system prompt selects intent modules deterministically', () {
    const router = MobileIntentRouter();
    const builder = MobileSystemPromptBuilder();
    final prompt = builder.build(
      latestUserText: 'Create a contract analysis PDF report with citations',
      provider: MobileProviderModelService.openCode,
      model: 'claude-sonnet-4-6',
    );

    expect(router.detect('normal chat'), contains(MobilePromptIntent.normal));
    expect(prompt, contains('Document / Report Module'));
    expect(prompt, contains('Research Module'));
    expect(prompt, contains('Legal / Compliance Module'));
    expect(prompt, contains('Available Mobile Skills'));
    expect(prompt, contains('load_mobile_skill'));
  });

  test('mobile intent router returns confidence and reasons', () {
    const router = MobileIntentRouter();
    final analysis = router.analyze(
      'Prepare a sourced PDF report about current AI compliance trends',
    );

    expect(analysis.intents, contains(MobilePromptIntent.document));
    expect(analysis.intents, contains(MobilePromptIntent.research));
    expect(
      analysis.scoreFor(MobilePromptIntent.document)?.confidence,
      greaterThanOrEqualTo(.24),
    );
    expect(
      analysis.scoreFor(MobilePromptIntent.research)?.reasons,
      contains('current'),
    );
  });

  test('completion gate blocks unfinished source and artifact work', () {
    final artifacts = const MobileArtifactPlanner().plan('Create a PDF report');
    final blocked = const MobileCompletionGate().evaluate(
      objective: 'Create a PDF report',
      artifactPlans: artifacts,
      sourceVerificationRequired: true,
    );
    final complete = const MobileCompletionGate().evaluate(
      objective: 'Create a PDF report',
      artifactPlans: artifacts,
      sourceVerificationRequired: true,
      sourcesVerified: true,
      savedArtifacts: {'aurict-research-report.pdf'},
    );

    expect(blocked.canFinish, isFalse);
    expect(blocked.openGates, contains('source_verification'));
    expect(blocked.openGates, contains('aurict-research-report.pdf:saved'));
    expect(complete.canFinish, isTrue);
  });

  test('reasoning ledger enforces phase gates for long mobile tasks', () {
    final ledger = const MobileReasoningLedgerPlanner().plan(
      objective: 'Research market trends and export a PDF report',
      requiresResearch: true,
      requiresDocument: true,
      requiresExport: true,
      hasLoadedSkill: true,
      hasPlan: true,
      hasEvidence: false,
    );
    final complete = const MobileReasoningLedgerPlanner().plan(
      objective: 'Research market trends and export a PDF report',
      requiresResearch: true,
      requiresDocument: true,
      requiresExport: true,
      hasLoadedSkill: true,
      hasPlan: true,
      hasEvidence: true,
      hasVerification: true,
      hasDraft: true,
      hasExport: true,
    );

    expect(ledger.currentPhase, MobileTaskPhase.gather);
    expect(ledger.autoContinue, isTrue);
    expect(ledger.openGates, contains('evidence_distilled'));
    expect(ledger.openGates, contains('verification_passed'));
    expect(complete.canFinish, isTrue);
  });

  test('task ledger instructions stay scoped to explicit workflows', () {
    const builder = MobileSystemPromptBuilder();
    final prompt = builder.build(
      latestUserText: 'Explain callbacks briefly',
      provider: MobileProviderModelService.openCode,
      model: 'test-model',
    );

    expect(prompt, contains('Open task_ledger only for explicit multi-step'));
    expect(prompt, contains('answer directly without task_ledger'));
    expect(prompt, contains('Be direct, objective, and evidence-led'));
    expect(prompt, contains('If you do not know, say so clearly'));
    expect(prompt, contains('research before answering'));
    expect(prompt, contains('Source contract'));
    expect(
      prompt,
      contains(
        'Do not finalize a multi-step task while task_ledger reports open gates',
      ),
    );
  });

  test('safety classifier and answer verifier catch high-risk gaps', () {
    final safety = const MobileSafetyClassifier().classify(
      'Analyze this contract and tax risk',
    );
    final revise = const MobileAnswerVerifier().verify(
      objective: 'Analyze this contract',
      answer: 'This clause is definitely enforceable.',
      sourcesRequired: true,
      hasCitations: false,
    );
    final pass = const MobileAnswerVerifier().verify(
      objective: 'Analyze this contract',
      answer:
          'Not legal advice; verify jurisdiction and consult a qualified lawyer. [S1] The clause creates a termination obligation.',
      sourcesRequired: true,
      hasCitations: true,
    );

    expect(safety.risks, contains(MobileSafetyRisk.legal));
    expect(safety.risks, contains(MobileSafetyRisk.finance));
    expect(safety.requiresVerifier, isTrue);
    expect(revise.verdict, MobileVerificationVerdict.revise);
    expect(revise.issues, contains('missing_citations'));
    expect(pass.verdict, MobileVerificationVerdict.pass);
  });

  test(
    'productivity tools calculate tables and citations deterministically',
    () {
      final calc = const MobileCalculatorTool().calculate('(1200-200)*1.18');
      final table = const MobileTableTool().buildMarkdownTable(
        columns: ['Item', 'Value'],
        rows: [
          ['Subtotal', '1000'],
          ['Total', calc['formatted'].toString()],
        ],
      );
      final citations = const MobileCitationManagerTool().format(
        style: 'apa',
        sources: [
          {
            'author': 'Ada Lovelace',
            'year': '1843',
            'title': 'Notes',
            'url': 'https://example.com/notes',
          },
          {'title': 'Incomplete'},
        ],
      );

      expect(calc['formatted'], '1180');
      expect(table['markdown'], contains('| Item | Value |'));
      expect(table['markdown'], contains('| Total | 1180 |'));
      expect((citations['citations'] as List).first, contains('Ada Lovelace'));
      expect(citations['missingFields'].toString(), contains('author'));
    },
  );

  test('cli skill importer classifies mobile compatibility', () {
    final plans = const MobileCliSkillImporter().plan(const [
      MobileCliSkillManifest(
        id: 'research',
        description: 'Research skill',
        allowedTools: ['web_search', 'web_fetch'],
      ),
      MobileCliSkillManifest(
        id: 'repo-editor',
        description: 'Edits local repo',
        allowedTools: ['read', 'apply_patch', 'bash'],
      ),
      MobileCliSkillManifest(
        id: 'chat-helper',
        description: 'Pure chat helper',
        allowedTools: ['chat'],
      ),
    ]);

    expect(plans[0].compatibility, MobileSkillCompatibility.limited);
    expect(plans[1].compatibility, MobileSkillCompatibility.unsupported);
    expect(plans[2].compatibility, MobileSkillCompatibility.native);
  });

  test('provider model service builds safe model list requests', () {
    const service = MobileProviderModelService();
    final openRouterRequest = service.buildRequest(
      MobileProviderModelService.openRouter,
      'sk-test',
    );
    final googleRequest = service.buildRequest(
      MobileProviderModelService.google,
      'google-key',
    );
    final openCodeRequest = service.buildRequest(
      MobileProviderModelService.openCode,
      'oc-test',
    );
    final nvidiaRequest = service.buildRequest(
      MobileProviderModelService.nvidia,
      'nv-test',
    );
    final zaiRequest = service.buildRequest(
      MobileProviderModelService.zai,
      'zai-test',
    );
    final alibabaRequest = service.buildRequest(
      MobileProviderModelService.alibaba,
      'dashscope-test',
    );

    expect(
      openRouterRequest.uri.toString(),
      'https://openrouter.ai/api/v1/models',
    );
    expect(openRouterRequest.headers['authorization'], 'Bearer sk-test');
    expect(openRouterRequest.headers['X-Title'], 'Aurict Mobile');
    expect(openCodeRequest.uri.toString(), 'https://opencode.ai/zen/v1/models');
    expect(openCodeRequest.headers['authorization'], 'Bearer oc-test');
    expect(
      nvidiaRequest.uri.toString(),
      'https://integrate.api.nvidia.com/v1/models',
    );
    expect(nvidiaRequest.headers['authorization'], 'Bearer nv-test');
    expect(zaiRequest.uri.toString(), 'https://api.z.ai/api/paas/v4/models');
    expect(zaiRequest.headers['authorization'], 'Bearer zai-test');
    expect(
      alibabaRequest.uri.toString(),
      'https://dashscope-us.aliyuncs.com/compatible-mode/v1/models',
    );
    expect(alibabaRequest.headers['authorization'], 'Bearer dashscope-test');
    expect(googleRequest.uri.query, contains('key=google-key'));
    expect(googleRequest.headers.containsKey('authorization'), isFalse);
  });

  test('provider model service parses common model response shapes', () {
    const service = MobileProviderModelService();
    final openAi = service.parseModels(MobileModelProvider.openai, {
      'data': [
        {'id': 'gpt-test'},
        {'id': 'gpt-next'},
      ],
    });
    final google = service.parseModels(MobileModelProvider.google, {
      'models': [
        {'name': 'models/gemini-test'},
      ],
    });
    final nvidia = service.parseModels(MobileModelProvider.nvidia, {
      'data': [
        {'id': 'nvidia/nemotron-test'},
      ],
    });

    expect(openAi, ['gpt-test', 'gpt-next']);
    expect(google, ['models/gemini-test']);
    expect(nvidia, ['nvidia/nemotron-test']);
  });

  test(
    'provider model service returns curated models without list endpoint',
    () async {
      const service = MobileProviderModelService();
      final result = await service.fetchModels(
        config: MobileProviderModelService.alibaba,
        apiKey: 'dashscope-test',
      );

      expect(result.models, contains('qwen-plus'));
      expect(
        result.request.uri.toString(),
        contains('compatible-mode/v1/models'),
      );
    },
  );

  test('OpenCode chat streaming uses zen chat completions endpoint', () {
    const service = MobileChatStreamingService();
    final request = service.buildChatRequest(
      MobileChatRequest(
        config: MobileProviderModelService.openCode,
        apiKey: 'oc-test',
        model: 'zen-test',
        messages: const [MobileChatMessage(role: 'user', content: 'hello')],
      ),
    );

    expect(
      request.uri.toString(),
      'https://opencode.ai/zen/v1/chat/completions',
    );
    expect(request.headers['authorization'], 'Bearer oc-test');
    expect(request.headers['accept'], 'text/event-stream');
    expect(request.body['model'], 'zen-test');
    expect(request.body['stream'], isTrue);
    expect(request.body['tool_choice'], 'auto');
    final tools = _toolNames(request);
    expect(tools, contains('answer_verifier'));
    expect(tools, contains('calculator'));
    expect(tools, contains('table_tool'));
    expect(tools, contains('citation_manager'));
    expect(tools, contains('note_memory'));
    expect(tools, isNot(contains('web_search')));
    expect(tools, isNot(contains('citation_audit')));
    expect(tools, isNot(contains('document_export')));
    expect(tools, isNot(contains('task_ledger')));
    final messages = request.body['messages'] as List<Object?>;
    expect(messages.first.toString(), contains('Aurict Mobile Runtime'));
    expect(
      messages.first.toString(),
      contains('answer directly without task_ledger'),
    );
  });

  test(
    'Anthropic chat adapter builds native messages request without tools',
    () {
      const service = MobileChatStreamingService();
      final request = service.buildChatRequest(
        MobileChatRequest(
          config: MobileProviderModelService.anthropic,
          apiKey: 'anthropic-test',
          model: 'claude-test',
          messages: const [MobileChatMessage(role: 'user', content: 'hello')],
        ),
      );

      expect(request.uri.toString(), 'https://api.anthropic.com/v1/messages');
      expect(request.headers['x-api-key'], 'anthropic-test');
      expect(request.protocol, MobileChatStreamProtocol.anthropic);
      expect(request.supportsToolLoop, isFalse);
      expect(
        request.body['system'].toString(),
        contains('Aurict Mobile Runtime'),
      );
      expect(request.body.containsKey('tools'), isFalse);
    },
  );

  test('Google chat adapter builds streamGenerateContent request', () {
    const service = MobileChatStreamingService();
    final request = service.buildChatRequest(
      MobileChatRequest(
        config: MobileProviderModelService.google,
        apiKey: 'google-test',
        model: 'gemini-test',
        messages: const [MobileChatMessage(role: 'user', content: 'hello')],
      ),
    );

    expect(request.uri.toString(), contains(':streamGenerateContent'));
    expect(request.uri.query, contains('key=google-test'));
    expect(request.protocol, MobileChatStreamProtocol.google);
    expect(request.supportsToolLoop, isFalse);
    expect(request.body['contents'].toString(), contains('hello'));
  });

  test('chat request exposes heavy tools only for matching intent', () {
    const service = MobileChatStreamingService();
    final request = service.buildChatRequest(
      MobileChatRequest(
        config: MobileProviderModelService.openCode,
        apiKey: 'oc-test',
        model: 'zen-test',
        latestUserText:
            'Research current AI security trends and create a PDF report with citations',
        messages: const [
          MobileChatMessage(
            role: 'user',
            content:
                'Research current AI security trends and create a PDF report with citations',
          ),
        ],
      ),
    );
    final tools = _toolNames(request);

    expect(tools, contains('task_ledger'));
    expect(tools, contains('web_search'));
    expect(tools, contains('web_fetch_plus'));
    expect(tools, contains('source_distill'));
    expect(tools, contains('citation_audit'));
    expect(tools, contains('document_export'));
    expect(tools, contains('html_document_create'));
    expect(tools, contains('html_to_pdf'));
    expect(tools, contains('answer_verifier'));
  });

  test(
    'Alibaba chat streaming tries tool schemas for fallback-capable models',
    () {
      const service = MobileChatStreamingService();
      final request = service.buildChatRequest(
        MobileChatRequest(
          config: MobileProviderModelService.alibaba,
          apiKey: 'dashscope-test',
          model: 'qwen-plus',
          messages: const [MobileChatMessage(role: 'user', content: 'hello')],
        ),
      );

      expect(
        request.uri.toString(),
        'https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions',
      );
      expect(request.headers['authorization'], 'Bearer dashscope-test');
      expect(request.body['model'], 'qwen-plus');
      expect(request.body['stream'], isTrue);
      expect(request.body.containsKey('tools'), isTrue);
      expect(request.body['tool_choice'], 'auto');
    },
  );

  test(
    'chat stream fallback policy retries only likely tool schema failures',
    () {
      const service = MobileChatStreamingService();

      expect(
        service.shouldRetryWithoutToolsForTest(
          statusCode: 400,
          body: '{"error":"unsupported parameter: tools"}',
        ),
        isTrue,
      );
      expect(
        service.shouldRetryWithoutToolsForTest(
          statusCode: 422,
          body: '{"error":"invalid schema for function call"}',
        ),
        isTrue,
      );
      expect(
        service.shouldRetryWithoutToolsForTest(
          statusCode: 401,
          body: '{"error":"invalid api key"}',
        ),
        isFalse,
      );
      expect(
        service.shouldRetryWithoutToolsForTest(
          statusCode: 429,
          body: '{"error":"rate limited"}',
        ),
        isFalse,
      );
      expect(
        service.shouldRetryWithoutToolsForTest(
          statusCode: 500,
          body: '{"error":"server failed while processing tools"}',
        ),
        isFalse,
      );
    },
  );

  test('chat stream parser keeps answer text separate from thinking', () {
    const service = MobileChatStreamingService();
    final normal = service.parseStreamFrameForTest(
      '{"choices":[{"delta":{"content":"hello answer"}}]}',
    );
    final thinking = service.parseStreamFrameForTest(
      '{"choices":[{"delta":{"thinking":"private thought"}}]}',
    );

    expect(normal.single.type, MobileChatEventType.textDelta);
    expect(normal.single.delta, 'hello answer');
    expect(thinking.single.type, MobileChatEventType.thinkingDelta);
    expect(thinking.single.delta, 'private thought');
  });

  test('chat stream parser handles Anthropic and Google text deltas', () {
    const service = MobileChatStreamingService();
    final anthropic = service.parseStreamFrameForProtocolTest(
      '{"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}',
      MobileChatStreamProtocol.anthropic,
    );
    final google = service.parseStreamFrameForProtocolTest(
      '{"candidates":[{"content":{"parts":[{"text":"world"}]}}]}',
      MobileChatStreamProtocol.google,
    );

    expect(anthropic.single.delta, 'hello');
    expect(anthropic.single.type, MobileChatEventType.textDelta);
    expect(google.single.delta, 'world');
  });

  test('chat stream parser keeps tool call chunks on stable index id', () {
    const service = MobileChatStreamingService();
    final first = service.parseStreamFrameForTest(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_real","function":{"name":"web_fetch","arguments":"{\\"url\\":"}}]}}]}',
    );
    final second = service.parseStreamFrameForTest(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"https://example.com\\"}"}}]}}]}',
    );

    expect(first.single.tool?.id, 'tool-0');
    expect(first.single.tool?.providerId, 'call_real');
    expect(second.single.tool?.id, 'tool-0');
    expect(second.single.tool?.providerId, isNull);
  });

  test('web fetch blocks private and local targets', () async {
    const service = MobileChatStreamingService();
    final body = jsonDecode(await service.webFetchForTest('http://127.0.0.1'));

    expect(body, isA<Map<String, Object?>>());
    expect(body['ok'], isFalse);
    expect(body['error'].toString(), contains('public HTTP/HTTPS'));
  });

  test(
    'chat tool executor runs note_memory with injected local store',
    () async {
      final store = MemoryMobileNoteMemoryStore();
      final service = MobileChatStreamingService(
        noteMemoryTool: MobileNoteMemoryTool(store: store),
      );

      final remembered =
          jsonDecode(
                await service.executeToolForTest('note_memory', {
                  'action': 'remember',
                  'text': 'Use compact answers in mobile mode.',
                  'category': 'style',
                }),
              )
              as Map<String, Object?>;
      final listed =
          jsonDecode(
                await service.executeToolForTest('note_memory', {
                  'action': 'list',
                }),
              )
              as Map<String, Object?>;

      expect(remembered['ok'], isTrue);
      expect(listed['count'], 1);
      expect(listed['records'].toString(), contains('compact answers'));
    },
  );

  test('chat tool executor runs citation_audit gate', () async {
    const service = MobileChatStreamingService();
    final result =
        jsonDecode(
              await service.executeToolForTest('citation_audit', {
                'answer':
                    'Current research shows a measurable improvement. '
                    'The direct source supports this claim [S1].',
                'citations': [
                  {'id': 'S1', 'confidence': 'high'},
                ],
              }),
            )
            as Map<String, Object?>;

    expect(result['ok'], isTrue);
    expect(result['tool'], 'citation_audit');
    expect(result['verdict'], 'revise');
    expect(result['issues'].toString(), contains('possible_uncited_claims'));
  });

  test(
    'encrypted chat history stores message payload outside plain snapshot',
    () async {
      final inner = MemoryMobileChatHistoryStore();
      final encrypted = EncryptedMobileChatHistoryStore(inner: inner);
      final snapshot = MobileChatThreadSnapshot(
        meta: MobileChatThreadMeta(
          id: 't1',
          title: 'Sensitive chat',
          createdAt: DateTime.utc(2026),
          updatedAt: DateTime.utc(2026),
          messageCount: 1,
          preview: 'secret preview',
        ),
        messages: const [
          {'role': 'user', 'text': 'secret body'},
        ],
      );

      await encrypted.writeThread(snapshot);
      final raw = await inner.readThread('t1');
      final restored = await encrypted.readThread('t1');

      expect(raw?.messages, isEmpty);
      expect(raw?.encryptedPayload, isNotNull);
      expect(raw?.encryptedPayload, isNot(contains('secret body')));
      expect(restored?.messages.single['text'], 'secret body');
    },
  );

  test(
    'artifact index upserts and removes records by thread and artifact',
    () async {
      final store = MemoryMobileArtifactIndexStore();
      await store.upsertThreadArtifacts(
        threadId: 'thread-1',
        threadTitle: 'Report thread',
        updatedAt: DateTime.utc(2026, 1, 1),
        artifacts: const [
          {'id': 'artifact-1', 'name': 'report.pdf'},
        ],
      );
      await store.upsertThreadArtifacts(
        threadId: 'thread-2',
        threadTitle: 'Deck thread',
        updatedAt: DateTime.utc(2026, 1, 2),
        artifacts: const [
          {'id': 'artifact-2', 'name': 'deck.pdf'},
        ],
      );

      expect((await store.readAll()).first.threadId, 'thread-2');
      await store.removeArtifact('artifact-2');
      expect((await store.readAll()).single.artifactId, 'artifact-1');
      await store.removeThread('thread-1');
      expect(await store.readAll(), isEmpty);
    },
  );

  test('note_memory remembers lists searches and forgets local notes', () async {
    final store = MemoryMobileNoteMemoryStore();
    final tool = MobileNoteMemoryTool(store: store);
    final remembered =
        jsonDecode(
              await tool.run({
                'action': 'remember',
                'text':
                    'User prefers concise Turkish answers for mobile planning.',
                'category': 'preference',
              }),
            )
            as Map<String, Object?>;
    final record = remembered['record'] as Map<String, Object?>;

    final listed =
        jsonDecode(await tool.run({'action': 'list'})) as Map<String, Object?>;
    final searched =
        jsonDecode(await tool.run({'action': 'search', 'query': 'Turkish'}))
            as Map<String, Object?>;
    final forgotten =
        jsonDecode(await tool.run({'action': 'forget', 'id': record['id']}))
            as Map<String, Object?>;

    expect(remembered['ok'], isTrue);
    expect(record['category'], 'preference');
    expect((listed['records'] as List), hasLength(1));
    expect(searched['count'], 1);
    expect(forgotten['forgotten'], isTrue);
    expect(await store.readAll(), isEmpty);
  });

  test('note_memory refuses likely secrets', () async {
    final tool = MobileNoteMemoryTool(store: MemoryMobileNoteMemoryStore());
    final result =
        jsonDecode(
              await tool.run({
                'action': 'remember',
                'text': 'api key: sk-this-should-never-be-stored-123456',
              }),
            )
            as Map<String, Object?>;

    expect(result['ok'], isFalse);
    expect(result['error'].toString(), contains('secret'));
  });

  test('citation_audit passes cited source-backed answer', () {
    final result =
        jsonDecode(
              const MobileCitationAuditTool().run({
                'answer': 'The fetched source supports the claim [S1].',
                'citations': [
                  {'id': 'S1', 'confidence': 'high'},
                ],
              }),
            )
            as Map<String, Object?>;

    expect(result['ok'], isTrue);
    expect(result['verdict'], 'pass');
    expect(result['issues'], isEmpty);
  });

  test('citation_audit flags unknown ids and uncited claims', () {
    final result =
        jsonDecode(
              const MobileCitationAuditTool().run({
                'answer':
                    'Current market data shows costs decreased materially. '
                    'This claim cites an unknown source [S9].',
                'citations': [
                  {'id': 'S1', 'confidence': 'medium'},
                ],
              }),
            )
            as Map<String, Object?>;

    expect(result['verdict'], 'revise');
    expect(result['unknownCitationIds'], contains('S9'));
    expect(result['issues'].toString(), contains('possible_uncited_claims'));
    expect(result['requiredFixes'].toString(), contains('S9'));
  });
}

Future<void> _waitFor(bool Function() condition) async {
  for (var i = 0; i < 30; i++) {
    if (condition()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

List<String> _toolNames(MobileChatHttpRequest request) {
  final tools = request.body['tools'] as List<Object?>;
  return tools
      .map((tool) {
        final schema = tool as Map<String, Object?>;
        final function = schema['function'] as Map<String, Object?>;
        return function['name'].toString();
      })
      .toList(growable: false);
}

class _FakeModelService extends MobileProviderModelService {
  var fetchCount = 0;

  @override
  Future<MobileModelListResult> fetchModels({
    required MobileProviderConfig config,
    required String apiKey,
  }) async {
    fetchCount++;
    final request = buildRequest(config, apiKey);
    return MobileModelListResult(
      provider: config.provider,
      models: const ['zen-a', 'zen-b'],
      request: request,
    );
  }
}
