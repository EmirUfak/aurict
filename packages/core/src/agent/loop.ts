import { streamText, generateText, tool } from "ai"
import type { CoreMessage, ToolSet } from "ai"
import { resolve } from "path"
import { ProviderRegistry } from "../provider/registry.js"
import { findCachedModelInfo, resolveModelInfo } from "../provider/models-fetch.js"
import { ToolRegistry } from "../tool/registry.js"
import { executeTool } from "../tool/executor.js"
import { SessionManager } from "../session/manager.js"
import { isOverflow, isOverflowByMessages, compact, DEFAULT_TAIL_TURNS, microCompactOldToolResults } from "../session/compaction.js"
import { buildSystemPromptSections } from "../skill/injector.js"
import { attachmentToAIContent } from "../util/attachments.js"
import { createThinkTagFilter } from "../util/think-tag-filter.js"
import { getUndercoverInstructions } from "./undercover.js"
import { loadConfig, resolveLongTaskRuntimeConfig } from "../config/config.js"
import { setTruncationConfig } from "../tool/truncation.js"
import { calculateCostUsd } from "../provider/costs.js"
import { extractAndStoreMemories, extractPerTurnMemories } from "../memory/extractor.js"
import { buildGitSection, buildProactiveFileSection, buildIntentSkillSection, getSkillsForProject, matchIntentSkills } from "../skill/injector.js"
import { joinPromptSections, splitPromptSectionsByCache, type ResolvedPromptSection } from "./prompt-sections.js"
import { skillScoreStore } from "../skill/score-store.js"
import { ProviderFallback, loadFallbackFromConfig, NonRetryableStreamError } from "../provider/fallback.js"
import { ModelRouter, loadRouterFromConfig } from "../provider/router.js"
import { metrics } from "../util/metrics.js"
import { extractText } from "../session/context-compactor.js"
import type { AgentRunOptions, AgentFinishResult, TokenBreakdown } from "./types.js"
import { analyzePromptSections } from "./prompt-diagnostics.js"
import { recordPromptCacheHealth } from "./prompt-cache-health.js"
import { getCachedToolSchema } from "../tool/schema-cache.js"
import { getPromptCacheControl, isPromptCachingEnabled } from "./prompt-cache-control.js"
import { clearActiveSkillPolicy, getSkillLifecycleSnapshot, restoreSkillLifecycle } from "../skill/runtime-policy.js"
import { evaluateContinuation } from "./continuation.js"
import { extractVerificationSnapshot, readSessionResumeState, writeSessionResumeState } from "../session/resume-state.js"
import { restoreWorkingSet, getWorkingSetSnapshot } from "./working-set.js"
import { restoreFailureCooldown, getFailureCooldownSnapshot } from "./failure-cooldown.js"
import { failedStrategiesStore } from "./failed-strategies-store.js"
import { summarizeFragileAreas } from "./fragile-areas.js"
import { buildAttentionAnchor } from "./attention-anchor.js"
import { evaluateCompletionGate } from "./completion-gate.js"
import { recordRunTrace } from "./run-trace.js"
import { filterToolIdsForSecurityCapability, prepareToolForSecurityCapability } from "../security/capability.js"
import type { OmniConfig } from "../config/config.js"
import { evaluateLongTaskContinuation } from "./continuation-controller.js"
import { buildTaskLedger, formatTaskLedgerAnchor } from "./task-ledger.js"
import { isTaskContinuationTurn } from "./turn-intent.js"
import { assessComplexity, stepsForComplexity, deriveReasoningEffort } from "./complexity.js"
import { getCoordinatorSystemPrompt, getCoordinatorContext, shouldInjectCoordinatorPrompt } from "./coordinator.js"
import { agentPool } from "./pool.js"

