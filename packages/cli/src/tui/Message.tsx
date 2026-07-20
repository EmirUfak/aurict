import React, { memo } from "react";
import { Box } from "./design-system/renderer.js";
import { projectTranscript } from "./conversation/projector.js";
import type { TranscriptMessage } from "./conversation/types.js";
import { TranscriptRows } from "./TranscriptRows.js";
import { useTerminalSize } from "./TerminalSizeContext.js";

export type {
  TranscriptBlock as AssistantContentBlock,
  TranscriptMessage as DisplayMessage,
} from "./conversation/types.js";

interface Props {
  message: TranscriptMessage;
  onExpand?: (() => void) | undefined;
  onExpandThinking?: (() => void) | undefined;
  onExpandTool?: ((content: string, tool: string) => void) | undefined;
}

/** Compatibility surface backed by the same projector as ConversationViewport. */
export const Message = memo(function Message({ message }: Props) {
  const width = useTerminalSize().columns ?? 120;
  const rows = projectTranscript({
    messages: [message],
    width,
    streamingText: null,
    streamingReason: null,
    streamingError: null,
  });
  return <Box flexDirection="column"><TranscriptRows rows={rows} /></Box>;
});
