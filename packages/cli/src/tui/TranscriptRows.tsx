import React from "react";
import { Text } from "ink";
import type { TranscriptRow, TranscriptTone } from "./conversation/projector.js";
import { useSemanticTheme, type SemanticTheme } from "./theme/semantic-theme.js";

function toneColor(tone: TranscriptTone | undefined, theme: SemanticTheme): string {
  if (tone === "user") return theme.identity.user;
  if (tone === "thinking") return theme.activity.running;
  if (tone === "tool") return theme.tool.default;
  if (tone === "error") return theme.status.error;
  if (tone === "success") return theme.status.success;
  if (tone === "bullet") return theme.markdown.bullet;
  if (tone === "heading") return theme.markdown.heading;
  if (tone === "code") return theme.markdown.code;
  if (tone === "quote") return theme.markdown.quote;
  if (tone === "muted") return theme.foreground.muted;
  return theme.foreground.secondary;
}

export function TranscriptRows({ rows }: { rows: TranscriptRow[] }) {
  const theme = useSemanticTheme();
  return <>
    {rows.map((row) => (
      <Text key={row.id} wrap="truncate-end">
        {row.segments.map((segment, index) => (
          <Text
            key={`${row.id}:${index}`}
            color={toneColor(segment.tone, theme)}
            {...(segment.bold ? { bold: true } : {})}
            {...(segment.italic ? { italic: true } : {})}
            {...(segment.dim ? { dimColor: true } : {})}
          >{segment.text || " "}</Text>
        ))}
      </Text>
    ))}
  </>;
}
