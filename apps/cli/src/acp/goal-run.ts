// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 目标迭代闭环 —— 把 `goal-loop` 与真实 `runToolLoop` 组合。
 *
 * ## 为什么需要这一层
 *
 * `goal-loop.ts` 只提供"什么时候该停"的骨架,它的 `iterate` 是注入的。
 * 上一轮接的是 ACP 侧的 `verdicts` 数组 —— 那等于让调用方逐轮告诉循环"这轮成没成",
 * 循环自己并不跑活。这是**半闭环**:判据在,但没和真实执行接上。
 *
 * 本模块把两者组合:每轮真的跑一次 `runToolLoop`,再用 `judge` 判定这一轮是否达成。
 * 这样"反复迭代直到达成"才真的成立。
 *
 * ## 三条必须守住的边界
 *
 * ① **绝不无限循环**:轮次上限由调用方给,且本层强制 >=1;
 * ② **副作用累积要给调用方看得见**:每轮跑完都会往 messages 里追加内容,
 *    本层不替调用方裁剪对话,但把每轮的 `stopReason` 与文本长度报出来,
 *    让调用方能判断"是不是在原地打转";
 * ③ **达成判据由调用方给** —— 本层不知道"什么算做完",只负责驱动与记录。
 *    这是刻意的:判据属业务语义,猜一个只会产出假闭环。
 */
import type { ChatMessage } from '@ihui/types';

import { runGoalLoop, type IterationVerdict, type LoopOutcome } from './goal-loop.js';

/** 单轮执行的观测记录。 */
export interface GoalIterationRecord {
  readonly iteration: number;
  /** 该轮的 stopReason(来自 runToolLoop)。 */
  readonly stopReason: string;
  /** 该轮产出的助手文本长度 —— 长度为 0 是"原地打转"的强信号。 */
  readonly textLength: number;
  /** 该轮耗时。 */
  readonly durationMs: number;
  /** 判据给出的结论。 */
  readonly verdict: IterationVerdict;
}

export interface GoalRunResult {
  readonly outcome: LoopOutcome;
  readonly records: readonly GoalIterationRecord[];
  /** 最后一轮的助手文本(便于上层展示)。 */
  readonly lastText: string;
  /**
   * 是否检测到"原地打转":连续两轮文本长度为 0。
   * 这个信号不改变 outcome,但上层可据此提前放弃 —— 比跑满轮次省预算。
   */
  readonly stalled: boolean;
}

/** 一轮执行的最小契约(runToolLoop 的子集,便于注入假实现测试)。 */
export type RunIteration = (params: {
  iteration: number;
  messages: ChatMessage[];
}) => Promise<{ stopReason: string; assistantText: string }>;

/** 判定这一轮是否达成。 */
export type JudgeIteration = (params: {
  iteration: number;
  stopReason: string;
  assistantText: string;
}) => IterationVerdict;

export interface RunGoalWithAgentOptions {
  readonly maxIterations: number;
  readonly deadlineMs?: number;
  readonly now?: () => number;
  readonly signal?: AbortSignal;
  /**
   * 遇到"原地打转"(连续两轮空产出)时是否提前终止。
   * 默认 true —— 空转的轮次只会烧预算。
   */
  readonly stopOnStall?: boolean;
}

/**
 * 驱动"跑一轮 → 判一轮"的闭环。
 *
 * `messages` 由调用方持有并被**原地追加**(runToolLoop 的既有约定),
 * 本层只透传,不改写内容 —— 对话裁剪是调用方的事。
 */
export async function runGoalWithAgent(
  options: RunGoalWithAgentOptions,
  deps: { runIteration: RunIteration; judge: JudgeIteration; messages: ChatMessage[] },
): Promise<GoalRunResult> {
  const records: GoalIterationRecord[] = [];
  let lastText = '';
  let consecutiveEmpty = 0;
  let stalled = false;
  const stopOnStall = options.stopOnStall !== false;
  const now = options.now ?? (() => Date.now());

  const outcome = await runGoalLoop(
    {
      maxIterations: options.maxIterations,
      ...(options.deadlineMs === undefined ? {} : { deadlineMs: options.deadlineMs }),
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    },
    async ({ iteration }) => {
      const started = now();
      const res = await deps.runIteration({ iteration, messages: deps.messages });
      const durationMs = now() - started;
      lastText = res.assistantText;

      const verdict = deps.judge({
        iteration,
        stopReason: res.stopReason,
        assistantText: res.assistantText,
      });

      records.push({
        iteration,
        stopReason: res.stopReason,
        textLength: res.assistantText.length,
        durationMs,
        verdict,
      });

      // 空转检测:连续两轮零产出
      if (res.assistantText.length === 0) {
        consecutiveEmpty += 1;
        if (consecutiveEmpty >= 2) stalled = true;
      } else {
        consecutiveEmpty = 0;
      }

      // 空转且允许提前停 ⇒ 用 unrecoverable 让循环立即收口
      if (stalled && stopOnStall && !verdict.done) {
        return { done: false, unrecoverable: '连续两轮无产出(疑似原地打转)' };
      }
      return verdict;
    },
  );

  return { outcome, records, lastText, stalled };
}

/** 一句话摘要(给审计/展示)。 */
export function describeGoalRun(r: GoalRunResult): string {
  const rounds = r.records.length;
  const empty = r.records.filter((x) => x.textLength === 0).length;
  const base = `${r.outcome.kind} / ${rounds} 轮${empty > 0 ? ` / ${empty} 轮空产出` : ''}`;
  return r.stalled ? `${base}(检测到原地打转)` : base;
}
