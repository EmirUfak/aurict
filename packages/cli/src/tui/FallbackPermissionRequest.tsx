import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "./design-system/renderer.js";
import { useTheme } from "../utils/theme.js";
import type { PermissionRequest } from "@aurict/core";
import { Select, type SelectOption } from "./Select.js";
import type { PermissionPromptDecision } from "./PermissionPrompt.js";
import type { PermissionDecision } from "@aurict/core";
import { PermissionScaffold } from "./PermissionScaffold.js";
import { PermissionCommandPreview } from "./PermissionCommandPreview.js";
import { glyph } from "./terminal-glyphs.js";

type Decision = PermissionDecision | "deny_abort" | "edit";

interface Props {
  request: PermissionRequest;
  onDecide: (d: PermissionPromptDecision) => void;
}

function toolLabel(tool: string): string {
  const map: Record<string, string> = {
    write: "File write",
    edit: "File edit",
    read: "File read",
    apply_patch: "Patch apply",
    glob: "Path search",
    grep: "Content search",
    webfetch: "HTTP request",
    websearch: "Web search",
    subagent: "Spawn subagent",
    todo: "Task update",
  };
  return map[tool] ?? `Tool use: ${tool}`;
}

export function FallbackPermissionRequest({ request, onDecide }: Props) {
  const theme = useTheme();
  const isDanger = request.level === "danger";
  const isWarning = request.level === "warning";
  const accentColor = isDanger
    ? theme.error
    : isWarning
      ? theme.warning
      : theme.accent;
  const supportsDir =
    request.tool === "write" ||
    request.tool === "edit" ||
    request.tool === "apply_patch";

  const options: SelectOption<Decision>[] = isDanger
    ? [
        {
          id: "allow_once",
          label: "Allow once",
          hint: "allow this time (risky)",
          color: theme.warning,
        },
        {
          id: "deny",
          label: "Deny",
          hint: "safest, AI receives error",
          color: theme.success,
        },
        {
          id: "deny_abort",
          label: "Deny & stop agent",
          hint: "reject and abort",
          color: theme.error,
        },
      ]
    : [
        { id: "allow_once", label: "Allow once", hint: "just this time" },
        ...(supportsDir
          ? [
              {
                id: "allow_directory" as Decision,
                label: "Allow directory",
                hint: "save this folder rule",
              },
            ]
          : []),
        {
          id: "allow",
          label: "Always allow",
          hint: "save this exact rule",
        },
        {
          id: "deny",
          label: "Deny",
          hint: "reject, AI continues with error",
          color: theme.error,
        },
      ];

  const [selectIdx, setSelectIdx] = useState(isDanger ? 1 : 0);
  const [showPattern, setShowPattern] = useState(false);

  useInput((input, key) => {
    if (!showPattern && input === "d" && !key.ctrl && !key.meta)
      setShowPattern(true);
  });

  const handleSelect = useCallback(
    (opt: SelectOption<Decision>) => {
      onDecide(opt.id);
    },
    [onDecide],
  );

  const subtitle = isDanger
    ? "destructive operation"
    : isWarning
      ? "elevated privileges"
      : undefined;
  const blast = isDanger
    ? "high"
    : isWarning
      ? "medium"
      : supportsDir
        ? "scoped"
        : "low";
  const explanation = request.reason ?? request.permissionSummary ?? request.summary;
  const header = (
    <Box flexDirection="column">
      <Text color={theme.textDim}>
        scope <Text color={accentColor} bold>{blast}</Text>
        {request.diff
          ? ` ${glyph("statusTiny")} +${request.diff.added} -${request.diff.removed} ${glyph("statusTiny")} ${request.diff.fileCount} file${request.diff.fileCount === 1 ? "" : "s"}`
          : ""}
      </Text>
      <PermissionCommandPreview
        command={request.pattern}
        open={showPattern}
        onOpenChange={setShowPattern}
      />
      {explanation && (
        <Text color={isDanger || isWarning ? accentColor : theme.textDim} wrap="truncate-end">
          {glyph("statusTiny")} {explanation}
        </Text>
      )}
    </Box>
  );

  return (
    <PermissionScaffold
      title={toolLabel(request.tool)}
      subtitle={subtitle}
      color={accentColor}
      header={header}
    >
      <Select
        options={options}
        selectedIndex={selectIdx}
        onChange={setSelectIdx}
        onSelect={handleSelect}
        onCancel={() => onDecide("deny")}
        isActive={!showPattern}
        compact
      />
      <Box>
        <Text color={theme.textDim} dimColor>
          {showPattern
            ? "d/Esc details  ↑↓ scroll"
            : "y allow once  n deny  ←→ select  Enter confirm  d inspect"}
        </Text>
      </Box>
    </PermissionScaffold>
  );
}
