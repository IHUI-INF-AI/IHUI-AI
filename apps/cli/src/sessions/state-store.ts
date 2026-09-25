// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主会话 Session 持久化 — 把 REPL/Agent 主会话状态写到 ~/.ihui/sessions/<id>.json,
 * 供跨进程恢复使用(参考行业 Agent 框架的 Sessions 持久化机制)。
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
/** 写前裁剪的最小间隔:长会话高频 saveSession 不至于每写都全目录扫描删除 */
const PRUNE_MIN_INTERVAL_MS = 60 * 1000;
/** 显式关闭保留裁剪的环境开关(测试隔离/人工排障用;默认不禁用) */
const PRUNE_DISABLED_ENV = 'IHUI_SESSION_PRUNE_DISABLED';
/** 下一次允许裁剪的时间点(模块级节流,同进程内生效) */
let nextPruneAtMs = 0;

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

/**
 * 写前保留裁剪(2026-09-26 接线)。
 *
 * 在修什么:`DEFAULT_MAX_AGE_MS`(7 天保留策略)与 `pruneOldSessions()` 此前是全仓
 * 零非测试调用方的"已声明、从未执行"策略(实测,见第八批 8F 取证 A8F-6)。
 * 修法取 (a) 挂真实生命周期点:saveSession 是本模块唯一的写入口(REPL/acp/server
 * 三条路径最终都经它),在其前触发一次按节流的裁剪 ⇒ 策略随每次存档被动执行,
 * 不需要新增常驻定时器(那会成为下一个"可能没人跑的 timer"型缺陷)。
 * 清理失败不得把一次成功的保存变成失败:保留策略是尽力而为的后台动作,
 * 方向恒为"宁可不删,绝不错删/绝不误伤存储"。
 */
function pruneOnWrite(): void {
  if (process.env[PRUNE_DISABLED_ENV] === '1') return;
  const now = Date.now();
  if (now < nextPruneAtMs) return;
  nextPruneAtMs = now + PRUNE_MIN_INTERVAL_MS;
  try {
    pruneOldSessions();
  } catch {
    // 见上:裁剪异常不冒泡进保存路径(只放弃本轮裁剪)
  }
}

export function saveSession(state: SessionState): void {
  pruneOnWrite();
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
