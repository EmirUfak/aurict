import '../remote/mobile_backend_client.dart';

const aurictMobileAppVersion = '1.0.0+1';

enum MobileFeedbackReportReason {
  incorrect('incorrect', 'Incorrect answer'),
  unsafe('unsafe', 'Unsafe / harmful'),
  hallucination('hallucination', 'Hallucination'),
  formatting('formatting', 'Bad formatting'),
  toolIssue('tool_issue', 'Tool / PDF / research issue'),
  other('other', 'Other');

  const MobileFeedbackReportReason(this.id, this.label);

  final String id;
  final String label;
}

class MobileFeedbackToolSummary {
  const MobileFeedbackToolSummary({required this.name, this.status, this.ok});

  final String name;
  final String? status;
  final bool? ok;

  Map<String, Object?> toJson() => {
    'name': name,
    if (status != null && status!.isNotEmpty) 'status': status,
    if (ok != null) 'ok': ok,
  };
}

class MobileFeedbackReportPayload {
  const MobileFeedbackReportPayload({
    required this.reason,
    required this.assistantMessage,
    this.note,
    this.userMessage,
    this.provider,
    this.model,
    this.appVersion = aurictMobileAppVersion,
    this.toolSummary = const [],
    this.metadata = const {},
  });

  final MobileFeedbackReportReason reason;
  final String assistantMessage;
  final String? note;
  final String? userMessage;
  final String? provider;
  final String? model;
  final String appVersion;
  final List<MobileFeedbackToolSummary> toolSummary;
  final Map<String, Object?> metadata;

  Map<String, Object?> toJson() => {
    'reason': reason.id,
    if (_trim(note).isNotEmpty) 'note': _trim(note),
    if (_trim(userMessage).isNotEmpty) 'userMessage': _trim(userMessage),
    'assistantMessage': _trim(assistantMessage),
    if (_trim(provider).isNotEmpty) 'provider': _trim(provider),
    if (_trim(model).isNotEmpty) 'model': _trim(model),
    'appVersion': appVersion,
    'platform': 'mobile',
    'toolSummary': toolSummary.map((tool) => tool.toJson()).toList(),
    'metadata': metadata,
  };
}

class MobileFeedbackReportResult {
  const MobileFeedbackReportResult({required this.id});

  final String id;
}

class MobileFeedbackReportService {
  const MobileFeedbackReportService({required this.backend});

  final MobileBackendClient backend;

  Future<MobileFeedbackReportResult> submit(
    MobileFeedbackReportPayload payload,
  ) async {
    final response = await backend.postJson(
      '/feedback/reports',
      payload.toJson(),
    );
    final report = response['report'];
    final id = report is Map ? report['id']?.toString() : null;
    return MobileFeedbackReportResult(id: id ?? '');
  }
}

String _trim(String? value) => value?.trim() ?? '';
