// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-062 回归:每条 WS 连接(含 Origin/鉴权拒绝的"鉴权前"连接)都必须挂 error 监听。
 *
 * 失败形态:EventEmitter 上无监听的 'error' 会直接抛出 —— ws 服务端表现为单帧
 * (超限帧/协议错误/ECONNRESET)即可打崩常驻 `ihui serve`。夹具用假的 ws 服务器
 * 与假 socket 驱动,不占用真实端口。
 */
import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentCore } from '../src/server/agent-core.js';

/** 假 WsServer 暴露给用例的口子(ws-bridge 只依赖 connection/close)。 */
type FakeConnection = {
  options: Record<string, unknown>;
  emitConnection: (ws: FakeSocket, req: { url?: string; headers?: Record<string, string> }) => void;
};

const harness = vi.hoisted(() => ({ instances: [] as unknown[] }));

vi.mock('ws', () => {
  class FakeWebSocketServer {
    readonly options: Record<string, unknown>;
    private connectionListener: ((ws: unknown, req: unknown) => void) | null = null;

    constructor(options: Record<string, unknown>) {
      this.options = options;
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

async function attach(token = 'secret'): Promise<{
  handle: Awaited<ReturnType<typeof attachWsBridge>>;
  server: FakeConnection;
}> {
  const core = { sendMessage: vi.fn() } as unknown as AgentCore;
  const handle = await attachWsBridge(core, { server: {} as unknown as Server, token });
  const instance = harness.instances[harness.instances.length - 1];
  if (!instance) throw new Error('假 WsServer 未被构造');
  return { handle, server: instance as FakeConnection };
}

describe('F-062 WS 连接 error 监听', () => {
  beforeEach(() => {
    harness.instances.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('放行连接:error 不抛、以 1009 关闭,并从可写集合清出', async () => {
    const { handle, server } = await attach();
    // 工单同一条要求:单帧必须有上限(默认 100MiB 可白吃进程内存)
    expect(server.options.maxPayload).toBe(4 * 1024 * 1024);

    const sock = new FakeSocket();
    server.emitConnection(sock, { url: '/ws', headers: { authorization: 'Bearer secret' } });
    expect(sock.closeCalls).toHaveLength(0);

    expect(() => sock.emit('error', new Error('Max payload size exceeded'))).not.toThrow();
    expect(sock.closeCalls).toEqual([{ code: 1009, reason: 'MESSAGE_TOO_BIG' }]);

    await handle.close();
    // 已从 clients 移除:关桥不应再触碰这条连接
    expect(sock.closeCalls).toHaveLength(1);
  });

  it('Origin 拒绝路径(鉴权前):error 不抛且连接被清理', async () => {
    const { handle, server } = await attach();
    const sock = new FakeSocket();
    server.emitConnection(sock, {
      url: '/ws',
      headers: { origin: 'https://evil.example', authorization: 'Bearer secret' },
    });
    expect(sock.closeCalls).toEqual([{ code: 4003, reason: 'ORIGIN_REJECTED' }]);
    expect(sock.sent.join('')).toContain('ORIGIN_REJECTED');

    expect(() => sock.emit('error', new Error('read ECONNRESET'))).not.toThrow();
    expect(sock.closeCalls[sock.closeCalls.length - 1]).toEqual({ code: 1009, reason: 'MESSAGE_TOO_BIG' });

    await handle.close();
  });

  it('鉴权失败路径(鉴权前):error 不抛且连接被清理', async () => {
    const { handle, server } = await attach();
    const sock = new FakeSocket();
    server.emitConnection(sock, { url: '/ws', headers: {} });
    expect(sock.closeCalls[0]).toEqual({ code: 4001, reason: 'CREDENTIAL_MISSING' });

    expect(() => sock.emit('error', new Error('write EPIPE'))).not.toThrow();
    expect(sock.closeCalls[sock.closeCalls.length - 1]).toEqual({ code: 1009, reason: 'MESSAGE_TOO_BIG' });

    await handle.close();
  });
});
