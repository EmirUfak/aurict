import 'package:flutter/material.dart';

import '../../main.dart' show TokensScope;

/// Patterns that indicate sensitive data in technical error details.
///
/// Used by [_sanitizeTechnicalDetail] to redact secrets, tokens, API keys,
/// passwords, and other sensitive values before displaying them in the UI.
final _sensitivePatterns = [
  // key=value or key:value pairs for known sensitive keys
  RegExp(
    r'(api[_-]?key|secret|token|password|credential|auth|bearer|session[_-]?id'
    r'|private[_-]?key|access[_-]?key)'
    r'\s*[=:]\s*\S+',
    caseSensitive: false,
  ),
  // Bearer tokens in authorization headers
  RegExp(r'Bearer\s+\S+', caseSensitive: false),
  // Standalone long hex/base64 strings (≥ 20 chars) that look like tokens
  RegExp(r'\b[A-Za-z0-9+/]{20,}={0,2}\b'),
];

/// Strips sensitive substrings from [raw] entirely and collapses blank lines.
///
/// The original (unsanitized) detail is written to the debug log for internal
/// diagnostics only — it is never shown in the UI.
/// Returns the cleaned string, or `null` when [raw] is `null`.
String? _sanitizeTechnicalDetail(String? raw) {
  if (raw == null) return null;
  // Log the raw detail for internal diagnostics before stripping.
  debugPrint('[ErrorRetryWidget] raw technical detail: $raw');
  var result = raw;
  for (final pattern in _sensitivePatterns) {
    result = result.replaceAll(pattern, '');
  }
  // Collapse multiple consecutive blank lines left after stripping.
  result = result.replaceAll(RegExp(r'\n{2,}'), '\n').trim();
  return result;
}

/// A reusable error display widget with an optional retry action.
///
/// Shows a user-facing [message], an optional expandable [technicalDetail]
/// (automatically sanitized for sensitive data), and a retry button that
/// prevents double-tap by disabling itself and showing a loading indicator
/// while the [onRetry] future is in progress.
///
/// ## Accessibility
/// - All interactive and informational elements carry [Semantics] labels.
/// - The retry button meets the 48×48 dp minimum touch target guideline.
///
/// ## Responsive
/// The entire content is wrapped in [SingleChildScrollView] so it never
/// overflows on small Android screens in either orientation.
///
/// ## Usage
/// ```dart
/// ErrorRetryWidget(
///   message: 'Could not load data.',
///   technicalDetail: error.toString(),
///   onRetry: () async => await fetchData(),
/// )
/// ```
class ErrorRetryWidget extends StatefulWidget {
  const ErrorRetryWidget({
    required this.message,
    this.technicalDetail,
    this.onRetry,
    super.key,
  });

  /// Short, user-facing error description.
  final String message;

  /// Optional raw technical detail. Automatically sanitized before display
  /// (secrets, tokens, API keys are redacted).
  final String? technicalDetail;

  /// Called when the user taps Retry. While the returned [Future] is running,
  /// the button is disabled and a loading indicator is shown.
  /// If `null`, the retry button is hidden entirely.
  final Future<void> Function()? onRetry;

  @override
  State<ErrorRetryWidget> createState() => _ErrorRetryWidgetState();
}

class _ErrorRetryWidgetState extends State<ErrorRetryWidget> {
  bool _loading = false;
  bool _detailExpanded = false;

  Future<void> _handleRetry() async {
    if (_loading || widget.onRetry == null) return;
    setState(() => _loading = true);
    try {
      await widget.onRetry!();
    } catch (error) {
      // Surface the error for diagnostics; never silently swallow.
      debugPrint('[ErrorRetryWidget] onRetry threw: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = TokensScope.maybeOf(context)?.tokens;
    final theme = Theme.of(context);

    // Resolve colors — prefer project tokens, fall back to Material theme.
    final dangerColor = tokens?.danger ?? theme.colorScheme.error;
    final mutedColor = tokens?.muted ?? theme.colorScheme.onSurfaceVariant;
    final textColor = tokens?.text ?? theme.colorScheme.onSurface;
    final surfaceColor = tokens?.surface ?? theme.colorScheme.surface;
    final borderColor = tokens?.border ?? theme.colorScheme.outline;

    final sanitizedDetail = _sanitizeTechnicalDetail(widget.technicalDetail);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Error icon ──
              Semantics(
                label: 'Hata simgesi',
                child: Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: dangerColor,
                ),
              ),
              const SizedBox(height: 16),

              // ── User-facing message ──
              Semantics(
                label: widget.message,
                child: Text(
                  widget.message,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: textColor,
                    height: 1.45,
                  ),
                ),
              ),

              // ── Expandable technical detail ──
              if (sanitizedDetail != null && sanitizedDetail.isNotEmpty) ...[
                const SizedBox(height: 12),
                Semantics(
                  button: true,
                  label: _detailExpanded
                      ? 'Teknik detayları gizle'
                      : 'Teknik detayları göster',
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () =>
                        setState(() => _detailExpanded = !_detailExpanded),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 6,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _detailExpanded
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            size: 18,
                            color: mutedColor,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _detailExpanded
                                ? 'Detayları gizle'
                                : 'Teknik detay',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: mutedColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                AnimatedCrossFade(
                  duration: const Duration(milliseconds: 200),
                  crossFadeState: _detailExpanded
                      ? CrossFadeState.showSecond
                      : CrossFadeState.showFirst,
                  firstChild: const SizedBox.shrink(),
                  secondChild: Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: surfaceColor,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: borderColor),
                    ),
                    child: Semantics(
                      label: 'Teknik hata detayı: $sanitizedDetail',
                      child: SelectableText(
                        sanitizedDetail,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: mutedColor,
                          fontFamily: 'IBM Plex Mono',
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ),
                  ),
                ),
              ],

              // ── Retry button ──
              if (widget.onRetry != null) ...[
                const SizedBox(height: 24),
                Semantics(
                  button: true,
                  enabled: !_loading,
                  label: _loading
                      ? 'Yeniden deneniyor, lütfen bekleyin'
                      : 'Yeniden dene',
                  child: SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _handleRetry,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: dangerColor,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: dangerColor.withValues(
                          alpha: 0.4,
                        ),
                        disabledForegroundColor: Colors.white54,
                        minimumSize: const Size(160, 48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white70,
                              ),
                            )
                          : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.refresh_rounded, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'Yeniden Dene',
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
