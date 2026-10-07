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
// G-719(2026-10-03):会话水合读侧唯一入口(落库工具结果元数据的版本分账/剥后校验)。
import { hydrateToolStateMap } from './tool-part-hydration.js';

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

/**
 * 原样读盘:只做 parse + 最小校验,不走 G-719 水合。
 * 写侧必须用这个 —— 水合会改写 toolState 的落库形态,若让它渗进写回路,
 * 一次 patch 就会把"未声明列"顺手改掉(G-820:维护性写入只拥有自己的列)。
 */
function readStateFile(id: string): SessionState | null {
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

/**
 * G-820(2026-10-07):单调钟。写盘值恒取 max(文件现值, 来值)——
 * 路径自愈类写入带着早先读到的旧时刻,曾把并发刚推进的活动钟压回过去;
 * 而会话列表按 updatedAt 排序展示,钟倒退 = 最近会话错序。解析失败时:
 * 现值不可解析 ⇒ 用来值(顺手修复脏钟);来值不可解析 ⇒ 保现值(不让脏钟盖好钟)。
 */
function monotonicUpdatedAt(current: string | undefined, incoming: string): string {
  const inMs = Date.parse(incoming);
  if (current === undefined) return incoming; // 新建:文件尚无钟
  const curMs = Date.parse(current);
  if (Number.isNaN(curMs)) return incoming; // 现值是脏钟 ⇒ 用来值修复
  if (Number.isNaN(inMs)) return current; // 来值是脏钟 ⇒ 保现值
  return inMs >= curMs ? incoming : current;
}

export function saveSession(state: SessionState): void {
  pruneOnWrite();
  ensureStateDir();
  const p = getSessionStatePath(state.id);
  // G-820(2026-10-07):兼容入口不再裸 JSON.stringify 整份覆写。除钟外的列仍整份
  // 以调用方为准(58 个既有调用点的全快照语义不变),唯独 updatedAt 取
  // max(文件现值, 来值)—— 旧快照不得把并发已推进的活动钟压回过去。
  const current = readStateFile(state.id);
  const next: SessionState = {
    ...state,
    updatedAt: monotonicUpdatedAt(current?.updatedAt, state.updatedAt),
  };
  fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf-8');
}

/**
 * G-820(2026-10-07):维护性写入 —— 只合并 ownedFields 声明的列,时钟单调推进到
 * max(文件现值, now),未声明列一律不动(读侧加工不出现在写回路)。
 * id 是文件身份、updatedAt 归单调钟,都不归调用方所有。
 */
export type SessionOwnedFields = Partial<Omit<SessionState, 'id' | 'updatedAt'>>;

/**
 * G-820(2026-10-07)维护性写入入口。
 *
 * expected:乐观并发护栏(CAS)。介质是单文件 JSON、无锁单用户场景,取
 * "调用方最后一次 loadSession 观察到的 updatedAt" 作令牌最省 —— 单调钟即版本号:
 * 期间有他人写入 ⇒ 钟被推进 ⇒ 现值对不上 ⇒ 拒写。同毫秒双写是已知 1ms 窗口,
 * 列所有权本身已把不同列的并发写散开,这里只护同列竞态。
 *
 * 返回写入后的完整状态;目标会话不存在(不代建,建会话走 saveSession)或
 * expected 不匹配 ⇒ 返回 null 不落盘,由调用方决定重读重试。
 */
export function patchSession(
  id: string,
  ownedFields: SessionOwnedFields,
  expected?: string,
): SessionState | null {
  pruneOnWrite();
  const current = readStateFile(id);
  if (!current) return null;
  if (expected !== undefined && current.updatedAt !== expected) return null;
  const next: SessionState = {
    ...current,
    ...ownedFields,
    id: current.id,
    updatedAt: monotonicUpdatedAt(current.updatedAt, new Date().toISOString()),
  };
  fs.writeFileSync(getSessionStatePath(id), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function loadSession(id: string): SessionState | null {
  const parsed = readStateFile(id);
  if (!parsed) return null;
  // G-719:会话水合读侧唯一入口 —— toolState 里的落库工具结果元数据经
  // 版本分账/剥后校验;降级条目剥 display 保外层,整份会话照常读出。
  const { toolState, report } = hydrateToolStateMap(parsed.toolState);
  if (report.degraded > 0) {
    console.warn(
      `[session-state] ${parsed.id} toolState 水合降级 ${report.degraded} 条:` +
        report.degradedEntries.map((d) => `${d.key}(${d.reason})`).join(', '),
    );
  }
  if (parsed.toolState !== undefined) parsed.toolState = toolState;
  return parsed;
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
