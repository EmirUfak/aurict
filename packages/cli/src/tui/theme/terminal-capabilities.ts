export type TerminalColorLevel = "none" | "ansi16" | "ansi256" | "truecolor";

export interface TerminalCapabilities {
  colorLevel: TerminalColorLevel;
  unicode: boolean;
  reducedMotion: boolean;
}

export function detectTerminalCapabilities(env: NodeJS.ProcessEnv = process.env): TerminalCapabilities {
  const term = (env["TERM"] ?? "").toLowerCase();
  const colorTerm = (env["COLORTERM"] ?? "").toLowerCase();
  const locale = env["LC_ALL"] ?? env["LC_CTYPE"] ?? env["LANG"] ?? "";
  const noColor = env["NO_COLOR"] !== undefined || term === "dumb";
  const forced = env["FORCE_COLOR"];
  const colorLevel: TerminalColorLevel = noColor && forced === undefined
    ? "none"
    : /truecolor|24bit/.test(colorTerm)
      ? "truecolor"
      : /256color/.test(term)
        ? "ansi256"
        : "ansi16";
  return {
    colorLevel,
    unicode: env["AURICT_ASCII"] !== "1" && term !== "dumb" && (locale.length === 0 || /utf-?8/i.test(locale)),
    reducedMotion: env["AURICT_NO_MOTION"] === "1"
      || env["AURICT_NO_MOTION"] === "true"
      || env["AURICT_REDUCED_MOTION"] === "1"
      || term === "dumb",
  };
}
