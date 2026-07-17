/**
 * Compaction V2 集成测试 — feature flag 切换 + sampler 真实调用 + fallback 路径。
 *
 * 覆盖:
 *   1. createCompactionSampler:mock streamChat,验证 response 累加 / 抛错 / timeout
 *   2. decideCompaction feature flag:enabled=false → V1;enabled=true → V2
 *   3. V2 抛错 fallback 到 V1(双保险)
 *   4. observer 回调:onSuccess → console.info;onError → console.warn
 *   5. settings.ts:saveSettingsTemplate 默认 compactionV2.enabled=false + Settings 接受字段
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ==================== Mock 基础设施 ====================

type StreamChatOpts = {
  model: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
};
type StreamChatFn = (opts: StreamChatOpts) => Promise<void>;

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<StreamChatFn>(),
}));

const { compressContextV2Mock, compressContextIfNeededMock } = vi.hoisted(() => ({
  compressContextV2Mock: vi.fn(),
  compressContextIfNeededMock: vi.fn(),
}));

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

vi.mock('../src/compaction-v2.js', () => ({
  compressContextV2: compressContextV2Mock,
}));

vi.mock('../src/context.js', () => ({
  compressContextIfNeeded: compressContextIfNeededMock,
  estimateTokens: (s: string) => Math.ceil(s.length / 4),
  estimateMessagesTokens: (msgs: Array<{ content: string }>) =>
    msgs.reduce((s, m) => s + Math.ceil(m.content.length / 4) + 4, 0),
}));

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}));

// Mock 后再 import,确保 mock 生效
import { createCompactionSampler, decideCompaction } from '../src/commands/agent.js';
import { saveSettingsTemplate, getSettingsPath, type Settings } from '../src/commands/settings.js';

// ==================== 测试辅助 ====================

function makeMessages(count: number): Array<{ role: 'user' | 'assistant'; content: string }> {
  const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let i = 0; i < count; i++) {
    msgs.push({ role: 'user', content: `用户消息 ${i} ${'x'.repeat(200)}` });
    msgs.push({ role: 'assistant', content: `助手回复 ${i} ${'y'.repeat(200)}` });
  }
  return msgs;
}

const FAKE_COMPRESSION_RESULT = {
  messages: [{ role: 'system' as const, content: 'compressed' }],
  compressed: true,
  originalTokens: 5000,
  compressedTokens: 3000,
  removedCount: 10,
  trigger: 'ratio' as const,
  usageRatio: 0.9,
};

const NO_COMPRESSION_RESULT = {
  messages: [],
  compressed: false,
  originalTokens: 1000,
  compressedTokens: 1000,
  removedCount: 0,
  trigger: 'none' as const,
  usageRatio: 0.2,
};

// ==================== createCompactionSampler ====================

describe('createCompactionSampler', () => {
  beforeEach(() => {
    streamChatMock.mockReset();
  });

  it('mock streamChat 返回固定 delta,验证 response 累加正确', async () => {
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      opts.onDelta('Hello ');
      opts.onDelta('World');
    });
    const sampler = createCompactionSampler('test-model');
    const result = await sampler.sampleCompaction(
      [{ role: 'user', content: 'test' }],
      { timeoutMs: 5000 },
    );
    expect(result.response).toBe('Hello World');
    expect(streamChatMock).toHaveBeenCalledTimes(1);
    // 验证 model 透传
    const callOpts = streamChatMock.mock.calls[0]![0];
    expect(callOpts.model).toBe('test-model');
    // 验证 system prompt 被前置
    expect(callOpts.messages[0]!.role).toBe('system');
    expect(callOpts.messages[0]!.content).toContain('上下文压缩器');
    // 验证用户消息被透传
    expect(callOpts.messages[1]).toEqual({ role: 'user', content: 'test' });
  });

  it('mock streamChat 抛错,sampler 抛错(由 V2 sampleWithRetry 处理重试)', async () => {
    streamChatMock.mockRejectedValue(new Error('network error: fetch failed'));
    const sampler = createCompactionSampler('test-model');
    await expect(
      sampler.sampleCompaction([{ role: 'user', content: 'test' }], { timeoutMs: 5000 }),
    ).rejects.toThrow('network error');
  });

  it('timeout 触发(controller.abort),sampler 抛错', async () => {
    // 模拟 streamChat 在 signal abort 时抛 AbortError
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      return new Promise<void>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });
    const sampler = createCompactionSampler('test-model');
    // timeoutMs=50 → 50ms 后 controller.abort() → streamChat 抛 AbortError
    await expect(
      sampler.sampleCompaction([{ role: 'user', content: 'test' }], { timeoutMs: 50 }),
    ).rejects.toThrow();
  });
});

// ==================== decideCompaction feature flag 切换 ====================

describe('decideCompaction feature flag 切换', () => {
  beforeEach(() => {
    compressContextV2Mock.mockReset();
    compressContextIfNeededMock.mockReset();
  });

  it('settings.compactionV2.enabled = false → 走 V1 路径(调 compressContextIfNeeded,不调 compressContextV2)', async () => {
    compressContextIfNeededMock.mockReturnValue(NO_COMPRESSION_RESULT);
    const settings: Settings = { compactionV2: { enabled: false } };
    const messages = makeMessages(10);
    const result = await decideCompaction(messages, settings, { contextLimit: 8000, modelId: 'm1' });
    expect(compressContextIfNeededMock).toHaveBeenCalledTimes(1);
    expect(compressContextV2Mock).not.toHaveBeenCalled();
    expect(result.compressed).toBe(false);
  });

  it('settings.compactionV2.enabled = true → 走 V2 路径(调 compressContextV2,不调 compressContextIfNeeded)', async () => {
    compressContextV2Mock.mockResolvedValue(FAKE_COMPRESSION_RESULT);
    const settings: Settings = { compactionV2: { enabled: true, model: 'gpt-4' } };
    const messages = makeMessages(10);
    const result = await decideCompaction(messages, settings, { contextLimit: 8000, modelId: 'm1' });
    expect(compressContextV2Mock).toHaveBeenCalledTimes(1);
    expect(compressContextIfNeededMock).not.toHaveBeenCalled();
    expect(result.compressed).toBe(true);
    // 验证 V2 调用参数:sampler + observer 已注入,contextLimit 透传
    const v2Args = compressContextV2Mock.mock.calls[0]![1];
    expect(v2Args.sampler).toBeDefined();
    expect(v2Args.observer).toBeDefined();
    expect(v2Args.contextLimit).toBe(8000);
  });

  it('settings 无 compactionV2 字段 → 走 V1 路径(向后兼容)', async () => {
    compressContextIfNeededMock.mockReturnValue(NO_COMPRESSION_RESULT);
    const settings: Settings = {};
    const messages = makeMessages(10);
    await decideCompaction(messages, settings, { contextLimit: 8000, modelId: 'm1' });
    expect(compressContextIfNeededMock).toHaveBeenCalledTimes(1);
    expect(compressContextV2Mock).not.toHaveBeenCalled();
  });
});

// ==================== V2 抛错 fallback ====================

describe('V2 抛错 fallback 到 V1', () => {
  beforeEach(() => {
    compressContextV2Mock.mockReset();
    compressContextIfNeededMock.mockReset();
  });

  it('compressContextV2 抛错 → 调用 compressContextIfNeeded 作为 fallback', async () => {
    compressContextV2Mock.mockRejectedValue(new Error('V2 internal error'));
    compressContextIfNeededMock.mockReturnValue(FAKE_COMPRESSION_RESULT);
    const settings: Settings = { compactionV2: { enabled: true } };
    const messages = makeMessages(10);
    const result = await decideCompaction(messages, settings, { contextLimit: 8000, modelId: 'm1' });
    expect(compressContextV2Mock).toHaveBeenCalledTimes(1);
    expect(compressContextIfNeededMock).toHaveBeenCalledTimes(1);
    expect(result.compressed).toBe(true);
  });
});

// ==================== observer 回调 ====================

describe('observer 回调', () => {
  beforeEach(() => {
    compressContextV2Mock.mockReset();
    compressContextIfNeededMock.mockReset();
  });

  it('compressContextV2 调用 observer.onSuccess → 验证 console.info 输出', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    compressContextV2Mock.mockImplementation(
      async (_msgs: unknown, opts: { observer?: { onSuccess: (o: unknown) => void } }) => {
        opts.observer?.onSuccess({
          target: 'compaction-v2',
          tokensBefore: 5000,
          tokensAfter: 3000,
          turnsCompacted: 10,
          elapsedMs: 1234,
        });
        return FAKE_COMPRESSION_RESULT;
      },
    );
    const settings: Settings = { compactionV2: { enabled: true } };
    await decideCompaction(makeMessages(10), settings, { contextLimit: 8000, modelId: 'm1' });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const msg = String(infoSpy.mock.calls[0]![0]);
    expect(msg).toContain('compaction-v2');
    expect(msg).toContain('5000');
    expect(msg).toContain('3000');
    expect(msg).toContain('10');
    infoSpy.mockRestore();
  });

  it('compressContextV2 调用 observer.onError → 验证 console.warn 输出', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    compressContextV2Mock.mockImplementation(
      async (_msgs: unknown, opts: { observer?: { onError: (o: unknown) => void } }) => {
        opts.observer?.onError({
          target: 'compaction-v2',
          statusLabel: 'degenerate-summary',
          error: new Error('summary too short'),
        });
        return NO_COMPRESSION_RESULT;
      },
    );
    const settings: Settings = { compactionV2: { enabled: true } };
    await decideCompaction(makeMessages(10), settings, { contextLimit: 8000, modelId: 'm1' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = String(warnSpy.mock.calls[0]![0]);
    expect(msg).toContain('compaction-v2 error');
    expect(msg).toContain('degenerate-summary');
    warnSpy.mockRestore();
  });
});

// ==================== settings.ts compactionV2 字段 ====================

describe('settings.ts compactionV2 字段', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-compaction-v2-test-'));
    originalEnv = { ...process.env };
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('saveSettingsTemplate 包含 compactionV2.enabled = false 默认值', () => {
    saveSettingsTemplate(true);
    const p = getSettingsPath();
    const content = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    expect(content.compactionV2).toBeDefined();
    const cv2 = content.compactionV2 as Record<string, unknown>;
    expect(cv2.enabled).toBe(false);
  });

  it('Settings interface 接受 compactionV2 可选字段', () => {
    const s: Settings = {
      compactionV2: {
        enabled: true,
        model: 'gpt-4',
        triggerRatio: 0.9,
        targetRatio: 0.5,
        samplingTimeoutMs: 60000,
      },
    };
    expect(s.compactionV2?.enabled).toBe(true);
    expect(s.compactionV2?.model).toBe('gpt-4');
    expect(s.compactionV2?.triggerRatio).toBe(0.9);
    expect(s.compactionV2?.targetRatio).toBe(0.5);
    expect(s.compactionV2?.samplingTimeoutMs).toBe(60000);
  });
});
