class MobileFileIntakePolicy {
  const MobileFileIntakePolicy();

  Map<String, Object?> describe({
    required String requestedAction,
    String mimeType = '',
  }) {
    final normalizedMime = mimeType.trim().toLowerCase();
    return {
      'requestedAction': requestedAction.trim().isEmpty
          ? 'read_user_file'
          : requestedAction.trim(),
      'allowedInputs': [
        'user-selected text',
        'user-selected markdown',
        'user-selected PDF as base64',
        'user-selected image with OCR text supplied by the OS/plugin layer',
      ],
      'blockedInputs': [
        'arbitrary filesystem paths',
        'background file scanning',
        'private app data without explicit user action',
      ],
      'mimeType': normalizedMime.isEmpty ? 'unknown' : normalizedMime,
      'needsRuntimePermission':
          normalizedMime.startsWith('image/') ||
          normalizedMime == 'application/pdf',
      'disclosure':
          'Aurict Mobile only processes files the user explicitly selects. Content stays on device unless the user sends it to a chosen model provider.',
    };
  }
}

class MobileOcrReadResult {
  const MobileOcrReadResult({
    required this.name,
    required this.languageHint,
    required this.text,
    required this.summary,
    required this.confidence,
    required this.requiresOcrEngine,
  });

  final String name;
  final String languageHint;
  final String text;
  final String summary;
  final String confidence;
  final bool requiresOcrEngine;

  Map<String, Object?> toJson() => {
    'name': name,
    'languageHint': languageHint,
    'text': text,
    'summary': summary,
    'confidence': confidence,
    'requiresOcrEngine': requiresOcrEngine,
  };
}

class MobileOcrTool {
  const MobileOcrTool();

  MobileOcrReadResult read({
    required String name,
    required String recognizedText,
    String languageHint = '',
  }) {
    final normalized = recognizedText.replaceAll(RegExp(r'\s+'), ' ').trim();
    final limited = normalized.length <= 12000
        ? normalized
        : '${normalized.substring(0, 12000)}...';
    return MobileOcrReadResult(
      name: name.trim().isEmpty ? 'user-image' : name.trim(),
      languageHint: languageHint.trim().isEmpty ? 'auto' : languageHint.trim(),
      text: limited,
      summary: _summary(normalized),
      confidence: normalized.length > 40 ? 'medium' : 'low',
      requiresOcrEngine: normalized.isEmpty,
    );
  }

  static String _summary(String value) {
    if (value.trim().isEmpty) {
      return 'No OCR text was provided by the device OCR layer.';
    }
    return value.length <= 360 ? value : '${value.substring(0, 357)}...';
  }
}
