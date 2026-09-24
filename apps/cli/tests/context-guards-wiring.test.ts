// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WP-2 三道有效性守卫的**接线**测试。
 *
 * 本仓最高频的事故类型是"造好没装车"(纯函数单测全绿而主循环一次都没调过它),
 * 所以这里判的是调用关系而不是函数单元:
 *   - 守卫一:provider usage 从 streamChat 的 onUsage 一路到 reverifyContextAfterCompaction
 *     (断言 `source === 'provider-usage'`,估算路径不可能得到这个值);
 *   - 守卫二:熔断 latch 之后主循环**不再调用压缩动作**(直接数 spy 调用次数),
 *     并且面向用户的诊断经 onContextDiagnostic 到人了;
 *   - 守卫三:prompt-too-long 时按完整 round 边界整组丢弃后真的重发了一次请求,
 *     且第二次下发的消息条数严格更少;
 *   - reclaim 的空闲触发:调用方必须把 lastActivityAtMs 传到压缩动作里。
 * 另附 decideCompaction → compressContextV2 的 idle 触发端到端证明。
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type StreamChatOpts = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  onDelta: (delta: string) => void;
  onError?: (err: string, info?: unknown) => void;
  onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void;
};

const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn() }));

vi.mock('@ihui/api-client', () => ({
  streamChat: streamChatMock,
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  formatSSEError: (err: unknown) => ({
    severity: 'unknown' as const,
    title: 'error',
    message: err instanceof Error ? err.message : String(err),
    rawMessage: err instanceof Error ? err.message : String(err),
    requireReauth: false,
  }),
}));

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

import { ContextGuards, isPromptTooLongErrorMessage, recoverAfterOverflow } from '../src/context-guards.js';
import { RefillBreaker, type ChatMessage, type CompressionResult } from '../src/context.js';
import { compressContextV2 } from '../src/compaction-v2.js';
import { runToolLoop } from '../src/commands/agent.js';
import { registerTools, clearTools, type Tool } from '../src/tools/index.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const FIXTURE_ROOT = path.join(REPO_ROOT, '.ihui-agent', 'tmp');

function filler(times: number): string {
  return 'The quick brown fox jumps over the lazy dog. '.repeat(times);
}

/** 不产生任何压缩动作也能过的最小压缩结果 */
function noopCompression(messages: ChatMessage[]): CompressionResult {
  return {
    messages,
    compressed: false,
    originalTokens: 0,
    compressedTokens: 0,
    removedCount: 0,
    trigger: 'none',
  };
}