// AI SDK tool() fonksiyonunun dönüş tipiyle exactOptionalPropertyTypes çakışıyor
// — ToolSet cast'i kullanıyoruz
function buildAITools(
  workdir: string,
  sessionId: string,
  provider: string,
  model: string,
  cfg: OmniConfig,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void,
  failureTracker?: Map<string, number>,
  recentReads?: Map<string, number>,
  toolCallIndexRef?: { current: number },
): ToolSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {}
  for (const def of ToolRegistry.list()) {
    // Faz 3B: orchestrate tool sadece orchestration.enabled true iken modele görünür —
    // kapalıyken model onu bir seçenek olarak bile görmemeli.
    if (def.id === "orchestrate" && cfg.orchestration?.enabled !== true) continue
    const filteredDef = prepareToolForSecurityCapability(def, cfg)
    if (!filteredDef) continue
    const captured = filteredDef
    const schema = getCachedToolSchema(filteredDef)
    const sanitizedId = schema.sanitizedId
    result[sanitizedId] = tool({
      description: schema.description,
      parameters:  schema.parameters as never,
      execute: async (args: Record<string, unknown>) => {
        if (toolCallIndexRef) toolCallIndexRef.current++
        const currentIdx = toolCallIndexRef?.current ?? 0

        // B: Re-read gating — if file not read in last 10 calls, inject current content
        if (recentReads && captured.id === "edit") {
          const rawPath = String(args["path"] ?? "")
          if (rawPath) {
            const absPath   = resolve(workdir, rawPath)
            const lastRead  = recentReads.get(absPath)
            const isFresh   = lastRead !== undefined && (currentIdx - lastRead) <= 10
            if (!isFresh) {
              try {
                // 2s timeout — yavaş FS'de re-read gate'in tool çağrısını bloklamasını önler
                const readP = Bun.file(absPath).text()
                const timeoutP = new Promise<string>((_, rej) =>
                  setTimeout(() => rej(new Error("timeout")), 2_000))
                const content = await Promise.race([readP, timeoutP])
                const excerpt = content.slice(0, 6_000)
                const trunc   = content.length > 6_000 ? "\n... [truncated]" : ""
                const staleness = lastRead !== undefined
                  ? `${currentIdx - lastRead} tool calls ago`
                  : "never in this turn"
                return `[Re-read gate] '${rawPath}' was last read ${staleness}. Current content:\n\`\`\`\n${excerpt}${trunc}\n\`\`\`\n\nReview the actual content above, then re-issue your edit with an exact verbatim match from what you see.`
              } catch {
                // Can't read file — let edit run and fail with its own error
              }
            }
          }
        }

        // ctx.signal, loop'un signal'ine bağlı: Ctrl+C veya dışarıdan iptal
        // tool'a kadar ulaşır; executor da timeout'ta bu signal'i abort eder.
        const ctx = {
          sessionId, workdir,
          signal: signal ?? new AbortController().signal,
          provider, model,
          ...(onChunk !== undefined ? { onChunk } : {}),
        }
        const res = await executeTool(captured, args, ctx)

        // Track file reads and writes so re-read gate stays accurate
        if (recentReads && !res.error && (captured.id === "read" || captured.id === "write")) {
          const rawPath = String(args["path"] ?? "")
          if (rawPath) recentReads.set(resolve(workdir, rawPath), currentIdx)
        }

        let out = res.error ? `ERROR: ${res.error}\n${res.output}` : res.output

        if (res.error && failureTracker) {
          const fingerprint = `${captured.id}:${String(res.error).slice(0, 80)}`
          const count = (failureTracker.get(fingerprint) ?? 0) + 1
          failureTracker.set(fingerprint, count)
          if (count >= 2) {
            out += `\n\n[SYSTEM: You have hit this exact error ${count} times in a row. DO NOT retry the same approach. Stop, identify the root cause, and try a fundamentally different solution.]`
          }
        }

        return out
      },
    })
  }
  return result as ToolSet
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentFinishResult> {
  const providerName = opts.provider ?? "anthropic"
  const plugin       = ProviderRegistry.get(providerName)
  const modelId      = opts.model ?? plugin.defaultModel()
  const workdir      = opts.workdir ?? process.cwd()
  const sessionId    = opts.sessionId
  const resumedState = sessionId ? await readSessionResumeState(workdir, sessionId) : null
  if (sessionId && resumedState) {
    restoreSkillLifecycle(sessionId, resumedState.activeSkills ?? [])
    restoreWorkingSet(sessionId, resumedState.workingSet)
    restoreFailureCooldown(sessionId, resumedState.failureCooldown)
  } else {
    clearActiveSkillPolicy(sessionId ?? "")
    restoreWorkingSet(sessionId ?? "", null)
    restoreFailureCooldown(sessionId ?? "", null)
  }

  let messages: CoreMessage[] = [...opts.messages]

  // --- Multimodal attachment injection ---
  // Attachments varsa son user mesajını array formatına çevir
  if (opts.attachments && opts.attachments.length > 0) {
    const lastIdx = messages.length - 1
    const last = messages[lastIdx]
    if (last && last.role === "user" && typeof last.content === "string") {
      const textBlock = { type: "text" as const, text: last.content }
      const imageBlocks = opts.attachments.map((a) => attachmentToAIContent(a))
      messages = [
        ...messages.slice(0, lastIdx),
        { role: "user", content: [textBlock, ...imageBlocks] } as CoreMessage,
      ]
    }
  }

  // --- Config yükle + truncation init ---
  const cfg              = loadConfig(workdir)
  const longTaskConfig   = resolveLongTaskRuntimeConfig(cfg)
  setTruncationConfig(cfg.truncation ?? {})

  // --- Provider fallback init ---
  if (cfg.fallback) {
    loadFallbackFromConfig({
      enabled: cfg.fallback.enabled ?? false,
      providers: cfg.fallback.providers ?? [],
      triggerOn: cfg.fallback.triggerOn ?? ["429", "503", "timeout"],
      maxRetries: cfg.fallback.maxRetries ?? 2,
      retryDelayMs: cfg.fallback.retryDelayMs ?? 15_000,
      circuitBreakerThreshold: cfg.fallback.circuitBreakerThreshold ?? 3,
      circuitBreakerResetMs: cfg.fallback.circuitBreakerResetMs ?? 60_000,
    })
  }

  // --- Model router init ---
  if (cfg.routing) {
    loadRouterFromConfig({
      enabled: cfg.routing.enabled ?? false,
      budgetThresholdUsd: cfg.routing.budgetThresholdUsd ?? 1.0,
      maxSessionCostUsd: cfg.routing.maxSessionCostUsd ?? 10.0,
    })
  }

  // --- Compaction kontrolü ---
  const compCfg          = cfg.compaction
  const tailTurns        = compCfg?.tailTurns            ?? DEFAULT_TAIL_TURNS
  const strategy         = compCfg?.strategy             ?? "balanced"
  const msgThreshold     = compCfg?.messageCountThreshold
  // 3 katmanlı çözüm: statik liste → uzak /models cache'i → models.dev/heuristik.
  // Her zaman dolu döner — bilinmeyen (BYOK) modelde artık sessiz 200k/8k
  // varsayımı yerine gerçek ya da bilgiye dayalı bir context/output tahmini var.
  const modelInfo = await resolveModelInfo(plugin, providerName, modelId)
  const compCfgFull = {
    contextLimit:          modelInfo.contextWindow,
    maxOutput:             modelInfo.maxOutput,
    tailTurns,
    strategy,
    provider:              providerName,
    model:                 modelId,
    workdir,
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(msgThreshold !== undefined ? { messageCountThreshold: msgThreshold } : {}),
  }
  messages = microCompactOldToolResults(messages, compCfgFull)

  if (isOverflow(messages, compCfgFull) || isOverflowByMessages(messages, compCfgFull)) {
    // Extract memories from messages about to be lost to compaction (fire-and-forget)
    extractAndStoreMemories(providerName, modelId, messages, workdir).catch(() => metrics.recordError("memory_extract"))
    const compacted = await compact(messages, compCfgFull)
    if (!compacted) return { text: "", tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, newMessages: [], ...(sessionId !== undefined ? { sessionId } : {}) }
    messages  = compacted
    opts.onCompaction?.()
  }

  // supportsTools: false olan modeller tool API'si desteklemez — boş geç
  const hasToolSupport   = modelInfo.supportsTools !== false
  const failureTracker   = new Map<string, number>()
  const recentReads      = new Map<string, number>()
  const toolCallIndexRef = { current: 0 }
  const rawTools = hasToolSupport
    ? buildAITools(workdir, sessionId ?? "", providerName, modelId, cfg, opts.signal, opts.onChunk, failureTracker, recentReads, toolCallIndexRef)
    : ({} as ToolSet)

  // toolsOverride: session agent kısıtlaması — sadece izin verilen tool'lar
  const toolsOverride = opts.toolsOverride
    ? filterToolIdsForSecurityCapability(opts.toolsOverride, cfg)
    : undefined
  const aiTools: ToolSet = opts.toolsOverride
    ? Object.fromEntries(
        Object.entries(rawTools).filter(([id]) => toolsOverride!.includes(id))
      ) as ToolSet
    : rawTools

  // --- Proactive file injection: dosya adları user mesajında geçiyorsa önceden inject et ---
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")
  const lastUserText = lastUserMsg
    ? (typeof lastUserMsg.content === "string" ? lastUserMsg.content : "")
    : ""
  const taskContinuationTurn = isTaskContinuationTurn(lastUserText)

  // --- Skill injection (otomatik proje tespiti) ---
  // Git context buildSystemPrompt dışında tutulur — Anthropic'te ayrı uncached blok olarak inject edilir
  const baseSystemSections = await buildSystemPromptSections(workdir, opts.system, false, undefined, lastUserText)
  const projectSkills   = await getSkillsForProject(workdir).catch(() => [])
  const projectSkillIds = new Set(projectSkills.map((s) => s.id))
  const activatedSkills = matchIntentSkills(lastUserText, workdir, projectSkillIds)
  if (activatedSkills.length > 0) opts.onSkillsActivated?.(activatedSkills)

  const [proactiveSection, intentSection] = await Promise.all([
    buildProactiveFileSection(lastUserText, workdir).catch(() => ""),
    buildIntentSkillSection(lastUserText, workdir, projectSkillIds).catch(() => ""),
  ])

  const runtimeSystemSections: ResolvedPromptSection[] = [...baseSystemSections]
  const extraSystem = [proactiveSection, intentSection].filter(Boolean).join("\n\n")
  if (extraSystem) {
    runtimeSystemSections.push({ name: "runtime_extra", cache: "dynamic", content: extraSystem })
  }

  if (opts.undercover) {
    runtimeSystemSections.push({ name: "undercover", cache: "dynamic", content: `---\n\n${getUndercoverInstructions()}` })
  }

  const workingSet = getWorkingSetSnapshot(sessionId ?? "")
  const failureCooldown = getFailureCooldownSnapshot(sessionId ?? "")

  // ─── Faz 2: Karmaşıklık değerlendirmesi — adaptif step limit + reasoning effort
  // aynı skordan türetilir (tek kaynak: agent/complexity.ts). Coordinator injection
  // kararı (Faz 3A) da bu skordan yararlanır, bu yüzden runtimeSystemSections
  // henüz join edilmeden önce, erken hesaplanıyor. ────────────────────────────
  const changedFilesCount = workingSet.items.filter(
    item => item.kind === "file" && item.reason === "changed file"
  ).length
  const complexity = assessComplexity({
    text: lastUserMsg ? extractText(lastUserMsg) : "",
    hasAttachments: !!opts.attachments,
    priorToolCalls: workingSet.items.length,
    changedFiles: changedFilesCount,
    priorFailures: failureCooldown.active.length,
  })
  const maxSteps = stepsForComplexity(complexity.level)

  const attentionAnchor = buildAttentionAnchor({
    objective: lastUserText,
    activeSkill: getSkillLifecycleSnapshot(sessionId ?? "").active,
    workingSet,
    verification: resumedState?.lastVerification,
    cooldown: failureCooldown,
    // Faz 5.1b: bu session'a özel değil — projede geçmiş session'larda da
    // tekrarlanmış (strategyShiftRequired) başarısız stratejiler.
    knownDeadEnds: failedStrategiesStore.recent(workdir),
    // Faz 6.3: run-trace geçmişinden (tool_result_distilled olayları) çıkarılan
    // "bu projede en çok hata veren tool'lar" özeti — 5dk cache'li, session'a özel değil.
    fragileAreas: await summarizeFragileAreas(workdir).catch(() => []),
  })
  if (attentionAnchor) {
    runtimeSystemSections.push({ name: "attention_anchor", cache: "dynamic", content: attentionAnchor })
  }
  if (longTaskConfig.enabled && resumedState?.taskLedger && taskContinuationTurn) {
    runtimeSystemSections.push({
      name: "task_ledger",
      cache: "dynamic",
      content: formatTaskLedgerAnchor(resumedState.taskLedger),
    })
  }

  // ─── Faz 3A: Coordinator prompt — karmaşıklık-kapılı ────────────────────────
  // Önceden CLI'de (App.tsx) coordinatorMode=true iken HER turn'e opts.system
  // üzerinden giriyordu; bu hem gereksiz maliyet hem de opts.system her zaman
  // dolu olduğu için TÜM core system bloğunun cache dışı kalmasına yol açıyordu
  // (buildSystemPromptSections: base truthy → dynamicPromptSection). Artık
  // sadece "complex" seviye veya çok-boyutlu/broad-scan istekte enjekte edilir;
  // orchestration.mode: "off" hiç, "always" eski davranış (geriye dönük uyum).
  const orchestrationMode = cfg.orchestration?.mode ?? "auto"
  const coordinatorActive = opts.coordinatorMode === false
    ? false  // kullanıcı /coordinator ile tamamen kapattı — config'e bakılmaksızın hiç enjekte etme
    : orchestrationMode === "off"
      ? false
      : orchestrationMode === "always"
        ? true
        : shouldInjectCoordinatorPrompt(lastUserText, complexity.level)
  if (coordinatorActive) {
    runtimeSystemSections.push({ name: "coordinator", cache: "dynamic", content: getCoordinatorSystemPrompt() })
    // agentPool.active best-effort — asla turu çökertmemeli (ör. testlerde/edge-case'lerde mock/eksik olabilir)
    const activeWorkers = agentPool.active ?? []
    if (activeWorkers.length > 0) {
      const coordinatorContext = getCoordinatorContext(activeWorkers)
      if (coordinatorContext) {
        runtimeSystemSections.push({ name: "coordinator_context", cache: "dynamic", content: coordinatorContext })
      }
    }
  }

  const system = joinPromptSections(runtimeSystemSections)
  opts.onPromptDiagnostics?.(analyzePromptSections(runtimeSystemSections))
  const cacheHealth = recordPromptCacheHealth({
    key: `${workdir}:${providerName}`,
    model: modelId,
    sections: runtimeSystemSections,
    toolIds: Object.keys(aiTools),
  })
  opts.onPromptCacheHealth?.(cacheHealth)
  if (sessionId) {
    recordRunTrace(workdir, sessionId, "prompt_sections", {
      sections: runtimeSystemSections.map(section => ({ name: section.name, cache: section.cache, chars: section.content.length })),
      cacheHealth,
    }).catch(() => {})
    if (attentionAnchor) {
      recordRunTrace(workdir, sessionId, "attention_anchor", {
        chars: attentionAnchor.length,
        workingSetItems: workingSet.items.length,
        activeSkill: getSkillLifecycleSnapshot(sessionId).active?.skillId ?? null,
      }).catch(() => {})
    }
  }

  // Git context her turn'de fresh — Anthropic cache'e girmemeli
  const gitSection = buildGitSection(workdir)

  interface AttemptResult {
    fullText:     string
    breakdown:    TokenBreakdown
    finishReason: string | undefined
    newMessages:  CoreMessage[]
    providerId:   string
    modelId:      string
  }

  // attemptIndex>0 olan her çağrı bir retry veya fallback denemesidir — önceki
  // denemeden UI'ye akmış olabilecek kısmi metni sıfırlamak için onStreamRestart
  // tetiklenir (aksi halde başarısız denemenin parçası + yeni denemenin metni
  // yan yana görünüp transcript'i bozar).
  let attemptIndex = 0

  // Faz 1: Tek bir provider denemesini uçtan uca çalıştırır — model/tool/thinking/
  // prompt-cache çözümü dahil. withRetry (aynı provider) veya withFallback (farklı
  // provider) bu fonksiyonu sarar; ikisi de retry kapsamına artık gerçek stream
  // tüketimini de alır (öncesinde withRetry sadece senkron streamText çağrısını
  // sarıyordu, asıl hata fullStream tüketimi sırasında kapsam dışında fırlıyordu).
  async function runOneAttempt(attemptProviderId: string): Promise<AttemptResult> {
    const isRetryOrFallbackAttempt = attemptIndex > 0
    attemptIndex++
    if (isRetryOrFallbackAttempt) opts.onStreamRestart?.()

    const attemptPlugin = attemptProviderId === providerName ? plugin : ProviderRegistry.get(attemptProviderId)
    // Fallback farklı bir provider'a geçtiyse orijinal model id o provider'da
    // muhtemelen geçersizdir (provider-specific id) — o provider'ın varsayılan
    // modelini kullan.
    const attemptModelId = attemptProviderId === providerName ? modelId : attemptPlugin.defaultModel()
    const attemptModel   = attemptPlugin.getModel(attemptModelId)

    const attemptModelInfo = attemptPlugin.listModels().find((m) => m.id === attemptModelId)
      ?? findCachedModelInfo(attemptProviderId, attemptModelId)
    const attemptHasToolSupport = attemptModelInfo?.supportsTools !== false
    const attemptRawTools = attemptHasToolSupport
      ? buildAITools(workdir, sessionId ?? "", attemptProviderId, attemptModelId, cfg, opts.signal, opts.onChunk, failureTracker, recentReads, toolCallIndexRef)
      : ({} as ToolSet)
    const attemptAiTools: ToolSet = toolsOverride
      ? Object.fromEntries(
          Object.entries(attemptRawTools).filter(([id]) => toolsOverride!.includes(id))
        ) as ToolSet
      : attemptRawTools

    // Anthropic prompt caching: static/session sections cache'lenir, dynamic/git
    // cache dışı kalır. Dış kapsamdaki `messages` hiç mutasyona uğramaz — her
    // attempt kendi system-wrap'li mesaj kopyasını kurar.
    let attemptMessages: CoreMessage[] = messages
    let attemptSystemParam: string | undefined = system || undefined
    if (attemptPlugin.sdkType === "anthropic") {
      // @ai-sdk/anthropic's convertToAnthropicMessagesPrompt groups CONSECUTIVE
      // system-role CoreMessages back into Anthropic's array-of-cached-blocks
      // system format itself (see its "system" block-grouping switch case) — it
      // does NOT accept one CoreMessage whose `content` is already an array;
      // ai@4.x's CoreSystemMessage.content is typed (and Zod-validated) as
      // `string` only. So here we emit one plain-string system message per
      // section, each carrying its own experimental_providerMetadata — the
      // provider's own grouping reassembles them into the cached blocks.
      const systemMessages: CoreMessage[] = []
      const splitSystem = splitPromptSectionsByCache(runtimeSystemSections)
      const promptCachingEnabled = isPromptCachingEnabled(attemptProviderId, attemptModelId)
      if (splitSystem.cacheable) {
        systemMessages.push({
          role: "system",
          content: splitSystem.cacheable,
          // PromptCacheControl is a plain JSON-safe object, but its named
          // (non-indexed) shape doesn't structurally satisfy the provider
          // metadata's `Record<string, JSONValue>` signature under
          // exactOptionalPropertyTypes — same cast the previous code applied.
          ...(promptCachingEnabled
            ? { experimental_providerMetadata: { anthropic: { cacheControl: getPromptCacheControl() } } as never }
            : {}),
        })
      }
      if (splitSystem.dynamic) {
        systemMessages.push({ role: "system", content: splitSystem.dynamic })
      }
      if (gitSection) {
        systemMessages.push({ role: "system", content: gitSection })
      }
      if (systemMessages.length > 0) {
        attemptMessages = [...systemMessages, ...messages]
        attemptSystemParam = undefined
      }
    } else if (system || gitSection) {
      // Non-Anthropic: git context dahil tek string
      const fullSystem = [system, gitSection].filter(Boolean).join("\n\n")
      attemptSystemParam = fullSystem || undefined
    }

    // Faz 2.2: opts.effort verilmemişse ve model thinking destekliyorsa,
    // escalation.enabled iken karmaşıklık skorundan bir effort türet
    // (escalation.maxReasoningEffort ile sınırlı). escalation kapalıyken
    // davranış aynen korunur: sadece dışarıdan gelen opts.effort kullanılır.
    const effectiveEffort = opts.effort ?? (
      cfg.escalation?.enabled === true && attemptModelInfo?.supportsThinking
        ? deriveReasoningEffort(complexity.score, cfg.escalation?.maxReasoningEffort)
        : undefined
    )

    const attemptShared = {
      model:    attemptModel,
      messages: attemptMessages,
      tools:    attemptAiTools,
      maxSteps,
      experimental_continueSteps: true,
      ...(attemptSystemParam ? { system: attemptSystemParam } : {}),
      ...(opts.signal !== undefined ? { abortSignal: opts.signal } : {}),
      ...(effectiveEffort ? (() => {
        const thinkOpts = attemptPlugin.buildThinkingOptions(attemptModelId, effectiveEffort)
        return thinkOpts ? { providerOptions: thinkOpts } : {}
      })() : {})
    }

    let fullText = ""
    let breakdown: TokenBreakdown = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }
    let finishReason: string | undefined
    let newMessages: CoreMessage[] = []

    // opts.stream=false → pipe/non-interactive mod, kesinlikle generate
    // opts.stream=true veya undefined → provider'ın streaming desteğine bak
    const useStreamAttempt = opts.stream !== false && attemptPlugin.supportsStreaming

    if (useStreamAttempt) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = streamText(attemptShared as any) as any
      const seenToolResults  = new Set<string>()
      const toolCallTimes    = new Map<string, number>()
      // Embedded <think>...</think> tag'lerini text stream'den ayıran filter
      // (DeepSeek-R1, Qwen, Ollama modeller)
      const thinkFilter = createThinkTagFilter()
      // En az bir tool call bu attempt'te çalıştı mı? Çalıştıysa gerçek yan
      // etkiler oluşmuştur (dosya yazıldı, komut çalıştı) — sonraki bir hata
      // bu attempt'i retry/fallback ile baştan tekrarlatmamalı.
      let toolCallHappened = false

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          const raw = (part.textDelta as string) || ""
          if (!raw) continue
          const { text, thinking } = thinkFilter.feed(raw)
          if (thinking) opts.onText?.(thinking, true)
          if (text) {
            fullText += text
            opts.onText?.(text, false)
          }
        } else if (
          part.type === "reasoning"       ||
          part.type === "reasoning-delta" ||
          part.type === "thinking"
        ) {
          // Native reasoning events (Anthropic extended thinking, AI SDK)
          const delta: string =
            (part as any).text      ??
            (part as any).textDelta ??
            (part as any).reasoning ??
            (part as any).delta     ?? ""
          if (delta) opts.onText?.(delta, true)
        } else if (part.type === "reasoning-start" || part.type === "reasoning-end") {
          // lifecycle sinyalleri — delta taşımaz, ignore
        } else if (part.type === "error") {
          const rawErr = (part as any).error
          const original = rawErr instanceof Error
            ? rawErr
            : new Error(typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr))
          if (toolCallHappened) {
            const nonRetryable = new NonRetryableStreamError(original.message)
            Object.assign(nonRetryable, original)
            nonRetryable.message = `${original.message}\n\n[Tool calls already ran this turn — not auto-retried to avoid duplicate side effects. Review the results above.]`
            throw nonRetryable
          }
          throw original
        } else if (part.type === "tool-call") {
          toolCallHappened = true
          toolCallTimes.set(part.toolCallId, Date.now())
          opts.onToolCall?.({ id: part.toolCallId, tool: part.toolName, args: part.args })
        } else if (part.type === "tool-result") {
          // tool-result tek kaynak — step-finish'te tekrar emit edilmez
          if (!seenToolResults.has(part.toolCallId)) {
            seenToolResults.add(part.toolCallId)
            const durationMs = Date.now() - (toolCallTimes.get(part.toolCallId) ?? Date.now())
            toolCallTimes.delete(part.toolCallId)
            // @ts-ignore: part.result
            opts.onToolResult?.({ id: part.toolCallId, result: String(part.result), durationMs })
          }
        } else if (part.type === "step-finish") {
          // Yalnızca step tamamlama sinyali — tool result emission yok (race condition önleme)
          opts.onStepFinish?.()
        }
      }

      // Stream bitti — buffer'da kalan fragmentleri boşalt
      const tail = thinkFilter.flush()
      if (tail.thinking) opts.onText?.(tail.thinking, true)
      if (tail.text) { fullText += tail.text; opts.onText?.(tail.text, false) }

      const u    = await result.usage as Record<string, unknown>
      const meta = await (result as any).experimental_providerMetadata as Record<string, unknown> | undefined
      breakdown  = extractTokenBreakdown(u, meta)
      finishReason = String(await (result as any).finishReason ?? "")

      const finalResponse = await result.response
      newMessages = finalResponse.messages
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await generateText(attemptShared as any)
      fullText      = result.text
      opts.onText?.(fullText)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const step of (result as any).steps ?? []) {
        for (const tc of step.toolCalls ?? []) {
          opts.onToolCall?.({ id: tc.toolCallId, tool: tc.toolName, args: tc.args })
        }
        for (const tr of step.toolResults ?? []) {
          opts.onToolResult?.({ id: tr.toolCallId, result: String(tr.result), durationMs: 0 })
        }
      }

      const u    = result.usage as Record<string, unknown>
      const meta = (result as any).experimental_providerMetadata as Record<string, unknown> | undefined
      breakdown  = extractTokenBreakdown(u, meta)
      finishReason = String((result as any).finishReason ?? "")
      newMessages = result.response.messages
    }

    return { fullText, breakdown, finishReason, newMessages, providerId: attemptProviderId, modelId: attemptModelId }
  }

  // --- Fallback zinciri sadece cfg.fallback.enabled + provider listesi varsa devrede ---
  // Kapalıyken davranış değişmez: tek provider, withRetry ile 429 retry'i.
  const fallbackEnabled = !!(cfg.fallback?.enabled && (cfg.fallback.providers?.length ?? 0) > 0)

  let attemptResult: AttemptResult
  if (fallbackEnabled) {
    const { result, provider: resolvedProvider, switchedFrom } =
      await withFallback(providerName, (attemptProviderId) => runOneAttempt(attemptProviderId))
    attemptResult = result
    if (switchedFrom) opts.onProviderFallback?.(switchedFrom, resolvedProvider)
  } else {
    attemptResult = await withRetry(() => runOneAttempt(providerName))
  }

  const { fullText, breakdown, finishReason, newMessages, providerId: usedProviderName, modelId: usedModelId } = attemptResult

  if (sessionId !== undefined && fullText) {
    // usedProviderName/usedModelId: fallback devredeyse gerçekten çalışan provider/model
    // — birincisi değil (billing ve session geçmişi doğru kaynağı yansıtmalı).
    SessionManager.ensureExists(sessionId, { provider: usedProviderName, model: usedModelId })
    SessionManager.addPart({ sessionId, role: "assistant", type: "text", content: fullText, tokens: breakdown.output })
    SessionManager.recordTurn(sessionId, {
      inputTokens:  breakdown.input,
      outputTokens: breakdown.output,
      cacheTokens:  (breakdown.cacheRead ?? 0) + (breakdown.cacheWrite ?? 0),
      costUsd:      calculateCostUsd(usedModelId, breakdown),
      model:        usedModelId,
    })
  }

  const continuationTasks = taskContinuationTurn ? opts.continuation?.getTasks?.() ?? [] : []
  const continuation = evaluateContinuation({
    text: fullText,
    finishReason,
    newMessageCount: newMessages.length,
    tasks: continuationTasks,
  }, {
    previousContinuations: opts.continuation?.previousContinuations ?? resumedState?.continuation?.nextContinuationCount,
    maxContinuations: opts.continuation?.maxContinuations,
    maxTaskContinuations: opts.continuation?.maxTaskContinuations,
  })
  const lastVerification = extractVerificationSnapshot(fullText) ?? resumedState?.lastVerification
  const finalWorkingSet = getWorkingSetSnapshot(sessionId ?? "")
  const completionGate = evaluateCompletionGate({
    text: fullText,
    continuation,
    workingSet: finalWorkingSet,
    verification: lastVerification,
    allowTaskAutoContinue: taskContinuationTurn,
  })
  const taskLedger = buildTaskLedger({
    objective: lastUserText,
    workingSet: finalWorkingSet,
    verification: lastVerification,
    continuation,
    tasks: continuationTasks,
    previous: resumedState?.taskLedger,
  })
  // Faz 2.4: bu turdaki tool çalışmaları failure-cooldown'u güncellemiş olabilir —
  // turn başında alınan `failureCooldown` snapshot'ı bayattır, taze bir tane çek.
  const finalFailureCooldown = getFailureCooldownSnapshot(sessionId ?? "")
  const shouldEscalateNudge = cfg.escalation?.enabled === true
    && cfg.escalation?.escalateOnRepeatedFailure === true
    && finalFailureCooldown.active.length > 0

  const longTask = evaluateLongTaskContinuation({
    text: fullText,
    ledger: taskLedger,
    completionGate,
    continuation,
    config: longTaskConfig,
    budget: {
      previousContinuations: continuation.previousContinuations,
    },
    taskIntent: taskContinuationTurn,
    escalateReasoning: shouldEscalateNudge,
  })
  if (longTask.shouldContinue && !completionGate.shouldAutoContinue && !completionGate.shadowOnly) {
    completionGate.status = longTask.reason === "budget_exhausted" ? "budget_exhausted" : "continue_required"
    completionGate.shouldAutoContinue = true
    completionGate.reason = `long_task:${longTask.reason}`
    completionGate.shadowOnly = longTask.shadowOnly
  }

  const finish: AgentFinishResult = {
    text:      fullText,
    tokens:    breakdown,
    newMessages,
    continuation,
    completionGate,
    longTask,
    taskLedger,
    ...(finishReason ? { finishReason } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
  }

  opts.onFinish?.(finish)

  if (sessionId !== undefined) {
    writeSessionResumeState({
      sessionId,
      workdir,
      provider: usedProviderName,
      model: usedModelId,
      updatedAt: Date.now(),
      activeSkills: getSkillLifecycleSnapshot(sessionId).stack,
      workingSet: finalWorkingSet,
      failureCooldown: getFailureCooldownSnapshot(sessionId),
      completionGate,
      continuation,
      longTask,
      taskLedger,
      ...(finishReason ? { finishReason } : {}),
      tokens: breakdown,
      ...(lastVerification ? { lastVerification } : {}),
      ...(fullText ? { lastTextPreview: fullText.slice(-1_500) } : {}),
    }).catch(() => {})
    recordRunTrace(workdir, sessionId, "completion_gate", completionGate as unknown as Record<string, unknown>).catch(() => {})
    recordRunTrace(workdir, sessionId, "long_task", {
      decision: longTask,
      ledger: taskLedger,
    }).catch(() => {})
    recordRunTrace(workdir, sessionId, "working_set", {
      items: finalWorkingSet.items.slice(0, 12),
      updatedAt: finalWorkingSet.updatedAt,
    }).catch(() => {})
  }

  // Agent başarıyla tamamlandı — aktif skill'lerin success skorunu artır (fire-and-forget)
  if (fullText && projectSkills.length > 0) {
    try { skillScoreStore.recordSuccess(workdir, projectSkills.map((s) => s.id)) } catch { /* optional */ }
  }

  // ─── Faz 3: Per-turn memory extraction ──────────────────────────────────────
  // Her turn sonunda memory extraction yap (fire-and-forget)
  // Compaction'dan daha sık çalışır, sadece son birkaç mesaja bakar
  if (fullText && messages.length >= 2) {
    extractPerTurnMemories(usedProviderName, usedModelId, messages, workdir).catch(() => metrics.recordError("memory_extract"))
  }

  return finish
}

