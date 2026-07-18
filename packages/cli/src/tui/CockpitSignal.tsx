import React from "react";
import { Text } from "ink";
import { useTheme } from "../utils/theme.js";
import { motionEnabled, usePulseFrame } from "./design-system/motion.js";
import { prefersAsciiGlyphs } from "./terminal-glyphs.js";

const UNICODE_FRAMES = ["▁▂▁", "▂▃▂", "▃▂▁", "▂▁▂"];
const ASCII_FRAMES = [".::", "::.", ":.:", ".:."];

export function CockpitSignal({ active }: { active: boolean }) {
  const theme = useTheme();
  const frame = usePulseFrame(active);
  const ascii = prefersAsciiGlyphs();
  const frames = ascii ? ASCII_FRAMES : UNICODE_FRAMES;
  const idle = ascii ? "---" : "▁▁▁";
  const signal = active && motionEnabled() ? frames[frame % frames.length]! : idle;
  return <Text color={active ? theme.accentAlt : theme.borderBright}>{signal}</Text>;
}
