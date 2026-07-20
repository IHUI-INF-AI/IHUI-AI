import { describe, expect, it, vi } from 'vitest';
import {
  selectTurnsToCompact,
  shouldCompact,
  isDegenerateSummary,
  formatCompactSummary,
  reductionGuard,
  sampleWithRetry,
  compressContextV2,
  type CompactionSampler,
  type CompactionObserver,
  type ChatMessage,
} from '../src/compaction-v2.js';
import { compressContextIfNeeded } from '../src/context.js';

// ==================== 测试工具 ====================

/** 生成固定长度摘要(避免退化检测) */
function makeSummary(minChars = 600): string {
  return '这是一段足够长的摘要内容用于通过退化检测。'.repeat(Math.ceil(minChars / 20) + 1);
}

/** Mock Sampler:可控制失败行为 */
class MockCompactionSampler implements CompactionSampler {
  public calls = 0;
  public callArgs: { messages: ChatMessage[]; timeoutMs: number }[] = [];
  constructor(
    public response: string,
    public failWith?: (call: number) => Error | null,
  ) {}

  async sampleCompaction(
    messages: ChatMessage[],
    opts: { timeoutMs: number },
  ): Promise<{ response: string; thinking?: string }> {
    this.calls++;
    this.callArgs.push({ messages, timeoutMs: opts.timeoutMs });
    if (this.failWith) {
      const err = this.failWith(this.calls);
      if (err) throw err;
    }
    return { response: this.response, thinking: 'mock-thinking' };
  }
}

/** 构造大消息列表触发压缩 */
function buildLargeMessages(count: number, contentSize = 1000): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'system', content: 'system prompt' }];
  const filler = 'A'.repeat(contentSize);
  for (let i = 0; i < count; i++) {
    msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `${filler}_msg_${i}` });
  }
  return msgs;
}

// ==================== selectTurnsToCompact ====================

describe('selectTurnsToCompact', () => {
  it('基础分割:head + tail,尾部至少保留 keepRecent 条', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `msg_${i}_${'x'.repeat(100)}`,
      })),
    ];
    const result = selectTurnsToCompact(messages, 500, { keepRecent: 6 });
    expect(result.splitIndex).toBeGreaterThan(0);
    expect(result.splitIndex).toBeLessThan(messages.length);
    expect(result.headToCompact.length + result.tailToKeep.length).toBe(messages.length);
    // 尾部至少 6 条 non-system
    const tailNonSystem = result.tailToKeep.filter((m) => m.role !== 'system');
    expect(tailNonSystem.length).toBeGreaterThanOrEqual(6);
  });

  it('tool-pair safe boundary:split 不落在 [工具结果 ✓] 标记上', () => {
    // 构造:system + 大量 user/assistant(强制 split 落在 tool result 附近)+ tool result + recent
    const big = 'B'.repeat(500);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: `${big}_u1` },
      { role: 'assistant', content: `${big}_a1` },
      { role: 'user', content: `${big}_u2` },
      { role: 'assistant', content: `${big}_a2` },
      { role: 'user', content: `${big}_u3` },
      { role: 'assistant', content: `${big}_a3` },
      { role: 'user', content: `${big}_u4` },
      { role: 'assistant', content: `[工具结果 ✓] read_file 成功\n${big}` }, // tool result
      { role: 'user', content: 'recent_u1' },
      { role: 'assistant', content: 'recent_a1' },
    ];
    // keepRecent=2,targetTokens 很小 → split 应落在 tool result 附近,snap 后前移
    const result = selectTurnsToCompact(messages, 50, { keepRecent: 2 });
    // 尾部不应以 tool result 开头
    const tailNonSystem = result.tailToKeep.filter((m) => m.role !== 'system');
    if (tailNonSystem.length > 0) {
      const firstTail = tailNonSystem[0]!;
      const isToolResult = firstTail.role === 'user' && /\[工具结果\s*[✓✗]\]/.test(firstTail.content);
      expect(isToolResult).toBe(false);
    }
  });

  it('keepRecent=0 时允许全部压缩(尾部可为空或最小)', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
    ];
    const result = selectTurnsToCompact(messages, 0, { keepRecent: 0 });
    // targetTokens=0 + keepRecent=0 → 全部进入 head
    expect(result.tailToKeep.filter((m) => m.role !== 'system').length).toBe(0);
    expect(result.headToCompact.length).toBe(messages.length);
  });

  it('只有 system 消息时返回空 head', () => {
    const messages: ChatMessage[] = [{ role: 'system', content: 'sys' }];
    const result = selectTurnsToCompact(messages, 1000, { keepRecent: 6 });
    expect(result.headToCompact).toEqual([]);
    expect(result.tailToKeep).toEqual(messages);
    expect(result.splitIndex).toBe(0);
  });
});

