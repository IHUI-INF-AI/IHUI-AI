/**
 * 主会话 Session 持久化 — 把 REPL/Agent 主会话状态写到 ~/.ihui/sessions/<id>.json,
 * 供跨进程恢复使用(对齐 grok-build Sessions 持久化机制)。
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
import type { SessionState, SessionSummary } from './types.js';

const STATE_DIR_ENV = 'IHUI_SESSION_STATE_DIR';
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionStateDir(): string {
  if (process.env[STATE_DIR_ENV]) return process.env[STATE_DIR_ENV]!;
  return path.join(os.homedir(), '.ihui', 'sessions');
}

export function getSessionStatePath(id: string): string {
  return path.join(getSessionStateDir(), `${id}.json`);
}

function ensureStateDir(): void {
  fs.mkdirSync(getSessionStateDir(), { recursive: true });
}

export function newSessionId(): string {
  return randomUUID();
}

export function saveSession(state: SessionState): void {
  ensureStateDir();
  const p = getSessionStatePath(state.id);
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

export function loadSession(id: string): SessionState | null {
  const p = getSessionStatePath(id);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function listSessions(): SessionSummary[] {
  const dir = getSessionStateDir();
  if (!fs.existsSync(dir)) return [];
  const out: SessionSummary[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    const s = loadSession(id);
    if (!s) continue;
    out.push({
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      status: s.status,
    });
  }
  return out;
}

export function deleteSession(id: string): boolean {
  const p = getSessionStatePath(id);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

export function pruneOldSessions(maxAgeMs: number = DEFAULT_MAX_AGE_MS): number {
  const dir = getSessionStateDir();
  if (!fs.existsSync(dir)) return 0;
  const now = Date.now();
  let removed = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    const s = loadSession(id);
    if (!s) continue;
    const updatedAtMs = Date.parse(s.updatedAt);
    if (Number.isNaN(updatedAtMs)) continue;
    if (now - updatedAtMs > maxAgeMs) {
      if (deleteSession(id)) removed++;
    }
  }
  return removed;
}
