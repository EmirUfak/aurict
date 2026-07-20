import React, { useState } from "react";
import { Box, Text } from "./design-system/renderer.js";
import { useTheme } from "../utils/theme.js";
import { glyph } from "./terminal-glyphs.js";
import { AurictWordmark } from "./AurictWordmark.js";
import { useSemanticTheme } from "./theme/semantic-theme.js";
import { selectStartupQuip } from "./startup-quips.js";

interface Props {
  version: string;
  provider: string;
  model: string;
  workdir: string;
  cols?: number;
  rows?: number;
  quip?: string;
}

function shortenMiddle(value: string, max: number): string {
  if (value.length <= max) return value;
  const separator = glyph("ellipsis");
  const side = Math.max(3, Math.floor((max - separator.length) / 2));
  return `${value.slice(0, side)}${separator}${value.slice(-side)}`;
}

export function StartupBanner({ version, provider, model, workdir, cols = 120, rows = 30, quip }: Props) {
  const theme = useTheme();
  const semantic = useSemanticTheme();
  const tinyHeight = rows < 18;
  const spacious = cols >= 76 && rows >= 24;
  const cwd = workdir.replace(process.env["HOME"] ?? "", "~");
  const [startupQuip] = useState(() => quip ?? selectStartupQuip());

  if (tinyHeight) {
    return (
      <Box flexDirection="column" alignItems="center" width="100%">
        <Text color={theme.accent} bold>AURICT {version}</Text>
        <Text color={theme.textDim}>{provider}/{shortenMiddle(model, Math.max(16, cols - provider.length - 5))} {glyph("statusTiny")} /help</Text>
      </Box>
    );
  }

  if (!spacious) {
    return (
      <Box flexDirection="column" alignItems="center" width="100%" paddingTop={1}>
        <Text color={theme.accent} bold>A U R I C T</Text>
        <Text color={theme.textDim}>agentic coding terminal</Text>
        <Text color={theme.textSecondary}>{provider}/{shortenMiddle(model, 28)} {glyph("statusTiny")} {shortenMiddle(cwd, 28)}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" alignItems="center" width="100%" paddingTop={rows >= 32 ? 1 : 0}>
      <AurictWordmark />
      <Text color={theme.textDim}>AURICT {glyph("statusTiny")} AGENTIC ENGINEERING SYSTEM {glyph("statusTiny")} {version}</Text>
      <Text color={theme.textSecondary} italic>{glyph("quote")} {shortenMiddle(startupQuip, Math.max(28, cols - 12))}</Text>
      <Text color={theme.textSecondary}>{provider}/<Text color={theme.accentAlt}>{shortenMiddle(model, 36)}</Text><Text color={theme.borderDim}> {glyph("statusTiny")} </Text>{shortenMiddle(cwd, Math.max(28, Math.min(52, cols - 28)))}</Text>
      <Text color={theme.textDim}><Text color={semantic.status.info}>/help</Text> commands {glyph("statusTiny")} <Text color={semantic.status.info}>@</Text> files {glyph("statusTiny")} Enter to begin</Text>
    </Box>
  );
}
