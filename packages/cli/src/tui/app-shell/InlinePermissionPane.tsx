import React from "react";
import type { PermissionRequest } from "@aurict/core";
import { Box, Text } from "../design-system/renderer.js";
import { PermissionPrompt } from "../PermissionPrompt.js";
import type { PermissionPromptDecision } from "../PermissionPrompt.js";
import { useTerminalSize } from "../TerminalSizeContext.js";
import { useTheme } from "../../utils/theme.js";
import { shellHorizontalInset } from "./layout-metrics.js";

interface Props {
  request: PermissionRequest;
  onDecide: (decision: PermissionPromptDecision) => void;
  queueLength: number;
}

/** Keeps permission decisions in the conversation flow, directly above the composer. */
export function InlinePermissionPane({ request, onDecide, queueLength }: Props) {
  const theme = useTheme();
  const { columns } = useTerminalSize();
  const inset = shellHorizontalInset(columns);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <PermissionPrompt request={request} onDecide={onDecide} />
      {queueLength > 1 && (
        <Box paddingLeft={inset + 2}>
          <Text color={theme.textDim}>
            1 of {queueLength} requests · {queueLength - 1} queued
          </Text>
        </Box>
      )}
    </Box>
  );
}
