// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-713 —— 改并发上界必须同时给出唤醒入口。
 *
 * 立因(票面原文 + 上游 `engine/scheduler.ts:384-403,425-428`):
 * 「抬高上界后必须显式 `pumpAll()` —— 除结算外没有任何事件会触发重扫」。
 * 我方 `SubagentWorkerPool` 的 `drainQueue()` 重扫时机只有三个(入队时 / worker 结算时 /
 * 关闭时),所以"把 `config.maxWorkers` 从 1 改成 2"这件事在字段上是真的、在行为上是假的:
 * 队列里那条等待项不会有任何人再去问一次 `activeCount < maxWorkers`,表现为
 * "上界明明抬高了而任务永远卡在队列里"。
 *
 * 因此本套件的**重心是成对性**,不是"setter 能用":
 *  - 反例(必须先绿):只改字段、不调 `setMaxWorkers` ⇒ 等待项**仍不动**。
 *    缺这一条,正例就可能被别的时机顺带满足,断言退化成复读实现(§22c)。
 *  - 正例:同一夹具下改调 `setMaxWorkers` ⇒ 等待项**立即**启动,证明是这道唤醒起的作用。
 *  - 钳制:越界值与非法值一律经唯一出口 `resolveMaxConcurrency` 折回合法档,且**永不**降到 0
 *    (0 会让 `activeCount < maxWorkers` 恒假 ⇒ 整池饿死,这是"钳制"与"关掉"的分界)。
 *  - 非抢占:调低只拦后续启动,已在跑的 worker 一个都不动(kill 计数为 0)。
 *  - 关闭后唤醒不得复活工作(shutdown 之后 `drainQueue` 的 `!shutDown` 闸必须仍合上)。
 *
 * 全程注入 `forkImpl` 假 proc,不派生任何真实子进程;每个用例都以 `shutdown()` 收尾,
 * 不把池生命周期计数(`notePoolCreated`/`notePoolClosed`)欠给并发总量遥测。
 */
import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import {
  MAX_CONCURRENCY,
  MIN_CONCURRENCY,
  resolveMaxConcurrency,
} from '../src/subagents/concurrency-budget.js';
import { SubagentWorkerPool, defaultWorkerPoolConfig } from '../src/subagents/worker-pool.js';
import type { SubagentSpawnRequest } from '@ihui/types';

/** 假子进程:记录 kill 次数;kill 即按优雅退出结算(exit 0),让 spawn 的 Promise 收口。 */
class FakeProc extends EventEmitter {
  killed = 0;
  constructor(readonly pid: number) {
    super();
  }
  send(_msg: unknown, _cb?: () => void): boolean {
    return true;
  }
  kill(_signal?: string): boolean {
    this.killed += 1;
    // 与真实语义一致:exit 排在下一个微任务,不在 kill 的同步栈里把条目拆掉
    queueMicrotask(() => this.emit('exit', 0, null));
    return true;
  }
}

interface Harness {
  readonly pool: SubagentWorkerPool;
  readonly procs: FakeProc[];
}

/** 造一个池:每次 fork 追加一个假 proc 到 `procs`,便于数"到底起了几个"。 */
function makeHarness(maxWorkers: number): Harness {
  const procs: FakeProc[] = [];
  const pool = new SubagentWorkerPool(defaultWorkerPoolConfig({ maxWorkers }), {
    forkImpl: () => {
      const proc = new FakeProc(5000 + procs.length);
      procs.push(proc);
      return proc as unknown as ChildProcess;
    },
  });
  return { pool, procs };
}

const REQ: SubagentSpawnRequest = { persona: 'coder', task: '夹具任务' };

/** 让事件循环空转若干轮(证明"没有事件会去重扫"不是"还没轮到")。 */
async function settleSeveralTurns(rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('G-713 抬高并发上界必须同时唤醒队列', () => {
  it('抬高上界(反例・只改字段)⇒ 等待项仍不动 —— 这一条红着才说明唤醒有必要', async () => {
    const { pool, procs } = makeHarness(1);
    const first = pool.spawn(REQ);
    const second = pool.spawn(REQ);
    // 夹具前提:第一个已起、第二个仍在队列
    expect(procs).toHaveLength(1);

    pool.config.maxWorkers = 2;
    await settleSeveralTurns();
    expect(procs).toHaveLength(1);
    expect(pool.activeSubagentIds()).toHaveLength(1);

    await pool.shutdown();
    await expect(first).resolves.toBeDefined();
    await expect(second).resolves.toBeDefined();
  });

  it('抬高上界(正例)⇒ setMaxWorkers 让等待项立即启动,不等任何外部事件', async () => {
    const { pool, procs } = makeHarness(1);
    const first = pool.spawn(REQ);
    const second = pool.spawn(REQ);
    expect(procs).toHaveLength(1);

    expect(pool.setMaxWorkers(2)).toBe(2);
    expect(procs).toHaveLength(2);
    expect(pool.activeSubagentIds()).toHaveLength(2);

    await pool.shutdown();
    await expect(first).resolves.toBeDefined();
    await expect(second).resolves.toBeDefined();
  });

  it('抬高上界(钳制)⇒ 999 折到硬上限;0/负数/NaN 折到下限而**绝非 0**(降到 0 = 整池饿死)', async () => {
    const { pool, procs } = makeHarness(1);
    expect(pool.setMaxWorkers(999)).toBe(MAX_CONCURRENCY);
    expect(pool.config.maxWorkers).toBe(MAX_CONCURRENCY);

    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(pool.setMaxWorkers(bad)).toBe(MIN_CONCURRENCY);
      expect(pool.config.maxWorkers).toBeGreaterThan(0);
    }
    // 全程没派生进程、没抛错:钳制是"折回合法档"不是"关掉池"
    expect(procs).toHaveLength(0);
    await pool.shutdown();
  });

  it('抬高上界(唯一出口)⇒ 返回值必须逐值等于 resolveMaxConcurrency,端内不得再算一遍', async () => {
    const { pool } = makeHarness(1);
    for (const requested of [999, 16, 8, 3, 1, 0, -1, Number.NaN]) {
      expect(pool.setMaxWorkers(requested)).toBe(resolveMaxConcurrency(requested));
    }
    await pool.shutdown();
  });

  it('抬高上界(非抢占)⇒ 调低只拦后续启动,已在跑的 worker 一个都不动', async () => {
    const { pool, procs } = makeHarness(2);
    const a = pool.spawn(REQ);
    const b = pool.spawn(REQ);
    expect(procs).toHaveLength(2);

    expect(pool.setMaxWorkers(1)).toBe(1);
    expect(procs.map((p) => p.killed)).toEqual([0, 0]);
    expect(pool.activeSubagentIds()).toHaveLength(2);

    // 新任务确实被新上界拦住(否则"调低"形同不存在)
    const c = pool.spawn(REQ);
    expect(procs).toHaveLength(2);

    await pool.shutdown();
    await Promise.all([a, b, c]);
  });

  it('抬高上界(关闭之后)⇒ 唤醒不得复活工作', async () => {
    const { pool, procs } = makeHarness(1);
    const first = pool.spawn(REQ);
    await pool.shutdown();
    await expect(first).resolves.toBeDefined();
    const forksAfterShutdown = procs.length;

    expect(pool.setMaxWorkers(MAX_CONCURRENCY)).toBe(MAX_CONCURRENCY);
    await settleSeveralTurns();
    expect(procs).toHaveLength(forksAfterShutdown);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
