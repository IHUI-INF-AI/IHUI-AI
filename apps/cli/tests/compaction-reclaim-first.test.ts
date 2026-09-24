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
    });
    expect(sampler.calls).toBe(0);
    expect(result.compressed).toBe(true);
    expect(result.trigger).toBe('reclaim');
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    expect(
      result.messages.filter((m) => m.role === 'tool' && m.content === RECLAIM_PLACEHOLDER).length,
    ).toBe(result.removedCount);
  });

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
