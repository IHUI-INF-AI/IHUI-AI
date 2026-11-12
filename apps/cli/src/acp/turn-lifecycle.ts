// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回合运行态状态机(长任务闭环的执行侧)。
 *
 * ## 为什么需要这一层
 *
 * 仓内已有的是**消息历史态**:
 *   · `packages/shared/src/chat/history-projection.ts` —— turn 分页/游标/合并;
 *   · `packages/shared/src/chat/artifact-turn.ts` —— 产物归属 turn 派生;
 *   · `packages/database` 的 `chat_messages.turn_ordinal` —— turn 级语义断点。
 *
 * 但一次回合**正在发生**的时候,没有任何对象记录它此刻在做什么。表现是三处真实缺口:
 *   1. 回合被中断(进程退出/连接断开)后,重连只能看到"消息到哪了",
 *      不知道"这一回合原本要做什么、做到哪一步";
 *   2. 没有"我暂时做不完,挂起等条件满足再继续"的表达 —— 只能整段结束;
 *   3. 上游没有给出结束信号时(流被掐断),历史里留下半截消息,
 *      分不清"正常结束"与"异常中断"。
 *
 * 本模块补的正是这三处。它是**纯状态机 + 纯函数**,零 IO、零平台 API,
 * 因此 CLI / web / api 都能复用同一份判据(AGENTS §3 共享层优先)。
 *
 * ## 与 Trae harness 的对照(取证见 `outputs/reverse-2026-11-12/TRAE-BINARY-REPORT.md`)
 *
 * 对方 `harness/core/src/v4/runner` 的目录结构给了三处直接可借的设计:
 *   · `agent/llm/consuming/` 与 `committing/` **两阶段分离**,提交前有 `pre_commit`;
 *   · `turn/driver/` 下有 `reentry`(重入)、`stop`、`synthetic_finish`(合成结束);
 *   · `session/finalizer` —— 会话有独立终结器。
 *
 * 本模块把这三处落成显式状态与显式迁移,而不是散在各调用点里用 if 猜。
 * 差异(我方更严的一处):对方的 `synthetic_finish` 只表达"这是合成的结束",
 * 本模块额外要求合成结束**必须携带原因**(`reason`),否则拒绝 —— 因为
 * "不知道为什么结束"与"没结束"对上层是同一件事,不允许混淆。
 */

/** 回合运行态。取值两两互斥,无交集。 */
import { nextCronAt } from './cron.js';

export type TurnPhase =
  /** 已创建,正在准备上下文/附件,尚未开始消费模型输出。 */
  | 'prepare'
  /** 正在消费模型流式输出。 */
  | 'consuming'
  /** 输出已收齐,正在提交(落库/写产物/结算),此阶段不可再追加内容。 */
  | 'committing'
  /** 已挂起:等外部条件(用户输入/审批/定时/依赖完成),可被唤醒回到 consuming。 */
  | 'parked'
  /** 已正常完成。终态。 */
  | 'completed'
  /** 已失败。终态。 */
  | 'failed'
  /** 已取消。终态。 */
  | 'cancelled'

/** 终态集合:进入后不再迁移(除非显式 fork 成新回合)。 */
export const TERMINAL_PHASES: readonly TurnPhase[] = ['completed', 'failed', 'cancelled'];

export function isTerminalPhase(phase: TurnPhase): boolean {
  return TERMINAL_PHASES.includes(phase);
}

/** 挂起原因。分类而非自由文本 —— 上层要据此决定谁来唤醒。 */
export type ParkReason =
  /** 等用户回答(ask_user_question 之类)。 */
  | 'awaiting-user'
  /** 等审批(危险工具确认)。 */
  | 'awaiting-approval'
  /** 等外部依赖(子任务/后台任务)。 */
  | 'awaiting-dependency'
  /** 等时间(定时重试/退避)。 */
  | 'awaiting-timer'

