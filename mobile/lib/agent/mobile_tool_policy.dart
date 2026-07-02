import 'mobile_agent_runtime.dart';

class MobileToolPolicy {
  const MobileToolPolicy({
    this.networkEnabled = true,
    this.fileReadEnabled = true,
    this.fileWriteEnabled = true,
    this.pdfExportEnabled = true,
    this.slideExportEnabled = true,
  });

  final bool networkEnabled;
  final bool fileReadEnabled;
  final bool fileWriteEnabled;
  final bool pdfExportEnabled;
  final bool slideExportEnabled;

  static const allowAll = MobileToolPolicy();

  List<MobileToolPermission> deniedFor(List<MobileSkillDef> skills) {
    final denied = <MobileToolPermission>{};
    for (final skill in skills) {
      for (final permission in skill.permissions) {
        if (!_allows(permission)) denied.add(permission);
      }
    }
    return denied.toList(growable: false);
  }

  bool allowsAll(List<MobileSkillDef> skills) => deniedFor(skills).isEmpty;

  bool _allows(MobileToolPermission permission) {
    return switch (permission) {
      MobileToolPermission.network => networkEnabled,
      MobileToolPermission.fileRead => fileReadEnabled,
      MobileToolPermission.fileWrite => fileWriteEnabled,
      MobileToolPermission.exportPdf => pdfExportEnabled,
      MobileToolPermission.exportSlides => slideExportEnabled,
    };
  }
}
