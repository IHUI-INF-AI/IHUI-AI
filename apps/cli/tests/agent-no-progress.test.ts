// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 零推进收口(本票):**空转不得被记成成功**,同时不得把正常收口判成失败。
 *
 * 缺陷事实:调度器(`scripts/auto-evolve.mjs`)以 `status === 0` + `"stopReason":"end_turn"`
 * 判"会话成功"。而 CLI 在某些轮次里"一次工具调用都没有、正文还是空白"时直接落 `end_turn`
 * → 退出码 0 → 票面零推进却被记成成功。全仓此前没有任何空回复守卫。
 *
 * 本用例钉死两件相反的事(缺任一半都是坏锁):
 *  ① 零工具 + 空正文 ⇒ 先**补救一次**(注入提醒再采样一轮)⇒ 仍空 ⇒ `no_progress` + 退出码 3;
 *  ② 有工具调用 / 有正文的轮次 ⇒ 仍然 `end_turn` + 退出码 0(**反向锁**:防止把正常路径判成失败);
 *  ③ 不传 `failOnNoProgress`(交互式 REPL)⇒ 空回复照旧 `end_turn`,空回一句不升级成错误退出。
 *
 * 判据走生产入口:纯判据函数 `isZeroProgressRound` 直接单测,行为面用 runToolLoop 全真链路
 * (mock 掉外部世界:网络 / settings / audit),沿用 tests/g-425-output-token-continuation.test.ts
 * 的桩形态 —— 同一套 SSE 夹具,避免两处各写一份流解析。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { clearTools } from '../src/tools/index.js';
import type { Settings } from '../src/commands/settings.js';

type StreamChatFn = (opts: unknown) => Promise<void>;

const { streamChatMock, settingsState, fetchMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<StreamChatFn>(),
  settingsState: { value: {} as Record<string, unknown> },
  fetchMock: vi.fn(),
}));

import type * as ApiClient from '@ihui/api-client'
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>()
  return {
    ...actual,
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
  }
});

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}));

vi.mock('../src/commands/settings.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    loadSettings: () => settingsState.value as Settings,
  };
});

import {
  MAX_ZERO_PROGRESS_REMEDIES,
  ZERO_PROGRESS_REMEDY_PROMPT,
  isZeroProgressRound,
  runToolLoop,
  stopReasonToExitCode,
} from '../src/commands/agent.js';
import { formatHeadlessEvent } from '../src/headless-format.js';

// ==================== ① 判据(纯函数) ====================

describe('isZeroProgressRound:判据只有两条,任一条不满足都不算零推进', () => {
  it('零工具 + 空正文(含纯空白) ⇒ 是零推进', () => {
    expect(isZeroProgressRound(0, '')).toBe(true);
    expect(isZeroProgressRound(0, '   \n\t ')).toBe(true);
  });

  it('有工具调用(哪怕正文为空)⇒ 不是零推进(turn 在推进)', () => {
    expect(isZeroProgressRound(1, '')).toBe(false);
    expect(isZeroProgressRound(3, '   ')).toBe(false);
  });

  it('有正文(哪怕只有一句"我做不到")⇒ 不是零推进(那是可审计的产出)', () => {
    expect(isZeroProgressRound(0, '我做不到,因为缺少凭据')).toBe(false);
    expect(isZeroProgressRound(0, '。')).toBe(false);
  });
});

// ==================== ② 行为(runToolLoop 全真链路) ====================

function sseResponse(choices: Array<Record<string, unknown>>): unknown {
  const encoder = new TextEncoder();
  const lines = [...choices.map((c) => `data: ${JSON.stringify({ choices: [c] })}\n`), 'data: [DONE]\n'];
  return {
    ok: true,
    status: 200,
    text: async () => '',
    body: {
      getReader: () => {
        let i = 0;
        return {
          read: async () => {
            if (i >= lines.length) return { value: undefined, done: true };
            const line = lines[i];
            i += 1;
            return { value: encoder.encode(line), done: false } as { value: Uint8Array; done: boolean };
          },
        };
      },
    },
  };
}

/** 空正文回复:content 为空串(delta 存在但无内容,`finish_reason='stop'`) */
function emptyStream(): Array<Record<string, unknown>> {
  return [
    { index: 0, delta: { content: '' }, finish_reason: null },
    { index: 0, delta: {}, finish_reason: 'stop' },
  ];
}

