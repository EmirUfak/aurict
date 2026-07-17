export interface LiveStreamBuffers {
  text: string;
  reasoning: string;
}

export interface VisibleLiveStream {
  text: string | null;
  reasoning: string | null;
}

/** Normalize empty buffers without withholding any live assistant output. */
export function visibleLiveStream(buffers: LiveStreamBuffers): VisibleLiveStream {
  return {
    text: buffers.text || null,
    reasoning: buffers.reasoning || null,
  };
}