/** 挂起时的唤醒条件。`at` 用毫秒时间戳,不用 Date —— 便于序列化与比较。 */
export interface WakeCondition {
  readonly reason: ParkReason;
  /**
   * 最早可唤醒时刻(ms)。`undefined` = 不按时间,只按事件唤醒。
   * 有值时表示"到点即可重试";无值时必须由外部显式 wake。
   */
  readonly notBefore?: number;
  /**
   * 周期唤醒的 cron 表达式(5 段),2026-11-12 加。
   *
   * 与 `notBefore` 的分工:
   *   · `notBefore` = 一次性到点;
   *   · `cron`      = 周期到点(如"每 30 分钟重试一次")。
   * 两者同时给时**以 cron 为准**(它表达了"每次触发后还要再排下一次")。
   *
   * 注意:本字段只表达"什么时候该醒",**不负责触发** —— 触发面由持有生命周期的
   * 宿主提供(编辑器轮询 `x.ai/turn/parked`,或未来的常驻服务)。
   * CLI 是短生命周期进程,自己不响闹钟。
   */
  readonly cron?: string;
  /** 唤醒后要做什么的说明(给上层/给人看),不参与判定。 */
  readonly note?: string;
}

/**
 * 回合记录。这是**运行态**,与消息历史分开存:
 * 历史是 append-only 的事实,运行态是可被覆盖的当前状态。
 * 混在一起会让"重放历史"变成"重放每次状态变更",既冗余又易错。
 */
export interface TurnRecord {
  /** 回合标识。与消息历史的 turnOrdinal 不同:ordinal 是序号,id 是身份。 */
  readonly id: string;
  readonly sessionId: string;
  /** 会话内的 1 基序号;与历史侧 turn_ordinal 对齐,便于两边对照。 */
  readonly ordinal: number;
  readonly phase: TurnPhase;
  /** 创建时刻(ms)。 */
  readonly createdAt: number;
  /** 最后一次状态变更时刻(ms)。 */
  readonly updatedAt: number;
  /** 仅 parked 阶段有值。 */
  readonly wake?: WakeCondition;
  /** 仅 completed/failed 有值:结束原因。合成结束必须给。 */
  readonly endReason?: TurnEndReason;
  /** 已重入次数。用于识别"反复失败又反复重试"的病态回合。 */
  readonly reentries: number;
}

/**
 * 回合结束原因。`synthetic` = 上游没给正常结束信号,由本地合成收尾。
 * 这一档必须带 `detail`,否则无法与"正常结束"区分。
 */
export type TurnEndReason =
  | { readonly kind: 'normal'; readonly detail?: string }
  | { readonly kind: 'synthetic'; readonly detail: string }
  | { readonly kind: 'error'; readonly detail: string }
  | { readonly kind: 'cancelled'; readonly detail?: string }

/** 迁移请求。判别式联合,非法组合在类型层就不可构造。 */
export type TurnTransition =
  /** prepare → consuming:上下文就绪。 */
  | { readonly type: 'begin-consuming'; readonly at: number }
  /** consuming → committing:输出收齐。 */
  | { readonly type: 'begin-committing'; readonly at: number }
  /** committing → completed:提交成功。 */
  | { readonly type: 'complete'; readonly at: number; readonly reason?: TurnEndReason }
  /** 任意非终态 → parked:挂起。 */
  | { readonly type: 'park'; readonly at: number; readonly wake: WakeCondition }
  /** parked → consuming:被唤醒。 */
  | { readonly type: 'wake'; readonly at: number }
  /** 任意非终态 → failed。 */
  | { readonly type: 'fail'; readonly at: number; readonly reason: TurnEndReason }
  /** 任意非终态 → cancelled。 */
  | { readonly type: 'cancel'; readonly at: number; readonly reason?: TurnEndReason }
  /**
   * 合成结束:上游没给结束信号时,由本地把回合收成 completed。
   * 与 `complete` 分开,是因为它**必须**带原因 —— 否则调用方可以伪装成正常结束。
   */
  | { readonly type: 'synthetic-finish'; readonly at: number; readonly detail: string }

/** 迁移结果。失败不抛异常,而是回结构化拒绝 —— 调用方要能区分并做不同处置。 */
export type TurnTransitionResult =
  | { readonly ok: true; readonly next: TurnRecord }
  | { readonly ok: false; readonly code: TurnRejectionCode; readonly message: string };

