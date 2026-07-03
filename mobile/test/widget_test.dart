import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aurict_mobile/agent/mobile_markdown_renderer.dart';
import 'package:aurict_mobile/agent/mobile_chat_stream.dart';
import 'package:aurict_mobile/agent/mobile_provider_session.dart';
import 'package:aurict_mobile/main.dart';

void main() {
  test('mobile markdown parser recognizes common LLM markdown blocks', () {
    final blocks = const MobileMarkdownParser().parse('''
# Title

Intro with **bold** and `code`.

- one
- two

| Name | Value |
| --- | --- |
| A | 1 |

```dart
final ok = true;
```
''');

    expect(
      blocks.map((block) => block.type),
      containsAll([
        MobileMarkdownBlockType.heading,
        MobileMarkdownBlockType.paragraph,
        MobileMarkdownBlockType.unorderedList,
        MobileMarkdownBlockType.table,
        MobileMarkdownBlockType.code,
      ]),
    );
  });

  testWidgets(
    'mobile markdown renderer displays headings lists code and tables',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MobileMarkdownRenderer(
              content: '''
## Summary

- first item
- second item

| Tool | Status |
| --- | --- |
| web_fetch | ready |

```ts
const value = 1
```
''',
              textColor: Colors.white,
              mutedColor: Colors.grey,
              borderColor: Colors.grey,
              surfaceColor: Colors.black,
              accentColor: Colors.blue,
              codeColor: Colors.green,
            ),
          ),
        ),
      );

      expect(find.text('Summary'), findsOneWidget);
      expect(find.text('first item'), findsOneWidget);
      expect(find.text('web_fetch'), findsOneWidget);
      expect(find.text('const value = 1'), findsOneWidget);
    },
  );

  testWidgets('stream tool card renders result summaries and failures', (
    tester,
  ) async {
    await tester.pumpWidget(
      TokensScope(
        tokens: aurictThemes.first,
        themeIndex: 0,
        onThemeChanged: (_) {},
        child: const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                StreamToolCard(
                  tool: MobileToolStreamBlock(
                    id: 'tool-1',
                    name: 'document_export',
                    arguments: '{"format":"pdf"}',
                    pending: false,
                    result:
                        '{"ok":true,"tool":"html_to_pdf","artifactId":"a1","artifactName":"report.pdf","mimeType":"application/pdf","sizeBytes":1200,"policy":{"note":"local only"}}',
                  ),
                ),
                StreamToolCard(
                  tool: MobileToolStreamBlock(
                    id: 'tool-2',
                    name: 'ocr_read',
                    pending: false,
                    result:
                        '{"ok":false,"tool":"ocr_read","error":"requires recognized_text","policy":{"note":"local only"}}',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(
      find.textContaining('PDF artifact rendered: report.pdf'),
      findsOneWidget,
    );
    expect(
      find.textContaining('Error: requires recognized_text'),
      findsOneWidget,
    );
    expect(find.text('failed'), findsOneWidget);
  });

  testWidgets('assistant bubble keeps generated file card at message end', (
    tester,
  ) async {
    await tester.pumpWidget(
      TokensScope(
        tokens: aurictThemes.first,
        themeIndex: 0,
        onThemeChanged: (_) {},
        child: const MaterialApp(
          home: Scaffold(
            body: AssistantBubble(
              text: 'Report is ready.',
              artifacts: [
                ChatArtifact(
                  id: 'a1',
                  name: 'report.pdf',
                  mimeType: 'application/pdf',
                  sizeBytes: 2048,
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.text('Generated files'), findsOneWidget);
    expect(find.text('report.pdf'), findsOneWidget);
    expect(find.text('Save to phone'), findsOneWidget);
    expect(find.text('Share'), findsOneWidget);
  });

  testWidgets('assistant bubble opens report sheet from report action', (
    tester,
  ) async {
    await tester.pumpWidget(
      TokensScope(
        tokens: aurictThemes.first,
        themeIndex: 0,
        onThemeChanged: (_) {},
        child: MaterialApp(
          home: Scaffold(
            body: AssistantBubble(
              text: 'This answer can be reported.',
              onReport: () => showAurictSheet(
                tester.element(find.byType(AssistantBubble)),
                ReportAnswerSheet(onSubmit: (_, _) async {}),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.bySemanticsLabel('Report answer'));
    await tester.pumpAndSettle();

    expect(find.text('Report answer'), findsOneWidget);
    expect(find.text('Incorrect answer'), findsOneWidget);
    expect(find.text('Send report'), findsOneWidget);
  });

  testWidgets('artifact save button delegates to ui export handler', (
    tester,
  ) async {
    ChatArtifact? handledArtifact;
    ArtifactAction? handledAction;

    await tester.pumpWidget(
      TokensScope(
        tokens: aurictThemes.first,
        themeIndex: 0,
        onThemeChanged: (_) {},
        child: MaterialApp(
          home: Scaffold(
            body: AssistantBubble(
              text: 'Report is ready.',
              artifacts: const [
                ChatArtifact(
                  id: 'a1',
                  name: 'report.pdf',
                  mimeType: 'application/pdf',
                  sizeBytes: 2048,
                ),
              ],
              onArtifactAction: (artifact, action) async {
                handledArtifact = artifact;
                handledAction = action;
              },
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Save to phone'));
    await tester.pump();

    expect(handledArtifact?.id, 'a1');
    expect(handledAction, ArtifactAction.save);
  });

  testWidgets('Aurict mobile shell renders primary surfaces', (tester) async {
    await tester.pumpWidget(const AurictMobileApp());

    expect(find.text('Your AI agent, wherever your work is.'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enter Aurict'));
    await tester.pumpAndSettle();

    expect(find.text('Aurict Chat'), findsOneWidget);
    expect(find.text('Chat'), findsWidgets);
    expect(find.text('Remote'), findsWidgets);
    expect(find.text('Local planner'), findsOneWidget);

    await tester.tap(find.text('Remote').last);
    await tester.pumpAndSettle();

    expect(find.text('Remote Control'), findsOneWidget);
    expect(find.text('Run /remote in Aurict CLI.'), findsNothing);
  });

  testWidgets('Android compact layout avoids overflow in primary flows', (
    tester,
  ) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      debugDefaultTargetPlatformOverride = null;
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const AurictMobileApp());
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Enter Aurict'));
    await tester.pumpAndSettle();
    expect(find.text('Aurict Chat'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Remote').last);
    await tester.pumpAndSettle();
    expect(find.text('Remote Control'), findsOneWidget);
    expect(tester.takeException(), isNull);

    debugDefaultTargetPlatformOverride = null;
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('new chat hero disappears after first message', (tester) async {
    await tester.pumpWidget(const AurictMobileApp());

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enter Aurict'));
    await tester.pumpAndSettle();

    expect(find.text('Today workspace'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Create a release plan');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();

    expect(find.text('Today workspace'), findsNothing);
    expect(find.text('Create a release plan'), findsOneWidget);
  });

  testWidgets('research pdf task activates mobile skill ledger', (
    tester,
  ) async {
    await tester.pumpWidget(const AurictMobileApp());

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enter Aurict'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextField),
      'Research private AI search and create a PDF report',
    );
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();

    expect(find.text('Task ledger · auto-continue'), findsOneWidget);
    expect(find.text('skill:research'), findsOneWidget);
    expect(find.text('skill:pdf'), findsOneWidget);
    expect(find.text('PDF export gate'), findsOneWidget);
    expect(find.textContaining('Wikimedia'), findsWidgets);
    expect(find.textContaining('aurict-research-report.pdf'), findsWidgets);
    expect(find.text('implementation_plan.md'), findsNothing);
  });

  testWidgets('temporary provider key can be entered from keys screen', (
    tester,
  ) async {
    await tester.pumpWidget(
      TokensScope(
        tokens: aurictThemes.first,
        themeIndex: 0,
        onThemeChanged: (_) {},
        child: MobileProviderSessionScope(
          session: MobileProviderSession(),
          child: const MaterialApp(home: Scaffold(body: KeysScreen())),
        ),
      ),
    );

    await tester.drag(find.byType(ListView), const Offset(0, -320));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OpenCode'));
    await tester.pumpAndSettle();
    expect(find.text('Paste API key'), findsOneWidget);

    await tester.enterText(find.byType(TextField).last, 'sk-test-temp');
    await tester.tap(find.text('Save securely'));
    await tester.pumpAndSettle();

    expect(find.text('Secure key'), findsOneWidget);
    expect(find.text('OpenCode'), findsOneWidget);
  });
}
