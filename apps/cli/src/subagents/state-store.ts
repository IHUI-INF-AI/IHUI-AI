/**
 * Subagent 状态持久化 — 把 subagent 运行状态写到 ~/.ihui/subagents/<id>.json,
 * 供 resumeFrom 断点续跑使用(对齐 AGENTS.md 第 12 节 subagent git 隔离规则)。
 *
 * 做减法:
 *   - 文件即数据库,JSON 直读直写,无锁(单用户场景足够)
 *   - 接口最小化:save/load/list/delete/prune
 *   - 状态机 4 态:running / completed / failed / cancelled
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

export interface SubagentState {
  id: string;
  parentId: string;
  persona: string;
  capabilityMode: string;
  isolation: string;
  worktreePath?: string;
  transcript: unknown[];
  toolState?: Record<string, unknown>;
  model?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  error?: string;
}

const STATE_DIR_ENV = 'IHUI_SUBAGENT_STATE_DIR';

export function getSubagentStateDir(): string {
  if (process.env[STATE_DIR_ENV]) return process.env[STATE_DIR_ENV]!;
  return path.join(os.homedir(), '.ihui', 'subagents');
}

export function getSubagentStatePath(id: string): string {
  return path.join(getSubagentStateDir(), `${id}.json`);
}

function ensureStateDir(): void {
  fs.mkdirSync(getSubagentStateDir(), { recursive: true });
}

export function newSubagentId(): string {
  return randomUUID();
}

export function saveSubagentState(state: SubagentState): void {
  ensureStateDir();
  const p = getSubagentStatePath(state.id);
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

export function loadSubagentState(id: string): SubagentState | null {
  const p = getSubagentStatePath(id);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as SubagentState;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function listSubagentStates(parentId?: string): SubagentState[] {
  const dir = getSubagentStateDir();
  if (!fs.existsSync(dir)) return [];
  const out: SubagentState[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    const s = loadSubagentState(id);
    if (!s) continue;
    if (parentId && s.parentId !== parentId) continue;
    out.push(s);
  }
  return out;
}

export function deleteSubagentState(id: string): boolean {
  const p = getSubagentStatePath(id);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

export function pruneOldSubagentStates(maxAgeMs: number): number {
  const dir = getSubagentStateDir();
  if (!fs.existsSync(dir)) return 0;
  const now = Date.now();
  let removed = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    const s = loadSubagentState(id);
    if (!s) continue;
    const startedAtMs = Date.parse(s.startedAt);
    if (Number.isNaN(startedAtMs)) continue;
    if (now - startedAtMs > maxAgeMs) {
      if (deleteSubagentState(id)) removed++;
    }
  }
  return removed;
}