export type TurnRejectionCode =
  /** 已经是终态,不接受任何迁移。 */
  | 'terminal'
  /** 该迁移不适用于当前阶段。 */
  | 'illegal-phase'
  /** 时间倒流(迁移时刻早于记录的最后更新时刻)。 */
  | 'time-travel'
  /** 合成结束缺原因。 */
  | 'missing-synthetic-reason'

const reject = (code: TurnRejectionCode, message: string): TurnTransitionResult => ({
  ok: false,
  code,
  message,
});

/** 允许 `park` 的来源阶段。终态不可挂起;已挂起不可再挂起。 */
const PARKABLE: readonly TurnPhase[] = ['prepare', 'consuming', 'committing'];

/**
 * 应用一次迁移,返回新记录(不可变)。
 *
 * 三条硬判据(都是踩过的坑,不是防御性编程):
 *   · 终态不可迁移 —— 否则"已取消的回合又被完成"会让结算重复;
 *   · 时间不可倒流 —— 否则按时间排序的回放会把状态拧乱;
 *   · 合成结束必须带原因 —— 否则无法与正常结束区分。
 */
export function applyTurnTransition(
  record: TurnRecord,
  transition: TurnTransition,
): TurnTransitionResult {
  if (isTerminalPhase(record.phase)) {
    return reject('terminal', `回合 ${record.id} 已处于终态 ${record.phase},不接受 ${transition.type}`);
  }
  if (transition.at < record.updatedAt) {
    return reject(
      'time-travel',
      `迁移时刻 ${transition.at} 早于记录最后更新时刻 ${record.updatedAt}`,
    );
  }

  const base = { ...record, updatedAt: transition.at };

  switch (transition.type) {
    case 'begin-consuming': {
      if (record.phase !== 'prepare') {
        return reject('illegal-phase', `${record.phase} → consuming 不允许(只有 prepare 可以)`);
      }
      return { ok: true, next: { ...base, phase: 'consuming' } };
    }

    case 'begin-committing': {
      if (record.phase !== 'consuming') {
        return reject('illegal-phase', `${record.phase} → committing 不允许(只有 consuming 可以)`);
      }
      return { ok: true, next: { ...base, phase: 'committing' } };
    }

    case 'complete': {
      if (record.phase !== 'committing') {
        return reject('illegal-phase', `${record.phase} → completed 不允许(只有 committing 可以)`);
      }
      return {
        ok: true,
        next: { ...base, phase: 'completed', endReason: transition.reason ?? { kind: 'normal' } },
      };
    }

    case 'park': {
      if (!PARKABLE.includes(record.phase)) {
        return reject('illegal-phase', `${record.phase} 不可挂起(仅 ${PARKABLE.join('/')} 可)`);
      }
      return { ok: true, next: { ...base, phase: 'parked', wake: transition.wake } };
    }

    case 'wake': {
      if (record.phase !== 'parked') {
        return reject('illegal-phase', `${record.phase} → consuming 不允许(只有 parked 可被唤醒)`);
      }
      // 唤醒后清掉 wake 条件:它已被消费,留着会让"还能再唤醒一次"变成歧义。
      const { wake: _consumed, ...rest } = base;
      return {
        ok: true,
        next: { ...rest, phase: 'consuming', reentries: record.reentries + 1 },
      };
    }

    case 'fail': {
      return { ok: true, next: { ...base, phase: 'failed', endReason: transition.reason } };
    }

    case 'cancel': {
      return {
        ok: true,
        next: { ...base, phase: 'cancelled', endReason: transition.reason ?? { kind: 'cancelled' } },
      };
    }

    case 'synthetic-finish': {
      if (!transition.detail || transition.detail.trim() === '') {
        return reject('missing-synthetic-reason', '合成结束必须说明原因(不允许空 detail)');
      }
      return {
        ok: true,
        next: {
          ...base,
          phase: 'completed',
          endReason: { kind: 'synthetic', detail: transition.detail },
        },
      };
    }
  }
}

