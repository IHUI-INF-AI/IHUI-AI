// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goalIterate（`ihui goal iterate`）达成路径真实验证。
 *
 * 为什么需要这一层:goal-run.test.ts 只钉了 runGoalWithAgent 的**通用闭环**,
 * 没钉 goal.ts 的**判据实现**(`--done-when` 正则 + 空输出永不达成)。
 * 判据是 goal 模式的灵魂 —— 猜错判据会得到"看起来在闭环、实际按错误标准收敛"的东西,
 * 所以必须钉:
 *   ① 助手输出匹配正则 ⇒ achieved(真跑到达成,不是空转);
 *   ② 空输出**永不**视为达成(空串能被空正则匹配是个真实陷阱);
 *   ③ 未匹配 ⇒ exhausted(不是 failed),记录每轮;
 *   ④ 非法正则直接抛错。
 */

import { describe, expect, it } from 'vitest';

import { goalIterate } from '../src/commands/goal.js';

/** 假模型:按预定脚本逐轮产出助手文本(模拟真实 runToolLoop 的输出形态)。 */
function fakeModel(script: string[], stopReason = 'end_turn') {
  return async ({ iteration }: { iteration: number }) => {
    const text = script[iteration - 1] ?? '';
    return { stopReason, assistantText: text };
  };
}

describe('goalIterate 达成路径', () => {
  it('助手输出匹配正则 ⇒ achieved(真跑到达成)', async () => {
    // 第 1 轮没成,第 2 轮输出含 "完成" ⇒ 判据说成
    const lines: string[] = [];
    const r = await goalIterate(
      {
        task: '把测试写完',
        doneWhen: '完成',
        maxIterations: 5,
        modelId: 'test-model',
      },
      {
        runIteration: fakeModel(['还在写', '测试已全部完成']),
        log: (l) => lines.push(l),
      },
    );
    expect(r.outcomeKind).toBe('achieved');
    expect(r.iterations).toBe(2);
    expect(r.stalled).toBe(false);
    // 摘要不得把达成说成失败
    expect(r.summary).toContain('achieved');
  });

  it('空输出永不视为达成(空串能被空正则匹配是陷阱)', async () => {
    // doneWhen = '' 是合法正则,能匹配任何串包括空串 —— 但空输出必须被显式排除
    const r = await goalIterate(
      {
        task: 'x',
        doneWhen: '',
        maxIterations: 3,
        modelId: 'test-model',
      },
      { runIteration: fakeModel(['', '', '']) },
    );
    // 连续两轮空输出 ⇒ 空转提前停,且绝不标 achieved
    expect(r.outcomeKind).not.toBe('achieved');
    expect(r.stalled).toBe(true);
  });

  it('跑满未匹配 ⇒ exhausted(不是 failed),记录每轮', async () => {
    const r = await goalIterate(
      {
        task: 'x',
        doneWhen: '完成',
        maxIterations: 3,
        modelId: 'test-model',
      },
      { runIteration: fakeModel(['a', 'b', 'c']) },
    );
    expect(r.outcomeKind).toBe('exhausted');
    expect(r.iterations).toBe(3);
    // exhausted ≠ failed —— 摘要不得出现 failed 字样误导
    expect(r.summary).not.toContain('failed');
  });

  it('非法正则直接抛错(不静默当空判据)', async () => {
    await expect(
      goalIterate(
        { task: 'x', doneWhen: '(unclosed', maxIterations: 3, modelId: 'm' },
        { runIteration: fakeModel(['a']) },
      ),
    ).rejects.toThrow(/--done-when/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