// ==================== shouldCompact ====================

describe('shouldCompact', () => {
  it('tokens < 0.88 limit 不触发', () => {
    const r = shouldCompact(7000, 10000);
    expect(r.shouldCompact).toBe(false);
    expect(r.trigger).toBe('none');
    expect(r.percent).toBeCloseTo(0.7, 5);
  });

  it('tokens > 0.88 limit 触发', () => {
    const r = shouldCompact(9000, 10000);
    expect(r.shouldCompact).toBe(true);
    expect(r.trigger).toBe('ratio');
    expect(r.percent).toBeCloseTo(0.9, 5);
  });

  it('percent 计算正确', () => {
    const r = shouldCompact(5000, 10000, undefined, { triggerRatio: 0.5 });
    expect(r.percent).toBeCloseTo(0.5, 5);
    // 严格 > 才触发,0.5 不 > 0.5
    expect(r.shouldCompact).toBe(false);
  });

  it('contextLimit <= 0 不触发(避免除零)', () => {
    const r = shouldCompact(1000, 0);
    expect(r.shouldCompact).toBe(false);
    expect(r.percent).toBe(0);
  });
});

// ==================== isDegenerateSummary ====================

describe('isDegenerateSummary', () => {
  it('< 500 字符返回 true(退化)', () => {
    expect(isDegenerateSummary('a'.repeat(499))).toBe(true);
  });

  it('> 500 字符返回 false(正常)', () => {
    expect(isDegenerateSummary('a'.repeat(501))).toBe(false);
  });

  it('trim 后判断(前后空白不计入长度)', () => {
    expect(isDegenerateSummary('   ' + 'a'.repeat(400) + '   ')).toBe(true);
    expect(isDegenerateSummary('   ' + 'a'.repeat(600) + '   ')).toBe(false);
  });

  it('自定义阈值', () => {
    expect(isDegenerateSummary('short', 100)).toBe(true);
    expect(isDegenerateSummary('a'.repeat(101), 100)).toBe(false);
  });
});

// ==================== formatCompactSummary ====================

describe('formatCompactSummary', () => {
  it('清理 <analysis> 标签', () => {
    const input = '<analysis>内部思考</analysis>实际摘要内容';
    expect(formatCompactSummary(input)).toBe('内部思考 实际摘要内容');
  });

  it('清理 <thinking> 标签(带属性)', () => {
    const input = '<thinking type="deep">推理过程</thinking>最终结论';
    expect(formatCompactSummary(input)).toBe('推理过程 最终结论');
  });

  it('多 whitespace 归一为单空格', () => {
    const input = '摘要\n\n\n   内容\t\t更多   内容';
    expect(formatCompactSummary(input)).toBe('摘要 内容 更多 内容');
  });

  it('清理 <summary> 标签并 trim', () => {
    const input = '  <summary>核心要点</summary>  ';
    expect(formatCompactSummary(input)).toBe('核心要点');
  });
});

// ==================== reductionGuard ====================

