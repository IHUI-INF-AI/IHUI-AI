// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​⁠

/**
 * 台账号 G-662 —— ACP init 竞态:关停信号不等卡住的 init Promise,init 之后才建成的
 * 句柄走 disposeLate 且失败打 warn。
 *
 * 钉四层(纯单元,不连网/不连 MCP):
 *   ① 验收格(构造面):abort 早于 create resolve ⇒ raceInitAgainstAbort 判 aborted,
 *      init 后台 resolve 后 disposeLateInitHandles 必被调用(迟到句柄被收走)
 *   ② 反向:init 先 resolve 且无 abort ⇒ ready 且不 dispose;init 先 reject ⇒ 原样上抛
 *   ③ 落败 init 的 reject 不得升级 unhandledRejection(挂空 catch)
 *   ④ 失败必 warn:runTeardowns 失败清单非空 / close 抛错 ⇒ console.warn 点名,不中断
 *   ⑤ 装车锁(对修复前源码必红):prompt() init 段必须真接线(裸 await 即为旧病)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  raceInitAgainstAbort,
  attachLateDispose,
  disposeLateHandles,
  disposeLateInitHandles,
} from '../src/acp/server.js';

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeRegistry(failed: string[] = []): {
  runTeardowns: () => Promise<string[]>;
  calls: number;
} {
  return {
    calls: 0,
    async runTeardowns() {
      this.calls++;
      return failed;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('① 验收格:abort 早于 create resolve ⇒ disposeLate 被调用', () => {
  it('竞态中 abort 先胜出,init 后台 resolve 后迟到句柄被收走', async () => {
    const ac = new AbortController();
    let resolveInit!: (v: { pluginRegistry: unknown }) => void;
    const init = new Promise<{ pluginRegistry: unknown }>((r) => {
      resolveInit = r;
    });
    const raced = raceInitAgainstAbort(init, ac.signal);
    ac.abort(); // abort 早于 create resolve
    await expect(raced).resolves.toEqual({ kind: 'aborted' });

    attachLateDispose(init); // 与 prompt() 共用同一条迟到回收链
    const registry = makeRegistry();
    resolveInit({ pluginRegistry: registry });
    await flushAsync(); // fire-and-forget 的迟到回收链落定

    expect(registry.calls).toBe(1); // disposeLate 被调用 ⇒ runTeardowns 恰 1 次
  });

  it('调用时信号已 aborted ⇒ 立即判 aborted,不等卡住的 init', async () => {
    const ac = new AbortController();
    ac.abort();
    let resolveInit!: () => void;
    const init = new Promise<{ pluginRegistry: unknown }>((r) => {
      resolveInit = r;
    });
    const raced = raceInitAgainstAbort(init, ac.signal);
    await expect(raced).resolves.toEqual({ kind: 'aborted' });
    resolveInit!(); // 之后才 resolve:不影响结论
    await flushAsync();
  });
});

describe('② 反向:正常路径不回收、失败照旧上抛', () => {
  it('init 先 resolve 且无 abort ⇒ ready,dispose 零调用', async () => {
    const ac = new AbortController();
    const registry = makeRegistry();
    const raced = raceInitAgainstAbort(
      Promise.resolve({ pluginRegistry: registry }),
      ac.signal,
    );
    await expect(raced).resolves.toEqual({
      kind: 'ready',
      value: { pluginRegistry: registry },
    });
    await flushAsync();
    expect(registry.calls).toBe(0); // 正常产物交还调用方,不得被误收
  });

  it('init 先 reject ⇒ race 原样上抛(与旧裸 await 同语义)', async () => {
    const ac = new AbortController();
    const raced = raceInitAgainstAbort(Promise.reject(new Error('init 炸了')), ac.signal);
    await expect(raced).rejects.toThrow('init 炸了');
    await flushAsync();
  });
});

describe('③ 落败 init 的 reject 不得升级 unhandledRejection', () => {
  it('abort 胜出后 init reject:进程安静(vitest 会把未处理 rejection 记失败)', async () => {
    const ac = new AbortController();
    let rejectInit!: (e: Error) => void;
    const init = new Promise<never>((_r, rej) => {
      rejectInit = rej;
    });
    const raced = raceInitAgainstAbort(init, ac.signal);
    ac.abort();
    await expect(raced).resolves.toEqual({ kind: 'aborted' });
    rejectInit(new Error('迟到的失败'));
    await flushAsync();
    await flushAsync();
    // 无断言:若未挂空 catch,这里的 unhandledRejection 会让本测试文件红
  });
});

describe('④ 失败必 warn:回收失败点名,不中断', () => {
  it('runTeardowns 失败清单非空 ⇒ warn 且不抛', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      disposeLateInitHandles('acp-init', { pluginRegistry: makeRegistry(['plug-a', 'plug-b']) }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('plug-a');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('plug-b');
  });

  it('close 抛错 ⇒ warn 点名,后续句柄照收', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = makeRegistry();
    await disposeLateHandles('测试面', [
      { name: 'bad', close: () => Promise.reject(new Error('fd 炸了')) },
      { name: 'ok', close: () => ok.runTeardowns() },
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('bad');
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('fd 炸了');
    expect(ok.calls).toBe(1);
  });

  it('无 pluginRegistry ⇒ 零句柄零回收(空面不误报)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(disposeLateInitHandles('acp-init', {})).resolves.toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('⑤ 装车锁:prompt() init 段必须真接线(对修复前裸 await 源码必红)', () => {
  const serverSrc = readFileSync(
    fileURLToPath(new URL('../src/acp/server.ts', import.meta.url)),
    'utf8',
  );

  it('init 段必须经 raceInitAgainstAbort 竞态,不得裸 await setupAgentTools', () => {
    expect(serverSrc).toContain('const initPromise = setupAgentTools({');
    expect(serverSrc).toContain('raceInitAgainstAbort(initPromise, initAbort.signal)');
    expect(serverSrc).not.toMatch(/const result = await setupAgentTools\(/);
  });

  it('init 期 cancel 可达:pendingAbort 必须先挂 initAbort', () => {
    expect(serverSrc).toContain('state.pendingAbort = initAbort;');
  });

  it('两条迟到路径都必须走 disposeLate 出口(acp-init)', () => {
    expect(serverSrc).toContain('attachLateDispose(initPromise);');
    expect(serverSrc).toContain("disposeLateInitHandles('acp-init', outcome.value)");
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​⁠
