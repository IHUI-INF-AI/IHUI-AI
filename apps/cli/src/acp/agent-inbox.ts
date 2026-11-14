// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent Inbox — 跨重启的 agent 间消息持久投递。
 *
 * ## 为什么需要(对标 Qoder agent_inbox_items)
 *
 * Qoder 的多 agent 协作不靠内存消息总线,而靠一张 `agent_inbox_items` 持久表:
 * 成员间投递的消息先落库,Runtime 重启后按消费游标续读,不无界重放。
 * 我方 `commands/subagent-collab.ts` 的 CollaborationManager 用的是**内存 EventTarget
 * 总线 + 内存死信队列**(该文件头注自认"不持久化,不走网络")—— 跨重启即丢。
 *
 * 本模块把 inbox 做成独立持久层,复用 `acp/turn-store.ts` 的成熟模式:
 *   - `segmentFilePathInside` 路径安全(id 收敛成单段名 + 断言落在目录内)
 *   - `writeJsonAtomic` 原子写(临时文件 + rename,防半截 JSON)
 *   - 版本校验(版本不符 → 回落空态,不静默覆盖)
 *
 * ## 与 Qoder 逐项对标
 *
 *   Qoder agent_inbox_items              →  本模块
 *   ─────────────────────────────────────────────────────────
 *   delivery_mode(started/queued/steered) →  DeliveryMode 三态:queued(独立排队)/
 *                                           started(并入活跃回合)/steered(插话)
 *   scanned_event_seq(消费游标)          →  cursor 按成员持久化,重启续读不重放
 *   recovery_attempts(恢复预算)          →  恢复预算上限,超限判持久失败,防无界重试
 *   status(accepted/failed 终态)         →  status 含 failed 终态,保留历史输入与错误码
 *
 * ## 做减法(对齐本仓"不引入新依赖")
 *
 *   - 存储:每 scope 一个 JSON 文件(`~/.ihui/inbox/<scope>.json`),不引 SQLite
 *   - 消费游标与条目同文件持久化(单写者场景足够;跨进程并发由调用方保证单写者)
 *   - 不做网络投递:本模块只管"落库 + 游标续读",实际送达仍由上层 CollaborationManager
 *     的 EventTarget 总线执行 —— 本模块是它的**跨重启持久兜底**,不是替代
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { backoffDelayMs } from './backoff.js';

import { segmentFilePathInside } from '../util/path-guard.js';

/** 投递模式(对标 Qoder delivery_mode CHECK IN ('started','queued','steered'))。
 *
 * 为什么这三态:重启后要能区分"这条消息是独立排队等消费"还是"已并入某活跃回合"
 * 还是"作为插话注入"—— 三者的续投语义不同,不能混为一档。
 */
export type DeliveryMode = 'queued' | 'started' | 'steered';

/** 投递状态。failed 是终态(对标 Qoder"未知异常进入持久失败终态")。 */
export type InboxStatus = 'pending' | 'delivered' | 'failed';

/** 一条 inbox 投递条目。 */
export interface InboxItem {
  readonly id: string;
  /** 投递模式:queued 独立排队 / started 并入活跃回合 / steered 插话。 */
  readonly deliveryMode: DeliveryMode;
  /** 目标成员 id(对标 Qoder agent_profile_id / member_id)。 */
  readonly toMemberId: string;
  /** 来源成员 id(广播为 '*'。对标 Qoder 无此列,我方补齐溯源)。 */
  readonly fromMemberId: string;
  /** 关联 discussion/task id(可选,对标 Qoder discussion_id)。 */
  readonly discussionId?: string;
  /** 消息正文。 */
  readonly content: string;
  /** 单调递增事件序号(同 scope 内自增,消费游标据此续读)。 */
  readonly eventSeq: number;
  readonly status: InboxStatus;
  readonly createdAt: number;
  /** 送达时刻(仅 delivered/failed 有值)。 */
  readonly settledAt?: number;
  /** 失败错误码(仅 failed 有值,对标 Qoder reply_error_code)。 */
  readonly errorCode?: string;
}

/** 一个 scope 的 inbox 快照(条目 + 每成员消费游标)。 */
export interface InboxSnapshot {
  readonly scope: string;
  readonly items: readonly InboxItem[];
  /** 成员 id → 已消费到的最大 eventSeq(对标 Qoder scanned_event_seq)。 */
  readonly cursors: Readonly<Record<string, number>>;
  readonly updatedAt: number;
}

const INBOX_VERSION = 1;

/** 恢复预算上限:单条投递重试超过此数判持久失败(对标 Qoder recovery_attempts)。 */
export const MAX_RECOVERY_ATTEMPTS = 3;

interface InboxFile {
  version: number;
  scope: string;
  items: InboxItem[];
  cursors: Record<string, number>;
  updatedAt: number;
}

function inboxDir(): string {
  if (process.env.IHUI_CLI_INBOX_DIR) return process.env.IHUI_CLI_INBOX_DIR;
  return path.join(os.homedir(), '.ihui', 'inbox');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** 原子写(与 turn-store 同一处置:临时文件 + rename,防半截 JSON)。 */
function writeJsonAtomic(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    // 损坏不静默覆盖:返回 null 让调用方决定(与 turn-store 一致)。
    return null;
  }
}