describe('ContextGuards:压缩前的闸门与压缩后的登记', () => {
  it('把 lastActivityAtMs 透给压缩动作(reclaim 空闲触发的唯一数据源)', async () => {
    let now = 1_000;
    const guards = new ContextGuards({ contextLimit: 4_000, now: () => now });
    const seen: Array<number | undefined> = [];
    await guards.compactIfNeeded([], 1, async (msgs, ctx) => {
      seen.push(ctx.lastActivityAtMs);
      return noopCompression(msgs);
    });
    now = 9_000;
    guards.touchActivity();
    await guards.compactIfNeeded([], 2, async (msgs, ctx) => {
      seen.push(ctx.lastActivityAtMs);
      return noopCompression(msgs);
    });
    expect(seen).toEqual([1_000, 9_000]);
  });

  it('只有真发生压缩才登记熔断事件(未压缩不给无关数字打分)', async () => {
    const guards = new ContextGuards({ contextLimit: 4_000 });
    let calls = 0;
    const action = async (msgs: ChatMessage[]): Promise<CompressionResult> => {
      calls += 1;
      return noopCompression(msgs);
    };
    for (let i = 1; i <= 4; i++) await guards.compactIfNeeded([], i, action);
    expect(calls).toBe(4);
    expect(guards.consecutiveQuickRefills).toBe(0);
    expect(guards.isSuspended).toBe(false);
    // 未压缩过 → 真值复测不该给出结论
    expect(guards.verifyAfterRequest({ messages: [] })).toBeNull();
  });

  it('真值复测优先用 provider usage,拿不到才退回估算并如实标 estimate', async () => {
    const guards = new ContextGuards({ contextLimit: 10_000 });
    const compressed: ChatMessage[] = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }];
    const action = async (msgs: ChatMessage[]): Promise<CompressionResult> => ({
      messages: msgs,
      compressed: true,
      originalTokens: 9_000,
      compressedTokens: 8_000,
      removedCount: 3,
      trigger: 'ratio',
    });
    // 无 usage:估算口径
    await guards.compactIfNeeded(compressed, 1, action);
    const byEstimate = guards.verifyAfterRequest({ messages: compressed, tokensAfterCompaction: 8_000 });
    expect(byEstimate?.source).toBe('estimate');
    expect(byEstimate?.meetsTarget).toBe(false); // 8000 > 10000*0.6 → 如实报"没压到位"
    // 有 usage:真值口径覆盖估算
    await guards.compactIfNeeded(compressed, 5, action);
    guards.recordProviderUsage({ promptTokens: 3_000, totalTokens: 3_100 });
    const byUsage = guards.verifyAfterRequest({ messages: compressed, tokensAfterCompaction: 8_000 });
    expect(byUsage?.source).toBe('provider-usage');
    expect(byUsage?.effectiveTokens).toBe(3_000);
    expect(byUsage?.meetsTarget).toBe(true);
    expect(byUsage?.estimateDriftTokens).toBe(-5_000);
  });

  it('连续快速回填即 latch:此后不再调用压缩动作,并给出到人诊断', async () => {
    const guards = new ContextGuards({
      contextLimit: 4_000,
      breaker: new RefillBreaker({ windowRounds: 2, maxConsecutive: 2 }),
    });
    let actionCalls = 0;
    const compressing: CompressionResult = {
      messages: [{ role: 'system', content: 'sys' }],
      compressed: true,
      originalTokens: 3_900,
      compressedTokens: 3_600,
      removedCount: 1,
      trigger: 'ratio',
    };
    const action = async () => {
      actionCalls += 1;
      return compressing;
    };

    const first = await guards.compactIfNeeded([], 1, action);
    const second = await guards.compactIfNeeded([], 2, action);
    const third = await guards.compactIfNeeded([], 3, action);
    expect(first.userDiagnostic).toBeNull();
    // 事件 1 无轮距 → 不计;事件 2/3 都在窗口内回填 → 计数 1、2 → 第 3 次触发熔断
    expect(second.suspended).toBe(false);
    expect(second.consecutiveQuickRefills).toBe(1);
    expect(third.suspended).toBe(true);
    expect(third.userDiagnostic).toContain('上下文自动压缩已暂停');
    expect(guards.isSuspended).toBe(true);

    // 熔断之后:压缩动作一次都不再被调用(这就是"停止自动压缩"的可测形态)
    actionCalls = 0;
    const fourth = await guards.compactIfNeeded([], 4, action);
    const fifth = await guards.compactIfNeeded([], 5, action);
    expect(actionCalls).toBe(0);
    expect(fourth.compressed).toBe(false);
    expect(fifth.userDiagnostic).toContain('上下文自动压缩已暂停');
    // 挂起期间返回的就是原消息,没有偷偷改写历史
    expect(fourth.messages).toEqual([]);
  });

  it('resume() 解除 latch 后重新允许压缩', async () => {
    const guards = new ContextGuards({
      contextLimit: 4_000,
      breaker: new RefillBreaker({ windowRounds: 5, maxConsecutive: 1 }),
    });
    const action = async (msgs: ChatMessage[]): Promise<CompressionResult> => ({
      ...noopCompression(msgs),
      compressed: true,
    });
    // 第一次压缩只是"首次事件"(没有轮距可比),第二次才算快速回填
    await guards.compactIfNeeded([], 1, action);
    expect(guards.isSuspended).toBe(false);
    await guards.compactIfNeeded([], 2, action);
    expect(guards.isSuspended).toBe(true);
    guards.resume();
    expect(guards.isSuspended).toBe(false);
    const after = await guards.compactIfNeeded([], 9, action);
    expect(after.compressed).toBe(true);
  });
});

describe('守卫三的判据与配对保护', () => {
  it('prompt-too-long 识别覆盖各家措辞,普通 4xx 不误判', () => {
    expect(isPromptTooLongErrorMessage('This model\'s maximum context length is 4096 tokens')).toBe(true);
    expect(isPromptTooLongErrorMessage('prompt is too long: 210000 tokens > 200000 maximum')).toBe(true);
    expect(isPromptTooLongErrorMessage('context_length_exceeded')).toBe(true);
    expect(isPromptTooLongErrorMessage('请求上下文超长')).toBe(true);
    expect(isPromptTooLongErrorMessage('401 Unauthorized')).toBe(false);
    expect(isPromptTooLongErrorMessage('')).toBe(false);
    expect(isPromptTooLongErrorMessage(undefined)).toBe(false);
  });

  it('丢弃按完整 round 边界,绝不留下孤儿 tool 消息', () => {
    const messages: ChatMessage[] = [{ role: 'system', content: 'sys' }];
    for (let i = 1; i <= 8; i++) {
      messages.push({
        role: 'assistant',
        content: `r${i}`,
        tool_calls: [{ id: `call-${i}`, type: 'function', function: { name: 'read_file', arguments: '{}' } }],
      });
      messages.push({ role: 'tool', content: filler(40), tool_call_id: `call-${i}` });
    }
    messages.push({ role: 'user', content: '继续' });
    const recovery = recoverAfterOverflow(messages, { contextLimit: 2_000 });
    expect(recovery.resolved).toBe(true);
    expect(recovery.droppedRounds).toBeGreaterThan(0);
    expect(recovery.orphanToolMessages).toBe(0);
    // 配对完整:每个 tool 消息都能在自己的前面找到 tool_calls
    const kept = recovery.messages;
    for (let i = 0; i < kept.length; i++) {
      const m = kept[i]!;
      if (m.role !== 'tool' || !m.tool_call_id) continue;
      const matched = kept.slice(0, i).some((x) => x.tool_calls?.some((tc) => tc.id === m.tool_call_id));
      expect(matched).toBe(true);
    }
  });
});

