enum MobileSkillCompatibility { native, limited, unsupported }

class MobileCliSkillManifest {
  const MobileCliSkillManifest({
    required this.id,
    required this.description,
    required this.allowedTools,
  });

  final String id;
  final String description;
  final List<String> allowedTools;
}

class MobileCliSkillImportPlan {
  const MobileCliSkillImportPlan({
    required this.manifest,
    required this.compatibility,
    required this.reason,
  });

  final MobileCliSkillManifest manifest;
  final MobileSkillCompatibility compatibility;
  final String reason;
}

class MobileCliSkillImporter {
  const MobileCliSkillImporter();

  List<MobileCliSkillImportPlan> plan(List<MobileCliSkillManifest> manifests) {
    return manifests.map(_planOne).toList(growable: false);
  }

  MobileCliSkillImportPlan _planOne(MobileCliSkillManifest manifest) {
    final tools = manifest.allowedTools
        .map((tool) => tool.toLowerCase())
        .toSet();
    if (tools.any(_isDesktopOnlyTool)) {
      return MobileCliSkillImportPlan(
        manifest: manifest,
        compatibility: MobileSkillCompatibility.unsupported,
        reason:
            'Uses desktop-only tools such as shell, patch, or local repo writes.',
      );
    }
    if (tools.any(_isMobileLimitedTool)) {
      return MobileCliSkillImportPlan(
        manifest: manifest,
        compatibility: MobileSkillCompatibility.limited,
        reason:
            'Can run on mobile with permission prompts or reduced export fidelity.',
      );
    }
    return MobileCliSkillImportPlan(
      manifest: manifest,
      compatibility: MobileSkillCompatibility.native,
      reason:
          'Uses mobile-native chat, research, fetch, document, or artifact tools.',
    );
  }

  bool _isDesktopOnlyTool(String tool) {
    return {
      'bash',
      'shell',
      'apply_patch',
      'edit',
      'write',
      'git',
      'subagent',
      'security_scan',
    }.contains(tool);
  }

  bool _isMobileLimitedTool(String tool) {
    return {
      'pdf_export',
      'deck_export',
      'file_write',
      'imagegen',
      'web_search',
      'web_fetch',
    }.contains(tool);
  }
}
