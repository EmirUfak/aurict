import React from "react";
import { Box, Text } from "../design-system/renderer.js";
import type { Theme } from "../../utils/theme.js";
import type { UpdateInfo } from "../../util/update-check.js";
import { CockpitHeader } from "../CockpitHeader.js";
import { StartupBanner } from "../StartupBanner.js";
import { SubagentView } from "../SubagentView.js";

export interface AppHeaderProps {
  theme: Theme;
  subagent: React.ComponentProps<typeof SubagentView> | null;
  cockpit: React.ComponentProps<typeof CockpitHeader> | null;
  startup: React.ComponentProps<typeof StartupBanner> | null;
  updateInfo: UpdateInfo | null;
  updateDismissed: boolean;
  sessionTitle: string | undefined;
  showSessionTitle: boolean;
}

export function AppHeader({
  theme,
  subagent,
  cockpit,
  startup,
  updateInfo,
  updateDismissed,
  sessionTitle,
  showSessionTitle,
}: AppHeaderProps) {
  return (
    <>
      {subagent && <SubagentView {...subagent} />}
      {cockpit && <CockpitHeader {...cockpit} />}
      {startup && <StartupBanner {...startup} />}
      {updateInfo && !updateDismissed && (
        <Box paddingX={2} marginBottom={1}>
          <Text color={theme.warning}>◆ </Text>
          <Text color={theme.warning}>Update available: </Text>
          <Text color={theme.textSecondary}>v{updateInfo.current}</Text>
          <Text color={theme.textDim}> → </Text>
          <Text color={theme.success} bold>v{updateInfo.latest} </Text>
          <Text color={theme.textSecondary}>npm install -g aurict</Text>
          <Text color={theme.textDim}> (esc to dismiss)</Text>
        </Box>
      )}
      {showSessionTitle && sessionTitle && !cockpit && (
        <Box paddingX={2} marginBottom={1}>
          <Text color={theme.textDim}>◈ </Text>
          <Text color={theme.textSecondary} italic>{sessionTitle}</Text>
        </Box>
      )}
    </>
  );
}
