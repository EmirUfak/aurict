import React from "react";
import { Box, Text } from "../design-system/renderer.js";
import { useTheme } from "../../utils/theme.js";

export interface OverlayGeometry {
  width: number;
  height: number;
  marginX: number;
  marginY: number;
  compact: boolean;
}

/** Responsive bounds for the terminal's single modal layer. */
export function overlayGeometry(columns: number, rows: number): OverlayGeometry {
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);
  const marginX = safeColumns < 60 ? 0 : safeColumns < 100 ? 1 : 2;
  const marginY = safeRows < 18 ? 0 : 1;
  return {
    width: Math.max(1, safeColumns - marginX * 2),
    height: Math.max(1, safeRows - marginY * 2),
    marginX,
    marginY,
    compact: safeColumns < 60 || safeRows < 18,
  };
}

interface Props {
  open: boolean;
  columns: number;
  rows: number;
  backdrop?: boolean | undefined;
  children: React.ReactNode;
}

/**
 * Root-level modal host. It renders after the application surface and uses
 * absolute Yoga positioning, so opening a modal never changes transcript or
 * composer measurements.
 */
export function OverlayStack({ open, columns, rows, backdrop = true, children }: Props) {
  const theme = useTheme();
  if (!open) return null;
  const geometry = overlayGeometry(columns, rows);
  const backdropColor = theme.bgDeep ?? theme.bgHighlight;
  const backdropLine = " ".repeat(geometry.width);
  return (
    <Box
      position="absolute"
      width={columns}
      height={rows}
      flexDirection="column"
      overflow="hidden"
    >
      {backdrop && (
        <Box
          position="absolute"
          flexDirection="column"
          width={geometry.width}
          height={geometry.height}
          marginX={geometry.marginX}
          marginY={geometry.marginY}
          overflow="hidden"
        >
          {Array.from({ length: geometry.height }, (_, row) => (
            <Text key={row} backgroundColor={backdropColor}>{backdropLine}</Text>
          ))}
        </Box>
      )}
      <Box
        flexDirection="column"
        width={geometry.width}
        height={geometry.height}
        marginX={geometry.marginX}
        marginY={geometry.marginY}
        justifyContent={geometry.compact ? "flex-start" : "center"}
        overflow="hidden"
      >
        {children}
      </Box>
    </Box>
  );
}
