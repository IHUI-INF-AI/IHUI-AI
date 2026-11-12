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
// 会话 id 路径穿越修复:会话 id 来自 `--resume`/ACP,不可信 —— 目录段收敛复用产物层唯一实现。
import { sanitizeSessionSegment } from '../tools/result-envelope/artifact-store.js';
// BUG-0010:会话状态落盘统一走唯一原子写出口(tmp+fsync+rename;Windows EPERM 有界重试)。
import { writeFileAtomicSync } from '../util/atomic-write.js';

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
  // id 一律先收敛成单段文件名:含 `../`、绝对路径、盘符的 id 不得改变落点。
  // 合法 UUID/短 id 不受影响(sanitizeSessionSegment 对白名单字符原样返回)。
  return path.join(getSessionStateDir(), `${sanitizeSessionSegment(id)}.json`);
}

function ensureStateDir(): void {
  // F-005:会话目录含完整对话/工具入参,默认 0755 可被同机他用户遍历 ⇒ 0700。
  fs.mkdirSync(getSessionStateDir(), { recursive: true, mode: 0o700 });
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
export function sessionPathKind(
  target: string,
  stat: (file: string) => unknown = fs.statSync,
): { kind: 'present' } | { kind: 'missing' } | { kind: 'unread'; code: string } {
  try {
    stat(target);
    return { kind: 'present' };
  } catch (error) {
    const code = sessionReadCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'missing' };
    return { kind: 'unread', code };
  }
}

function sessionReadCode(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return 'unknown';
}

function sessionFileBlocksReplace(id: string): boolean {
  const target = getSessionStatePath(id);
  let raw: string;
  try {
    raw = fs.readFileSync(target, 'utf-8');
  } catch (error) {
    const code = sessionReadCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw new Error(`会话读不到,不能把它覆盖成新会话 (${code})`);
  }
  if (raw.trim() === '') return false;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown } | null;
    return !parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.id !== 'string';
  } catch {
    return true;
  }
}

/**
 * F-031(2026-11-12):会话读盘三态 —— 把"文件损坏/解析失败(corrupt)"与
 * "根本没有这场会话(missing)"分开。修前两者都塌成 null,resume 只能说
 * "不存在",列表也静默 continue(无 warn、无证据、无自愈)。
 */
export type SessionLoadResult =
  | { kind: 'ok'; session: SessionState }
  | { kind: 'missing'; id: string; path: string }
  | { kind: 'corrupt'; id: string; path: string; reason: string; message: string };

/** 隔离件命名: `<原文件名>.corrupt-<ts>.json` */
const CORRUPT_QUARANTINE_SUFFIX = '.corrupt-';
const CORRUPT_QUARANTINE_RE = /\.corrupt-\d+(?:-\d+)?\.json$/;

