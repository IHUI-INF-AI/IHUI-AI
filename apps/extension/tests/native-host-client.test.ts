// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B3-01 connectNative 客户端契约。
 *
 * ① 只认带 requestId 的应答，多路复用不串号；
 * ② 超时 / 断线 / connect 不可用三种失败各有具名原因；
 * ③ dispose 后不再发请求，且断开底层 port。
 */

import { describe, expect, it } from 'vitest';

import {
  createNativeHostClient,
  NATIVE_HOST_NAME,
  type NativePortLike,
} from '../lib/native-host-client.js';

class FakePort implements NativePortLike {
  readonly sent: unknown[] = [];
  private messageListeners: Array<(message: unknown) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  disconnected = false;

  readonly onMessage = {
    addListener: (listener: (message: unknown) => void) => {
      this.messageListeners.push(listener);
    },
  };

  readonly onDisconnect = {
    addListener: (listener: () => void) => {
      this.disconnectListeners.push(listener);
    },
  };

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  emit(message: unknown): void {
    for (const listener of this.messageListeners) listener(message);
  }

  drop(): void {
    for (const listener of this.disconnectListeners) listener();
  }
}

describe('A 请求/应答', () => {
  it('connectNative 使用固定 host 名，按 requestId 回包', async () => {
    const port = new FakePort();
    const names: string[] = [];
    const client = createNativeHostClient({
      connect: (name) => {
        names.push(name);
        return port;
      },
    });

    const promise = client.request({ op: 'ping' });
    expect(names).toEqual([NATIVE_HOST_NAME]);
    expect(port.sent).toHaveLength(1);
    const sent = port.sent[0] as { requestId: string; op: string };
    expect(sent.op).toBe('ping');
    port.emit({ requestId: sent.requestId, ok: true, op: 'ping', pid: 123 });
    await expect(promise).resolves.toMatchObject({ ok: true, pid: 123 });
  });

  it('不带 requestId 的噪声不结算任何请求', async () => {
    const port = new FakePort();
    const client = createNativeHostClient({ connect: () => port });
    const promise = client.request({ op: 'capabilities' });
    port.emit({ ok: true, op: 'capabilities' });
    port.emit({ requestId: 'other', ok: true, op: 'ping' });
    const sent = port.sent[0] as { requestId: string };
    port.emit({ requestId: sent.requestId, ok: true, op: 'capabilities' });
    await expect(promise).resolves.toMatchObject({ op: 'capabilities' });
  });
});

describe('B 失败面', () => {
  it('超时抛 native-host-timeout', async () => {
    const port = new FakePort();
    const client = createNativeHostClient({ connect: () => port });
    await expect(client.request({ op: 'ping', timeoutMs: 10 })).rejects.toThrow(
      'native-host-timeout',
    );
  });

  it('connect 抛错归一成 native-messaging-unavailable', async () => {
    const client = createNativeHostClient({
      connect: () => {
        throw new Error('not allowed');
      },
    });
    await expect(client.request({ op: 'ping' })).rejects.toThrow(
      'native-messaging-unavailable',
    );
  });

  it('断线时在飞请求全部拒绝，后续请求重连', async () => {
    const first = new FakePort();
    const second = new FakePort();
    let calls = 0;
    const client = createNativeHostClient({
      connect: () => (calls++ === 0 ? first : second),
    });
    const promise = client.request({ op: 'ping' });
    first.drop();
    await expect(promise).rejects.toThrow('native-host-disconnected');

    const next = client.request({ op: 'ping' });
    const sent = second.sent[0] as { requestId: string };
    second.emit({ requestId: sent.requestId, ok: true, op: 'ping' });
    await expect(next).resolves.toMatchObject({ ok: true });
  });

  it('dispose 拒绝在飞请求并断开 port', async () => {
    const port = new FakePort();
    const client = createNativeHostClient({ connect: () => port });
    const promise = client.request({ op: 'ping' });
    client.dispose();
    await expect(promise).rejects.toThrow('native-host-disposed');
    expect(port.disconnected).toBe(true);
    await expect(client.request({ op: 'ping' })).rejects.toThrow('native-host-disposed');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
