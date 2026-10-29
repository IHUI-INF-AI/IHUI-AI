// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-241 结算状态机（认领 / 退避 / 终态）—— 纯函数服务层。
 *
 * 设计定位:本文件是结算状态机的**唯一真相源**(§0.6),与
 * `packages/database/src/schema/user-automations.ts` 里的
 * `AUTOMATION_TERMINAL_REASONS`(终态成因封闭集)同包同源,避免词表住第二处。
 * 服务层不碰 DB、不做 I/O,只做状态枚举 / 合法转移 / 退避计算 —— 故单测可纯函数覆盖,
 * 调度器 `apps/api/src/services/agent-automation-scheduler.ts` 与 routes 共用同一份判据。
 *
 * 四大状态(SETTLEMENT_STATES,封闭集):
 *   pending_claim 待认领 —— 已到点且未被任何执行体认领(claim_token IS NULL)。
 *   processing    处理中 —— 被某执行体行级 CAS 认领(claim_token 非空、租约有效)。
 *   backing_off   退避   —— transient 失败后进重试队列(attempt>0,等 next_run_at)。
 *   terminal      终态   —— 结算到不可逆档(terminal_reason 非空),吸收态,FSM 内不可再出。
 *
 * 持久化映射(见 20261027120000_automation_settlement_state_machine.sql):
 *   状态字段   settlement_status(varchar24)            —— 本迁移新增
 *   退避计数   attempt(已存,G-669)
 *   时间戳     claimed_at / next_run_at / last_run_at(已存,G-241/G-669)
 *            + settlement_terminal_at(本迁移新增:到达终态的时刻)
 */

import type { UserAutomation } from './schema/user-automations.js'

/** 结算状态机四大状态的封闭集。字面量联合,TS/zod 直接复用,不另起枚举。 */
export const SETTLEMENT_STATES = ['pending_claim', 'processing', 'backing_off', 'terminal'] as const

export type SettlementState = (typeof SETTLEMENT_STATES)[number]

/**
 * 合法转移表(邻接表)。终态是吸收态 —— terminal 的出边为空,
 * 任何"从终态再走一步"的尝试都被 canTransition 判为非法(显式人工重激活超出 FSM 范畴)。
 */
export const SETTLEMENT_TRANSITIONS: Record<SettlementState, readonly SettlementState[]> = {
  pending_claim: ['processing', 'terminal'],
  processing: ['backing_off', 'terminal'],
  backing_off: ['processing', 'terminal'],
  terminal: [],
}

/** 返回某状态的所有合法后继状态(终态返回空数组)。 */
export function nextStates(from: SettlementState): readonly SettlementState[] {
  return SETTLEMENT_TRANSITIONS[from]
}

/** 判某次状态转移是否合法(FSM 守门)。纯函数。 */
export function canTransition(from: SettlementState, to: SettlementState): boolean {
  if (!SETTLEMENT_STATES.includes(from) || !SETTLEMENT_STATES.includes(to)) return false
  return SETTLEMENT_TRANSITIONS[from].includes(to)
}

/**
 * 退避策略。
 * - exponential:delay = min(baseMs * factor^(attempt-1), maxMs)
 * - fixed:每次恒定 baseMs(同样被 maxMs 截断)
 * attempt<=0 视为"无需退避",返回 0。
 */
export type BackoffStrategy = 'exponential' | 'fixed'

export interface BackoffOptions {
  strategy?: BackoffStrategy
  /** 首次退避基准毫秒(默认 30_000 = 30s) */
  baseMs?: number
  /** 指数增长因子(默认 2) */
  factor?: number
  /** 退避上限毫秒(默认 3_600_000 = 1h),防无限膨胀 */
  maxMs?: number
}

/** 计算退避延迟(毫秒)。纯函数,无随机抖动,便于边界单测。 */
export function computeBackoffDelay(attempt: number, opts: BackoffOptions = {}): number {
  const { strategy = 'exponential', baseMs = 30_000, factor = 2, maxMs = 3_600_000 } = opts
  if (!Number.isFinite(attempt) || attempt <= 0) return 0
  const cappedBase = Math.max(0, Math.min(baseMs, maxMs))
  if (strategy === 'fixed') return cappedBase
  const raw = cappedBase * Math.pow(factor, attempt - 1)
  return Math.min(raw, maxMs)
}

/**
 * 由退避延迟推算下次排程时刻(写 next_run_at 用)。纯函数,需传入 now 以便测试。
 * attempt<=0 返回 now 本身(不延时)。
 */
export function computeNextRunAt(attempt: number, now: Date, opts?: BackoffOptions): Date {
  const delay = computeBackoffDelay(attempt, opts)
  return new Date(now.getTime() + delay)
}

/**
 * 从 user_automations 一行(已落库字段)派生当前结算 FSM 状态。纯函数,不查 DB。
 *
 * 判定优先级(终态最高,认领次之,退避再次,其余归待认领):
 *   1. terminal_reason 非空            → terminal
 *   2. claim_token 非空(被认领)        → processing
 *   3. attempt > 0(在重试队列)         → backing_off
 *   4. 其余                            → pending_claim
 *
 * 注:认领租约超龄的接管在调度器 CAS 逻辑里(见 G-241 migration 注释),不在本纯派生函数内;
 * 派生只看持久化标志。
 */
export function deriveSettlementStatus(
  row: Pick<UserAutomation, 'claimToken' | 'attempt' | 'terminalReason'>,
): SettlementState {
  // 空串与 null/undefined 同视为"无值":(x ?? '') !== '' 与 x != null && x !== '' 等价,
  // 但不用 != 以免触 eqeqeq(本包 lint 面要求 ===/!==)。
  if ((row.terminalReason ?? '') !== '') return 'terminal'
  if ((row.claimToken ?? '') !== '') return 'processing'
  if (typeof row.attempt === 'number' && row.attempt > 0) return 'backing_off'
  return 'pending_claim'
}
