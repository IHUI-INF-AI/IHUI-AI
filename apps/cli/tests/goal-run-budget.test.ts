// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal 迭代的 token 预算闸(2026-11-24,对齐 Codex `thread_goals.token_budget` / `tokens_used`)。
 *
 * 钉五件事:
 *   ① 每轮 token 真值累加并逐轮记录;
 *   ② 达到上限且**未达成**才收口(停止原因写清 tokensUsed/tokenCap);
 *   ③ 已达成的一轮越过上限仍按 achieved 记 —— 活儿干完了,不能因话多判成没做成;
 *   ④ 拿不到 usage / 非法值一律计 0,绝不拿估算冒充实测;
 *   ⑤ 上限缺省或非法 ⇒ 不设闸(行为与接线前一致)。
 */
import { describe, expect, it } from 'vitest';

import type { IterationVerdict } from '../src/acp/goal-loop.js';
import { describeGoalRun, runGoalWithAgent } from '../src/acp/goal-run.js';
import { goalIterate } from '../src/commands/goal.js';

const msgs = () => [] as never[];

const notDone = (): IterationVerdict => ({ done: false, note: '未达成' });

describe('runGoalWithAgent token 预算', () => {
  it('逐轮累加 token 并记录到 records', async () => {
    const r = await runGoalWithAgent(
      { maxIterations: 3 },
      {
        messages: msgs(),
        runIteration: async ({ iteration }) => ({
          stopReason: 'end_turn',
          assistantText: `第${iteration}轮`,
          usage: { tokens: 30 },
        }),
        judge: notDone,
      },
    );
    expect(r.tokensUsed).toBe(90);
    expect(r.records.map((x) => x.tokens)).toEqual([30, 30, 30]);
  });

  it('达到上限且未达成 ⇒ 立即收口,原因带 tokensUsed/tokenCap', async () => {
    let rounds = 0;
    const r = await runGoalWithAgent(
      { maxIterations: 5, maxTokens: 100 },
      {
        messages: msgs(),
        runIteration: async () => {
          rounds += 1;
          return { stopReason: 'end_turn', assistantText: '干活', usage: { tokens: 60 } };
        },
        judge: notDone,
      },
    );
    expect(rounds).toBe(2);
    expect(r.tokensUsed).toBe(120);
    expect(r.outcome.kind).toBe('exhausted');
    expect(r.outcome.kind === 'exhausted' ? r.outcome.lastNote : '').toContain('token 预算已耗尽(120/100)');
  });

  it('已达成优先:越过上限仍按 achieved 记', async () => {
    const r = await runGoalWithAgent(
      { maxIterations: 5, maxTokens: 10 },
      {
        messages: msgs(),
        runIteration: async () => ({
          stopReason: 'end_turn',
          assistantText: '做完了',
          usage: { tokens: 50 },
        }),
        judge: (): IterationVerdict => ({ done: true, note: 'ok' }),
      },
    );
    expect(r.outcome.kind).toBe('achieved');
    expect(r.tokensUsed).toBe(50);
  });

  it('拿不到 usage ⇒ 计 0,且不误触预算闸', async () => {
    const r = await runGoalWithAgent(
      { maxIterations: 3, maxTokens: 1 },
      {
        messages: msgs(),
        runIteration: async () => ({ stopReason: 'end_turn', assistantText: '干活' }),
        judge: notDone,
      },
    );
    expect(r.tokensUsed).toBe(0);
    expect(r.records.every((x) => x.tokens === 0)).toBe(true);
    expect(r.outcome.kind).toBe('exhausted');
    // 收口原因是轮次用尽,不能是预算闸(拿不到 usage 不许编一个读数出来)。
    expect(r.outcome.kind === 'exhausted' ? (r.outcome.lastNote ?? '') : '').not.toContain('预算');
  });

  it('非法 token 值(-5/NaN)一律计 0', async () => {
    const r = await runGoalWithAgent(
      { maxIterations: 2 },
      {
        messages: msgs(),
        runIteration: async ({ iteration }) => ({
          stopReason: 'end_turn',
          assistantText: `第${iteration}轮`,
          usage: { tokens: iteration === 1 ? -5 : Number.NaN },
        }),
        judge: notDone,
      },
    );
    expect(r.tokensUsed).toBe(0);
  });

  it('上限 <= 0 / NaN ⇒ 不设闸(跑满轮次)', async () => {
    const r = await runGoalWithAgent(
      { maxIterations: 3, maxTokens: Number.NaN },
      {
        messages: msgs(),
        runIteration: async () => ({
          stopReason: 'end_turn',
          assistantText: '干活',
          usage: { tokens: 999 },
        }),
        judge: notDone,
      },
    );
    expect(r.records).toHaveLength(3);
    expect(r.tokensUsed).toBe(2997);
  });

  it('describeGoalRun 在有 token 时追加读数,无 token 时逐字不变', async () => {
    const withTokens = await runGoalWithAgent(
      { maxIterations: 1 },
      {
        messages: msgs(),
        runIteration: async () => ({
          stopReason: 'end_turn',
          assistantText: '干活',
          usage: { tokens: 12 },
        }),
        judge: notDone,
      },
    );
    expect(describeGoalRun(withTokens)).toContain('12 tok');

    const noTokens = await runGoalWithAgent(
      { maxIterations: 1 },
      {
        messages: msgs(),
        runIteration: async () => ({ stopReason: 'end_turn', assistantText: '干活' }),
        judge: notDone,
      },
    );
    expect(describeGoalRun(noTokens)).not.toContain('tok');
  });
});

describe('goalIterate 透传预算与读数', () => {
  it('maxTokens 透传到闭环,并回传 tokensUsed', async () => {
    const logs: string[] = [];
    const r = await goalIterate(
      {
        task: '干活',
        doneWhen: '完成',
        maxIterations: 5,
        modelId: 'gpt-4o',
        maxTokens: 50,
      },
      {
        runIteration: async () => ({
          stopReason: 'end_turn',
          assistantText: '还在干',
          usage: { tokens: 40 },
        }),
        log: (l) => logs.push(l),
      },
    );
    expect(r.tokensUsed).toBe(80);
    expect(r.outcomeKind).toBe('exhausted');
    expect(logs.some((l) => l.includes('40 tok'))).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