/** 有正文的回复 */
function textStream(content: string): Array<Record<string, unknown>> {
  return [
    { index: 0, delta: { content }, finish_reason: null },
    { index: 0, delta: {}, finish_reason: 'stop' },
  ];
}

interface DriveOptions {
  streams: Array<Array<Record<string, unknown>>>;
  /** true = 无头单次执行(runAgent 会置的那个标志);不传 = 交互式语义 */
  failOnNoProgress?: boolean;
  maxIterations?: number;
}

async function driveTurn(opts: DriveOptions): Promise<{
  stderr: string;
  result: Awaited<ReturnType<typeof runToolLoop>>;
  requestBodies: Array<{ messages: Array<{ role: string; content: string }> }>;
  messages: Array<{ role: string; content: string }>;
}> {
  let stderr = '';
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderr += String(chunk);
    return true;
  }) as never);
  const requestBodies: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  let callIndex = 0;
  fetchMock.mockImplementation(async (_url: unknown, init: { body?: string }) => {
    requestBodies.push(JSON.parse(String(init?.body ?? '{}')));
    const stream = opts.streams[Math.min(callIndex, opts.streams.length - 1)]!;
    callIndex += 1;
    return sseResponse(stream);
  });
  vi.stubGlobal('fetch', fetchMock);

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: '把这张票做完' },
  ];
  const result = await runToolLoop({
    modelId: 'qwen2.5:7b',
    messages,
    ctx: { workspacePath: '.' },
    maxIterations: opts.maxIterations ?? 8,
    ...(opts.failOnNoProgress === undefined ? {} : { failOnNoProgress: opts.failOnNoProgress }),
  });
  return { stderr, result, requestBodies, messages };
}

