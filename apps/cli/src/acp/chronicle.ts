// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回合编年史(chronicle)—— 把运行态流水整理成可读的时间线。
 *
 * ## 为什么需要这一层
 *
 * `turn-store` 存的是**当前状态**(每个回合一条记录,phase 被反复覆盖)。
 * 而"这个会话都发生过什么"需要的是**按时间排的事件序列** —— 两者不是同一件事:
 *   · 状态回答"现在在哪";
 *   · 时间线回答"怎么走到这里的"。
 *
 * 没有时间线时,排查长任务只能靠翻 turn 记录的当前 phase,看不出
 * "它挂起过 3 次 / 重入过 2 次 / 最后是被合成结束收掉的"。
 *
 * ## 数据从哪来(不新增存储)
 *
 * 全部从 `turn-store` 的 `TurnRecord` 派生 —— **不另建第二份真相源**
 * (AGENTS §0.6)。每条 TurnRecord 自带:
 *   createdAt / updatedAt / phase / reentries / wake / endReason
 * 足以还原出一串事件。派生是纯函数,零 IO,可单测穷尽。
 *
 * ## 一条纪律
 *
 * **不伪造未记录的事件**。比如某回合从 prepare 直接跳到 completed,
 * 时间线只写这两个点,不编造中间的 consuming/committing ——
 * 观测层不知道的事,不许写进时间线(那会让审计读出不存在的历史)。
 */
import type { TurnRecord } from './turn-lifecycle.js';

/** 时间线事件类别。 */
export type ChronicleEventKind =
  /** 回合被创建。 */
  | 'turn-created'
  /** 观测到终态(completed / failed / cancelled)。 */
  | 'turn-ended'
  /** 当前处于挂起。 */
  | 'turn-parked'
  /** 当前在运行(prepare/consuming/committing)。 */
  | 'turn-active';

export interface ChronicleEvent {
  readonly kind: ChronicleEventKind;
  /** 发生时刻(ms)。 */
  readonly at: number;
  readonly turnId: string;
  readonly ordinal: number;
  /** 一句话说明(人读面)。 */
  readonly summary: string;
  /** 结构化补充,便于机器消费。 */
  readonly detail?: Readonly<Record<string, unknown>>;
}

/**
 * 从一个会话的全部回合派生时间线。
 *
 * 排序规则:按事件时刻升序;同刻按 `ordinal` 升序(保证稳定、可复现)。
 * 这点很重要 —— 时间线若不稳定,两次读同一份数据会得到不同顺序,
 * 审计就无法比对。
 */
export function buildChronicle(turns: readonly TurnRecord[]): ChronicleEvent[] {
  const events: ChronicleEvent[] = [];

  for (const t of turns) {
    events.push({
      kind: 'turn-created',
      at: t.createdAt,
      turnId: t.id,
      ordinal: t.ordinal,
      summary: `回合 #${t.ordinal} 创建`,
    });

    // 终态:记录结束时刻与原因
    if (t.phase === 'completed' || t.phase === 'failed' || t.phase === 'cancelled') {
      events.push({
        kind: 'turn-ended',
        at: t.updatedAt,
        turnId: t.id,
        ordinal: t.ordinal,
        summary: `回合 #${t.ordinal} ${describeEnd(t)}`,
        detail: {
          phase: t.phase,
          endKind: t.endReason?.kind ?? 'unknown',
          ...(t.endReason && 'detail' in t.endReason ? { reason: t.endReason.detail } : {}),
          ...(t.reentries > 0 ? { reentries: t.reentries } : {}),
        },
      });
      continue;
    }

    // 挂起:带唤醒条件
    if (t.phase === 'parked') {
      events.push({
        kind: 'turn-parked',
        at: t.updatedAt,
        turnId: t.id,
        ordinal: t.ordinal,
        summary: `回合 #${t.ordinal} 挂起(等待${describeParkReason(t.wake?.reason)})`,
        detail: {
          reason: t.wake?.reason ?? 'unknown',
          ...(t.wake?.notBefore === undefined ? {} : { notBefore: t.wake.notBefore }),
          ...(t.reentries > 0 ? { reentries: t.reentries } : {}),
        },
      });
      continue;
    }

    // 运行中
    events.push({
      kind: 'turn-active',
      at: t.updatedAt,
      turnId: t.id,
      ordinal: t.ordinal,
      summary: `回合 #${t.ordinal} 进行中(${t.phase})`,
      detail: { phase: t.phase, ...(t.reentries > 0 ? { reentries: t.reentries } : {}) },
    });
  }

  events.sort((a, b) => (a.at !== b.at ? a.at - b.at : a.ordinal - b.ordinal));
  return events;
}

function describeEnd(t: TurnRecord): string {
  const kind = t.endReason?.kind ?? 'unknown';
  switch (kind) {
    case 'normal':
      return '正常完成';
    case 'synthetic':
      return '合成结束(上游未给结束信号)';
    case 'error':
      return '失败';
    case 'cancelled':
      return '已取消';
    default:
      return `结束(${t.phase})`;
  }
}

function describeParkReason(reason: string | undefined): string {
  switch (reason) {
    case 'awaiting-user':
      return '用户回答';
    case 'awaiting-approval':
      return '审批';
    case 'awaiting-dependency':
      return '依赖完成';
    case 'awaiting-timer':
      return '定时';
    default:
      return '未知条件';
  }
}

/** 时间线摘要统计(给看板/健康检查用)。 */
export interface ChronicleStats {
  readonly totalTurns: number;
  readonly byPhase: Readonly<Record<string, number>>;
  readonly parked: number;
  readonly active: number;
  readonly reentered: number;
  /** 合成结束的回合数 —— 这个数高说明上游结束信号不可靠。 */
  readonly syntheticEnded: number;
}

export function summarizeChronicle(turns: readonly TurnRecord[]): ChronicleStats {
  const byPhase: Record<string, number> = {};
  let parked = 0;
  let active = 0;
  let reentered = 0;
  let syntheticEnded = 0;

  for (const t of turns) {
    byPhase[t.phase] = (byPhase[t.phase] ?? 0) + 1;
    if (t.phase === 'parked') parked += 1;
    if (t.phase === 'prepare' || t.phase === 'consuming' || t.phase === 'committing') active += 1;
    if (t.reentries > 0) reentered += 1;
    if (t.endReason?.kind === 'synthetic') syntheticEnded += 1;
  }

  return {
    totalTurns: turns.length,
    byPhase,
    parked,
    active,
    reentered,
    syntheticEnded,
  };
}
