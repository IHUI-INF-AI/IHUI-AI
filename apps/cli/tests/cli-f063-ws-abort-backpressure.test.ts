// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-063 回归:WS 断连必须取消在飞回合;发送侧必须看 bufferedAmount 背压。
 *
 * 失败形态:关闭标签页/断网后 agent 回合继续跑(继续烧 token、继续写文件);
 * 慢客户端时 ws.send 无背压判断,排队字节无界增长。
 * 夹具复用 F-062 的假 ws 服务器/假 socket 形态,不占用真实端口。
 */
import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentCore } from '../src/server/agent-core.js';

type FakeConnection = {
  emitConnection: (ws: FakeSocket, req: { url?: string; headers?: Record<string, string> }) => void;
};

const harness = vi.hoisted(() => ({ instances: [] as unknown[] }));

vi.mock('ws', () => {
  class FakeWebSocketServer {
    private connectionListener: ((ws: unknown, req: unknown) => void) | null = null;

    constructor() {
      harness.instances.push(this);
    }

    on(event: string, listener: (ws: unknown, req: unknown) => void): void {
      if (event === 'connection') this.connectionListener = listener;
    }

    close(callback?: () => void): void {
      callback?.();
    }

    emitConnection(ws: unknown, req: unknown): void {
      this.connectionListener?.(ws, req);
    }
  }

  return { WebSocketServer: FakeWebSocketServer, default: FakeWebSocketServer };
});

import { attachWsBridge } from '../src/server/ws-bridge.js';

class FakeSocket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  readonly sent: string[] = [];
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.closeCalls.push({ code, reason });
  }
}

type SendMessageArgs = [
  text: string,
  onEvent: (event: { type: string; text?: string }) => void,
  opts?: { sessionId?: string; signal?: AbortSignal },
];

async function attach(
  sendMessage: (...args: SendMessageArgs) => Promise<unknown>,
): Promise<{ handle: Awaited<ReturnType<typeof attachWsBridge>>; server: FakeConnection; sock: FakeSocket }> {
  const core = { sendMessage: vi.fn(sendMessage) } as unknown as AgentCore;
  const handle = await attachWsBridge(core, { server: {} as unknown as Server, token: 'secret' });
  const instance = harness.instances[harness.instances.length - 1] as FakeConnection | undefined;
  if (!instance) throw new Error('假 WsServer 未被构造');

  const sock = new FakeSocket();
  instance.emitConnection(sock, { url: '/ws', headers: { authorization: 'Bearer secret' } });
  return { handle, server: instance, sock };
}

/** 让 void handleMessage 的微任务推进到 sendMessage 被调用之后。 */
async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

function sendFrame(sock: FakeSocket, text: string): void {
  sock.emit('message', Buffer.from(JSON.stringify({ type: 'message', text }), 'utf-8'));
}

describe('F-063 WS 断连取消在飞回合 + 发送背压', () => {
  beforeEach(() => {
    harness.instances.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('连接 close 会 abort 该连接的在飞回合', async () => {
    let capturedSignal: AbortSignal | undefined;
    const { handle, sock } = await attach(
      (_text, _onEvent, opts) =>
        new Promise((resolve) => {
          capturedSignal = opts?.signal;
          // 模拟长回合:只有被 abort 才收口
          opts?.signal?.addEventListener('abort', () => resolve({ aborted: true }), { once: true });
        }),
    );

    sendFrame(sock, '你好');
    await flush();
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    // 对端断开
    sock.emit('close');
    expect(capturedSignal?.aborted).toBe(true);

    await handle.close();
  });

  it('关桥时也会 abort 在飞回合', async () => {
    let capturedSignal: AbortSignal | undefined;
    const { handle, sock } = await attach(
      (_text, _onEvent, opts) =>
        new Promise((resolve) => {
          capturedSignal = opts?.signal;
          opts?.signal?.addEventListener('abort', () => resolve({ aborted: true }), { once: true });
        }),
    );

    sendFrame(sock, '你好');
    await flush();
    expect(capturedSignal?.aborted).toBe(false);

    await handle.close();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('bufferedAmount 超阈值时丢弃帧并留痕,不无限堆积', async () => {
    const { handle, sock } = await attach(async (_text, onEvent) => {
      onEvent({ type: 'token', text: 'a' });
      onEvent({ type: 'token', text: 'b' });
      return { ok: true };
    });

    // 慢客户端:已排队 9 MiB(超过 8 MiB 阈值)
    sock.bufferedAmount = 9 * 1024 * 1024;
    sendFrame(sock, '你好');
    await flush();

    // token 帧与 result 帧都不应写出
    expect(sock.sent).toHaveLength(0);
    expect(vi.mocked(console.warn).mock.calls.length).toBeGreaterThan(0);
    expect(String(vi.mocked(console.warn).mock.calls[0]?.[0])).toContain('背压');

    await handle.close();
  });

  it('背压正常时收发语义不变:token 与 result 照常推送', async () => {
    const { handle, sock } = await attach(async (_text, onEvent) => {
      onEvent({ type: 'token', text: 'a' });
      return { ok: true };
    });

    sock.bufferedAmount = 0;
    sendFrame(sock, '你好');
    await flush();

    expect(sock.sent).toHaveLength(2);
    expect(JSON.parse(sock.sent[0]!)).toMatchObject({ type: 'token', text: 'a' });
    expect(JSON.parse(sock.sent[1]!)).toMatchObject({ type: 'result', ok: true });

    await handle.close();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