describe('reclaim 空闲触发经 decideCompaction 的端到端证明', () => {
  /** 窗口比例远低于 0.6(不可能靠比例触发),只有"空闲"这一条腿能让它回收 */
  function staleConversation(): ChatMessage[] {
    const msgs: ChatMessage[] = [{ role: 'system', content: 'sys' }];
    for (let i = 1; i <= 12; i++) {
      msgs.push({
        role: 'assistant',
        content: `第 ${i} 次`,
        tool_calls: [{ id: `c${i}`, type: 'function', function: { name: 'grep', arguments: '{}' } }],
      });
      msgs.push({ role: 'tool', content: filler(20), tool_call_id: `c${i}` });
    }
    msgs.push({ role: 'user', content: '继续' });
    return msgs;
  }

  it('传了 lastActivityAtMs 才走 idle 回收;不传则判 not-triggered', async () => {
    const withIdle = await compressContextV2(staleConversation(), {
      contextLimit: 100_000,
      reclaimEnabled: true,
      lastActivityAtMs: 0,
      nowMs: 10 * 60 * 1000,
      sampler: { async sampleCompaction() { return { response: filler(500) }; } },
    });
    expect(withIdle.compressed).toBe(true);
    expect(withIdle.trigger).toBe('reclaim');

    const withoutIdle = await compressContextV2(staleConversation(), {
      contextLimit: 100_000,
      nowMs: 10 * 60 * 1000,
      sampler: { async sampleCompaction() { return { response: filler(500) }; } },
    });
    expect(withoutIdle.trigger).not.toBe('reclaim');
  });
});

