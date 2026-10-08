// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-425(2026-10-07 拍板:抄上游)—— 输出被 max_tokens 截断时的有界续写。
 *
 * 上游参考:`apps/zcode-cli/packages/core/src/runtime/methods/turn-output-token-continuation.ts`。
 * 三条被钉死的语义:
 * ① 判据:finish_reason==='length' 或 raw 家族值(max_tokens / max_output_tokens /
 *    model_context_window_exceeded,OpenAI 兼容代理透传上游原生值的形态)都算截断;
 * ② 有界:每个恢复段最多续写 3 次 —— 第 4 次截断必须喊"预算耗尽",不得无限烧钱;
 * ③ 续写补丁(Output token limit hit …)只进下一轮下发视图,**绝不写进持久历史**
 *    (runToolLoop 的 opts.messages / saveSession 落库面结构性不存在这条补丁)。
 *
 * 判据必须走生产入口(§22c"镜像测试只复读实现就是复读机"):纯函数单测钉判据表,
 * 行为测试 mock 外部世界(fetch / settings / api-client / audit),runToolLoop 全真链路。
 * 夹具形态取自 tests/truncation-visible-notice.test.ts(同票前置批,读它、复用其风格)。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { clearTools } from '../src/tools/index.js';
import type { Settings } from '../src/commands/settings.js';

// ---- 外部世界桩:不发真实网络、不读写 ~/.ihui、不写审计文件 ----
type StreamChatFn = (opts: unknown) => Promise<void>;

const { streamChatMock, settingsState, fetchMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<StreamChatFn>(),
  settingsState: { value: {} as Record<string, unknown> },
  fetchMock: vi.fn(),
}));

import type * as ApiClient from '@ihui/api-client'
vi.mock('@ihui/api-client', async (importOriginal) => {
  // 部分 mock:保留本文件自己列出的桩(真发网络/真写盘的那几个),其余导出走真实实现。
  const actual = await importOriginal<typeof ApiClient>()
  return {
    ...actual,
    // 本用例走本地 provider 支路,结构上碰不到 streamChat;留桩只为避免真实网络与重依赖在 worker 内加载。
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

// loadSettings 只换"读到的档位",其余导出保留原实现(与 truncation-visible-notice.test.ts 同法)。
vi.mock('../src/commands/settings.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    loadSettings: () => settingsState.value as Settings,
  };
});

import {
  MAX_OUTPUT_TOKEN_CONTINUATIONS,
  OUTPUT_TOKEN_CONTINUE_PROMPT,
  classifyOutputTokenContinuation,
  isOutputTokenLimitFinishReason,
} from '../src/commands/agent-output-continuation.js';
import { runToolLoop } from '../src/commands/agent.js';

// ==================== ① 判据表(纯函数,与上游 classify 同语义) ====================

describe('classifyOutputTokenContinuation(判据表,对齐上游 turn-output-token-continuation)', () => {
  const base = { toolCallCount: 0, continuationCount: 0 };

  it('length + 预算未尽 ⇒ continue;预算(3 次)用尽 ⇒ exhausted', () => {
    expect(classifyOutputTokenContinuation({ ...base, finishReason: 'length' })).toBe('continue');
    expect(
      classifyOutputTokenContinuation({ ...base, finishReason: 'length', continuationCount: MAX_OUTPUT_TOKEN_CONTINUATIONS - 1 }),
    ).toBe('continue');
    expect(
      classifyOutputTokenContinuation({ ...base, finishReason: 'length', continuationCount: MAX_OUTPUT_TOKEN_CONTINUATIONS }),
    ).toBe('exhausted');
  });

  it('raw 家族(max_tokens / max_output_tokens / model_context_window_exceeded)同判为截断', () => {
    for (const raw of ['max_tokens', 'max_output_tokens', 'model_context_window_exceeded']) {
      expect(classifyOutputTokenContinuation({ ...base, finishReason: raw })).toBe('continue');
    }
    // model_context_window_exceeded 出现在**成功响应**里也走续写而非压缩/报错(上游注明的有意设计)
    expect(
      classifyOutputTokenContinuation({ ...base, finishReason: 'model_context_window_exceeded', continuationCount: 3 }),
    ).toBe('exhausted');
  });

  it('有工具调用 ⇒ none(turn 由工具循环正常推进,不进恢复段)', () => {
    expect(classifyOutputTokenContinuation({ ...base, toolCallCount: 1, finishReason: 'length' })).toBe('none');
  });

  it('非截断结束(stop / tool_calls / 上游没发)⇒ none,不误报', () => {
    for (const finishReason of ['stop', 'tool_calls', undefined]) {
      expect(classifyOutputTokenContinuation({ ...base, finishReason })).toBe('none');
    }
    expect(isOutputTokenLimitFinishReason(undefined)).toBe(false);
    expect(isOutputTokenLimitFinishReason(null)).toBe(false);
  });
});

// ==================== ② 生产行为(runToolLoop 全真链路,mock 外部世界) ====================

/**
 * 构造一条 OpenAI 兼容 SSE 流(与 truncation-visible-notice.test.ts 同形)。
 */
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
            return { value: encoder.encode(line), done: false } as {
              value: Uint8Array;
              done: boolean;
            };
          },
        };
      },
    },
  };
}

/** 一轮纯文本回复;finishReason === null = 上游根本没发 finish_reason */
function textStream(finishReason: string | null): Array<Record<string, unknown>> {
  const last: Record<string, unknown> = { index: 0, delta: { content: '后半句' } };
  if (finishReason !== null) last.finish_reason = finishReason;
  return [{ index: 0, delta: { content: '前半句' }, finish_reason: null }, last];
}

