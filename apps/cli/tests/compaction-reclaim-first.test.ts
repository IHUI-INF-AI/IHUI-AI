// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 主入口的"回收先行"接线测试:证明免费阶段真的替代了模型调用,
 * 而不是只挂在导出面上没人用(AGENTS.md「造好没装车」同型防御)。
 */
import { describe, expect, it } from 'vitest';

import { compressContextV2, type ChatMessage, type CompactionSampler } from '../src/compaction-v2.js';
import { RECLAIM_PLACEHOLDER } from '../src/context.js';
// P1/P2 的判据常量取自共享包主入口(唯一公开面,守门 103 的 D3 禁止深读内部路径)
import {
  COMPACTION_DECISION_REASONS,
  MAX_OUTPUT_RESERVE_TOKENS,
  effectiveContextWindow,
  isCompactionDecisionReason,
} from '@ihui/context-compaction';

/** ~10 tokens/句,拼体积用 */
function filler(times: number): string {
  return 'The quick brown fox jumps over the lazy dog. '.repeat(times);
}

/** OpenAI 形态的一轮工具调用(白名单内工具,可被回收) */
function toolRound(n: number): ChatMessage[] {
  return [
    {
      role: 'assistant',
      content: `第 ${n} 次读取`,
      tool_calls: [
        { id: `c${n}`, type: 'function', function: { name: 'read_file', arguments: '{}' } },
      ],
    },
    { role: 'tool', content: filler(50), tool_call_id: `c${n}` },
  ];
}

/** 30 轮旧工具结果 + 收尾提问:窗口 4000,回收后回落到触发线以下 */
function staleHeavyConversation(): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'system', content: 'sys' }];
  for (let i = 1; i <= 30; i++) msgs.push(...toolRound(i));
  msgs.push({ role: 'user', content: '继续' });
  return msgs;
}

/** 计数 sampler:同时是"有没有请求模型"的探针 */
function countingSampler(): CompactionSampler & { calls: number } {
  const longSummary = '## 任务目标\n' + filler(120);
  const sampler = {
    calls: 0,
    async sampleCompaction() {
      sampler.calls += 1;
      return { response: longSummary };
    },
  };
  return sampler;
}

describe('compressContextV2 回收先行(零模型请求优先)', () => {
  it('回收足够时:一次模型请求都不发,结果标 trigger=reclaim', async () => {
    const sampler = countingSampler();
    const result = await compressContextV2(staleHeavyConversation(), {
      contextLimit: 4000,
      sampler,
      nowMs: 1_000,
      lastActivityAtMs: 1_000, // 空闲 0 ⇒ 只有窗口比例触发能成立
      // P1 之后分母默认要扣输出预留,本用例测的是「回收先行」这一件事,
      // 故把预留关掉、把分母钉回窗口原值 —— 新分母的行为由下面两条用例单独测。
      outputReserveEnabled: false,
    });
    expect(sampler.calls).toBe(0);
    expect(result.compressed).toBe(true);
    expect(result.trigger).toBe('reclaim');
    // P2:闭集原因 —— 回收把体量压回触发线以下,也算"过了触发线并压成了"
    expect(result.reason).toBe('above-threshold');
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    expect(
      result.messages.filter((m) => m.role === 'tool' && m.content === RECLAIM_PLACEHOLDER).length,
    ).toBe(result.removedCount);
  });
});

// ==================== P1/P2 新判据的行为证明 ====================