function readStateFileResult(id: string): SessionLoadResult {
  const p = getSessionStatePath(id);
  let raw: string;
  try {
    raw = fs.readFileSync(p, 'utf-8');
  } catch (error) {
    const code = sessionReadCode(error);
    // 读错误与"文件不存在"仍然分开:读不到 ≠ 没有(既有口径不变)。
    if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'missing', id, path: p };
    throw new Error(`会话读不到,不能把它当成没有这场会话 (${code})`);
  }
  const corrupt = (reason: string): SessionLoadResult => ({
    kind: 'corrupt',
    id,
    path: p,
    reason,
    message: `会话文件已损坏,与"不存在"不同:${p}(${reason})`,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return corrupt(`JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return corrupt('内容不是 JSON 对象');
  }
  const state = parsed as SessionState;
  if (typeof state.id !== 'string') return corrupt('缺少字符串 id 字段');
  return { kind: 'ok', session: state };
}

/**
 * F-031:隔离损坏会话文件 —— 只改名(不删除、不截断),原字节原样保留;
 * 正常会话文件不受影响;改名失败则保留原文件并返回 null(宁可不隔离,绝不误删)。
 */
function quarantineCorruptSessionFile(filePath: string): string | null {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, '.json');
  const ts = Date.now();
  for (let attempt = 0; attempt < 100; attempt++) {
    const seq = attempt === 0 ? '' : `-${attempt}`;
    const target = path.join(dir, `${base}${CORRUPT_QUARANTINE_SUFFIX}${ts}${seq}.json`);
    if (fs.existsSync(target)) continue;
    try {
      fs.renameSync(filePath, target);
      return target;
    } catch {
      return null;
    }
  }
  return null;
}

/** 原样读盘(不水合):非 ok 一律 null —— 写回路与旧契约调用点用。 */
function readStateFile(id: string): SessionState | null {
  const result = readStateFileResult(id);
  return result.kind === 'ok' ? result.session : null;
}

function hydrateSessionState(parsed: SessionState): SessionState {
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
  if (current === null && sessionFileBlocksReplace(state.id)) {
    throw new Error('会话读不到,不能把它覆盖成新会话 (corrupt)');
  }
  const next: SessionState = {
    ...state,
    updatedAt: monotonicUpdatedAt(current?.updatedAt, state.updatedAt),
  };
  writeFileAtomicSync(p, JSON.stringify(next, null, 2), { mode: 0o600 });
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
  writeFileAtomicSync(getSessionStatePath(id), JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

/**
 * F-031:resume 专用读入口 —— 三态返回,损坏给"损坏"文案而不是"不存在"。
 * 兼容入口 `loadSession` 的返回类型与语义保持不变(损坏仍返回 null),
 * 既有依赖 null 的调用点(ACP/REPL/prune/http 等)行为不变。
 */
export function loadSessionForResume(id: string): SessionLoadResult {
  const result = readStateFileResult(id);
  if (result.kind !== 'ok') return result;
  return { kind: 'ok', session: hydrateSessionState(result.session) };
}

export function loadSession(id: string): SessionState | null {
  const result = readStateFileResult(id);
  if (result.kind === 'missing') return null;
  if (result.kind === 'corrupt') {
    // F-031:至少留一条可诊断证据(修前是无声的 return null)。
    console.warn(`[session-state] ${result.message};按"不存在"返回 null(旧契约不变)`);
    return null;
  }
  return hydrateSessionState(result.session);
}

export function listSessions(stat?: (file: string) => unknown): SessionSummary[] {
  const dir = getSessionStateDir();
  const kind = sessionPathKind(dir, stat);
  if (kind.kind === 'missing') return [];
  if (kind.kind === 'unread') {
    throw new Error(`会话目录读不到,不能把它说成没有会话 (${kind.code})`);
  }
  const out: SessionSummary[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    // F-031:已隔离的损坏件既不是会话,也不再二次改名(避免链式 .corrupt-x.corrupt-y)。
    if (CORRUPT_QUARANTINE_RE.test(entry)) continue;
    const id = entry.slice(0, -'.json'.length);
    const result = readStateFileResult(id);
    if (result.kind === 'missing') continue;
    if (result.kind === 'corrupt') {
      // F-031:列表点名 + 隔离,不再静默 continue。
      const quarantined = quarantineCorruptSessionFile(result.path);
      console.warn(
        `[session-state] 会话列表跳过损坏文件 ${path.basename(result.path)}(${result.reason});` +
          (quarantined
            ? `已隔离为 ${path.basename(quarantined)}`
            : '隔离失败,原损坏文件原样保留'),
      );
      continue;
    }
    const s = result.session;
    out.push({
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      status: s.status,
    });
  }
  return out;
}

export function deleteSession(id: string, stat?: (file: string) => unknown): boolean {
  const p = getSessionStatePath(id);
  const kind = sessionPathKind(p, stat);
  if (kind.kind === 'unread') {
    throw new Error(`会话读不到,不能把它说成已删除 (${kind.code})`);
  }
  if (kind.kind === 'missing') return false;
  fs.unlinkSync(p);
  return true;
}

export function pruneOldSessions(
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
  stat?: (file: string) => unknown,
): number {
  const dir = getSessionStateDir();
  const kind = sessionPathKind(dir, stat);
  if (kind.kind === 'missing') return 0;
  if (kind.kind === 'unread') {
    throw new Error(`会话目录读不到,不能把它说成没有可清理的会话 (${kind.code})`);
  }
  const now = Date.now();
  let removed = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    // F-031:隔离件不是会话,不参与保留裁剪。
    if (CORRUPT_QUARANTINE_RE.test(entry)) continue;
    const id = entry.slice(0, -'.json'.length);
    const result = readStateFileResult(id);
    if (result.kind !== 'ok') continue;
    const s = result.session;
    const updatedAtMs = Date.parse(s.updatedAt);
    if (Number.isNaN(updatedAtMs)) continue;
    if (now - updatedAtMs > maxAgeMs) {
      if (deleteSession(id)) removed++;
    }
  }
  return removed;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
