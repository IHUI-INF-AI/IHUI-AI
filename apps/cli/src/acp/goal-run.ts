// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  /**
   * 该轮消耗的 token 数(取 provider 真值;拿不到按 0 计并如实记录)。
   * 2026-11-24 对齐 Codex `thread_goals.tokens_used`:预算若不计账,就只是纸面数字。
   */
  readonly tokens: number;
  /**
   * 该轮墙钟耗时(秒,毫秒精度截到 3 位)。
   * 2026-11-24 对齐 Codex `thread_goals.time_used_seconds`:token 之外还有时间这一维。
   */
  readonly seconds: number;
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
  /** 本次目标迭代累计 token(各轮 tokens 之和;拿不到 usage 的轮次计 0)。 */
  readonly tokensUsed: number;
  /** 本次目标迭代累计墙钟时间(秒;各轮 durationMs 之和,毫秒精度)。 */
  readonly secondsUsed: number;
}

/** 一轮执行的最小契约(runToolLoop 的子集,便于注入假实现测试)。 */
export type RunIteration = (params: {
  iteration: number;
  messages: ChatMessage[];
}) => Promise<{
  stopReason: string;
  assistantText: string;
  /** provider 回传的用量;可选 —— 不提供就按 0 计,绝不拿估算冒充实测。 */
  usage?: { readonly tokens?: number };
}>;

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
  /**
   * 累计 token 上限(2026-11-24 对齐 Codex `thread_goals.token_budget`)。
   * 只认 > 0 的有限数;缺省/非法 ⇒ 不设闸(行为与接线前逐字节一致)。
   * 闸只在**未达成**时收口:已达成的一轮即使越过上限也按 achieved 记 ——
   * 活儿已经干完,不能因为最后一轮话多就判成"没做成"。
   */
  readonly maxTokens?: number;
  /**
   * 累计墙钟时间上限(秒,2026-11-24 对齐 Codex `thread_goals.time_used_seconds`)。
   * 只认 > 0 的有限数;缺省/非法 ⇒ 不设闸。与 token 闸同口径:只在**未达成**时收口。
   */
  readonly maxSeconds?: number;
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
  let tokensUsed = 0;
  let secondsUsed = 0;
  const stopOnStall = options.stopOnStall !== false;
  const now = options.now ?? (() => Date.now());
  const tokenCap =
    options.maxTokens !== undefined &&
    Number.isFinite(options.maxTokens) &&
    options.maxTokens > 0
      ? Math.floor(options.maxTokens)
      : undefined;
  const secondCap =
    options.maxSeconds !== undefined &&
    Number.isFinite(options.maxSeconds) &&
    options.maxSeconds > 0
      ? options.maxSeconds
      : undefined;

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
      const roundSeconds = Math.round((durationMs / 1000) * 1000) / 1000;
      secondsUsed = Math.round((secondsUsed + roundSeconds) * 1000) / 1000;
      lastText = res.assistantText;

      // token 真值记账:只认有限正数;拿不到/非法一律计 0(不拿估算冒充实测)。
      const rawTokens = res.usage?.tokens;
      const roundTokens =
        typeof rawTokens === 'number' && Number.isFinite(rawTokens) && rawTokens > 0
          ? Math.floor(rawTokens)
          : 0;
      tokensUsed += roundTokens;

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
        tokens: roundTokens,
        seconds: roundSeconds,
      });

      // token 预算闸:只在未达成时收口 —— 达成优先(活儿已经干完,不能因话多判成没做成)。
      if (tokenCap !== undefined && tokensUsed >= tokenCap && !verdict.done) {
        return {
          done: false,
          unrecoverable: `token 预算已耗尽(${tokensUsed}/${tokenCap})`,
        };
      }

      // 时间预算闸:与 token 闸同口径,只在未达成时收口(达成优先)。
      if (secondCap !== undefined && secondsUsed >= secondCap && !verdict.done) {
        return {
          done: false,
          unrecoverable: `时间预算已耗尽(${formatSeconds(secondsUsed)}s/${formatSeconds(secondCap)}s)`,
        };
      }

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

  return { outcome, records, lastText, stalled, tokensUsed, secondsUsed };
}

/** 秒数展示:整数不带小数点,其余保留到 3 位(避免 0.30000000000000004 之类噪声)。 */
function formatSeconds(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** 一句话摘要(给审计/展示)。 */
export function describeGoalRun(r: GoalRunResult): string {
  const rounds = r.records.length;
  const empty = r.records.filter((x) => x.textLength === 0).length;
  const base = `${r.outcome.kind} / ${rounds} 轮${empty > 0 ? ` / ${empty} 轮空产出` : ''}`;
  const tokens = r.tokensUsed > 0 ? ` / ${r.tokensUsed} tok` : '';
  const seconds = r.secondsUsed > 0 ? ` / ${formatSeconds(r.secondsUsed)}s` : '';
  const withUsage = `${base}${tokens}${seconds}`;
  return r.stalled ? `${withUsage}(检测到原地打转)` : withUsage;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
