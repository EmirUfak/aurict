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
import { Box, Text } from "ink"

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
      const err = this.state.error
      const stackFrame = err.stack?.split("\n")[1]?.trim() ?? "unavailable"
      return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="#38bdf8">
          <Box gap={1} marginBottom={1}>
            <Text color="#38bdf8" bold>AURICT</Text>
            <Text color="#a78bfa" bold> terminal UI recovered</Text>
            <Text color="#817694">component crash contained</Text>
          </Box>

          <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor="#27314a">
            <Text color="#fb7185" bold>{err.name || "Error"}</Text>
            <Text color="#f7f3ff">{err.message || "Unknown terminal render error"}</Text>
            {this.state.phase && (
              <Text color="#817694" dimColor>component: {this.state.phase}</Text>
            )}
            <Text color="#817694" dimColor>stack: {stackFrame}</Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text color="#34d399" bold>Recovery</Text>
            <Text color="#c8bedc">• Press Ctrl+C twice to exit cleanly.</Text>
            <Text color="#c8bedc">• Restart with a wider terminal if the crash followed a resize.</Text>
            <Text color="#c8bedc">• Run aurict doctor, then attach the crash report when filing an issue.</Text>
          </Box>
        </Box>
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
  } catch {
    // non-fatal — pass silently if the crash report can't be written
  }
}
