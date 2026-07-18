import React, { useMemo, useState, useCallback } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../utils/theme.js"
import type { PermissionDecision, PermissionRequest, PermissionResponse } from "@aurict/core"
import { Select, type SelectOption } from "./Select.js"
import { BashPermissionRequest } from "./BashPermissionRequest.js"
import { FallbackPermissionRequest } from "./FallbackPermissionRequest.js"
import { PermissionScaffold } from "./PermissionScaffold.js"
import { PermissionCommandPreview } from "./PermissionCommandPreview.js"

type Decision = PermissionDecision | "deny_abort" | "edit"
export type PermissionPromptDecision = Decision | PermissionResponse

interface Props {
  request:  PermissionRequest
  onDecide: (d: PermissionPromptDecision) => void
}

// ── Granular patch UI — multi-file apply_patch with file selector ─────────────

function patchFileLabel(file: NonNullable<PermissionRequest["files"]>[number]): string {
  if (file.action === "move" && file.targetPath) return `${file.path} -> ${file.targetPath}`
  return `${file.action} ${file.path}`
}

function patchFileKeys(file: NonNullable<PermissionRequest["files"]>[number]): string[] {
  return file.action === "move" && file.targetPath ? [file.path, file.targetPath] : [file.path]
}

function GranularPatchRequest({ request, onDecide }: Props) {
  const theme = useTheme()
  const files  = request.files ?? []
  const patchText = request.patch?.text
  const selectableFileKeys = useMemo(() => files.map(patchFileKeys), [files])
  const allSelectedFiles   = useMemo(() => selectableFileKeys.flat(), [selectableFileKeys])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(() => new Set(allSelectedFiles))
  const [fileIdx,   setFileIdx]   = useState(0)
  const [showPatch, setShowPatch] = useState(false)

  const selectedCount = files.filter((f) => patchFileKeys(f).some((p) => selectedFiles.has(p))).length

  const options: SelectOption<Decision>[] = [
    { id: "allow_partial",   label: "Apply selected",     hint: `${selectedCount}/${files.length} file${files.length === 1 ? "" : "s"}` },
    { id: "allow_directory", label: "Apply + allow dirs", hint: "remember touched folders for this session" },
    { id: "allow_once",      label: "Apply all once",     hint: "ignore file selection for this patch" },
    { id: "deny",            label: "Deny",               hint: "reject patch, AI receives error", color: theme.error },
  ]
  const [selectIdx, setSelectIdx] = useState(0)

  const handleSelect = useCallback((opt: SelectOption<Decision>) => {
    if (opt.id === "allow_partial") {
      const approvedFiles = allSelectedFiles.filter((p) => selectedFiles.has(p))
      if (approvedFiles.length === 0) return
      onDecide({ decision: "allow_partial", approvedFiles })
      return
    }
    onDecide(opt.id)
  }, [allSelectedFiles, selectedFiles, onDecide])

  useInput((char, key) => {
    if (showPatch) return
    if (key.leftArrow)  { setFileIdx(i => Math.max(0, i - 1)); return }
    if (key.rightArrow) { setFileIdx(i => Math.min(files.length - 1, i + 1)); return }
    if (char === " ") {
      const keys = selectableFileKeys[fileIdx] ?? []
      if (keys.length > 0) {
        setSelectedFiles((cur) => {
          const next = new Set(cur)
          const sel  = keys.some((p) => next.has(p))
          for (const p of keys) sel ? next.delete(p) : next.add(p)
          return next
        })
      }
      return
    }
    if (char === "d" && patchText) setShowPatch(v => !v)
  })

  const subtitle = `${selectedCount} of ${files.length} file${files.length === 1 ? "" : "s"} selected`

  const firstVisibleFile = Math.max(0, Math.min(fileIdx - 1, files.length - 3))
  const header = (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {files.slice(firstVisibleFile, firstVisibleFile + 3).map((file, offset) => {
          const actualIdx = firstVisibleFile + offset
          const fileSel   = patchFileKeys(file).some(p => selectedFiles.has(p))
          const focused   = actualIdx === fileIdx
          return (
            <Box key={`${file.path}-${actualIdx}`} gap={1}>
              <Text color={focused ? theme.accent : theme.borderBright}>{focused ? "❯" : " "}</Text>
              <Text color={fileSel ? theme.success : theme.textDim}>{fileSel ? "[x]" : "[ ]"}</Text>
              <Text color={focused ? theme.textPrimary : theme.textDim}>{patchFileLabel(file)}</Text>
            </Box>
          )
        })}
      </Box>
      {patchText && (
        <PermissionCommandPreview
          command={patchText}
          open={showPatch}
          onOpenChange={setShowPatch}
          label="patch"
          linePrefix=""
        />
      )}
    </Box>
  )

  return (
    <PermissionScaffold title="Patch apply" subtitle={subtitle} color={theme.accent} header={header}>
      <Select
        options={options}
        selectedIndex={selectIdx}
        onChange={setSelectIdx}
        onSelect={handleSelect}
        onCancel={() => onDecide("deny")}
      />
      <Box>
        <Text color={theme.textDim} dimColor>
          y apply all  n deny  ↑↓ action  Enter confirm  ←/→ file  Space toggle
          {patchText ? "  d diff" : ""}
        </Text>
      </Box>
    </PermissionScaffold>
  )
}

// ── Route ─────────────────────────────────────────────────────────────────────

export function PermissionPrompt({ request, onDecide }: Props) {
  useInput((char, key) => {
    if (key.ctrl || key.meta) return
    const shortcut = char.toLowerCase()
    if (shortcut === "y") onDecide("allow_once")
    else if (shortcut === "n") onDecide("deny")
    else if (shortcut === "e" && (request.tool === "bash" || request.tool === "shell")) onDecide("edit")
  })

  const isGranularPatch = request.tool === "apply_patch"
    && request.patch?.granular === true
    && (request.files ?? []).length > 0

  if (isGranularPatch) {
    return <GranularPatchRequest request={request} onDecide={onDecide} />
  }

  if (request.tool === "bash" || request.tool === "shell") {
    return <BashPermissionRequest request={request} onDecide={onDecide} />
  }

  return <FallbackPermissionRequest request={request} onDecide={onDecide} />
}