describe('零推进收口:正反两面', () => {
  beforeEach(() => {
    clearTools();
    fetchMock.mockReset();
    streamChatMock.mockReset();
    settingsState.value = { provider: 'ollama' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('① 零工具 + 空正文 ⇒ 恰好补救一次(第二次请求末尾是提醒)⇒ 仍空 ⇒ no_progress + 退出码 3', async () => {
    const { stderr, result, requestBodies } = await driveTurn({
      streams: [emptyStream(), emptyStream()],
      failOnNoProgress: true,
    });

    // 补救恰好一次:首轮 1 次请求 + 补救 1 次请求,不循环烧钱
    expect(fetchMock.mock.calls.length).toBe(1 + MAX_ZERO_PROGRESS_REMEDIES);
    expect(requestBodies.length).toBe(2);

    // 提醒逐字等于常量(不是"含某个关键词"—— 指令面被人改写时必须红)
    const secondRequest = requestBodies[1]!.messages;
    expect(secondRequest[secondRequest.length - 1]!.role).toBe('user');
    expect(secondRequest[secondRequest.length - 1]!.content).toBe(ZERO_PROGRESS_REMEDY_PROMPT);

    // 终态:no_progress,且**正文确实是空**(不是伪造出来的结论)
    expect(result.stopReason).toBe('no_progress');
    expect(result.assistantText).toBe('');
    expect(result.iterations).toBe(2);
    // 退出码:非 0 —— 这是"空转不得被记成成功"的唯一机器面判据
    expect(stopReasonToExitCode(result.stopReason)).toBe(3);
    expect(stderr).toContain('[no-progress]');
  });

  it('② 补救有效(第二轮给了结论)⇒ end_turn + 退出码 0,不误判', async () => {
    const { result, requestBodies } = await driveTurn({
      streams: [emptyStream(), textStream('已完成:改了三处并跑了测试')],
      failOnNoProgress: true,
    });
    expect(requestBodies.length).toBe(2);
    expect(result.stopReason).toBe('end_turn');
    expect(stopReasonToExitCode(result.stopReason)).toBe(0);
    expect(result.assistantText).toContain('已完成');
    expect(result.iterations).toBe(2);
  });

  it('③ 反向锁一:本轮有正文 ⇒ 不补救、不判失败(end_turn + 0,只发一次请求)', async () => {
    const { result, requestBodies } = await driveTurn({
      streams: [textStream('我无法完成:缺少 API key')],
      failOnNoProgress: true,
    });
    expect(requestBodies.length).toBe(1);
    expect(result.stopReason).toBe('end_turn');
    expect(stopReasonToExitCode(result.stopReason)).toBe(0);
    // 一句"做不到"也是可审计的产出,不得被改判成空转
    expect(result.assistantText).toContain('无法完成');
  });

  it('④ 反向锁二:本轮有工具调用 ⇒ 不判失败(下一轮给出结论即 end_turn + 0)', async () => {
    const toolCallText = '```tool_call\n{"name":"grep","arguments":{"pattern":"x"}}\n```';
    const { result, requestBodies } = await driveTurn({
      streams: [textStream(toolCallText), textStream('结论:命中 2 处')],
      failOnNoProgress: true,
    });
    // 第一轮有工具调用 ⇒ turn 正常推进,不进零推进分支(没有提醒注入 ⇒ 恰好两轮)
    expect(requestBodies.length).toBe(2);
    expect(requestBodies[1]!.messages.every((m) => m.content !== ZERO_PROGRESS_REMEDY_PROMPT)).toBe(true);
    expect(result.stopReason).toBe('end_turn');
    expect(stopReasonToExitCode(result.stopReason)).toBe(0);
  });

  it('⑤ 闸门默认关(交互式 REPL 语义):空回复照旧 end_turn + 0,不补救', async () => {
    const { result, requestBodies } = await driveTurn({
      streams: [emptyStream()],
    });
    expect(requestBodies.length).toBe(1);
    expect(result.stopReason).toBe('end_turn');
    expect(stopReasonToExitCode(result.stopReason)).toBe(0);
  });
});

// ==================== ③ 退出码:3 不与既有四档冲突 ====================

describe('no_progress 的退出码(3):与既有档位互不重叠', () => {
  it('3 只属于 no_progress;0/1/2/130 的既有语义逐一未变', () => {
    expect(stopReasonToExitCode('no_progress')).toBe(3);
    // 既有语义(改前逐字):成功 / 硬错误与验收未过 / 轮次与死循环与待审批 / Ctrl-C
    expect(stopReasonToExitCode('end_turn')).toBe(0);
    expect(stopReasonToExitCode('error')).toBe(1);
    expect(stopReasonToExitCode('verification_not_achieved')).toBe(1);
    expect(stopReasonToExitCode('max_iterations')).toBe(2);
    expect(stopReasonToExitCode('doom_loop')).toBe(2);
    expect(stopReasonToExitCode('plan_approval_required')).toBe(2);
    expect(stopReasonToExitCode('cancelled')).toBe(130);
    // 关键:3 不是 0(否则空转又被记成成功),也不是 2(那一档已承担"跑满了轮次")
    expect(stopReasonToExitCode('no_progress')).not.toBe(stopReasonToExitCode('end_turn'));
    expect(stopReasonToExitCode('no_progress')).not.toBe(stopReasonToExitCode('max_iterations'));
  });
});

// ==================== ④ --json 事件流:新终态可见,且 usage 一行不丢 ====================

describe('--json 结果行:no_progress 是新终态,usage 照旧齐全', () => {
  it('complete 行带 stopReason=no_progress 与四类 usage 字段(调度器 parseSessionUsage 照读)', () => {
    const usage = { promptTokens: 900, completionTokens: 100, totalTokens: 1000, estimatedCostUsd: 0.12 };
    const line = formatHeadlessEvent(
      { type: 'complete', stopReason: 'no_progress', iterations: 2, usage },
      'json',
    );
    const parsed = JSON.parse(line.trim()) as {
      type: string;
      stopReason: string;
      usage: Record<string, unknown>;
    };
    // 终态在事件流里可见 —— 调度器能读出"这是哪一种失败",而不是只看到一个非 0 码
    expect(parsed.type).toBe('complete');
    expect(parsed.stopReason).toBe('no_progress');
    // usage 不因为新终态而丢:`scripts/auto-evolve.mjs` 的 parseSessionUsage 只认这四格
    expect(parsed.usage).toEqual(usage);
    expect(Number(parsed.usage.totalTokens)).toBe(1000);
    expect(Number(parsed.usage.estimatedCostUsd)).toBeCloseTo(0.12, 6);
  });
});
