import React, { useEffect, useState } from "react";
import { Box, Text } from "../design-system/renderer.js";
import { hasUnseenCrashReport, markCrashReportsSeen } from "../../util/draft.js";
import { useTerminalSize } from "../TerminalSizeContext.js";
import { useTheme } from "../../utils/theme.js";
import { shellHorizontalInset } from "./layout-metrics.js";

const NOTICE_DURATION_MS = 8_000;

export function CrashNoticeBanner() {
  const theme = useTheme();
  const columns = useTerminalSize().columns;
  const inset = shellHorizontalInset(columns);
  return (
    <Box paddingLeft={inset} marginBottom={1}>
      <Box
        width={Math.max(1, columns - inset * 2)}
        paddingX={1}
        {...(theme.bgCard !== undefined ? { backgroundColor: theme.bgCard } : {})}
      >
        <Text color={theme.warning} bold>! </Text>
        <Text color={theme.textPrimary}>Previous run ended unexpectedly</Text>
        <Text color={theme.textDim}> · /crashes</Text>
      </Box>
    </Box>
  );
}

/** A transient snackbar; crash diagnostics never become conversation content. */
export function CrashNotice() {
  const [visible, setVisible] = useState(() => hasUnseenCrashReport());
  useEffect(() => {
    if (!visible) return;
    markCrashReportsSeen();
    const timer = setTimeout(() => setVisible(false), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [visible]);
  return visible ? <CrashNoticeBanner /> : null;
}
