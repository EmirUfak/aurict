import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../utils/theme.js";
import { prefersAsciiGlyphs } from "./terminal-glyphs.js";

const BRAND_WORDMARK = [
  " █████╗ ██╗   ██╗██████╗ ██╗ ██████╗████████╗",
  "██╔══██╗██║   ██║██╔══██╗██║██╔════╝╚══██╔══╝",
  "███████║██║   ██║██████╔╝██║██║        ██║   ",
  "██╔══██║██║   ██║██╔══██╗██║██║        ██║   ",
  "██║  ██║╚██████╔╝██║  ██║██║╚██████╗   ██║   ",
  "╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝ ╚═════╝   ╚═╝   ",
];

const ASCII_WORDMARK = [
  "   A    U   U RRRR  I CCCC TTTTT",
  "  A A   U   U R   R I C      T  ",
  " AAAAA  U   U RRRR  I C      T  ",
  " A   A  U   U R  R  I C      T  ",
  " A   A   UUU  R   R I CCCC   T  ",
];

export function AurictWordmark() {
  const theme = useTheme();
  const lines = prefersAsciiGlyphs() ? ASCII_WORDMARK : BRAND_WORDMARK;
  return (
    <Box flexDirection="column" alignItems="center">
      {lines.map((line, index) => (
        <Text key={line} color={index === 0 || index === lines.length - 1 ? theme.accent : theme.accentAlt} bold>
          {line}
        </Text>
      ))}
    </Box>
  );
}
