// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 目标迭代循环(ralph-loop)判据层。
 *
 * 钉四档退出**必须可区分** —— 这是本模块存在的全部理由:
 *   achieved / exhausted / timed-out / aborted
 * 把 exhausted 折成"失败"是最常见的错误:前者是"还没成",后者是"做不成"。
 */
import { describe, expect, it } from 'vitest';

import {
  deservesRetry,
  describeOutcome,
  runGoalLoop,
  type IterationVerdict,
} from '../src/acp/goal-loop.js';

const T0 = 1_700_000_000_000;

describe('goal-loop 四档退出', () => {
  it('首轮达成 ⇒ achieved', async () => {
    const out = await runGoalLoop({ maxIterations: 5 }, async () => ({ done: true, note: 'ok' }));
    expect(out.kind).toBe('achieved');
    expect(out.iterations).toBe(1);
    expect(out.kind === 'achieved' ? out.note : '').toBe('ok');
  });

  it('第 N 轮达成 ⇒ 记下真实轮次', async () => {
    let n = 0;
    const out = await runGoalLoop({ maxIterations: 10 }, async () => {
      n += 1;
      return { done: n === 3 } as IterationVerdict;
    });
    expect(out.kind).toBe('achieved');
    expect(out.iterations).toBe(3);
  });

  it('跑满未达成 ⇒ exhausted(不是失败)', async () => {
    const out = await runGoalLoop({ maxIterations: 4 }, async ({ iteration }) => ({
      done: false,
      note: `round ${iteration}`,
    }));
    expect(out.kind).toBe('exhausted');
    expect(out.iterations).toBe(4);
    expect(out.kind === 'exhausted' ? out.lastNote : '').toBe('round 4');
  });

  it('unrecoverable ⇒ 立即终止,不浪费剩余轮次', async () => {
    let calls = 0;
    const out = await runGoalLoop({ maxIterations: 100 }, async ({ iteration }) => {
      calls += 1;
      if (iteration === 2) return { done: false, unrecoverable: '目标与判据矛盾' };
      return { done: false };
    });
    expect(out.kind).toBe('exhausted');
    expect(out.iterations).toBe(2);
    expect(calls).toBe(2); // 没有白跑后面的 98 轮
  });

  it('墙钟超时 ⇒ timed-out,且**跑之前**就检查', async () => {
    let t = T0;
    let calls = 0;
    const out = await runGoalLoop(
      { maxIterations: 100, deadlineMs: 1000, now: () => t },
      async () => {
        calls += 1;
        t += 600; // 每轮消耗 600ms
        return { done: false };
      },
    );
    expect(out.kind).toBe('timed-out');
    // 第 1 轮后 600ms < 1000 继续;第 2 轮后 1200ms ≥ 1000 ⇒ 第 3 轮开跑前就停
    expect(calls).toBe(2);
    expect(out.iterations).toBe(2);
  });

  it('abort 信号 ⇒ aborted', async () => {
    const ac = new AbortController();
    let calls = 0;
    const out = await runGoalLoop({ maxIterations: 10, signal: ac.signal }, async () => {
      calls += 1;
      if (calls === 2) ac.abort();
      return { done: false };
    });
    expect(out.kind).toBe('aborted');
    expect(out.iterations).toBe(2);
    expect(calls).toBe(2); // 第 3 轮开跑前被拦
  });
});

describe('goal-loop 硬约束', () => {
  it('maxIterations < 1 直接抛错(无上限循环会把预算烧穿)', async () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      await expect(runGoalLoop({ maxIterations: bad }, async () => ({ done: true }))).rejects.toThrow(
        /maxIterations/,
      );
    }
  });

  it('iterate 抛错直接向上冒泡,不折成 exhausted', async () => {
    await expect(
      runGoalLoop({ maxIterations: 3 }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});

describe('outcome 语义', () => {
  it('deservesRetry:exhausted 与 timed-out 值得再给预算,achieved 不值得', () => {
    expect(deservesRetry({ kind: 'exhausted', iterations: 3 })).toBe(true);
    expect(deservesRetry({ kind: 'timed-out', iterations: 3, elapsedMs: 100 })).toBe(true);
    expect(deservesRetry({ kind: 'achieved', iterations: 1 })).toBe(false);
    expect(deservesRetry({ kind: 'aborted', iterations: 1, reason: 'x' })).toBe(false);
  });

  it('describeOutcome 不得把 exhausted 说成失败', () => {
    const s = describeOutcome({ kind: 'exhausted', iterations: 5 });
    expect(s).toContain('未达成');
    expect(s).toContain('不算失败');
    expect(s).not.toContain('失败:'); // 不能写成"失败"
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
