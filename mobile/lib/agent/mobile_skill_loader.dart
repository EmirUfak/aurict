import 'mobile_agent_runtime.dart';
import 'mobile_skill_catalog.dart';

enum MobileSkillContext { inline, fork }

class MobileLoadedSkill {
  const MobileLoadedSkill({
    required this.skillId,
    required this.name,
    required this.instructions,
    required this.allowedTools,
    required this.context,
    required this.autoContinue,
    required this.policy,
  });

  final String skillId;
  final String name;
  final String instructions;
  final List<String> allowedTools;
  final MobileSkillContext context;
  final bool autoContinue;
  final MobileSkillPolicy policy;
}

class MobileSkillLoader {
  const MobileSkillLoader();

  String buildDiscoveryPrompt(List<MobileSkillDef> skills) {
    return skills
        .map(
          (skill) =>
              '${skill.id}: ${skill.description} tools=${skill.tools.join(",")}',
        )
        .join('\n');
  }

  MobileLoadedSkill load(MobileSkillDef skill) {
    final entry = const MobileSkillCatalog().get(skill.id);
    if (entry == null) {
      throw ArgumentError.value(skill.id, 'skill.id', 'Unknown mobile skill');
    }
    return MobileLoadedSkill(
      skillId: skill.id,
      name: skill.name,
      instructions: entry.instructions,
      allowedTools: skill.tools,
      context: entry.context,
      autoContinue: skill.autoContinue,
      policy: entry.policy,
    );
  }

  MobileLoadedSkill? loadByQuery(String query) {
    final entry = const MobileSkillCatalog().findBest(query);
    if (entry == null) return null;
    return load(entry.def);
  }

  String formatLoadedSkill(MobileLoadedSkill skill) {
    final lines = [
      '# Skill Loaded: ${skill.name}',
      'Skill ID: ${skill.skillId}',
      'Context: ${skill.context.name}',
      'Allowed mobile tools: ${skill.allowedTools.join(", ")}',
      'Auto-continue: ${skill.autoContinue}',
      if (skill.policy.caveat.isNotEmpty) 'Caveat: ${skill.policy.caveat}',
      'Output format: ${skill.policy.outputFormat}',
      if (skill.policy.checklist.isNotEmpty)
        'Checklist: ${skill.policy.checklist.join("; ")}',
      if (skill.policy.requiredPhases.isNotEmpty)
        'Required phases: ${skill.policy.requiredPhases.join(" -> ")}',
      'Verifier required: ${skill.policy.requiredVerifier}',
      if (skill.policy.artifactGates.isNotEmpty)
        'Artifact gates: ${skill.policy.artifactGates.join(" -> ")}',
      'Max mobile tool steps: ${skill.policy.maxToolSteps}',
      '',
      skill.instructions,
      '',
      'Use this skill for the current answer. Do not call the same skill repeatedly unless the user changes the task.',
    ];
    return lines.join('\n');
  }
}