function extractTokenBreakdown(
  u:    Record<string, unknown>,
  meta: Record<string, unknown> | undefined,
): TokenBreakdown {
  const am = (meta?.["anthropic"] ?? {}) as Record<string, unknown>

  const input  = Number(u["promptTokens"]     ?? u["inputTokens"]     ?? u["prompt_tokens"]      ?? 0)
  const output = Number(u["completionTokens"] ?? u["outputTokens"]    ?? u["completion_tokens"]   ?? 0)

  // Cache tokens — Anthropic native fields (via AI SDK providerMetadata)
  const cacheRead  = Number(am["cacheReadInputTokens"]      ?? u["cacheReadInputTokens"]       ?? 0)
  const cacheWrite = Number(am["cacheCreationInputTokens"]  ?? u["cacheCreationInputTokens"]   ?? 0)

  // Reasoning tokens — extended thinking (Anthropic, may come via usage or providerMetadata)
  const reasoning  = Number(am["reasoningOutputTokens"] ?? u["reasoningTokens"] ?? 0)

  return { input, output, cacheRead, cacheWrite, reasoning }
}

// 429 için basit retry — Retry-After header'ı yoksa 15s bekle, max 2 deneme
// NonRetryableStreamError: attempt sırasında tool call zaten çalıştı — asla retry etme
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof NonRetryableStreamError) throw err
      const msg = err instanceof Error ? err.message : String(err)
      const isRateLimit = /429|rate.?limit|too.many/i.test(msg)
      if (!isRateLimit || attempt >= maxRetries) throw err
      attempt++
      const waitMs = parseRetryAfter(msg) ?? 15_000
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
}