/** 读一个 scope 的 inbox。文件不存在或损坏 → 空态(而非抛错),因为"没有投递"是合法初态。 */
export function loadInbox(scope: string): InboxSnapshot {
  const file = segmentFilePathInside(inboxDir(), scope, '.json', 'inbox 文件');
  const raw = readJson<InboxFile>(file);
  if (!raw || raw.version !== INBOX_VERSION || !Array.isArray(raw.items)) {
    return { scope, items: [], cursors: {}, updatedAt: 0 };
  }
  return {
    scope: raw.scope,
    items: raw.items,
    cursors: raw.cursors ?? {},
    updatedAt: raw.updatedAt,
  };
}

function saveInbox(snapshot: InboxSnapshot): void {
  const file = segmentFilePathInside(inboxDir(), snapshot.scope, '.json', 'inbox 文件');
  const payload: InboxFile = {
    version: INBOX_VERSION,
    scope: snapshot.scope,
    items: [...snapshot.items],
    cursors: { ...snapshot.cursors },
    updatedAt: Date.now(),
  };
  writeJsonAtomic(file, payload);
}

/**
 * 取该 scope 下一个可用的事件序号(1 基,取 max+1)。
 *
 * 必须同时越过**已有游标**:`compact` 会回收终态条目,若序号只按剩余条目算,
 * 回收后序号会回退到 1,而游标仍停在旧水位 —— 新条目会被 `pendingFor` 的
 * `eventSeq > cursor` 永久挡掉(投递不出去,也不会被 compact 回收)。
 */
export function nextEventSeq(scope: string): number {
  const inbox = loadInbox(scope);
  const maxItemSeq = inbox.items.reduce((n, it) => Math.max(n, it.eventSeq), 0);
  const maxCursor = Object.values(inbox.cursors).reduce((n, c) => Math.max(n, c), 0);
  return Math.max(maxItemSeq, maxCursor) + 1;
}

/**
 * 入队一条投递。status 初始 pending,deliveryMode 由调用方按语义选(默认 queued)。
 * eventSeq 未传时自动取 nextEventSeq(调用方批量入队可显式传以控序)。
 */
export function enqueue(params: {
  scope: string;
  id: string;
  toMemberId: string;
  fromMemberId: string;
  content: string;
  deliveryMode?: DeliveryMode;
  discussionId?: string;
  eventSeq?: number;
  at?: number;
}): { inbox: InboxSnapshot; item: InboxItem } {
  const inbox = loadInbox(params.scope);
  const at = params.at ?? Date.now();
  const item: InboxItem = {
    id: params.id,
    deliveryMode: params.deliveryMode ?? 'queued',
    toMemberId: params.toMemberId,
    fromMemberId: params.fromMemberId,
    ...(params.discussionId !== undefined ? { discussionId: params.discussionId } : {}),
    content: params.content,
    eventSeq: params.eventSeq ?? nextEventSeq(params.scope),
    status: 'pending',
    createdAt: at,
  };
  const next: InboxSnapshot = {
    ...inbox,
    items: [...inbox.items, item],
    updatedAt: at,
  };
  saveInbox(next);
  return { inbox: next, item };
}

/**
 * 取某成员的待投递条目(按 eventSeq 升序)。
 * 对标 Qoder"按成员消费游标续读":只返回 eventSeq > 该成员游标的 pending 条目。
 */
export function pendingFor(scope: string, memberId: string): InboxItem[] {
  const inbox = loadInbox(scope);
  const cursor = inbox.cursors[memberId] ?? 0;
  return inbox.items
    .filter((it) => it.toMemberId === memberId && it.status === 'pending' && it.eventSeq > cursor)
    .sort((a, b) => a.eventSeq - b.eventSeq);
}

/**
 * 标记一条投递为已送达,并推进该成员消费游标。
 *
 * 游标是**连续消费水位**,不是"见过的最大序号":若同成员还有更早的 pending
 * 条目(乱序送达/前一条投递失败),游标不能越过它 —— 否则 `pendingFor` 的
 * `eventSeq > cursor` 会把那条 pending 永久挡成不可见(重投也救不回来)。
 */
export function markDelivered(scope: string, itemId: string, at?: number): InboxSnapshot {
  const inbox = loadInbox(scope);
  const target = inbox.items.find((it) => it.id === itemId);
  if (!target) return inbox;
  const settledAt = at ?? Date.now();
  const items = inbox.items.map((it) =>
    it.id === itemId ? { ...it, status: 'delivered' as const, settledAt } : it,
  );
  const memberId = target.toMemberId;
  const prevCursor = inbox.cursors[memberId] ?? 0;
  const minPendingSeq = items.reduce(
    (min, it) =>
      it.toMemberId === memberId && it.status === 'pending' ? Math.min(min, it.eventSeq) : min,
    Number.POSITIVE_INFINITY,
  );
  // 无 pending ⇒ 水位可推到该成员已结算的最大序号;有 pending ⇒ 停在它前一位。
  const maxSettledSeq = items.reduce(
    (max, it) =>
      it.toMemberId === memberId && it.status !== 'pending' ? Math.max(max, it.eventSeq) : max,
    0,
  );
  const watermark = Number.isFinite(minPendingSeq)
    ? Math.min(target.eventSeq, minPendingSeq - 1)
    : maxSettledSeq;
  const cursors: Record<string, number> = {
    ...inbox.cursors,
    [memberId]: Math.max(prevCursor, watermark),
  };
  const next: InboxSnapshot = { ...inbox, items, cursors, updatedAt: settledAt };
  saveInbox(next);
  return next;
}

