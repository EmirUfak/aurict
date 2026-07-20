/**
 * ErrorBoundary — TUI crash protection
 *
 * Prevents the whole app from crashing when an error occurs in the React
 * component tree. Shows the user a meaningful error message and offers
 * recovery options.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */

import React from "react"
import { Box, Text } from "./design-system/renderer.js"
import { ThemeContext, type Theme } from "../utils/theme.js"
import { resolveSemanticTheme } from "./theme/semantic-theme.js"

interface Props {
  children: React.ReactNode
  /** Called when an error occurs (writing a crash report, etc.) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  phase: string
}

function ErrorFallback({ error, phase, theme }: { error: Error; phase: string; theme: Theme }) {
  const semantic = resolveSemanticTheme(theme)
  const stackFrame = error.stack?.split("\n")[1]?.trim() ?? "unavailable"
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor={semantic.border.focus}>
      <Box gap={1} marginBottom={1}>
        <Text color={semantic.identity.assistant} bold>AURICT</Text>
        <Text color={semantic.status.info} bold> terminal UI recovered</Text>
        <Text color={semantic.foreground.muted}>component crash contained</Text>
      </Box>

      <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor={semantic.border.subtle}>
        <Text color={semantic.status.error} bold>{error.name || "Error"}</Text>
        <Text color={semantic.foreground.primary}>{error.message || "Unknown terminal render error"}</Text>
        {phase && <Text color={semantic.foreground.muted}>component: {phase}</Text>}
        <Text color={semantic.foreground.muted}>stack: {stackFrame}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={semantic.status.info} bold>Recovery</Text>
        <Text color={semantic.foreground.secondary}>• Press Ctrl+C twice to exit cleanly.</Text>
        <Text color={semantic.foreground.secondary}>• Restart with a wider terminal if the crash followed a resize.</Text>
        <Text color={semantic.foreground.secondary}>• Run aurict doctor, then attach the crash report when filing an issue.</Text>
      </Box>
    </Box>
  )
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, phase: "" }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ phase: errorInfo.componentStack?.split("\n")[1]?.trim() ?? "unknown" })
    this.props.onError?.(error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <ThemeContext.Consumer>
          {(theme) => <ErrorFallback error={this.state.error!} phase={this.state.phase} theme={theme} />}
        </ThemeContext.Consumer>
      )
    }

    return this.props.children
  }
}

/**
 * Crash report writer — used as ErrorBoundary's onError callback
 */
export function writeTUIcrashReport(error: Error, errorInfo: React.ErrorInfo): void {
  try {
    const { writeCrashReport } = require("../util/draft.js")
    const report = [
      `# TUI Crash Report`,
      `Date: ${new Date().toISOString()}`,
      `Terminal: ${process.env["TERM_PROGRAM"] ?? process.env["TERM"] ?? "unknown"}`,
      `Node: ${process.version}`,
      ``,
      `## Error`,
      `${error.message}`,
      ``,
      `## Stack`,
      `\`\`\``,
      error.stack ?? "no stack",
      `\`\``,
      ``,
      `## Component Stack`,
      `\`\`\``,
      errorInfo.componentStack ?? "no component stack",
      `\`\``,
    ].join("\n")
    writeCrashReport(report)
  } catch (reportError) {
    process.stderr.write(`Aurict could not write the TUI crash report: ${String(reportError)}\n`)
  }
}
