import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FinanceCalculationEntry, FinanceCalculationResult, FinanceConversation, FinanceConversationMessage, FinanceMessageBlock, FinanceResearchAudit, FinanceResearchEntry } from '../shared/ipc-types.js';

type UserDataPath = () => string;

const CALCULATION_KINDS = new Set([
  'net_present_value',
  'internal_rate_of_return',
  'extended_internal_rate_of_return',
  'compound_annual_growth_rate',
  'discounted_cash_flow',
  'amortization_schedule',
  'fixed_coupon_bond_metrics',
  'fixed_coupon_bond_yield_shock',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isResearchEntry(value: unknown): value is FinanceResearchEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.question === 'string'
    && typeof value.createdAt === 'number'
    && (value.status === 'researching' || value.status === 'complete' || value.status === 'needs-review')
    && (value.dataAsOf === undefined || typeof value.dataAsOf === 'string')
    && (value.completedAt === undefined || typeof value.completedAt === 'number')
    && (value.audit === undefined || isResearchAudit(value.audit));
}

function isResearchAudit(value: unknown): value is FinanceResearchAudit {
  if (!isRecord(value) || typeof value.summary !== 'string' || !Array.isArray(value.sources) || !Array.isArray(value.assumptions) || !Array.isArray(value.uncertainties)) return false;
  if (value.dataAsOf !== undefined && typeof value.dataAsOf !== 'string') return false;
  if (value.warning !== undefined && typeof value.warning !== 'string') return false;
  return value.sources.every((source) => isRecord(source)
    && typeof source.title === 'string'
    && typeof source.url === 'string'
    && typeof source.accessedAt === 'string'
    && (source.publishedAt === undefined || typeof source.publishedAt === 'string'))
    && value.assumptions.every((item) => typeof item === 'string')
    && value.uncertainties.every((item) => typeof item === 'string');
}

function isMessageBlock(value: unknown): value is FinanceMessageBlock {
  if (!isRecord(value) || (value.type !== 'text' && value.type !== 'tool')) return false;
  if (value.type === 'text') return typeof value.content === 'string';
  return typeof value.id === 'string'
    && typeof value.tool === 'string'
    && typeof value.argsSummary === 'string'
    && typeof value.pending === 'boolean'
    && (value.result === undefined || typeof value.result === 'string')
    && (value.durationMs === undefined || typeof value.durationMs === 'number');
}

function isConversationMessage(value: unknown): value is FinanceConversationMessage {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.role === 'user' || value.role === 'assistant' || value.role === 'error')
    && typeof value.content === 'string'
    && typeof value.createdAt === 'number'
    && (value.blocks === undefined || (Array.isArray(value.blocks) && value.blocks.every(isMessageBlock)));
}

function isConversation(value: unknown): value is FinanceConversation {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.createdAt === 'number'
    && typeof value.updatedAt === 'number'
    && (value.status === 'active' || value.status === 'complete' || value.status === 'needs-review' || value.status === 'failed' || value.status === 'cancelled')
    && Array.isArray(value.messages)
    && value.messages.every(isConversationMessage)
    && (value.audit === undefined || isResearchAudit(value.audit))
    && (value.error === undefined || typeof value.error === 'string');
}

function isCalculationResult(value: unknown): value is FinanceCalculationResult {
  if (!isRecord(value) || typeof value.calculation !== 'string' || !CALCULATION_KINDS.has(value.calculation)) return false;
  if (typeof value.formulaVersion !== 'string' || typeof value.calculatedAt !== 'string' || !isRecord(value.precision)) return false;
  if (typeof value.precision.decimalPlaces !== 'number' || typeof value.precision.rounding !== 'string') return false;
  if (!isRecord(value.inputs) || !isRecord(value.outputs) || !Array.isArray(value.assumptions) || !Array.isArray(value.warnings)) return false;
  return value.assumptions.every((assumption) => typeof assumption === 'string')
    && value.warnings.every((warning) => isRecord(warning) && typeof warning.code === 'string' && typeof warning.message === 'string');
}

function isCalculationEntry(value: unknown): value is FinanceCalculationEntry {
  return isRecord(value) && typeof value.id === 'string' && typeof value.savedAt === 'number' && isCalculationResult(value.result);
}

function readEntries<T>(filePath: string, label: string, validate: (value: unknown) => value is T): T[] {
  if (!existsSync(filePath)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(parsed) || !parsed.every(validate)) throw new Error(`${label} is malformed`);
  return parsed;
}

function writeEntries<T>(filePath: string, entries: T[]): void {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(entries, null, 2), 'utf8');
  renameSync(temporaryPath, filePath);
}

