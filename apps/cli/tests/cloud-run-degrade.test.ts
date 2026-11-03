// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cloud-run 降级可见化回归(单点修复票 2026-09-26)。
 * 钉三件事:① 失败必留可见痕迹(计数 + 结构化原因 + 喊话);② 成功路径逐字不变;
 * ③ 原因分档沿用 inflight-ledger 封闭集 + 'server',不得折叠成单一 unknown、不得自立第二套词表。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLOUD_RUN_FAILURE_CODES,
  completeCloudRun,
  getCloudRunDegradeFacts,
  resetCloudRunDegradeFacts,
  startCloudRun,
} from '../src/cloud-run.js';
import { LEDGER_FAILURE_CODES } from '../src/util/inflight-ledger.js';

interface StubInit {
  method?: string;
  signal?: AbortSignal;
}

function stubFetch(impl: (url: string, init?: StubInit) => Promise<Response> | Response) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (url: string, init?: StubInit): Promise<Response> | Response => {
    calls.push(url);
    return impl(url, init);
  });
  return calls;
}

function statusResponse(ok: boolean, status: number): Response {
  return { ok, status } as Response;
}

beforeEach(() => {
  resetCloudRunDegradeFacts();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cloud-run 降级可见化', () => {
  it('回归锁:成功路径不变 —— 返回 runId、零失败痕迹、零喊话(start 与 complete)', async () => {
    const calls = stubFetch(() => statusResponse(true, 200));
    const runId = await startCloudRun({ task: 't', apiKey: 'k' });
    expect(typeof runId).toBe('string');
    expect(runId).toMatch(/^[0-9a-f]{32}$/);
    expect(calls[0]).toContain('/api/cloud-runs/run');
    expect(await completeCloudRun({ runId: runId ?? 'x', status: 'done', output: 'ok' })).toBe(true);
    const facts = getCloudRunDegradeFacts();
    expect(facts.start.failures).toBe(0);
    expect(facts.start.lastFailure).toBeNull();
    expect(facts.complete.failures).toBe(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('失败必留可见痕迹:计数 +1、原因非空、首次立即喊话(不再静默 return null)', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));
    expect(await startCloudRun({ task: 't', apiKey: 'k' })).toBeNull();
    const facts = getCloudRunDegradeFacts();
    expect(facts.start.failures).toBe(1);
    expect(facts.start.lastFailure).not.toBeNull();
    expect(facts.start.lastFailure?.code).toBe('network');
    expect(facts.start.lastFailure?.message).toContain('fetch failed');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('原因分档:auth / server / cancelled 各归各档,不折叠成一个 unknown', async () => {
    // 401 → auth(处置=重新登录)
    stubFetch(() => statusResponse(false, 401));
    await startCloudRun({ task: 't' });
    expect(getCloudRunDegradeFacts().start.lastFailure?.code).toBe('auth');

    // 500 → server(处置=查服务)—— 与 auth 不同档才算分档成立
    resetCloudRunDegradeFacts();
    stubFetch(() => statusResponse(false, 500));
    await startCloudRun({ task: 't' });
    expect(getCloudRunDegradeFacts().start.lastFailure?.code).toBe('server');

    // 外部取消 → cancelled(发起前已 abort,连请求都不发)
    resetCloudRunDegradeFacts();
    const ac = new AbortController();
    ac.abort();
    const calls = stubFetch(() => statusResponse(true, 200));
    expect(await startCloudRun({ task: 't', signal: ac.signal })).toBeNull();
    expect(getCloudRunDegradeFacts().start.lastFailure?.code).toBe('cancelled');
    expect(calls.length).toBe(0);
  });

  it('timeout 与 cancelled 不同码:内部定时器触发落 timeout,不落 network', async () => {
    vi.useFakeTimers();
    try {
      stubFetch(
        (_url, init) =>
          new Promise<Response>((_res, rej) => {
            init?.signal?.addEventListener('abort', () => rej(new Error('The operation was aborted')));
          }),
      );
      const pending = startCloudRun({ task: 't', apiKey: 'k' });
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toBeNull();
      expect(getCloudRunDegradeFacts().start.lastFailure?.code).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('连续失败能被发现:计数累计到 5,喊话按节流不刷屏(1 ≤ 次数 ≤ 2)', async () => {
    stubFetch(() => Promise.reject(new Error('boom')));
    for (let i = 0; i < 5; i += 1) {
      expect(await completeCloudRun({ runId: 'r1', status: 'error' })).toBe(false);
    }
    const facts = getCloudRunDegradeFacts();
    expect(facts.complete.failures).toBe(5);
    expect(facts.complete.lastFailure?.code).toBe('network');
    const warns = vi.mocked(console.warn).mock.calls.length;
    expect(warns).toBeGreaterThanOrEqual(1);
    expect(warns).toBeLessThanOrEqual(2);
    // start 计数独立,不被 complete 的失败污染
    expect(facts.start.failures).toBe(0);
  });

  it('词表锁:原因码 = inflight-ledger 封闭集 + server,禁止第二套词表', () => {
    expect(CLOUD_RUN_FAILURE_CODES).toEqual([...LEDGER_FAILURE_CODES, 'server']);
    for (const c of ['network', 'auth', 'timeout', 'cancelled', 'server']) {
      expect(CLOUD_RUN_FAILURE_CODES).toContain(c);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
