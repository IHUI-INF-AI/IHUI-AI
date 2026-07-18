/**
 * 极简 Telemetry 上报(fetch + JSON 批量,不引入 OpenTelemetry SDK)。
 *
 * 灵感来源:参考行业 Agent 框架的轻量 telemetry 设计(PostHog/Mixpanel 模式)。
 * 简化策略(做减法):
 *   - 队列 + 定时 flush(60s)+ 阈值 flush(50 条)
 *   - fetch POST 单端点,失败重试入队(最多保留 100 条防止无限增长)
 *   - feature flag 默认关闭(settings.telemetry.enabled),关闭时 track 直接 no-op
 *   - shutdown 清理 timer + 最后一次 flush
 *
 * 使用方式:
 *   1. 启动时 initTelemetry(settings.telemetry)
 *   2. 任意位置 track('event_name', { prop: value })
 *   3. 退出时 await shutdownTelemetry()
 */

/** Telemetry 事件类型(枚举已知事件) */
export type TelemetryEventType =
  | 'session_start'
  | 'session_end'
  | 'tool_call_completed'
  | 'prompt_completed'
  | 'error_logged';

/** Telemetry 事件 */
export interface TelemetryEvent {
  /** 事件名 */
  name: TelemetryEventType;
  /** 事件属性(可选) */
  props?: Record<string, unknown>;
  /** 时间戳(ms) */
  timestamp: number;
}

/** TelemetryClient 配置 */
export interface TelemetryConfig {
  /** 上报端点 URL(如 https://api.example.com/v1/telemetry/ingest) */
  endpoint?: string;
  /** 是否启用(默认 false) */
  enabled?: boolean;
  /** 批量大小(默认 50,达到即 flush) */
  batchSize?: number;
  /** flush 间隔毫秒(默认 60000=1min) */
  flushIntervalMs?: number;
  /** fetch 实现(可注入,测试用) */
  fetchImpl?: typeof fetch;
  /** 定时器实现(可注入,测试用) */
  setIntervalImpl?: typeof setInterval;
  /** 清除定时器实现(可注入,测试用) */
  clearIntervalImpl?: typeof clearInterval;
}

/** 默认配置 */
const DEFAULT_FLUSH_INTERVAL_MS = 60_000;
const DEFAULT_MAX_BATCH_SIZE = 50;
/** flush 失败时队列最多保留多少条(防止无限增长) */
const MAX_QUEUE_ON_FAILURE = 100;

/**
 * TelemetryClient — 极简批量上报客户端。
 *
 * 行为契约:
 * - enabled !== true 时 trackEvent 直接 no-op(零回归)
 * - 队列达到 batchSize 时自动 flush(异步,失败忽略)
 * - 定时 flush(默认 60s)
 * - flush 失败时把事件放回队列(最多保留 MAX_QUEUE_ON_FAILURE 条)
 * - endpoint 未配置时 flush 为 no-op
 */
export class TelemetryClient {
  private queue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly config: Required<Pick<TelemetryConfig, 'enabled' | 'batchSize' | 'flushIntervalMs'>> &
    Pick<TelemetryConfig, 'endpoint' | 'fetchImpl'>;
  private readonly fetchFn: typeof fetch;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;

  constructor(config: TelemetryConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      batchSize: config.batchSize ?? DEFAULT_MAX_BATCH_SIZE,
      flushIntervalMs: config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      endpoint: config.endpoint,
      fetchImpl: config.fetchImpl,
    };
    this.fetchFn = config.fetchImpl ?? fetch;
    this.setIntervalFn = config.setIntervalImpl ?? setInterval;
    this.clearIntervalFn = config.clearIntervalImpl ?? clearInterval;

    if (this.config.enabled) {
      // 启用定时 flush(失败忽略)
      this.flushTimer = this.setIntervalFn(() => {
        void this.flush().catch(() => {
          // 静默失败:telemetry 不应阻塞主流程
        });
      }, this.config.flushIntervalMs);
    }
  }

  /** 入队事件 */
  trackEvent(name: TelemetryEventType, props?: Record<string, unknown>): void {
    if (!this.config.enabled) return;
    this.queue.push({ name, props, timestamp: Date.now() });
    if (this.queue.length >= this.config.batchSize) {
      void this.flush().catch(() => {
        // 静默失败
      });
    }
  }

  /** flush 队列到 endpoint */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    if (!this.config.endpoint) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const res = await this.fetchFn(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
      if (!res.ok) {
        // HTTP 非 2xx:把事件放回队列(最多保留 100 条)
        this.queue.unshift(...batch.slice(-MAX_QUEUE_ON_FAILURE));
      }
    } catch {
      // 网络错误:把事件放回队列(最多保留 100 条)
      this.queue.unshift(...batch.slice(-MAX_QUEUE_ON_FAILURE));
    }
  }

  /** 关闭客户端:清理 timer + 最后一次 flush */
  async shutdown(): Promise<void> {
    if (this.flushTimer !== null) {
      this.clearIntervalFn(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /** 当前队列长度(测试用) */
  getQueueSize(): number {
    return this.queue.length;
  }

  /** 是否已启用(测试用) */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// === 默认实例 + 全局 API ===

let defaultClient: TelemetryClient | null = null;

/**
 * 初始化默认 telemetry 客户端。
 *
 * 多次调用:先 shutdown 旧客户端(清理 timer + 最后一次 flush),再创建新客户端。
 * 这保证测试中 initTelemetry 多次调用不会泄漏 timer。
 *
 * @returns 新创建的客户端(供调用方主动 shutdown)
 */
export function initTelemetry(config: TelemetryConfig = {}): TelemetryClient {
  if (defaultClient) {
    void defaultClient.shutdown();
  }
  defaultClient = new TelemetryClient(config);
  return defaultClient;
}

/** 全局 track:把事件入队到默认客户端 */
export function track(name: TelemetryEventType, props?: Record<string, unknown>): void {
  defaultClient?.trackEvent(name, props);
}

/** 全局 flush:强制把默认客户端队列 flush 到 endpoint */
export async function flushTelemetry(): Promise<void> {
  if (defaultClient) {
    await defaultClient.flush();
  }
}

/** 全局 shutdown:清理默认客户端 timer + 最后一次 flush */
export async function shutdownTelemetry(): Promise<void> {
  if (defaultClient) {
    await defaultClient.shutdown();
    defaultClient = null;
  }
}

/** 获取默认客户端(测试用) */
export function getDefaultTelemetryClient(): TelemetryClient | null {
  return defaultClient;
}

/** 重置默认客户端为 null(测试用,跳过 shutdown) */
export function _resetDefaultClientForTest(): void {
  defaultClient = null;
}