/**
 * 判断一个 parked 回合此刻是否可以被唤醒。
 *
 * 两类:到点(`notBefore <= now`),或纯事件式(`notBefore` 缺席,只能显式 wake)。
 * 后者不返回 true —— 它没有"自动可唤醒"的时刻,必须由事件驱动。
 */
export function isWakeable(record: TurnRecord, now: number): boolean {
  if (record.phase !== 'parked' || !record.wake) return false;
  // cron 优先:周期挂起由 cron 表达式算下一次到点时刻
  if (record.wake.cron !== undefined) {
    try {
      const due = nextCronAt(record.wake.cron, record.updatedAt);
      return due <= now;
    } catch {
      // 表达式非法 ⇒ 不可唤醒(不静默当成"立刻可醒")。调用方应校验后再落库。
      return false;
    }
  }
  if (record.wake.notBefore === undefined) return false;
  return record.wake.notBefore <= now;
}

/** 新建一条回合记录(初始 phase = prepare)。 */
export function createTurnRecord(params: {
  id: string;
  sessionId: string;
  ordinal: number;
  at: number;
}): TurnRecord {
  return {
    id: params.id,
    sessionId: params.sessionId,
    ordinal: params.ordinal,
    phase: 'prepare',
    createdAt: params.at,
    updatedAt: params.at,
    reentries: 0,
  };
}

/**
 * 判定一条回合记录是否"需要人工介入"。给上层做告警/看板用,不改状态。
 * 判据:挂着超过 `staleMs` 仍未唤醒,或重入次数超过阈值(反复失败的特征)。
 */
export function needsAttention(
  record: TurnRecord,
  now: number,
  options: { staleMs?: number; maxReentries?: number } = {},
): { needed: boolean; reason?: string } {
  const staleMs = options.staleMs ?? 30 * 60 * 1000;
  const maxReentries = options.maxReentries ?? 3;

  if (record.phase === 'parked' && now - record.updatedAt >= staleMs) {
    return { needed: true, reason: `已挂起 ${Math.round((now - record.updatedAt) / 1000)}s 未唤醒` };
  }
  if (record.reentries >= maxReentries) {
    return { needed: true, reason: `已重入 ${record.reentries} 次(阈值 ${maxReentries})` };
  }
  return { needed: false };
}

/**
 * 把 CLI 循环的 `AgentStopReason` 映射成回合结束原因。
 *
 * 为什么要这张表而不是随手 if:
 *   `AgentStopReason` 是 CLI 循环的封闭集(`apps/cli/src/commands/agent.ts:294`),
 *   而 `TurnEndReason.kind` 只有四档。映射必须**穷尽**,漏一档就等于把某种终止
 *   记成了别的性质。
 *
 * 分档口径:
 *   · `end_turn` / `completed` = 模型自己说完了 ⇒ normal;
 *   · `cancelled` / `canceled` ⇒ cancelled;
 *   · 其余一律记 `synthetic` —— 它们都不是"模型自己说完",而是外部或判据把回合收掉的。
 *     这类必须能被后续分析区分出来,否则"正常完成率"会被系统性高估。
 *     典型:synthetic 档的 detail 里带原 stopReason,便于回溯是哪条判据收的。
 */
export type TurnStopReasonLike = string;

const NORMAL_STOPS = new Set(['end_turn', 'completed']);
const CANCELLED_STOPS = new Set(['cancelled', 'canceled']);

export function endReasonFromStopReason(
  stopReason: TurnStopReasonLike,
  detail?: string,
): TurnEndReason {
  if (NORMAL_STOPS.has(stopReason)) {
    return detail === undefined ? { kind: 'normal' } : { kind: 'normal', detail };
  }
  if (CANCELLED_STOPS.has(stopReason)) {
    return detail === undefined ? { kind: 'cancelled' } : { kind: 'cancelled', detail };
  }
  // 非"模型自己说完"的一切终止:合成结束,必须带原因。
  return { kind: 'synthetic', detail: detail ?? `stopped: ${stopReason}` };
}

/** 判断某个 stopReason 是否算"正常说完"。审计/统计用,不参与状态迁移。 */
export function isNormalStop(stopReason: TurnStopReasonLike): boolean {
  return NORMAL_STOPS.has(stopReason);
}