interface DriveOptions {
  /** 每次请求依次返回的流(超出次数时复用最后一个) */
  streams: Array<Array<Record<string, unknown>>>;
  maxIterations?: number;
}

/** 把一轮 runToolLoop 跑完:回传 stderr、循环结论、逐次请求体、传入的持久历史数组 */
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
    const stream = opts.streams[Math.min(callIndex, opts.streams.length - 1)];
    callIndex += 1;
    return sseResponse(stream);
  });
  vi.stubGlobal('fetch', fetchMock);

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: '说一句长话' },
  ];
  const result = await runToolLoop({
    modelId: 'qwen2.5:7b',
    messages,
    ctx: { workspacePath: '.' },
    maxIterations: opts.maxIterations ?? 8,
  });
  return { stderr, result, requestBodies, messages };
}

const countLinesWith = (stderr: string, needle: string): number =>
  stderr.split('\n').filter((l) => l.includes(needle)).length;

describe('G-425 有界续写(生产入口 runToolLoop,本地 provider 面)', () => {
  beforeEach(() => {
    clearTools();
    fetchMock.mockReset();
    streamChatMock.mockReset();
    // provider='ollama' 才走 streamOpenAiCompatible 那条真链路(resolveProvider 的判据)
    settingsState.value = { provider: 'ollama' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('① length 截断 ⇒ 续写补丁进第二次请求且为最后一条 user 消息;补丁不落持久历史;终局 finish_reason=stop', async () => {
    const { stderr, result, requestBodies, messages } = await driveTurn({
      streams: [textStream('length'), textStream('stop')],
    });
    // 第一次截断后确实发起了续写:恰好 2 次请求
    expect(fetchMock.mock.calls.length).toBe(2);
    expect(requestBodies.length).toBe(2);
    // 续写补丁是第二次请求的最后一条 user 消息
    const secondRequest = requestBodies[1]!.messages;
    expect(secondRequest.length).toBeGreaterThan(0);
    expect(secondRequest[secondRequest.length - 1]!.role).toBe('user');
    // 断正文**等于那份常量**,而不是"含 Output token limit hit 这几个字":上游打磨过的指令面
    // 是整句提示,被人改写成别的话(或只留半句)时"含关键词"仍然绿,而模型收到的指令已经变了。
    expect(secondRequest[secondRequest.length - 1]!.content).toBe(OUTPUT_TOKEN_CONTINUE_PROMPT);
    // 续写段正常收口:正文 = 首答 + 续写段,只喊过一次截断
    expect(result.assistantText).toBe('前半句后半句' + '前半句后半句');
    expect(countLinesWith(stderr, '长度上限被截断')).toBe(1);
    expect(result.stopReason).toBe('end_turn');
    // finish_reason 透传:终局是续写段自己的 stop,且不得再报"仍被截断"
    expect(result.finishReason).toBe('stop');
    expect(result.outputTruncated).toBe(false);
    // 续写补丁绝不写进持久历史:传入的 messages 数组(runToolLoop 的落库源)里不存在补丁
    for (const m of messages) {
      expect(m.content).not.toContain(OUTPUT_TOKEN_CONTINUE_PROMPT);
    }
    // 持久历史里首答残句照存(上游同语义:partial 照存,用户已看到的残句不蒸发)
    expect(messages.some((m) => m.role === 'assistant' && m.content === '前半句后半句')).toBe(true);
  });

  it('② raw 家族(max_tokens)同样触发续写(OpenAI 兼容代理透传上游原生值的形态)', async () => {
    const { result, requestBodies } = await driveTurn({
      streams: [textStream('max_tokens'), textStream('stop')],
    });
    expect(requestBodies.length).toBe(2);
    expect(result.finishReason).toBe('stop');
    expect(result.outputTruncated).toBe(false);
    expect(result.stopReason).toBe('end_turn');
  });

  it('③ 有界:连续 4 次截断 ⇒ 恰好续写 3 次后收口,喊"预算耗尽",不无限烧钱', async () => {
    const truncated = textStream('length');
    const { stderr, result, requestBodies } = await driveTurn({
      streams: [truncated, truncated, truncated, truncated],
      maxIterations: 8,
    });
    // 1 次首答 + 恰好 3 次续写 —— 第 4 次截断不再续写(尽管 maxIterations 还有余量)
    expect(fetchMock.mock.calls.length).toBe(1 + MAX_OUTPUT_TOKEN_CONTINUATIONS);
    expect(requestBodies.length).toBe(1 + MAX_OUTPUT_TOKEN_CONTINUATIONS);
    // 每次截断都各喊一行可见提示,预算耗尽额外喊一行
    expect(countLinesWith(stderr, '长度上限被截断')).toBe(4);
    expect(countLinesWith(stderr, '已自动续写 3 次')).toBe(1);
    // 键名不得漏到界面
    expect(stderr).not.toContain('cli.truncatedContinuationExhausted');
    // 终局 finish_reason=length + outputTruncated=true ⇒ 端上可判"回复不完整"
    expect(result.finishReason).toBe('length');
    expect(result.outputTruncated).toBe(true);
    expect(result.stopReason).toBe('end_turn');
  });

  it('④ 正常说完(stop)⇒ 不续写、不发第二次请求、一声不响', async () => {
    const { stderr, result, requestBodies } = await driveTurn({ streams: [textStream('stop')] });
    expect(fetchMock.mock.calls.length).toBe(1);
    expect(requestBodies.length).toBe(1);
    expect(countLinesWith(stderr, '长度上限被截断')).toBe(0);
    expect(countLinesWith(stderr, '已自动续写 3 次')).toBe(0);
    expect(result.stopReason).toBe('end_turn');
    expect(result.finishReason).toBe('stop');
    expect(result.outputTruncated).toBe(false);
  });
});