describe('effectiveContextWindow(共享窗口必须扣输出预留)', () => {
  it('P1-a 新分母只会 ≤ 旧分母(压缩更早触发,绝不更晚)', () => {
    expect(effectiveContextWindow({ contextWindow: 128_000, maxOutputTokens: 8_000 })).toBe(120_000);
    for (const w of [8_000, 32_000, 128_000, 200_000]) {
      expect(effectiveContextWindow({ contextWindow: w })).toBeLessThanOrEqual(w);
    }
  });

  it('P1-b 预留封顶:不得随模型 maxOutput 无限涨', () => {
    // 64K 输出的模型也只让出 MAX_OUTPUT_RESERVE_TOKENS,而不是 64K
    expect(
      effectiveContextWindow({ contextWindow: 32_000, maxOutputTokens: 64_000 }),
    ).toBe(32_000 - MAX_OUTPUT_RESERVE_TOKENS);
    expect(
      effectiveContextWindow({ contextWindow: 32_000, maxOutputTokens: 4_000 }),
    ).toBe(28_000);
  });

  it('P1-c buffer 继续扣;开关关掉即逐字回到旧分母;窗口非正原样返回', () => {
    expect(
      effectiveContextWindow({ contextWindow: 10_000, maxOutputTokens: 1_000, buffer: 500 }),
    ).toBe(8_500);
    expect(
      effectiveContextWindow({ contextWindow: 10_000, maxOutputTokens: 1_000, enabled: false }),
    ).toBe(10_000);
    expect(effectiveContextWindow({ contextWindow: 0 })).toBe(0);
    expect(effectiveContextWindow({ contextWindow: -5 })).toBe(-5);
  });

  it('P1-d 预留吃满窗口时落到地板值 1 ⇒ 走向"压",绝不静默变成"永不触发"', () => {
    expect(effectiveContextWindow({ contextWindow: 300, maxOutputTokens: 4_000 })).toBe(1);
  });

  it('P1-e 默认开启预留时,同一份对话会更早请求摘要(与关闭态成对)', async () => {
    const off = countingSampler();
    await compressContextV2(staleHeavyConversation(), {
      contextLimit: 4000,
      sampler: off,
      nowMs: 1_000,
      lastActivityAtMs: 1_000,
      outputReserveEnabled: false,
    });
    const on = countingSampler();
    const r = await compressContextV2(staleHeavyConversation(), {
      contextLimit: 4000,
      sampler: on,
      nowMs: 1_000,
      lastActivityAtMs: 1_000,
    });
    expect(off.calls).toBe(0); // 旧分母:回收就够
    expect(on.calls).toBeGreaterThan(0); // 新分母:更早触发 ⇒ 回收不够,摘要被请求
    expect(COMPACTION_DECISION_REASONS).toContain(r.reason);
  });
});

describe('压缩决策 reason 闭集', () => {
  it('P2-a 未达触发线 → below-threshold(且值落在声明式闭集内)', async () => {
    const sampler = countingSampler();
    const r = await compressContextV2([{ role: 'user', content: 'hi' }], {
      contextLimit: 100_000,
      sampler,
    });
    expect(r.reason).toBe('below-threshold');
    expect(sampler.calls).toBe(0);
  });

  it('P2-b 值域只允许声明式闭集成员(消费面不得自由发挥字符串)', () => {
    expect(new Set(COMPACTION_DECISION_REASONS).size).toBe(COMPACTION_DECISION_REASONS.length);
    for (const v of [...COMPACTION_DECISION_REASONS, 'nope', '', 'CIRCUIT-BREAKER']) {
      expect(isCompactionDecisionReason(v)).toBe(COMPACTION_DECISION_REASONS.includes(v as never));
    }
  });
});

describe('compressContextV2 回收对照与边界', () => {
  it('对照:关掉回收开关就回到旧的摘要路径(sampler 必被调用)', async () => {
    const sampler = countingSampler();
    const result = await compressContextV2(staleHeavyConversation(), {
      contextLimit: 4000,
      sampler,
      reclaimEnabled: false,
    });
    expect(sampler.calls).toBeGreaterThan(0);
    expect(result.trigger).not.toBe('reclaim');
    // 未回收 ⇒ 没有任何 tool 结果被换成占位串(正文要么原样、要么被摘要吸收)
    expect(result.messages.filter((m) => m.content === RECLAIM_PLACEHOLDER)).toHaveLength(0);
    // 未回收 ⇒ 所有 tool 结果正文仍是原文
    expect(result.messages.some((m) => m.role === 'tool' && m.content.includes('lazy dog'))).toBe(
      true,
    );
  });

  it('无可回收内容时不改写、也不谎报 reclaim(返回原样 none)', async () => {
    const sampler = countingSampler();
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: filler(60) },
      { role: 'assistant', content: filler(60) },
      { role: 'user', content: filler(60) },
      { role: 'assistant', content: filler(60) },
      { role: 'user', content: filler(60) },
    ];
    const result = await compressContextV2(messages, { contextLimit: 200, sampler });
    expect(result.trigger).not.toBe('reclaim');
    expect(
      result.messages.filter((m) => m.role === 'tool' && m.content === RECLAIM_PLACEHOLDER),
    ).toHaveLength(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
