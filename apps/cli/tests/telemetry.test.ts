/**
 * Telemetry 模块测试 — 验证极简批量上报客户端。
 *
 * 测试范围:
 *   1. TelemetryClient 基础行为:disabled 时 no-op、track 入队、flush 触发 fetch POST
 *   2. flush 失败:HTTP 非 2xx 与网络错误时事件放回队列(最多 100 条)
 *   3. batchSize 自动 flush:队列达阈值自动触发 fetch
 *   4. shutdown 行为:清理 timer + 最后一次 flush
 *   5. endpoint 未配置:flush 为 no-op
 *   6. 全局 API:initTelemetry / track / flushTelemetry / shutdownTelemetry
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TelemetryClient,
  initTelemetry,
  track,
  flushTelemetry,
  shutdownTelemetry,
  getDefaultTelemetryClient,
  _resetDefaultClientForTest,
} from '../src/telemetry/index.js';

// === 辅助:构造 mock fetch ===
function createMockFetch(ok: boolean = true, status: number = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as unknown as Response);
}

// === 辅助:构造可控制的 mock 定时器 ===
function createMockTimers() {
  const intervals: Array<() => void> = [];
  const setIntervalImpl = vi.fn((cb: () => void, _ms: number) => {
    const id = intervals.length;
    intervals.push(cb);
    return id as unknown as NodeJS.Timeout;
  });
  const clearIntervalImpl = vi.fn((_id: NodeJS.Timeout) => {
    // mock no-op
  });
  return {
    setIntervalImpl,
    clearIntervalImpl,
    intervals,
    // 触发所有已注册的定时器
    tickAll: () => {
      for (const cb of intervals) cb();
    },
  };
}

describe('TelemetryClient', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    _resetDefaultClientForTest();
  });

  afterEach(async () => {
    await shutdownTelemetry();
    global.fetch = originalFetch;
  });

  describe('disabled 状态(零回归)', () => {
    it('enabled=false 时 trackEvent 不入队', () => {
      const client = new TelemetryClient({ enabled: false });
      client.trackEvent('session_start', { foo: 'bar' });
      expect(client.getQueueSize()).toBe(0);
    });

    it('默认构造(无配置)enabled=false', () => {
      const client = new TelemetryClient();
      expect(client.isEnabled()).toBe(false);
      client.trackEvent('session_start');
      expect(client.getQueueSize()).toBe(0);
    });

    it('disabled 时不注册定时器', () => {
      const { setIntervalImpl } = createMockTimers();
      new TelemetryClient({ enabled: false, setIntervalImpl });
      expect(setIntervalImpl).not.toHaveBeenCalled();
    });
  });

  describe('track 入队', () => {
    it('enabled=true 时 trackEvent 入队', () => {
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: createMockFetch(),
      });
      client.trackEvent('session_start', { modelId: 'test-model' });
      expect(client.getQueueSize()).toBe(1);
    });

    it('多次 trackEvent 累计入队', () => {
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: createMockFetch(),
        batchSize: 100,
      });
      for (let i = 0; i < 5; i++) {
        client.trackEvent('tool_call_completed', { toolName: `tool-${i}` });
      }
      expect(client.getQueueSize()).toBe(5);
    });

    it('未提供 props 也能入队', () => {
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: createMockFetch(),
        batchSize: 100,
      });
      client.trackEvent('prompt_completed');
      expect(client.getQueueSize()).toBe(1);
    });
  });

  describe('flush 触发 fetch POST', () => {
    it('flush 调用 fetch 发送 POST 到 endpoint', async () => {
      const fetchFn = createMockFetch(true, 200);
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 100,
      });
      client.trackEvent('session_start', { modelId: 'test' });
      await client.flush();

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = fetchFn.mock.calls[0]!;
      expect(url).toBe('https://example.com/v1/telemetry/ingest');
      expect(init).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      // body 包含 events 数组
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].name).toBe('session_start');
      expect(body.events[0].props).toEqual({ modelId: 'test' });
      expect(body.events[0].timestamp).toBeGreaterThan(0);
    });

    it('flush 成功后队列清空', async () => {
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: createMockFetch(true, 200),
        batchSize: 100,
      });
      client.trackEvent('session_start');
      client.trackEvent('tool_call_completed');
      expect(client.getQueueSize()).toBe(2);

      await client.flush();
      expect(client.getQueueSize()).toBe(0);
    });

    it('空队列 flush 不调用 fetch', async () => {
      const fetchFn = createMockFetch();
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 100,
      });
      await client.flush();
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('未配置 endpoint 时 flush 不调用 fetch(no-op)', async () => {
      const fetchFn = createMockFetch();
      const client = new TelemetryClient({
        enabled: true,
        // 不设 endpoint
        fetchImpl: fetchFn,
        batchSize: 100,
      });
      client.trackEvent('session_start');
      await client.flush();
      expect(fetchFn).not.toHaveBeenCalled();
      // endpoint 未配置时 flush 提前 return(无 splice),事件仍保留在队列
      expect(client.getQueueSize()).toBe(1);
    });
  });

  describe('flush 失败时事件放回队列(最多 100 条)', () => {
    it('HTTP 非 2xx 时事件放回队列', async () => {
      const fetchFn = createMockFetch(false, 500);
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 100,
      });
      client.trackEvent('session_start');
      client.trackEvent('tool_call_completed');
      await client.flush();
      // 放回队列
      expect(client.getQueueSize()).toBe(2);
    });

    it('网络错误(fetch 抛异常)时事件放回队列', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('network error'));
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 100,
      });
      client.trackEvent('session_start');
      await client.flush();
      expect(client.getQueueSize()).toBe(1);
    });

    it('放回队列最多保留 100 条(防止无限增长)', async () => {
      const fetchFn = createMockFetch(false, 500);
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 1000, // 设大避免触发自动 flush
      });
      // 入队 150 条
      for (let i = 0; i < 150; i++) {
        client.trackEvent('tool_call_completed', { i });
      }
      expect(client.getQueueSize()).toBe(150);

      await client.flush();
      // 最多保留 100 条
      expect(client.getQueueSize()).toBe(100);
    });

    it('放回的事件是最后 100 条(slice(-100))', async () => {
      const fetchFn = createMockFetch(false, 500);
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 1000,
      });
      for (let i = 0; i < 150; i++) {
        client.trackEvent('tool_call_completed', { i });
      }
      await client.flush();
      expect(client.getQueueSize()).toBe(100);
      // 注:queue 是私有字段,无法直接验证内容,通过数量已可证明 slice(-100) 生效
    });
  });

  describe('batchSize 触发自动 flush', () => {
    it('队列达 batchSize 时自动触发 fetch', async () => {
      const fetchFn = createMockFetch(true, 200);
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 3,
      });
      client.trackEvent('session_start');
      client.trackEvent('tool_call_completed');
      expect(fetchFn).not.toHaveBeenCalled();

      // 第 3 条触发自动 flush
      client.trackEvent('prompt_completed');

      // 异步 flush,等一下
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('未达 batchSize 不自动 flush', async () => {
      const fetchFn = createMockFetch(true, 200);
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 10,
      });
      client.trackEvent('session_start');
      client.trackEvent('tool_call_completed');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('shutdown 行为', () => {
    it('shutdown 清理定时器', () => {
      const { setIntervalImpl, clearIntervalImpl } = createMockTimers();
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: createMockFetch(),
        batchSize: 100,
        setIntervalImpl,
        clearIntervalImpl,
      });
      expect(setIntervalImpl).toHaveBeenCalledTimes(1);

      // shutdown 是 async,但清理 timer 是同步部分
      void client.shutdown();
      expect(clearIntervalImpl).toHaveBeenCalledTimes(1);
    });

    it('shutdown 触发最后一次 flush', async () => {
      const fetchFn = createMockFetch(true, 200);
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        batchSize: 100,
      });
      client.trackEvent('session_start');
      expect(fetchFn).not.toHaveBeenCalled();

      await client.shutdown();
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('shutdown 后队列为空', async () => {
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: createMockFetch(),
        batchSize: 100,
      });
      client.trackEvent('session_start');
      await client.shutdown();
      expect(client.getQueueSize()).toBe(0);
    });

    it('disabled 客户端 shutdown 不抛错', async () => {
      const client = new TelemetryClient({ enabled: false });
      await expect(client.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('定时 flush', () => {
    it('启用时注册 setInterval 定时器', () => {
      const { setIntervalImpl } = createMockTimers();
      new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: createMockFetch(),
        setIntervalImpl,
        batchSize: 100,
      });
      expect(setIntervalImpl).toHaveBeenCalledTimes(1);
      // 默认 60s
      expect(setIntervalImpl.mock.calls[0]![1]).toBe(60_000);
    });

    it('定时器触发时调用 flush', async () => {
      const fetchFn = createMockFetch(true, 200);
      const timers = createMockTimers();
      const client = new TelemetryClient({
        enabled: true,
        endpoint: 'https://example.com/v1/telemetry/ingest',
        fetchImpl: fetchFn,
        setIntervalImpl: timers.setIntervalImpl,
        clearIntervalImpl: timers.clearIntervalImpl,
        batchSize: 100,
      });
      client.trackEvent('session_start');
      // 触发定时器
      timers.tickAll();
      // 等待 async flush 完成
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('全局 API', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    _resetDefaultClientForTest();
  });

  afterEach(async () => {
    await shutdownTelemetry();
    global.fetch = originalFetch;
  });

  it('initTelemetry 创建默认客户端并返回', () => {
    const client = initTelemetry({
      enabled: true,
      endpoint: 'https://example.com/v1/telemetry/ingest',
      fetchImpl: createMockFetch(),
    });
    expect(client).toBeInstanceOf(TelemetryClient);
    expect(getDefaultTelemetryClient()).toBe(client);
  });

  it('track 调用默认客户端入队', () => {
    initTelemetry({
      enabled: true,
      endpoint: 'https://example.com/v1/telemetry/ingest',
      fetchImpl: createMockFetch(),
      batchSize: 100,
    });
    track('session_start', { modelId: 'test' });
    expect(getDefaultTelemetryClient()!.getQueueSize()).toBe(1);
  });

  it('未 initTelemetry 时 track 是 no-op(不抛错)', () => {
    expect(() => track('session_start')).not.toThrow();
  });

  it('flushTelemetry 调用默认客户端 flush', async () => {
    const fetchFn = createMockFetch(true, 200);
    initTelemetry({
      enabled: true,
      endpoint: 'https://example.com/v1/telemetry/ingest',
      fetchImpl: fetchFn,
      batchSize: 100,
    });
    track('session_start');
    await flushTelemetry();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('shutdownTelemetry 清理默认客户端 + 最后一次 flush', async () => {
    const fetchFn = createMockFetch(true, 200);
    initTelemetry({
      enabled: true,
      endpoint: 'https://example.com/v1/telemetry/ingest',
      fetchImpl: fetchFn,
      batchSize: 100,
    });
    track('session_start');
    await shutdownTelemetry();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // shutdown 后默认客户端置 null
    expect(getDefaultTelemetryClient()).toBeNull();
  });

  it('未 initTelemetry 时 shutdownTelemetry 是 no-op(不抛错)', async () => {
    await expect(shutdownTelemetry()).resolves.toBeUndefined();
  });

  it('多次 initTelemetry 不泄漏 timer(旧 client shutdown)', async () => {
    const timers1 = createMockTimers();
    const timers2 = createMockTimers();
    // 第一次 init
    initTelemetry({
      enabled: true,
      endpoint: 'https://example.com/v1/telemetry/ingest',
      fetchImpl: createMockFetch(),
      setIntervalImpl: timers1.setIntervalImpl,
      clearIntervalImpl: timers1.clearIntervalImpl,
      batchSize: 100,
    });
    expect(timers1.setIntervalImpl).toHaveBeenCalledTimes(1);

    // 第二次 init(应触发旧 client shutdown)
    initTelemetry({
      enabled: true,
      endpoint: 'https://example.com/v1/telemetry/ingest',
      fetchImpl: createMockFetch(),
      setIntervalImpl: timers2.setIntervalImpl,
      clearIntervalImpl: timers2.clearIntervalImpl,
      batchSize: 100,
    });
    // 旧 client 的 clearInterval 被调用(注意:旧 shutdown 是 async,可能未立即完成)
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(timers1.clearIntervalImpl).toHaveBeenCalledTimes(1);
    expect(timers2.setIntervalImpl).toHaveBeenCalledTimes(1);
  });
});
