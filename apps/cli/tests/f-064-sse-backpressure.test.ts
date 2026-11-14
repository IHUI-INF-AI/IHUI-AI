// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-064 回归:SSE 写出必须有背压。
 *
 * 判据:
 *   1. 写封装在 `res.write` 返回 false 时**不许丢帧**,而是等 'drain' 后才 resolve;
 *   2. 连接关闭/上游 abort 时不挂死,立即返回 false 并摘掉监听器;
 *   3. 真实 http server + 慢读客户端:客户端暂停期间上游产出被阻塞(不再无限缓冲),
 *      恢复后帧数/顺序完全一致,不丢帧。
 * 既有闸门(F-137 的 1 MB 请求体上限、headersTimeout)不在此重复,只核对其仍在。
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as http from 'node:http';
import {
  MAX_JSON_BODY_BYTES,
  MAX_SSE_BUFFERED_BYTES,
  startAgentServer,
  writeSseChunk,
  type AgentServerHandle,
  type SseWritable,
} from '../src/server/http-server.js';
import type { AgentCore, AgentEvent } from '../src/server/index.js';

/** 假 res:`write` 恒返回 false(模拟内核缓冲已满),由测试手动触发 'drain'/'close'。 */
class FakeRes implements SseWritable {
  readonly written: string[] = [];
  writableEnded = false;
  destroyed = false;
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly immediate: boolean;

  constructor(immediate = false) {
    this.immediate = immediate;
  }

  write(chunk: string): boolean {
    this.written.push(chunk);
    return this.immediate;
  }

  once(event: 'drain' | 'close' | 'error', listener: () => void): this {
    const bucket = this.listeners.get(event) ?? new Set<() => void>();
    bucket.add(listener);
    this.listeners.set(event, bucket);
    return this;
  }

  off(event: 'drain' | 'close' | 'error', listener: () => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  count(event: 'drain' | 'close' | 'error'): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  emit(event: 'drain' | 'close' | 'error'): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener();
  }
}