describe('runToolLoop 装车证明(守卫真的在主循环里跑)', () => {
  let workspace = '';

  beforeEach(() => {
    clearTools();
    streamChatMock.mockReset();
    fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
    workspace = fs.mkdtempSync(path.join(FIXTURE_ROOT, 'guards-loop-'));
  });

  afterEach(() => {
    clearTools();
    if (typeof clearToolsForTest === 'function') clearToolsForTest();
    if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('熔断 latch 后循环不再调用压缩动作,诊断经回调到人', async () => {
    let compactionCalls = 0;
    const guards = new ContextGuards({
      contextLimit: 4_000,
      breaker: new RefillBreaker({ windowRounds: 5, maxConsecutive: 2 }),
    });
    const diagnostics: string[] = [];
    const compactContext = async (msgs: ChatMessage[]): Promise<CompressionResult> => {
      compactionCalls += 1;
      return { ...noopCompression(msgs), compressed: true, trigger: 'ratio' };
    };
    // streamChat 每轮都直接 end_turn ⇒ 每次 runOnce 恰好登记一次压缩事件;
    // 轮次序号在每次 runToolLoop 内从 1 起算,轮距 0 ≤ windowRounds → 算快速回填。
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      opts.onDelta('完成。');
    });
    const runOnce = () =>
      runToolLoop({
        modelId: 'test',
        messages: [{ role: 'user', content: 'go' } as ChatMessage],
        ctx: { workspacePath: workspace },
        maxIterations: 2,
        contextLimit: 4_000,
        contextGuards: guards,
        compactContext,
        onContextDiagnostic: (d) => diagnostics.push(d),
      });

    await runOnce();
    await runOnce();
    await runOnce();
    // 事件 1 无轮距可比 → 不计数;事件 2 快速回填=1;事件 3 快速回填=2 → 熔断(所以调了 3 次)
    expect(compactionCalls).toBe(3);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain('上下文自动压缩已暂停');
    expect(guards.isSuspended).toBe(true);
    // 熔断后再跑一整轮循环:压缩动作**一次都不再被调用**,但用户仍然被告知为什么不动
    await runOnce();
    expect(compactionCalls).toBe(3);
    expect(diagnostics).toHaveLength(2);
  });

  it('provider usage 经 onUsage 到达真值复测(不是只测单元)', async () => {
    const guards = new ContextGuards({ contextLimit: 100_000 });
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      opts.onUsage?.({ promptTokens: 4_321, completionTokens: 12, totalTokens: 4_333 });
      opts.onDelta('完成。');
    });
    await runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: 'go' } as ChatMessage],
      ctx: { workspacePath: workspace },
      maxIterations: 1,
      contextLimit: 100_000,
      contextGuards: guards,
      compactContext: async (msgs) => ({ ...noopCompression(msgs), compressed: true, trigger: 'ratio' }),
    });
    expect(guards.providerUsageAvailable).toBe(true);
    expect(guards.lastReverified?.source).toBe('provider-usage');
    expect(guards.lastReverified?.authoritativeTokens).toBe(4_321);
  });

  it('prompt-too-long 时整组丢弃最老轮次后重发,第二次下发条数严格更少', async () => {
    const messages: ChatMessage[] = [{ role: 'system', content: 'sys' }];
    for (let i = 1; i <= 8; i++) {
      messages.push({
        role: 'assistant',
        content: `r${i}`,
        tool_calls: [{ id: `c${i}`, type: 'function', function: { name: 'grep', arguments: '{}' } }],
      });
      messages.push({ role: 'tool', content: filler(40), tool_call_id: `c${i}` });
    }
    messages.push({ role: 'user', content: '继续' });

    let call = 0;
    const seenMessageCounts: number[] = [];
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      seenMessageCounts.push(opts.messages.length);
      call += 1;
      if (call === 1) {
        opts.onError?.("This model's maximum context length is 4096 tokens");
        return;
      }
      opts.onDelta('恢复完成。');
    });

    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: workspace },
      maxIterations: 2,
      contextLimit: 2_000,
      // 本用例判的是"溢出后整组丢弃"这条腿,不能让摘要压缩先把体量降下来
      // (否则丢轮判据看到的是已压缩过的视图,测不到本守卫)。
      compactContext: async (msgs) => noopCompression(msgs),
    });

    expect(streamChatMock).toHaveBeenCalledTimes(2);
    expect(seenMessageCounts[1]!).toBeLessThan(seenMessageCounts[0]!);
    // 溢出被恢复,不是把它当错误终止
    expect(result.stopReason).toBe('end_turn');
    // 恢复是"下发视图"的裁剪,不得把用户的原始历史就地删掉:
    // 18 条原历史(1 system + 8×2 + 1 user)全部在位,只多了本轮 assistant 回复
    expect(messages.length).toBe(1 + 8 * 2 + 1 + 1);
    expect(messages.filter((m) => m.role === 'tool')).toHaveLength(8);
  });

  it('超限工具结果不落进上下文,压缩后请求里带重建的已读提醒', async () => {
    const big = filler(4_000); // 远超 read_file 的 24K 字符预算
    const readTool: Tool = {
      name: 'read_file',
      description: 'test',
      parameters: { path: { type: 'string', description: 'p' } },
      required: ['path'],
      execute: async () => ({ success: true, output: big }),
    };
    clearTools();
    registerTools([readTool]);

    const calls: Array<Array<{ role: string; content: string }>> = [];
    let turn = 0;
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      calls.push(opts.messages);
      turn += 1;
      if (turn === 1) {
        opts.onDelta('```tool_call\n{"name":"read_file","arguments":{"path":"src/big.ts"}}\n```');
        return;
      }
      opts.onDelta('完成。');
    });

    const result = await runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: '读一下 src/big.ts' } as ChatMessage],
      ctx: { workspacePath: workspace },
      sessionId: 'loop-envelope',
      maxIterations: 3,
      contextLimit: 100_000,
      // 第 2 轮起报告"压缩发生过",以此驱动提醒段重建这条腿
      compactContext: async (msgs) => ({ ...noopCompression(msgs), compressed: true, trigger: 'ratio' }),
    });

    expect(result.stopReason).toBe('end_turn');
    expect(calls.length).toBe(2);
    const second = calls[1]!.map((m) => m.content).join('\n');
    // ① 超限正文没有整段进上下文
    expect(second.length).toBeLessThan(big.length / 2);
    // ② 取而代之的是信封(路径 + 预览 + 截断说明)
    expect(second).toContain('[[结果信封 v1]]');
    expect(second).toContain('正文未进入上下文');
    const artifactFile = path.join(workspace, '.ihui-agent', 'tmp', 'tool-artifacts', 'loop-envelope');
    expect(fs.existsSync(artifactFile)).toBe(true);
    // ③ 压缩后重建的"最近已读文件"提醒段被注入到本轮请求里
    expect(second).toContain('[最近已读文件 · 压缩后重建]');
    expect(second).toContain('src/big.ts');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
