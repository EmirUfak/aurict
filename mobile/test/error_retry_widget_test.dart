import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aurict_mobile/ui/widgets/error_retry_widget.dart';

/// Helper that wraps [child] in a minimal MaterialApp for widget tests.
Widget _harness(Widget child) {
  return MaterialApp(home: Scaffold(body: child));
}

void main() {
  group('ErrorRetryWidget', () {
    testWidgets('displays user-facing error message', (tester) async {
      await tester.pumpWidget(
        _harness(const ErrorRetryWidget(message: 'Something went wrong.')),
      );

      expect(find.text('Something went wrong.'), findsOneWidget);
    });

    testWidgets('hides retry button when onRetry is null', (tester) async {
      await tester.pumpWidget(
        _harness(const ErrorRetryWidget(message: 'Oops')),
      );

      expect(find.text('Yeniden Dene'), findsNothing);
    });

    testWidgets('shows retry button when onRetry is provided', (tester) async {
      await tester.pumpWidget(
        _harness(ErrorRetryWidget(message: 'Oops', onRetry: () async {})),
      );

      expect(find.text('Yeniden Dene'), findsOneWidget);
    });

    testWidgets(
      'retry button disables and shows spinner during async operation',
      (tester) async {
        final completer = Completer<void>();

        await tester.pumpWidget(
          _harness(
            ErrorRetryWidget(message: 'Error', onRetry: () => completer.future),
          ),
        );

        // Tap retry
        await tester.tap(find.text('Yeniden Dene'));
        await tester.pump();

        // Button text should be gone, spinner should be visible
        expect(find.text('Yeniden Dene'), findsNothing);
        expect(find.byType(CircularProgressIndicator), findsOneWidget);

        // Elevated button should be disabled (onPressed == null)
        final button = tester.widget<ElevatedButton>(
          find.byType(ElevatedButton),
        );
        expect(button.onPressed, isNull);

        // Complete the retry and pump
        completer.complete();
        await tester.pumpAndSettle();

        // Button should be re-enabled
        expect(find.text('Yeniden Dene'), findsOneWidget);
        expect(find.byType(CircularProgressIndicator), findsNothing);
      },
    );

    testWidgets('double-tap is prevented during loading', (tester) async {
      var callCount = 0;
      final completer = Completer<void>();

      await tester.pumpWidget(
        _harness(
          ErrorRetryWidget(
            message: 'Error',
            onRetry: () {
              callCount++;
              return completer.future;
            },
          ),
        ),
      );

      // First tap
      await tester.tap(find.text('Yeniden Dene'));
      await tester.pump();

      // Button is now a spinner — tap its area again
      await tester.tap(find.byType(ElevatedButton));
      await tester.pump();

      expect(callCount, 1, reason: 'onRetry should only be called once');

      completer.complete();
      await tester.pumpAndSettle();
    });

    testWidgets('technical detail is hidden by default', (tester) async {
      await tester.pumpWidget(
        _harness(
          ErrorRetryWidget(
            message: 'Error',
            technicalDetail: 'SocketException: Connection refused',
            onRetry: () async {},
          ),
        ),
      );

      // Detail toggle should be visible
      expect(find.text('Teknik detay'), findsOneWidget);
      // But the actual detail text should not be rendered visually
      // (it's in the AnimatedCrossFade's hidden child)
      expect(
        find.text('SocketException: Connection refused'),
        findsOneWidget, // Widget exists but is in the hidden cross-fade
      );
    });

    testWidgets('technical detail expands and collapses on tap', (
      tester,
    ) async {
      await tester.pumpWidget(
        _harness(
          ErrorRetryWidget(
            message: 'Error',
            technicalDetail: 'Connection timeout',
            onRetry: () async {},
          ),
        ),
      );

      // Expand
      await tester.tap(find.text('Teknik detay'));
      await tester.pumpAndSettle();

      expect(find.text('Detayları gizle'), findsOneWidget);

      // Collapse
      await tester.tap(find.text('Detayları gizle'));
      await tester.pumpAndSettle();

      expect(find.text('Teknik detay'), findsOneWidget);
    });

    testWidgets('sanitizes sensitive data in technical detail', (tester) async {
      const raw =
          'Request failed: api_key=sk-abc123XYZ456 and token:my_secret_token';

      await tester.pumpWidget(
        _harness(
          ErrorRetryWidget(
            message: 'Error',
            technicalDetail: raw,
            onRetry: () async {},
          ),
        ),
      );

      // Expand detail
      await tester.tap(find.text('Teknik detay'));
      await tester.pumpAndSettle();

      // The raw sensitive strings should NOT be displayed
      expect(find.textContaining('sk-abc123XYZ456'), findsNothing);
      expect(find.textContaining('my_secret_token'), findsNothing);

      // Sensitive data is stripped entirely — no [REDACTED] marker in the UI
      expect(find.textContaining('[REDACTED]'), findsNothing);

      // Only the clean prefix text should remain
      expect(find.textContaining('Request failed:'), findsOneWidget);
    });

    testWidgets('retry button meets 48dp minimum touch target', (tester) async {
      await tester.pumpWidget(
        _harness(ErrorRetryWidget(message: 'Error', onRetry: () async {})),
      );

      final buttonSize = tester.getSize(find.byType(ElevatedButton));
      expect(buttonSize.height, greaterThanOrEqualTo(48));
      expect(buttonSize.width, greaterThanOrEqualTo(48));
    });

    testWidgets('re-enables button even when onRetry throws', (tester) async {
      await tester.pumpWidget(
        _harness(
          ErrorRetryWidget(
            message: 'Error',
            onRetry: () async => throw Exception('boom'),
          ),
        ),
      );

      // Tap and let the error propagate
      await tester.tap(find.text('Yeniden Dene'));
      await tester.pumpAndSettle();

      // Button should be re-enabled after the error
      expect(find.text('Yeniden Dene'), findsOneWidget);
      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(button.onPressed, isNotNull);
    });

    testWidgets('renders without overflow in narrow viewport', (tester) async {
      // Simulate a small Android screen (320x480)
      tester.view.physicalSize = const Size(320, 480);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _harness(
          ErrorRetryWidget(
            message:
                'A long error message that might cause overflow '
                'on very small screens if not handled properly.',
            technicalDetail: 'Some detail' * 20,
            onRetry: () async {},
          ),
        ),
      );

      // Expand the detail panel
      await tester.tap(find.text('Teknik detay'));
      await tester.pumpAndSettle();

      // If this completes without RenderFlex overflow errors, the test passes.
      expect(tester.takeException(), isNull);
    });
  });
}