/**
 * 标记一条投递失败(终态)。对标 Qoder"未知异常进入持久失败终态;保留历史输入、
 * 回复请求、投递模式和来源时间"。带 errorCode 便于上层诊断。
 */
export function markFailed(
  scope: string,
  itemId: string,
  errorCode: string,
  at?: number,
): InboxSnapshot {
  const inbox = loadInbox(scope);
  const settledAt = at ?? Date.now();
  const items = inbox.items.map((it) =>
    it.id === itemId
      ? { ...it, status: 'failed' as const, settledAt, errorCode }
      : it,
  );
  const next: InboxSnapshot = { ...inbox, items, updatedAt: settledAt };
  saveInbox(next);
  return next;
}

/**
 * 恢复预算判定:某条投递还能不能重试。
 * 对标 Qoder recovery_attempts:"恢复预算与发送操作共存,避免重启后重新进入无界重放"。
 * 返回 { retryable, reason } —— retryable=false 时上层应 markFailed(不再重试)。
 *
 * 注意:本模块不自行计数重试(那是投递执行方的职责),只按 attempts 入参判预算。
 * 这样判据保持纯函数(可测),执行方在每次重试前问一次即可。
 */
export function recoveryBudget(attempts: number): {
  retryable: boolean;
  reason: string;
} {
  if (attempts < 0) {
    return { retryable: false, reason: `attempts 负数非法(${attempts}),判持久失败` };
  }
  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    return {
      retryable: false,
      reason: `恢复预算耗尽(${attempts}/${MAX_RECOVERY_ATTEMPTS}),判持久失败`,
    };
  }
  return { retryable: true, reason: `剩余预算 ${MAX_RECOVERY_ATTEMPTS - attempts}` };
}

/**
 * 重投计划:把恢复预算判定与 jitter 退避组合成一次"是否重试 + 何时重试"的决策。
 *
 * 对标 Qoder rc_vm_uploads:失败上传写 retry_at,按退避决定何时再试(防重试风暴)。
 * 我方 inbox 此前只有预算判定(recoveryBudget),缺"何时重试"的退避维度 —— 本函数补齐。
 *
 * 应用 acp/backoff.ts 的 full-jitter 退避:多个成员同时失败时,退避值被抖动打散,
 * 不会在同一毫秒集体重投(惊群)。复用 backoff.ts 单一真相源,不在本模块重算位移。
 *
 * @param attempts 已失败次数
 * @param now 当前时间戳(ms,默认 Date.now;测试可注入)
 * @returns { retry, delayMs, retryAt, reason } — retry=false 时 delayMs/retryAt 为 0
 */
export function retryPlanFor(
  attempts: number,
  now: number = Date.now(),
): {
  retry: boolean;
  delayMs: number;
  retryAt: number;
  reason: string;
} {
  const budget = recoveryBudget(attempts);
  if (!budget.retryable) {
    return { retry: false, delayMs: 0, retryAt: 0, reason: budget.reason };
  }
  const delayMs = backoffDelayMs(attempts);
  return {
    retry: true,
    delayMs,
    retryAt: now + delayMs,
    reason: `${budget.reason};退避 ${delayMs}ms 后重投(jitter 打散惊群)`,
  };
}

/** 列出所有 scope(便于启动时扫描跨重启未投递条目)。 */
export function listScopes(): string[] {
  const dir = inboxDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json') && !name.includes('.tmp-'))
    .map((name) => name.slice(0, -'.json'.length));
}

/** 清理全部终态(delivered/failed)条目,回收文件体积。
 *
 * 对标 Qoder"只保存清理所需的身份与资源引用,不保留已删除对象的正文"。
 * 返回回收的条目数。只清终态条目,不动 pending(清了就丢消息)。
 * 终态条目不会再被 `pendingFor` 返回,所以无需等游标覆盖即可回收;
 * 序号单调性由 `nextEventSeq` 越过游标保证。
 */
export function compact(scope: string): number {
  const inbox = loadInbox(scope);
  const before = inbox.items.length;
  // 只保留 pending(未投递);终态条目回收。
  const pending = inbox.items.filter((it) => it.status === 'pending');
  if (pending.length === before) return 0; // 无终态条目可回收
  const next: InboxSnapshot = { ...inbox, items: pending, updatedAt: Date.now() };
  saveInbox(next);
  return before - pending.length;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
