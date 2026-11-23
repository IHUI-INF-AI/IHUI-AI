// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B3-01 浏览器扩展 → 本机常驻桥 host 的 `chrome.runtime.connectNative` 客户端。
 *
 * 分工：
 *   - `native-messaging-protocol.ts` 管 Chrome 与本机 host 之间的 4 字节帧；
 *   - 本文件管扩展这一侧：按 requestId 多路复用、超时、断线重连、错误归一。
 *
 * 失败方向：没有 `chrome.runtime.connectNative`（非扩展宿主 / 被策略禁用）⇒ 明确
 * `native-messaging-unavailable`，不伪装成「host 没响应」；断线时所有在飞请求
 * 一次性 `native-host-disconnected`，不悬挂。
 */

export const NATIVE_HOST_NAME = 'ai.ihui.bridge';

export type NativeHostOp = 'ping' | 'capabilities' | 'shutdown';

export interface NativeHostRequest {
  readonly op: NativeHostOp;
  readonly payload?: unknown;
  readonly timeoutMs?: number;
}

export interface NativeHostReply<T = unknown> {
  readonly ok: boolean;
  readonly op: string;
  readonly data?: T;
  readonly error?: string;
  readonly pid?: number;
  readonly version?: string;
}

export interface NativePortLike {
  postMessage(message: unknown): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
  disconnect?(): void;
}

export interface NativeHostClientDeps {
  readonly connect: (name: string) => NativePortLike;
  readonly now?: () => number;
  readonly setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export interface NativeHostClient {
  request<T = unknown>(req: NativeHostRequest): Promise<NativeHostReply<T>>;
  dispose(): void;
}

interface Pending {
  readonly resolve: (reply: NativeHostReply) => void;
  readonly reject: (err: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function lastErrorMessage(): string | null {
  const runtime = (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } })
    .chrome?.runtime;
  return runtime?.lastError?.message ?? null;
}

export function createNativeHostClient(deps: NativeHostClientDeps): NativeHostClient {
  let port: NativePortLike | null = null;
  let disposed = false;
  let seq = 0;
  const pending = new Map<string, Pending>();
  const setTimer = (deps.setTimer ?? setTimeout) as (
    fn: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
  const clearTimer = (deps.clearTimer ?? clearTimeout) as (
    timer: ReturnType<typeof setTimeout>,
  ) => void;

  const rejectAll = (reason: string): void => {
    for (const [id, p] of pending) {
      clearTimer(p.timer);
      p.reject(new Error(reason));
      pending.delete(id);
    }
  };

  const ensurePort = (): NativePortLike => {
    if (port) return port;
    if (typeof deps.connect !== 'function') {
      throw new Error('native-messaging-unavailable');
    }
    let created: NativePortLike;
    try {
      created = deps.connect(NATIVE_HOST_NAME);
    } catch (err) {
      throw new Error(`native-messaging-unavailable: ${(err as Error).message}`);
    }
    const connectError = lastErrorMessage();
    if (connectError) throw new Error(`native-messaging-unavailable: ${connectError}`);
    created.onMessage.addListener((message) => {
      if (!isRecord(message) || typeof message.requestId !== 'string') return;
      const p = pending.get(message.requestId);
      if (!p) return;
      pending.delete(message.requestId);
      clearTimer(p.timer);
      p.resolve(message as unknown as NativeHostReply);
    });
    created.onDisconnect.addListener(() => {
      const reason = lastErrorMessage() ?? 'native-host-disconnected';
      port = null;
      rejectAll(reason);
    });
    port = created;
    return created;
  };

  return {
    request<T = unknown>(req: NativeHostRequest): Promise<NativeHostReply<T>> {
      if (disposed) return Promise.reject(new Error('native-host-disposed'));
      return new Promise<NativeHostReply<T>>((resolve, reject) => {
        let target: NativePortLike;
        try {
          target = ensurePort();
        } catch (err) {
          reject(err as Error);
          return;
        }
        seq += 1;
        const requestId = `nh-${seq}-${Math.random().toString(36).slice(2, 8)}`;
        const timeoutMs = req.timeoutMs ?? 10_000;
        const timer = setTimer(() => {
          if (!pending.has(requestId)) return;
          pending.delete(requestId);
          reject(new Error(`native-host-timeout: ${req.op}`));
        }, timeoutMs);
        pending.set(requestId, {
          resolve: resolve as (reply: NativeHostReply) => void,
          reject,
          timer,
        });
        try {
          target.postMessage({ requestId, op: req.op, payload: req.payload });
        } catch (err) {
          pending.delete(requestId);
          clearTimer(timer);
          reject(new Error(`native-host-post-failed: ${(err as Error).message}`));
        }
      });
    },
    dispose(): void {
      disposed = true;
      rejectAll('native-host-disposed');
      try {
        port?.disconnect?.();
      } catch {
        // 断线失败不影响 dispose 语义
      }
      port = null;
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
