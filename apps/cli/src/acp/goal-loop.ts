// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 目标迭代循环(ralph-loop)—— 「同一目标反复迭代直到达成」。
 *
 * ## 为什么需要「达成判据」而不是纯循环
 *
 * 对标物 Trae 的 `ralph-loop` crate 是目标驱动的重试循环。但**没有达成判据的
 * 循环只会无限重试** —— 这一点在上一轮被判定为 N/A,理由正是"缺判据"。
 *
 * 本轮补上判据层。判据不是猜的,而是**显式声明**:
 *   · `maxIterations` 硬上限(必须给,不允许 0 或负数);
 *   · `deadlineMs` 墙钟上限(可选,但给了就硬性生效);
 *   · `verdict` 回调(必需)—— 由调用方给出"这一轮算不算达成"。
 *
 * **三档结论区分清楚**(这是本模块的核心价值):
 *   achieved    判据说达成了
 *   exhausted   迭代次数用尽(≠ 失败,可能只是还需要更多轮)
 *   timed-out   墙钟超时
 *   aborted     调用方主动中止
 *
 * 把 `exhausted` 与 `failed` 混为一谈是最常见的错误 —— 前者是"还没成",
 * 后者是"做不成"。分开记才能让上层决定"要不要加预算再来一轮"。
 *
 * ## 为什么不做成纯函数
 *
 * 循环本身有副作用(每轮要跑 agent),所以本模块只提供**驱动骨架**:
 * 它决定"还该不该再来一轮",具体每轮做什么由 `iterate` 回调提供。
 * 这样它能被单测穷尽(用假 iterate),也能被真实 runToolLoop 复用。
 */

/** 迭代终止原因。四档互斥,无重叠。 */
export type LoopOutcome =
  /** 判据判定达成。 */
  | { readonly kind: 'achieved'; readonly iterations: number; readonly note?: string }
  /** 迭代次数用尽,未达成。**不等于失败** —— 可能只是预算不够。 */
  | { readonly kind: 'exhausted'; readonly iterations: number; readonly lastNote?: string }
  /** 墙钟超时。 */
  | { readonly kind: 'timed-out'; readonly iterations: number; readonly elapsedMs: number }
  /** 调用方主动中止。 */
  | { readonly kind: 'aborted'; readonly iterations: number; readonly reason: string };

/** 单轮结论。由调用方在 `iterate` 里给出。 */
export type IterationVerdict =
  /** 已达成,可以停。 */
  | { readonly done: true; readonly note?: string }
  /** 未达成,继续。 */
  | { readonly done: false; readonly note?: string }
  /** 判定为不可达成(不是"还没成",是"做不成")—— 立即终止并记为 exhausted。 */
  | { readonly done: false; readonly unrecoverable: string };

export interface LoopOptions {
  /** 硬上限。必须 >= 1,否则抛错 —— 无上限的循环是事故。 */
  readonly maxIterations: number;
  /** 墙钟上限(毫秒)。可选;给了就硬性生效。 */
  readonly deadlineMs?: number;
  /** 当前时刻注入(便于测试)。 */
  readonly now?: () => number;
  /** 外部中止信号。 */
  readonly signal?: AbortSignal;
}

/** 循环体:跑一轮,返回本轮结论。 */
export type IterateFn = (ctx: { iteration: number; startedAt: number }) => Promise<IterationVerdict>;

/**
 * 驱动循环。
 *
 * 四条硬约束(每条都对应一个真实事故形态):
 *   ① `maxIterations` 必须 >= 1 —— 无上限循环会把预算烧穿;
 *   ② 每轮**先检查** signal 与 deadline,再跑 iterate ——
 *      否则最后一轮会在超时后仍完整跑完,墙钟形同虚设;
 *   ③ iterate 抛错不吞:直接向上抛,不折成 exhausted ——
 *      "循环跑完了"与"循环里炸了"必须可区分;
 *   ④ `unrecoverable` 立即终止,不浪费剩余轮次。
 */
export async function runGoalLoop(
  options: LoopOptions,
  iterate: IterateFn,
): Promise<LoopOutcome> {
  if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1) {
    throw new Error(
      `maxIterations 必须是 >= 1 的整数(收到 ${String(options.maxIterations)}) —— 无上限循环会把预算烧穿`,
    );
  }
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  let lastNote: string | undefined;

  for (let iteration = 1; iteration <= options.maxIterations; iteration++) {
    // ② 先检查再跑 —— 不能等这一轮跑完才发现超时
    if (options.signal?.aborted) {
      return { kind: 'aborted', iterations: iteration - 1, reason: 'aborted before iteration' };
    }
    if (options.deadlineMs !== undefined) {
      const elapsed = now() - startedAt;
      if (elapsed >= options.deadlineMs) {
        return { kind: 'timed-out', iterations: iteration - 1, elapsedMs: elapsed };
      }
    }

    // ③ iterate 抛错直接向上冒泡(不写 try/catch)
    const verdict = await iterate({ iteration, startedAt });

    if (verdict.done) {
      return {
        kind: 'achieved',
        iterations: iteration,
        ...(verdict.note === undefined ? {} : { note: verdict.note }),
      };
    }
    if ('unrecoverable' in verdict) {
      return { kind: 'exhausted', iterations: iteration, lastNote: verdict.unrecoverable };
    }
    if (verdict.note !== undefined) lastNote = verdict.note;
  }

  return {
    kind: 'exhausted',
    iterations: options.maxIterations,
    ...(lastNote === undefined ? {} : { lastNote }),
  };
}

/**
 * 判断一个 outcome 是否"值得再给一次预算"。
 *
 * 这是本模块最实用的一个函数:上层据此决定"要不要加轮次重跑",
 * 而不是把所有非 achieved 都当成失败。
 */
export function deservesRetry(outcome: LoopOutcome): boolean {
  return outcome.kind === 'exhausted' || outcome.kind === 'timed-out';
}

/** 给审计/展示的一句话摘要。不得把 exhausted 说成失败。 */
export function describeOutcome(outcome: LoopOutcome): string {
  switch (outcome.kind) {
    case 'achieved':
      return `第 ${outcome.iterations} 轮达成${outcome.note ? `:${outcome.note}` : ''}`;
    case 'exhausted':
      return `跑满 ${outcome.iterations} 轮仍未达成${outcome.lastNote ? `(末轮:${outcome.lastNote})` : ''} —— 这不算失败`;
    case 'timed-out':
      return `跑满 ${outcome.iterations} 轮后超时(${outcome.elapsedMs}ms)`;
    case 'aborted':
      return `第 ${outcome.iterations} 轮后被中止:${outcome.reason}`;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