export function createFinanceStore(userDataPath: UserDataPath) {
  const researchPath = () => path.join(userDataPath(), 'finance-research.json');
  const calculationsPath = () => path.join(userDataPath(), 'finance-calculations.json');
  const conversationsPath = () => path.join(userDataPath(), 'finance-conversations.json');

  const migrateResearch = (): FinanceConversation[] => {
    if (existsSync(conversationsPath())) return readEntries(conversationsPath(), 'finance conversations', isConversation);
    const legacy = readEntries(researchPath(), 'finance research history', isResearchEntry);
    if (legacy.length === 0) return [];
    const conversations = legacy.map((entry): FinanceConversation => ({
      id: entry.id,
      title: entry.question.slice(0, 80) || 'Imported research',
      createdAt: entry.createdAt,
      updatedAt: entry.completedAt ?? entry.createdAt,
      status: entry.status === 'researching' ? 'active' : entry.status,
      messages: [
        { id: `${entry.id}:question`, role: 'user', content: entry.question, createdAt: entry.createdAt },
        ...(entry.audit ? [{ id: `${entry.id}:summary`, role: 'assistant' as const, content: entry.audit.summary, createdAt: entry.completedAt ?? entry.createdAt }] : []),
      ],
      ...(entry.audit ? { audit: entry.audit } : {}),
    }));
    writeEntries(conversationsPath(), conversations);
    return conversations;
  };

  const updateConversation = (id: string, updater: (current: FinanceConversation) => FinanceConversation): FinanceConversation => {
    const entries = migrateResearch();
    const current = entries.find((entry) => entry.id === id);
    if (!current) throw new Error(`Finance conversation not found: ${id}`);
    const next = updater(current);
    writeEntries(conversationsPath(), entries.map((entry) => entry.id === id ? next : entry));
    return next;
  };

  return {
    listConversations(): FinanceConversation[] {
      return migrateResearch().sort((a, b) => b.updatedAt - a.updatedAt);
    },
    createConversation(): FinanceConversation {
      const now = Date.now();
      const entry: FinanceConversation = { id: randomUUID(), title: 'New finance research', createdAt: now, updatedAt: now, status: 'active', messages: [] };
      writeEntries(conversationsPath(), [entry, ...migrateResearch()]);
      return entry;
    },
    appendConversationMessage(id: string, message: FinanceConversationMessage): FinanceConversation {
      if (!isConversationMessage(message)) throw new Error('Cannot save malformed finance conversation message');
      return updateConversation(id, (current) => {
        const withoutError = { ...current };
        delete withoutError.error;
        return {
          ...withoutError,
          title: current.messages.length === 0 && message.role === 'user' ? message.content.trim().slice(0, 80) || current.title : current.title,
          status: 'active',
          messages: [...current.messages, message],
          updatedAt: Date.now(),
        };
      });
    },
    completeConversation(id: string, message: FinanceConversationMessage): FinanceConversation {
      if (!isConversationMessage(message) || message.role !== 'assistant') throw new Error('Finance completion must contain an assistant message');
      return updateConversation(id, (current) => ({
        ...current,
        status: current.audit?.warning ? 'needs-review' : 'complete',
        messages: [...current.messages, message],
        updatedAt: Date.now(),
      }));
    },
    failConversation(id: string, message: string, cancelled = false): FinanceConversation {
      const normalized = message.trim() || 'Finance research failed.';
      return updateConversation(id, (current) => ({
        ...current,
        status: cancelled ? 'cancelled' : 'failed',
        error: normalized,
        messages: [...current.messages, { id: randomUUID(), role: 'error', content: normalized, createdAt: Date.now() }],
        updatedAt: Date.now(),
      }));
    },
    removeConversation(id: string): boolean {
      const entries = migrateResearch();
      const next = entries.filter((entry) => entry.id !== id);
      if (next.length === entries.length) return false;
      writeEntries(conversationsPath(), next);
      return true;
    },
    listResearch(): FinanceResearchEntry[] {
      return readEntries(researchPath(), 'finance research history', isResearchEntry).sort((a, b) => b.createdAt - a.createdAt);
    },
    createResearch(question: string): FinanceResearchEntry {
      const normalized = question.trim();
      if (!normalized) throw new Error('Research question cannot be empty');
      const entry: FinanceResearchEntry = { id: randomUUID(), question: normalized, createdAt: Date.now(), status: 'researching' };
      writeEntries(researchPath(), [entry, ...this.listResearch()]);
      return entry;
    },
    recordResearchAudit(id: string, audit: FinanceResearchAudit): FinanceResearchEntry {
      if (!isResearchAudit(audit)) throw new Error('Cannot save malformed finance research audit');
      const entries = this.listResearch();
      const current = entries.find((entry) => entry.id === id);
      if (!current) throw new Error(`Finance research record not found: ${id}`);
      const entry: FinanceResearchEntry = {
        ...current,
        status: audit.warning ? 'needs-review' : 'complete',
        completedAt: Date.now(),
        ...(audit.dataAsOf ? { dataAsOf: audit.dataAsOf } : {}),
        audit,
      };
      writeEntries(researchPath(), entries.map((candidate) => candidate.id === id ? entry : candidate));
      return entry;
    },
    recordConversationAudit(id: string, audit: FinanceResearchAudit): FinanceConversation {
      if (!isResearchAudit(audit)) throw new Error('Cannot save malformed finance conversation audit');
      return updateConversation(id, (current) => ({
        ...current,
        status: audit.warning ? 'needs-review' : 'active',
        audit,
        updatedAt: Date.now(),
      }));
    },
    removeResearch(id: string): boolean {
      const entries = this.listResearch();
      const next = entries.filter((entry) => entry.id !== id);
      if (next.length === entries.length) return false;
      writeEntries(researchPath(), next);
      return true;
    },
    listCalculations(): FinanceCalculationEntry[] {
      return readEntries(calculationsPath(), 'finance calculation history', isCalculationEntry).sort((a, b) => b.savedAt - a.savedAt);
    },
    saveCalculation(result: FinanceCalculationResult): FinanceCalculationEntry {
      if (!isCalculationResult(result)) throw new Error('Cannot save malformed finance calculation result');
      const entry: FinanceCalculationEntry = { id: randomUUID(), savedAt: Date.now(), result };
      writeEntries(calculationsPath(), [entry, ...this.listCalculations()]);
      return entry;
    },
    removeCalculation(id: string): boolean {
      const entries = this.listCalculations();
      const next = entries.filter((entry) => entry.id !== id);
      if (next.length === entries.length) return false;
      writeEntries(calculationsPath(), next);
      return true;
    },
  };
}
