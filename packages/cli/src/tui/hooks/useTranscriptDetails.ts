import { useCallback, useMemo, useState } from "react";
import type { DisplayMessage } from "../conversation/types.js";
import {
  collectTranscriptDetails,
  type TranscriptDetail,
} from "../conversation/transcript-details.js";
import type { useOverlayState } from "./useOverlayState.js";

export function useTranscriptDetails(
  messages: DisplayMessage[],
  overlay: ReturnType<typeof useOverlayState>,
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const details = useMemo(() => collectTranscriptDetails(messages), [messages]);
  const openDetail = useCallback((detail: TranscriptDetail) => {
    overlay.closePrimaryOverlays();
    setSelectedId(detail.id);
    overlay.setExpandedContent({
      content: detail.content,
      toolName: detail.title,
      kind: detail.kind,
      ...(detail.rawDiff ? { rawDiff: detail.rawDiff } : {}),
      ...(detail.filePath ? { filePath: detail.filePath } : {}),
      ...(detail.totalLines !== undefined ? { totalLines: detail.totalLines } : {}),
    });
  }, [overlay]);
  const moveDetail = useCallback((direction: -1 | 1) => {
    if (details.length < 2) return;
    const currentIndex = Math.max(
      0,
      details.findIndex((detail) => detail.id === selectedId),
    );
    const nextIndex = (currentIndex + direction + details.length) % details.length;
    openDetail(details[nextIndex]!);
  }, [details, openDetail, selectedId]);

  return { details, selectedId, openDetail, moveDetail };
}