describe('reductionGuard', () => {
  it('tokensAfter > before*0.8 → 拒绝', () => {
    const r = reductionGuard(1000, 850); // 0.85 > 0.8
    expect(r.accepted).toBe(false);
    expect(r.ratio).toBeCloseTo(0.85, 5);
  });

  it('tokensAfter <= before*0.8 → 接受', () => {
    const r = reductionGuard(1000, 700); // 0.7 <= 0.8
    expect(r.accepted).toBe(true);
    expect(r.ratio).toBeCloseTo(0.7, 5);
  });

  it('ratio 计算正确', () => {
    const r = reductionGuard(2000, 1000);
    expect(r.ratio).toBeCloseTo(0.5, 5);
    expect(r.accepted).toBe(true);
  });

  it('tokensBefore <= 0 时接受(避免除零)', () => {
    const r = reductionGuard(0, 100);
    expect(r.accepted).toBe(true);
    expect(r.ratio).toBe(0);
  });

  it('自定义 maxReductionRatio', () => {
    expect(reductionGuard(1000, 600, 0.5).accepted).toBe(false); // 0.6 > 0.5
    expect(reductionGuard(1000, 400, 0.5).accepted).toBe(true); // 0.4 <= 0.5
  });
});

// ==================== sampleWithRetry ====================

describe('sampleWithRetry', () => {
  it('瞬态错误重试直到成功', async () => {
    const sampler = new MockCompactionSampler(
      makeSummary(),
      (call) => (call < 3 ? new Error('timeout error') : null),
    );
    const r = await sampleWithRetry(
      [{ role: 'user', content: 'hi' }],
      sampler,
      { maxAttempts: 3, retryDelayMs: 10, samplingTimeoutMs: 1000 },
    );
    expect(r.attempts).toBe(3);
    expect(r.statusLabel).toBe('ok');
    expect(sampler.calls).toBe(3);
  });

  it('确定性错误(4xx)不重试,立即抛出', async () => {
    const sampler = new MockCompactionSampler(
      makeSummary(),
      () => new Error('HTTP 400 Bad Request'),
    );
    await expect(
      sampleWithRetry(
        [{ role: 'user', content: 'hi' }],
        sampler,
        { maxAttempts: 3, retryDelayMs: 10 },
      ),
    ).rejects.toThrow(/4xx/);
    expect(sampler.calls).toBe(1);
  });

  it('达到 maxAttempts 仍失败 → 抛出 transient-exhausted', async () => {
    const sampler = new MockCompactionSampler(
      makeSummary(),
      () => new Error('network error'),
    );
    await expect(
      sampleWithRetry(
        [{ role: 'user', content: 'hi' }],
        sampler,
        { maxAttempts: 2, retryDelayMs: 10 },
      ),
    ).rejects.toThrow(/transient-exhausted/);
    expect(sampler.calls).toBe(2);
  });

  it('首次成功不重试', async () => {
    const sampler = new MockCompactionSampler(makeSummary());
    const r = await sampleWithRetry(
      [{ role: 'user', content: 'hi' }],
      sampler,
      { maxAttempts: 3, retryDelayMs: 10 },
    );
    expect(r.attempts).toBe(1);
    expect(sampler.calls).toBe(1);
  });
});

// ==================== compressContextV2 端到端 ====================

