import React, { useEffect, useMemo, useRef } from "react";
import { Box, Text } from "ink";
import type { DisplayMessage } from "./Message.js";
import { useTheme } from "../utils/theme.js";
import { buildTranscriptLines } from "./conversation/line-buffer.js";

export interface ConversationViewportProps {
  height: number;
  width: number;
  messages: DisplayMessage[];
  loading: boolean;
  activeTool?: string;
  streamingText: string | null;
  streamingReason: string | null;
  streamingError: string | null;
  scrollLocked: boolean;
  offsetRowsFromBottom: number;
  unseenCount?: number;
  onScrollRange?: (maxOffset: number) => void;
  onAnchorShift?: (deltaRows: number) => void;
  onExpandTool: (content: string, toolName: string) => void;
  onExpandThinking: (content: string) => void;
}

export function ConversationViewport(props: ConversationViewportProps) {
  const theme = useTheme();
  const lines = useMemo(
    () =>
      buildTranscriptLines(
        props.messages,
        props.width,
        props.streamingText,
        props.streamingReason,
        props.streamingError,
      ),
    [
      props.messages,
      props.width,
      props.streamingText,
      props.streamingReason,
      props.streamingError,
    ],
  );
  const reserveUnseen =
    (props.unseenCount ?? 0) > 0 && props.offsetRowsFromBottom > 0;
  const viewportRows = Math.max(1, props.height - (reserveUnseen ? 1 : 0));
  const maxOffset = Math.max(0, lines.length - viewportRows);
  const offset = Math.min(props.offsetRowsFromBottom, maxOffset);
  const start = maxOffset - offset;
  const previousLineCount = useRef(lines.length);

  useEffect(() => {
    props.onScrollRange?.(maxOffset);
  }, [maxOffset, props.onScrollRange]);
  useEffect(() => {
    const delta = lines.length - previousLineCount.current;
    previousLineCount.current = lines.length;
    if (delta > 0 && props.offsetRowsFromBottom > 0)
      props.onAnchorShift?.(delta);
  }, [lines.length, props.offsetRowsFromBottom, props.onAnchorShift]);

  const colorFor = (tone: string): string => {
    if (tone === "user") return theme.accent;
    if (tone === "tool") return theme.warning;
    if (tone === "error") return theme.error;
    if (tone === "heading") return theme.textPrimary;
    if (tone === "code") return theme.accentAlt;
    if (tone === "quote") return theme.textDim;
    if (tone === "thinking") return theme.accent;
    return tone === "muted" ? theme.textDim : theme.textSecondary;
  };
  const isWaitingForFirstOutput =
    props.loading &&
    !props.streamingText &&
    !props.streamingReason &&
    !props.streamingError;

  return (
    <Box
      height={props.height}
      flexDirection="column"
      overflow="hidden"
      {...(theme.bgDeep !== undefined ? { backgroundColor: theme.bgDeep } : {})}
    >
      {reserveUnseen && (
        <Text color={theme.accent} bold>⋯ {props.unseenCount} new messages below</Text>
      )}
      {isWaitingForFirstOutput && (
        <Text color={theme.accent} dimColor italic wrap="truncate-end">
          ◌ {props.activeTool ? `${props.activeTool} is working…` : "Aurict is preparing a response…"}
        </Text>
      )}
      {lines.slice(start, start + viewportRows).map((line) => (
        <Text
          key={line.id}
          color={colorFor(line.tone)}
          wrap="truncate-end"
          {...(line.bold ? { bold: true } : {})}
          {...(line.italic ? { italic: true } : {})}
        >
          {line.text || " "}
        </Text>
      ))}
    </Box>
  );
}
