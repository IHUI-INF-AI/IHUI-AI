// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest';
import {
  AgentSdkError,
  JsonRpcPeer,
  NdjsonDecoder,
  encodeMessage,
  type DecodeResult,
  type JsonRpcMessage,
  type JsonRpcRequest,
} from '../src/index.js';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function messagesOf(results: DecodeResult[]): JsonRpcMessage[] {
  return results.map((result) => {
    if (result.kind === 'error') throw new Error(`unexpected decode error: ${result.message}`);
    return result.message;
  });
}

describe('NdjsonDecoder', () => {
  it('跨 chunk 半行、CRLF 与空行都能正确切分', () => {
    const decoder = new NdjsonDecoder();
    expect(decoder.push('{"jsonrpc":"2.0","id":1,"res')).toEqual([]);

    const results = decoder.push(
      'ult":"ok"}\r\n\r\n{"jsonrpc":"2.0","method":"session/update","params":{}}\n',
    );
    const messages = messagesOf(results);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ jsonrpc: '2.0', id: 1, result: 'ok' });
    expect(messages[1]).toEqual({
      jsonrpc: '2.0',
      method: 'session/update',
      params: {},
    });
  });

  it('坏行只产出错误，不阻断后续合法行', () => {
    const decoder = new NdjsonDecoder();
    const results = decoder.push('not-json\n{"jsonrpc":"2.0","method":"ok"}\n');
    expect(results).toHaveLength(2);
    const [broken, valid] = results;
    expect(broken).toMatchObject({ kind: 'error', lineNumber: 1, raw: 'not-json' });
    if (!valid || valid.kind !== 'message') throw new Error('second line should decode');
    expect(valid.message).toEqual({ jsonrpc: '2.0', method: 'ok' });
  });

  it('非对象与非 2.0 版本都按协议错误拒绝', () => {
    const decoder = new NdjsonDecoder();
    const results = decoder.push('[]\n{"jsonrpc":"1.0","method":"x"}\n');
    expect(results.map((result) => result.kind)).toEqual(['error', 'error']);
  });

  it('flush 能冲刷没有换行结尾的最后一行', () => {
    const decoder = new NdjsonDecoder();
    expect(decoder.push('{"jsonrpc":"2.0","method":"tail"}')).toEqual([]);
    const messages = messagesOf(decoder.flush());
    expect(messages).toHaveLength(1);
  });
});

describe('encodeMessage', () => {
  it('始终以单个换行结尾，字符串内的换行被 JSON 转义', () => {
    const line = encodeMessage({ jsonrpc: '2.0', method: 'x', params: { text: 'a\nb' } });
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1)).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({ jsonrpc: '2.0', method: 'x', params: { text: 'a\nb' } });
  });
});

describe('JsonRpcPeer', () => {
  function createPeer() {
    const sent: JsonRpcMessage[] = [];
    const peer = new JsonRpcPeer({
      sendLine: (line) => {
        sent.push(JSON.parse(line) as JsonRpcMessage);
      },
    });
    return { peer, sent };
  }

  function outboundRequest(sent: JsonRpcMessage[], index: number): JsonRpcRequest {
    const message = sent[index];
    if (!message || !('method' in message) || !('id' in message)) {
      throw new Error(`sent[${index}] is not a request`);
    }
    return message;
  }

  it('响应乱序到达仍按 id 正确关联', async () => {
    const { peer, sent } = createPeer();
    const first = peer.request<string>('a');
    const second = peer.request<string>('b');
    const firstId = outboundRequest(sent, 0).id;
    const secondId = outboundRequest(sent, 1).id;

    peer.handleMessage({ jsonrpc: '2.0', id: secondId, result: 'two' });
    peer.handleMessage({ jsonrpc: '2.0', id: firstId, result: 'one' });

    await expect(first).resolves.toBe('one');
    await expect(second).resolves.toBe('two');
  });

  it('错误响应 reject 为 RPC 错误并带上方法名', async () => {
    const { peer, sent } = createPeer();
    const pending = peer.request('session/prompt');
    const expectation = expect(pending).rejects.toMatchObject({
      code: 'RPC',
      message: expect.stringContaining('session/prompt'),
    });
    peer.handleMessage({
      jsonrpc: '2.0',
      id: outboundRequest(sent, 0).id,
      error: { code: -32602, message: 'bad params' },
    });
    await expectation;
  });

  it('入站请求交给注册的 handler，响应写回同 id', async () => {
    const { peer, sent } = createPeer();
    peer.onRequest('session/request_permission', async () => ({
      outcome: { outcome: 'cancelled' },
    }));

    peer.handleMessage({
      jsonrpc: '2.0',
      id: 77,
      method: 'session/request_permission',
      params: {},
    });
    await tick();

    expect(sent).toEqual([
      { jsonrpc: '2.0', id: 77, result: { outcome: { outcome: 'cancelled' } } },
    ]);
  });

  it('未知方法与 handler 抛错都回 JSON-RPC 错误', async () => {
    const { peer, sent } = createPeer();
    peer.handleMessage({ jsonrpc: '2.0', id: 1, method: 'unknown/method' });
    await tick();
    expect(sent[0]).toMatchObject({ id: 1, error: { code: -32601 } });

    peer.onRequest('explode', () => {
      throw new Error('handler boom');
    });
    peer.handleMessage({ jsonrpc: '2.0', id: 2, method: 'explode' });
    await tick();
    expect(sent[1]).toMatchObject({ id: 2, error: { code: -32603, message: 'handler boom' } });
  });

  it('通知按方法分发', () => {
    const { peer } = createPeer();
    const seen: unknown[] = [];
    peer.onNotification('session/update', (params) => {
      seen.push(params);
    });
    peer.handleMessage({
      jsonrpc: '2.0',
      method: 'session/update',
      params: { sessionId: 's1' },
    });
    expect(seen).toEqual([{ sessionId: 's1' }]);
  });

  it('close 一次性 reject 所有 pending，之后的请求立即失败', async () => {
    const { peer } = createPeer();
    const pending = peer.request('never');
    const expectation = expect(pending).rejects.toBeInstanceOf(AgentSdkError);
    peer.close('bye');
    await expectation;
    expect(peer.pendingCount).toBe(0);
    await expect(peer.request('after-close')).rejects.toMatchObject({ code: 'PROTOCOL' });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
