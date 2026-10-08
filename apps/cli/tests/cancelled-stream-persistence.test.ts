// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-634(2026-09-29)被取消的流也必须持久化。
 *
 * 票面判据:cancelled 的部分回答不得整段丢弃,须落"已取消"终态+已有内容。
 * 此前取消打断正在流的这一轮时,流中已累积的回答随 abort 整段蒸发 —— 既不进
 * messages(下游 --resume/会话持久化自然看不到),assistantText 也不含它。
 *
 * 测试策略(与 stream-tool-ledger-wiring 同一 mock 骨架):mock streamChat,
 * 流中先吐若干 delta 再触发 abort,驱动**真的 runToolLoop**,断言:
 *   ① 流中已有内容以 assistant 消息落进 messages(持久化的事实载体);
 *   ② result.assistantText 包含已有内容(结果面不得静默变短);
 *   ③ stopReason='cancelled'(已取消终态,不得误报成完整 end_turn);
 *   ④ 反向对照:无任何 delta 就取消 ⇒ 不落空消息(没有内容就没有可保的);
 *   ⑤ 正常完成路径零回归:整轮文本只入账一次,结算口不重复追加。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type StreamChatOpts = {
  onDelta: (delta: string) => void;
  onError?: (err: string, info?: unknown) => void;
};

const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn() }));

import type * as ApiClient from '@ihui/api-client'
vi.mock('@ihui/api-client', async (importOriginal) => {
  // 部分 mock:保留本文件自己列出的桩(真发网络/真写盘的那几个),其余导出走真实实现。
  const actual = await importOriginal<typeof ApiClient>()
  return {
    ...actual,
    streamChat: streamChatMock,
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
    fetchApi: vi.fn(async () => ({ success: true, data: { recorded: 0, failed: 0 } })),
    getToken: () => null,
    formatSSEError: (err: unknown) => ({
      severity: 'unknown' as const,
      title: 'error',
      message: err instanceof Error ? err.message : String(err),
      rawMessage: err instanceof Error ? err.message : String(err),
      requireReauth: false,
    }),
  }
});

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

import { runToolLoop } from '../src/commands/agent.js';
import { buildCancelledStreamSettlement, CANCELLED_STREAM_TERMINAL } from '../src/cancelled-stream-settlement.js';
import type { ChatMessage } from '../src/context.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const FIXTURE_ROOT = path.join(REPO_ROOT, '.ihui-agent', 'tmp');

describe('G-634 取消流的结算出口(部分回答不整段丢弃)', () => {
  let workspace = '';

  beforeEach(() => {
    streamChatMock.mockReset();
    fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
    workspace = fs.mkdtempSync(path.join(FIXTURE_ROOT, 'cancelled-stream-'));
  });

  afterEach(() => {
    if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
  });

  function makeMessages(): ChatMessage[] {
    return [{ role: 'user', content: 'go' } as ChatMessage];
  }

  it('流中已有内容 + 取消:内容落进 messages、assistantText,终态 cancelled', async () => {
    const controller = new AbortController();
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      o.onDelta('部分回答:');
      o.onDelta('还没说完');
      controller.abort();
      throw new Error('The operation was aborted');
    });
    const messages = makeMessages();
    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: workspace },
      signal: controller.signal,
      maxIterations: 3,
    });

    expect(result.stopReason).toBe('cancelled'); // 已取消终态,不是 end_turn/error
    expect(result.assistantText).toContain('还没说完'); // 结果面不静默变短
    const assistants = messages.filter((m) => m.role === 'assistant');
    expect(assistants).toHaveLength(1); // 恰好一条,不丢也不重
    expect(assistants[0]!.content).toContain('部分回答:');
    expect(assistants[0]!.content).toContain('还没说完');
  });

  it('反向对照:一个 delta 都没收到就取消 ⇒ 不落空消息,终态仍是 cancelled', async () => {
    const controller = new AbortController();
    streamChatMock.mockImplementation(async () => {
      controller.abort();
      throw new Error('The operation was aborted');
    });
    const messages = makeMessages();
    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: workspace },
      signal: controller.signal,
      maxIterations: 3,
    });

    expect(result.stopReason).toBe('cancelled');
    expect(result.assistantText).toBe('');
    expect(messages.filter((m) => m.role === 'assistant')).toHaveLength(0);
  });

  it('正常完成零回归:整轮文本只入账一次,取消结算口不重复追加', async () => {
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      o.onDelta('完整回答。');
    });
    const messages = makeMessages();
    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: workspace },
      maxIterations: 3,
    });

    expect(result.stopReason).toBe('end_turn');
    expect(result.assistantText).toBe('完整回答。');
    const assistants = messages.filter((m) => m.role === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(assistants[0]!.content).toBe('完整回答。');
  });

  it('结算事实形状:终态恒为 cancelled、内容逐字保留、truncated 恒真', () => {
    const settledAt = 1_790_000_000_000;
    const settlement = buildCancelledStreamSettlement('流中残段', () => settledAt);
    expect(settlement.terminal).toBe(CANCELLED_STREAM_TERMINAL);
    expect(settlement.terminal).toBe('cancelled');
    expect(settlement.content).toBe('流中残段'); // 逐字保留,不改写不截断
    expect(settlement.truncated).toBe(true);
    expect(settlement.settledAtMs).toBe(settledAt);
  });
});
