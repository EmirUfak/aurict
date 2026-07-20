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

function sandboxLine(request: PermissionRequest): string | null {
  if (!request.sandbox) return null;
  const { backend, reason } = request.sandbox;
  if (backend === "policy")
    return reason ? `sandboxed · ${reason}` : "sandboxed";
  if (backend === "docker") return "docker sandbox";
  return reason ?? null;
}

export function BashPermissionRequest({ request, onDecide }: Props) {
  const theme = useTheme();
  const isDanger = request.level === "danger";
  const isWarning = request.level === "warning";
  const accentColor = isDanger
    ? theme.error
    : isWarning
      ? theme.warning
      : theme.accent;

  const options: SelectOption<Decision>[] = isDanger
    ? [
        {
          id: "allow_once",
          label: "Allow once",
          hint: "allow this time (risky)",
          color: theme.warning,
        },
        {
          id: "edit",
          label: "Edit command",
          hint: "move command to input",
          color: theme.accent,
        },
        {
          id: "deny",
          label: "Deny",
          hint: "safest default, AI receives error",
          color: theme.success,
        },
        {
          id: "deny_abort",
          label: "Deny & stop agent",
          hint: "reject and abort execution",
          color: theme.error,
        },
      ]
    : [
        {
          id: "allow_once",
          label: "Allow once",
          hint: "just this time, don't remember",
        },
        {
          id: "allow",
          label: "Always allow",
          hint: "save this exact command rule",
        },
        {
          id: "deny",
          label: "Deny",
          hint: "reject, AI continues with error",
          color: theme.error,
        },
      ];

  const [selectIdx, setSelectIdx] = useState(isDanger ? 2 : 0);
  const [showCommand, setShowCommand] = useState(false);

  useInput((input, key) => {
    if (!showCommand && input === "d" && !key.ctrl && !key.meta)
      setShowCommand(true);
  });

  const handleSelect = useCallback(
    (opt: SelectOption<Decision>) => {
      onDecide(opt.id === "edit" ? "edit" : opt.id);
    },
    [onDecide],
  );

  const sandbox = sandboxLine(request);
  const title =
    request.sandbox?.backend === "none"
      ? "Bash command (unsandboxed)"
      : "Bash command";
  const subtitle = isDanger
    ? "destructive operation"
    : isWarning
      ? "review required"
      : undefined;
  const blast = isDanger ? "high" : isWarning ? "medium" : "low";
  const bareBackends = request.sandbox?.backend === "none";

  const shield = bareBackends
    ? "unsandboxed"
    : request.sandbox?.backend === "docker"
      ? "docker shield"
      : "policy shield";
  const executables = request.command?.executables?.filter(Boolean).join(", ");
  const explanation = request.reason ?? request.permissionSummary ?? request.summary;
  const header = (
    <Box flexDirection="column">
      <Text color={theme.textDim} wrap="truncate-end">
        scope <Text color={accentColor} bold>{blast}</Text>
        {` ${glyph("statusTiny")} `}
        <Text color={bareBackends ? theme.warning : theme.accentAlt}>{shield}</Text>
        {executables ? ` ${glyph("statusTiny")} exec ${executables}` : ""}
      </Text>
      <PermissionCommandPreview
        command={request.pattern}
        open={showCommand}
        onOpenChange={setShowCommand}
      />
      {explanation && explanation !== sandbox && (
        <Text color={isDanger || isWarning ? accentColor : theme.textDim} wrap="truncate-end">
          {glyph("statusTiny")} {explanation}
        </Text>
      )}
    </Box>
  );

  return (
    <PermissionScaffold
      title={title}
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
        isActive={!showCommand}
        compact
      />
      <Box>
        <Text color={theme.textDim} dimColor>
          {showCommand
            ? "d/Esc close  ↑↓ scroll"
            : "y allow once  n deny  e edit  ←→ choose  Enter confirm  d inspect"}
        </Text>
      </Box>
    </PermissionScaffold>
  );
}
