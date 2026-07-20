import React from "react";
import { Box } from "ink";
import { ChatInput } from "../ChatInput.js";
import type { ComposerQueueItem } from "../composer-queue.js";
import { useTerminalSize } from "../TerminalSizeContext.js";
import { shellHorizontalInset } from "./layout-metrics.js";

interface Props {
  visible: boolean;
  active?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onQueue: (value: string) => void;
  working: boolean;
  history: string[];
  queue: ComposerQueueItem[];
  inlineSuggestionActive: boolean;
  onInputTruncated: (original: number, truncated: number) => void;
  onCopied: (characters: number) => void;
}

export function ComposerPane({ active = true, ...props }: Props) {
  const columns = useTerminalSize().columns;
  if (!props.visible) return null;
  return (
    <Box flexDirection="row" alignItems="flex-end" paddingX={shellHorizontalInset(columns)}>
      <ChatInput
        value={props.value}
        onChange={props.onChange}
        onSubmit={props.onSubmit}
        onQueue={props.onQueue}
        disabled={!active}
        working={props.working}
        history={props.history}
        inlineSuggestionActive={props.inlineSuggestionActive}
        onInputTruncated={props.onInputTruncated}
        onCopied={props.onCopied}
        {...(props.queue.length > 0 ? { queued: props.queue } : {})}
      />
    </Box>
  );
}
