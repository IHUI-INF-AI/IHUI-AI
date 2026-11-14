// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `ihui goal iterate` 命令 —— `goal-run.ts` 的**真实消费方**。
 *
 * ## 它做什么
 *
 * 反复跑 `runToolLoop` 直到"达成"或轮次用尽。达成判据由用户通过
 * `--done-when <regex>` 给出:助手输出匹配该正则即视为达成。
 *
 * ## 为什么判据交给用户
 *
 * "什么算做完"是业务语义。若本命令内置一个猜测(比如"输出含'完成'二字"),
 * 就会得到一个**看起来在闭环、实际按错误标准收敛**的东西。
 * 交给用户写正则,至少判据是显式的、可审计的。
 *
 * ## 三种终止都要说清楚
 *
 *   achieved    判据说成了
 *   exhausted   轮次用尽仍未达成 —— **不是失败**,可能只是预算不够
 *   stalled     连续两轮无产出,提前停(省预算)
 *
 * 输出里绝不能把 exhausted 写成 failed —— 那会让人误以为做不成。
 */
import chalk from 'chalk';
import type { ChatMessage } from '@ihui/types';

import { runGoalWithAgent, describeGoalRun } from '../acp/goal-run.js';
import type { IterationVerdict } from '../acp/goal-loop.js';

export interface GoalIterateOptions {
  readonly task: string;
  /** 达成判据:助手输出匹配此正则即达成。 */
  readonly doneWhen: string;
  readonly maxIterations: number;
  readonly modelId: string;
}

export interface GoalIterateDeps {
  /** 跑一轮(生产上是 runToolLoop 的薄包装;测试可注入假实现)。 */
  readonly runIteration: (p: { iteration: number; messages: ChatMessage[] }) => Promise<{
    stopReason: string;
    assistantText: string;
  }>;
  readonly log?: (line: string) => void;
}

export interface GoalIterateResult {
  readonly outcomeKind: string;
  readonly iterations: number;
  readonly stalled: boolean;
  readonly summary: string;
  readonly lastText: string;
}

/**
 * 执行目标迭代。
 *
 * 判据实现:`--done-when` 是正则,匹配**助手输出**。空输出永不匹配 ——
 * 空串能被空正则匹配是个陷阱,这里显式排除。
 */
export async function goalIterate(
  options: GoalIterateOptions,
  deps: GoalIterateDeps,
): Promise<GoalIterateResult> {
  const log = deps.log ?? ((l: string) => console.info(l));

  let matcher: RegExp;
  try {
    matcher = new RegExp(options.doneWhen);
  } catch (e) {
    throw new Error(
      `--done-when 不是合法正则:${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const messages: ChatMessage[] = [{ role: 'user', content: options.task } as ChatMessage];

  const result = await runGoalWithAgent(
    { maxIterations: options.maxIterations },
    {
      messages,
      runIteration: deps.runIteration,
      judge: ({ assistantText }): IterationVerdict => {
        // 空输出永不视为达成:空串能被空正则匹配,是个真实陷阱
        if (assistantText.length === 0) {
          return { done: false, note: '本轮无产出' };
        }
        return matcher.test(assistantText)
          ? { done: true, note: `匹配 /${options.doneWhen}/` }
          : { done: false, note: `未匹配 /${options.doneWhen}/` };
      },
    },
  );

  // 每轮记录一条(便于用户看"到底在做什么")
  for (const rec of result.records) {
    log(
      chalk.dim(
        `  第 ${rec.iteration} 轮:${rec.stopReason} / ${rec.textLength} 字 / ${rec.durationMs}ms`,
      ),
    );
  }

  const summary = describeGoalRun(result);
  log(
    result.outcome.kind === 'achieved'
      ? chalk.green(`✅ ${summary}`)
      : chalk.yellow(`⚠ ${summary}`),
  );

  return {
    outcomeKind: result.outcome.kind,
    iterations: result.records.length,
    stalled: result.stalled,
    summary,
    lastText: result.lastText,
  };
}
