export interface TranscriptErrorPresentation {
  title: string;
  detail?: string;
  action: string;
}

function firstLine(message: string): string {
  return message.replace(/^ERROR:\s*/i, "").split("\n")[0]?.trim() || "Unknown error";
}

/** Turns provider/runtime errors into a short diagnosis and a concrete recovery action. */
export function presentTranscriptError(message: string): TranscriptErrorPresentation {
  const detail = firstLine(message);
  const normalized = detail.toLowerCase();

  if (/401|unauthori[sz]ed|authentication|api key|credential/.test(normalized)) {
    return { title: "Authentication required", detail, action: "Check provider credentials with /provider, then retry." };
  }
  if (/429|rate.?limit|too many requests/.test(normalized)) {
    return { title: "Provider rate limit", detail, action: "Wait and retry, or choose another model with /model." };
  }
  if (/context.{0,12}(limit|length|window)|token.{0,12}limit|maximum context/.test(normalized)) {
    return { title: "Context limit reached", detail, action: "Run /compact or choose a model with a larger context window." };
  }
  if (/network|connect|econn|dns|fetch failed|timed? out|socket/.test(normalized)) {
    return { title: "Couldn’t reach provider", detail, action: "Check the connection and provider, then retry." };
  }
  if (/abort|cancel/.test(normalized)) {
    return { title: "Request stopped", detail, action: "Edit the prompt if needed, then retry." };
  }
  return { title: "Request failed", detail, action: "Retry, or run /doctor if the problem continues." };
}