describe('F-064 SSE 写封装', () => {
  it('write 返回 false ⇒ 等 drain 才 resolve(true),帧不丢', async () => {
    const res = new FakeRes();
    let settled = false;
    const pending = writeSseChunk(res, 'data: {"type":"token"}\n\n').then((flushed) => {
      settled = true;
      return flushed;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(res.written).toEqual(['data: {"type":"token"}\n\n']);
    expect(res.count('drain')).toBe(1);

    res.emit('drain');
    await expect(pending).resolves.toBe(true);
    expect(res.count('drain')).toBe(0);
    expect(res.count('close')).toBe(0);
  });

  it('write 返回 true ⇒ 立即 resolve(true) 且不注册监听器', async () => {
    const res = new FakeRes(true);
    await expect(writeSseChunk(res, 'x')).resolves.toBe(true);
    expect(res.count('drain') + res.count('close') + res.count('error')).toBe(0);
  });

  it('等待期间连接关闭 ⇒ 立即 resolve(false) 并在各事件上摘干净监听器', async () => {
    const res = new FakeRes();
    const pending = writeSseChunk(res, 'x');
    res.emit('close');

    await expect(pending).resolves.toBe(false);
    expect(res.count('drain')).toBe(0);
    expect(res.count('close')).toBe(0);
    expect(res.count('error')).toBe(0);
  });

  it('上游 abort ⇒ 立即 resolve(false),不挂在永远不会来的 drain 上', async () => {
    const res = new FakeRes();
    const abort = new AbortController();
    const pending = writeSseChunk(res, 'x', abort.signal);
    abort.abort();

    await expect(pending).resolves.toBe(false);
    expect(res.count('drain')).toBe(0);
    expect(res.count('close')).toBe(0);
  });

  it('res 已销毁 ⇒ 不写也不留监听器', async () => {
    const res = new FakeRes();
    res.destroyed = true;
    await expect(writeSseChunk(res, 'x')).resolves.toBe(false);
    expect(res.written).toEqual([]);
  });
});

const TOKEN = 'f-064-test-token';
const FRAMES = 2000;
const PAYLOAD = 'x'.repeat(1024);

interface ProductionState {
  produced: number;
  inFlight: number;
}

/** 每条事件 1 KB、共 2000 帧(2 MB)⇒ 慢读客户端必然触发 write=false。 */
function slowCore(state: ProductionState): AgentCore {
  return {
    listSessions: () => [],
    resumeSession: async () => null,
    sendMessage: async (
      _text: string,
      onEvent: (event: AgentEvent) => void | Promise<void>,
    ) => {
      for (let i = 0; i < FRAMES; i += 1) {
        state.inFlight += 1;
        await onEvent({ type: 'token', text: `${String(i).padStart(5, '0')}:${PAYLOAD}` });
        state.inFlight -= 1;
        state.produced = i + 1;
      }
      return { sessionId: 's', stopReason: 'end_turn', iterations: 1, usage: {} };
    },
  } as unknown as AgentCore;
}

interface SlowClientResult {
  pausedProduced: number;
  pausedInFlight: number;
  tokenFrames: string[];
  sawResult: boolean;
}

function runSlowClient(port: number, state: ProductionState, pauseMs: number): Promise<SlowClientResult> {
  const body = Buffer.from(JSON.stringify({ text: 'hi' }), 'utf-8');
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/message',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          authorization: `Bearer ${TOKEN}`,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.pause();
        res.on('data', (c) => chunks.push(c instanceof Buffer ? c : Buffer.from(c)));
        res.on('error', reject);

        let pausedProduced = -1;
        let pausedInFlight = -1;
        setTimeout(() => {
          // 客户端仍在暂停:此刻上游产出必须已被背压挡住
          pausedProduced = state.produced;
          pausedInFlight = state.inFlight;
          res.resume();
        }, pauseMs);

        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          const tokenFrames: string[] = [];
          let sawResult = false;
          for (const block of raw.split('\n\n')) {
            if (block.startsWith('event: result')) {
              sawResult = true;
              continue;
            }
            const line = block.split('\n').find((entry) => entry.startsWith('data: '));
            if (!line) continue;
            const parsed = JSON.parse(line.slice('data: '.length)) as { type: string; text: string };
            if (parsed.type === 'token') tokenFrames.push(parsed.text);
          }
          resolve({ pausedProduced, pausedInFlight, tokenFrames, sawResult });
        });
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

describe('F-064 SSE 真实连接背压', () => {
  let handle: AgentServerHandle | null = null;

  afterEach(async () => {
    if (handle) {
      await handle.close().catch(() => undefined);
      handle = null;
    }
  });

  it('慢读客户端暂停期间产出被挡住;恢复后 2000 帧全到且顺序不变', async () => {
    const state: ProductionState = { produced: 0, inFlight: 0 };
    handle = await startAgentServer(slowCore(state), { port: 0, token: TOKEN });

    const result = await runSlowClient(handle.port, state, 200);

    // 背压证据:客户端不读 ⇒ 上游卡在 onEvent 里,没有被无限缓冲
    expect(result.pausedInFlight).toBe(1);
    expect(result.pausedProduced).toBeLessThan(FRAMES);
    // 不丢帧:帧数与顺序完全一致
    expect(result.tokenFrames).toHaveLength(FRAMES);
    expect(result.tokenFrames[0]!.slice(0, 5)).toBe('00000');
    expect(result.tokenFrames[FRAMES - 1]!.slice(0, 5)).toBe(String(FRAMES - 1).padStart(5, '0'));
    expect(result.tokenFrames.map((text) => text.slice(0, 5))).toEqual(
      Array.from({ length: FRAMES }, (_, i) => String(i).padStart(5, '0')),
    );
    expect(result.sawResult).toBe(true);
  });

  it('既有闸门仍在:1 MB 请求体上限 + 显式 requestTimeout/headersTimeout', async () => {
    handle = await startAgentServer(slowCore({ produced: 0, inFlight: 0 }), { port: 0, token: TOKEN });

    expect(MAX_JSON_BODY_BYTES).toBe(1024 * 1024);
    expect(MAX_SSE_BUFFERED_BYTES).toBe(1024 * 1024);
    expect(handle.server.requestTimeout).toBe(300_000);
    expect(handle.server.headersTimeout).toBeGreaterThan(0);
    expect(handle.server.headersTimeout).toBeLessThanOrEqual(handle.server.requestTimeout);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