describe('compressContextV2 端到端', () => {
  it('不触发(消息少 / token 未达阈值)→ 原样返回', async () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    const r = await compressContextV2(messages, { contextLimit: 100000 });
    expect(r.compressed).toBe(false);
    expect(r.trigger).toBe('none');
    expect(r.messages).toBe(messages);
  });

  it('sampler 未提供 → fallback 到 compressContextIfNeeded', async () => {
    // 触发压缩但无 sampler(100 条 ~13000 tokens 远超 8000*0.88=7040)
    const messages = buildLargeMessages(100, 1000);
    const r = await compressContextV2(messages, { contextLimit: 8000 });
    // fallback 走 v1,v1 会压缩(因为 token 远超 88%)
    const v1Result = compressContextIfNeeded(messages, { contextLimit: 8000 });
    expect(r.compressed).toBe(v1Result.compressed);
    expect(r.messages).toEqual(v1Result.messages);
  });

  it('退化摘要(< 500 字符)→ fallback', async () => {
    const messages = buildLargeMessages(100, 1000);
    const degenerateSampler = new MockCompactionSampler('短摘要,退化');
    const observer: CompactionObserver = {
      onSuccess: vi.fn(),
      onError: vi.fn(),
    };
    const r = await compressContextV2(messages, {
      contextLimit: 8000,
      sampler: degenerateSampler,
      observer,
    });
    // 退化 → fallback 到 v1
    const v1Result = compressContextIfNeeded(messages, { contextLimit: 8000 });
    expect(r.messages).toEqual(v1Result.messages);
    expect(observer.onError).toHaveBeenCalledWith(
      expect.objectContaining({ statusLabel: 'degenerate-summary' }),
    );
  });

  it('reduction guard 拒绝(摘要过大导致压完 token 反增)→ fallback', async () => {
    // 30 条 ~3900 tokens,contextLimit=4000 触发(>3400),head 较小
    const messages = buildLargeMessages(30, 1000);
    // 构造超大摘要使 compressedTokens > originalTokens * 0.8
    const hugeSummary = 'Z'.repeat(50000);
    const sampler = new MockCompactionSampler(hugeSummary);
    const observer: CompactionObserver = {
      onSuccess: vi.fn(),
      onError: vi.fn(),
    };
    const r = await compressContextV2(messages, {
      contextLimit: 4000,
      sampler,
      observer,
      maxReductionRatio: 0.8,
    });
    // 拒绝 → fallback
    const v1Result = compressContextIfNeeded(messages, { contextLimit: 4000 });
    expect(r.messages).toEqual(v1Result.messages);
    expect(observer.onError).toHaveBeenCalledWith(
      expect.objectContaining({ statusLabel: 'reduction-rejected' }),
    );
  });

  it('正常压缩 → 返回 summary + tail,observer.onSuccess 被调用', async () => {
    // 100 条 ~13000 tokens 远超 8000*0.88=7040,触发压缩
    const messages = buildLargeMessages(100, 1000);
    const goodSummary = makeSummary(700); // 700 字符 ~ 200 tokens,远小于 head
    const sampler = new MockCompactionSampler(goodSummary);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const observer: CompactionObserver = { onSuccess, onError };
    const r = await compressContextV2(messages, {
      contextLimit: 8000,
      sampler,
      observer,
      keepRecent: 6,
      maxReductionRatio: 0.8,
    });
    expect(r.compressed).toBe(true);
    expect(r.trigger).toBe('ratio');
    expect(r.compressedTokens).toBeLessThan(r.originalTokens);
    // 结果含 system + summary + tail
    expect(r.messages[0]?.role).toBe('system');
    const hasSummary = r.messages.some(
      (m) => m.role === 'user' && m.content.includes('上下文摘要'),
    );
    expect(hasSummary).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    const callArg = onSuccess.mock.calls[0]![0];
    expect(callArg.tokensBefore).toBe(r.originalTokens);
    expect(callArg.tokensAfter).toBe(r.compressedTokens);
    expect(callArg.turnsCompacted).toBeGreaterThan(0);
  });

  it('消息数 < minMessages → fallback 到 v1', async () => {
    // 触发阈值但消息数不足 minMessages(用小 contextLimit + 小内容避免 tokenizer 慢)
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'X'.repeat(1000) }, // ~130 tokens > 88 (0.88*100)
    ];
    const sampler = new MockCompactionSampler(makeSummary());
    const r = await compressContextV2(messages, {
      contextLimit: 100, // 极小,触发
      sampler,
      minMessages: 10,
    });
    const v1Result = compressContextIfNeeded(messages, { contextLimit: 100 });
    expect(r.messages).toEqual(v1Result.messages);
  });
});