// Provider fallback ile retry — fallback aktifse provider değiştirir.
// fn provider ID string'i alır (plugin'i kendi çözer); NonRetryableStreamError
// providerFallback.execute içinde isFallbackTrigger tarafından asla trigger sayılmaz.
export async function withFallback<T>(
  primaryProvider: string,
  fn: (provider: string) => Promise<T>,
): Promise<{ result: T; provider: string; switchedFrom?: string }> {
  const { providerFallback } = await import("../provider/fallback.js")
  return providerFallback.execute(primaryProvider, async (plugin) => fn(plugin.id))
}

function parseRetryAfter(msg: string): number | undefined {
  const m = msg.match(/retry.{0,10}after[:\s]+(\d+)/i)
  return m ? Number(m[1]) * 1000 : undefined
}

export function parseProviderError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)

  // AI SDK APICallError: statusCode + url + responseBody taşır — "Bad Request"
  // gibi çıplak mesajlar yerine asıl nedeni göster.
  const api = err as { statusCode?: number; url?: string; responseBody?: unknown }
  const status = typeof api?.statusCode === "number" ? api.statusCode : undefined
  const body = typeof api?.responseBody === "string"
    ? api.responseBody.slice(0, 600)
    : api?.responseBody !== undefined ? JSON.stringify(api.responseBody).slice(0, 600) : ""
  const detail = [
    status !== undefined ? `HTTP ${status}` : null,
    api?.url ? `endpoint: ${api.url}` : null,
    body ? `response: ${body}` : null,
  ].filter(Boolean).join("\n")

  if (status === 400 || /\b400\b|bad request/i.test(raw)) {
    return [
      `Provider rejected the request (400 Bad Request).`,
      detail,
      `Common causes: model id not available on this provider (/models to pick from the live list), unsupported parameter, or tool/schema rejected by the model.`,
    ].filter(Boolean).join("\n")
  }
  if (status === 404 || /\b404\b|not found/i.test(raw))
    return [`Model or endpoint not found (404).`, detail, `Pick a model from /models — the id may be stale.`].filter(Boolean).join("\n")
  if (status === 401 || /\b401\b|unauthorized|invalid.{0,20}key/i.test(raw))
    return [`Invalid API key — update with /config set <provider> <key>`, detail].filter(Boolean).join("\n")
  if (status === 403 || /\b403\b|forbidden/i.test(raw))
    return [`Access forbidden (403) — key may lack access to this model.`, detail].filter(Boolean).join("\n")
  if (status === 429 || /\b429\b|rate.?limit|too.many/i.test(raw))
    return `Rate limited — wait a moment or switch provider (/providers)`
  if (/503|502|overload|unavailable/i.test(raw))
    return `Provider unavailable — try again or switch with /providers`
  if (/ECONNREFUSED|ENOTFOUND|network|timeout/i.test(raw))
    return `Network error — check your internet connection`
  return detail ? `${raw}\n${detail}` : raw
}
