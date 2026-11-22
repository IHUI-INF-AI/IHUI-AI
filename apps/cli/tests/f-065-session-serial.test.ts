// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-065 回归:同会话并发回合必须串行,且 cancel 中止该会话全部在飞回合。
 *
 * 失败形态(修前):两条同 sessionId 的请求共用 messages 数组并发改写,
 * `state.abort = abort` 覆盖前一个 ⇒ 先跑的回合无法取消,历史交叉污染。
 *
 * 这里 mock 掉 setupAgentTools/runToolLoop 与会话读写,只留 AgentCore 自身的
 * 排队与中止语义 —— 真实模型调用不是本票的变量。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/commands/agent.js', () => ({
  setupAgentTools: vi.fn(async () => ({ systemPrompt: 'SYS', ctx: {} })),
  runToolLoop: vi.fn(),
  createToolDeltaBridge: () => ({
    noteToolCall: () => {},
    onFrames: () => [],
    settle: () => undefined,
    abort: () => [],
  }),
}));

vi.mock('../src/commands/session.js', () => ({
  createSession: vi.fn(() => ({ id: 'sess-1', workspacePath: '/w', model: 'm', history: [] })),
  saveSession: vi.fn(),
  loadSession: vi.fn(() => null),
  listSessions: vi.fn(() => []),
}));

vi.mock('../src/lib/auth-refresh.js', () => ({ registerCliTokenProvider: () => {} }));
vi.mock('@ihui/api-client', () => ({ setBaseUrl: () => {} }));
vi.mock('../src/tools/danger-gate-audit.js', () => ({ createAuditedDangerGate: () => async () => false }));
vi.mock('../src/tools/index.js', () => ({ buildToolResultPersistence: () => undefined }));

import { runToolLoop } from '../src/commands/agent.js';
import { AgentCore } from '../src/server/agent-core.js';

interface RunRecord {
  userTexts: string[];
  signal: AbortSignal;
}

function makeResult(index: number) {
  return {
    stopReason: 'end_turn' as const,
    assistantText: `reply-${index}`,
    iterations: 1,
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
    branchGeneration: 0,
  };
}

function makeCore(): AgentCore {
  return new AgentCore({ workspacePath: '/w', model: 'm', apiUrl: 'http://localhost' });
}

function abortsOf(core: AgentCore): Set<AbortController> {
  return (core as unknown as { sessions: Map<string, { aborts: Set<AbortController> }> }).sessions.get(
    'sess-1',
  )!.aborts;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('F-065 同会话回合串行', () => {
  it('第二个回合等第一回合收尾后才开始,消息按序追加', async () => {
    const records: RunRecord[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    vi.mocked(runToolLoop).mockImplementation((async (opts: any) => {
      const index = records.length;
      records.push({
        userTexts: opts.messages
          .filter((m: { role: string }) => m.role === 'user')
          .map((m: { content: string }) => m.content),
        signal: opts.signal,
      });
      if (index === 0) {
        markStarted();
        await gate;
      }
      return makeResult(index);
    }) as never);

    const core = makeCore();
    const first = core.sendMessage('first', () => {});
    await firstStarted;

    const second = core.sendMessage('second', () => {}, { sessionId: 'sess-1' });
    await vi.waitFor(() => expect(abortsOf(core).size).toBe(2));
    // 第一回合仍在飞:第二个回合不得进入 runToolLoop(否则共享 messages 被并发改写)
    expect(records).toHaveLength(1);

    releaseFirst();
    const [a, b] = await Promise.all([first, second]);

    expect(records).toHaveLength(2);
    expect(records[0].userTexts).toEqual(['first']);
    expect(records[1].userTexts).toEqual(['first', 'second']);
    expect(a.sessionId).toBe('sess-1');
    expect(b.sessionId).toBe('sess-1');
    expect(abortsOf(core).size).toBe(0);
  });

  it('cancel 中止该会话全部在飞回合(含排队中的第二个)', async () => {
    const signals: AbortSignal[] = [];
    let markStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    vi.mocked(runToolLoop).mockImplementation((async (opts: any) => {
      const index = signals.length;
      signals.push(opts.signal);
      if (index === 0) {
        markStarted();
        await new Promise<never>((_resolve, reject) => {
          if (opts.signal.aborted) {
            reject(new Error('aborted'));
            return;
          }
          opts.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      }
      if (opts.signal.aborted) throw new Error('aborted');
      return makeResult(index);
    }) as never);

    const core = makeCore();
    const first = core.sendMessage('first', () => {});
    await firstStarted;
    const second = core.sendMessage('second', () => {}, { sessionId: 'sess-1' });
    await vi.waitFor(() => expect(abortsOf(core).size).toBe(2));

    const firstSettled = expect(first).rejects.toThrow('aborted');
    const secondSettled = expect(second).rejects.toThrow('aborted');
    core.cancel('sess-1');

    await firstSettled;
    await secondSettled;

    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    // 回合收尾后集合清账,不允许残留控制器
    await vi.waitFor(() => expect(abortsOf(core).size).toBe(0));
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
