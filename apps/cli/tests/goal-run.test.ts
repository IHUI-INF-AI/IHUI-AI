// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 目标迭代闭环(goal-run)—— 把 goal-loop 与真实执行组合。
 *
 * 钉四件事:
 *   ① 每轮真的跑一次 runIteration(不是空转);
 *   ② 达成即停,不跑多余轮次;
 *   ③ **空转检测**:连续两轮零产出提前停,省预算;
 *   ④ 三种终止可区分(achieved / exhausted / aborted)。
 */
import { describe, expect, it } from 'vitest';

import { describeGoalRun, runGoalWithAgent } from '../src/acp/goal-run.js';
import type { IterationVerdict } from '../src/acp/goal-loop.js';

const msgs = () => [] as never[];

describe('runGoalWithAgent 闭环', () => {
  it('第 2 轮达成 ⇒ 只跑 2 轮', async () => {
    let rounds = 0;
    const r = await runGoalWithAgent(
      { maxIterations: 10 },
      {
        messages: msgs(),
        runIteration: async ({ iteration }) => {
          rounds += 1;
          return { stopReason: 'end_turn', assistantText: `第${iteration}轮` };
        },
        judge: ({ iteration }): IterationVerdict => ({ done: iteration === 2 }),
      },
    );
    expect(r.outcome.kind).toBe('achieved');
    expect(rounds).toBe(2);
    expect(r.records).toHaveLength(2);
  });

  it('每轮都被真实执行(不是空转)', async () => {
    const seen: number[] = [];
    await runGoalWithAgent(
      { maxIterations: 3 },
      {
        messages: msgs(),
        runIteration: async ({ iteration }) => {
          seen.push(iteration);
          return { stopReason: 'end_turn', assistantText: 'x' };
        },
        judge: (): IterationVerdict => ({ done: false }),
      },
    );
    expect(seen).toEqual([1, 2, 3]);
  });

  it('跑满未达成 ⇒ exhausted,记录每轮明细', async () => {
    const r = await runGoalWithAgent(
      { maxIterations: 3 },
      {
        messages: msgs(),
        runIteration: async () => ({ stopReason: 'end_turn', assistantText: 'abc' }),
        judge: (): IterationVerdict => ({ done: false }),
      },
    );
    expect(r.outcome.kind).toBe('exhausted');
    expect(r.records).toHaveLength(3);
    expect(r.records.every((x) => x.textLength === 3)).toBe(true);
    expect(r.lastText).toBe('abc');
  });

  it('空转检测:连续两轮零产出 ⇒ 提前停', async () => {
    let rounds = 0;
    const r = await runGoalWithAgent(
      { maxIterations: 10 },
      {
        messages: msgs(),
        runIteration: async () => {
          rounds += 1;
          return { stopReason: 'end_turn', assistantText: '' };
        },
        judge: (): IterationVerdict => ({ done: false }),
      },
    );
    expect(r.stalled).toBe(true);
    expect(rounds).toBe(2); // 第 2 轮检测到空转就停,没跑满 10
    expect(r.outcome.kind).toBe('exhausted');
  });

  it('空转但有产出交替 ⇒ 不误判为 stalled', async () => {
    let i = 0;
    const r = await runGoalWithAgent(
      { maxIterations: 4 },
      {
        messages: msgs(),
        runIteration: async () => {
          i += 1;
          return { stopReason: 'end_turn', assistantText: i % 2 === 0 ? '有内容' : '' };
        },
        judge: (): IterationVerdict => ({ done: false }),
      },
    );
    expect(r.stalled).toBe(false);
    expect(r.records).toHaveLength(4);
  });

  it('stopOnStall=false 时即使空转也跑满', async () => {
    let rounds = 0;
    const r = await runGoalWithAgent(
      { maxIterations: 4, stopOnStall: false },
      {
        messages: msgs(),
        runIteration: async () => {
          rounds += 1;
          return { stopReason: 'end_turn', assistantText: '' };
        },
        judge: (): IterationVerdict => ({ done: false }),
      },
    );
    expect(rounds).toBe(4);
    expect(r.stalled).toBe(true); // 标记仍然设，只是不提前停
  });

  it('maxIterations < 1 抛错', async () => {
    await expect(
      runGoalWithAgent(
        { maxIterations: 0 },
        { messages: msgs(), runIteration: async () => ({ stopReason: 'x', assistantText: '' }), judge: () => ({ done: true }) },
      ),
    ).rejects.toThrow(/maxIterations/);
  });
});

describe('describeGoalRun', () => {
  it('达成时摘要含 kind 与轮次', () => {
    const s = describeGoalRun({
      outcome: { kind: 'achieved', iterations: 2 },
      records: [
        { iteration: 1, stopReason: 'end_turn', textLength: 5, durationMs: 10, verdict: { done: false } },
        { iteration: 2, stopReason: 'end_turn', textLength: 5, durationMs: 10, verdict: { done: true } },
      ],
      lastText: 'x',
      stalled: false,
    });
    expect(s).toContain('achieved');
    expect(s).toContain('2 轮');
  });

  it('stalled 时明确标注', () => {
    const s = describeGoalRun({
      outcome: { kind: 'exhausted', iterations: 2 },
      records: [
        { iteration: 1, stopReason: 'end_turn', textLength: 0, durationMs: 1, verdict: { done: false } },
        { iteration: 2, stopReason: 'end_turn', textLength: 0, durationMs: 1, verdict: { done: false } },
      ],
      lastText: '',
      stalled: true,
    });
    expect(s).toContain('原地打转');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
