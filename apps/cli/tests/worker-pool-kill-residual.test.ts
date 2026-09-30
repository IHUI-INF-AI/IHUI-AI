// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998112(T3)—— kill 必须留下"进程到底退没退"的证据。
 *
 * 立因(上游 zcodeStdioTransport.ts:171-206):kill 失败被 `catch { /\* ignore *\/ }` 吞掉,
 * 账面记 dead/failed 却没有任何记录能回答 pid 是否真的没了。本套件钉两条成对判据:
 *  ① 注入 kill 抛错的假 proc(EPERM/ESRCH 形态)⇒ 残留记录非空(residualPid 可查)、
 *     spawn 响应 status=failed 且 error 带 `residualPid=` 结构化原因;
 *  ② 正常 kill(exit 事件如约到达)⇒ 残留记录为空,终态按 exit 事件正常结算。
 * 另钉超预算形态(kill 成功但 exit 永不到)与心跳 watchdog 残留路径。
 *
 * 全程注入 forkImpl 假 proc,不派生任何真实子进程。
 */
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  SubagentWorkerPool,
  defaultWorkerPoolConfig,
  type WorkerPoolDeps,
} from '../src/subagents/worker-pool.js';
import type { ChildProcess } from 'node:child_process';
import type { SubagentSpawnRequest } from '@ihui/types';

/** 假子进程:EventEmitter + pid + kill 注入点;send 收下 start 消息即返回。 */
class FakeProc extends EventEmitter {
  pid = 4242;
  exitCode: number | null = null;
  signalCode: number | null = null;
  killed = 0;
  constructor(private readonly killImpl: (signal?: string) => void) {
    super();
  }
  send(_msg: unknown, _cb?: () => void): boolean {
    return true;
  }
  kill(signal?: string): boolean {
    this.killed += 1;
    this.killImpl(signal ?? 'SIGTERM');
    return true;
  }
}

const REQ: SubagentSpawnRequest = { persona: 'coder', task: '夹具任务', workspacePath: '.' } as unknown as SubagentSpawnRequest;

function makePool(forkImpl: WorkerPoolDeps['forkImpl'], killExitBudgetMs?: number) {
  return new SubagentWorkerPool(
    defaultWorkerPoolConfig({ maxWorkers: 2, taskTimeoutSeconds: 60, heartbeatTimeoutSeconds: 60 }),
    { forkImpl, ...(killExitBudgetMs !== undefined ? { killExitBudgetMs } : {}) },
  );
}

/** 等到池把 worker 真正启动(fork 已发生、条目已入表)。 */
async function waitForStart(pool: SubagentWorkerPool): Promise<string> {
  for (let i = 0; i < 100; i += 1) {
    const ids = pool.activeSubagentIds();
    if (ids.length > 0) return ids[0];
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('夹具:worker 未启动');
}

describe('G-998112 kill 证据化(killImpl 抛错 ⇒ residualPid + failed)', () => {
  it('(a) kill 抛错(EPERM 形态)⇒ residualPid 非空、响应 failed 且 error 带 residualPid= 结构化原因', async () => {
    const proc = new FakeProc(() => {
      throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
    });
    const pool = makePool(() => proc as unknown as ChildProcess);
    const pending = pool.spawn(REQ);
    const id = await waitForStart(pool);
    await pool.shutdown();
    const resp = await pending;
    expect(resp.status).toBe('failed');
    expect(resp.error).toContain('residualPid=4242');
    expect(resp.error).toContain('EPERM');
    expect(pool.getResidualPid(id)).toBe(4242);
    expect(pool.getResidualKills()).toHaveLength(1);
    expect(pool.getResidualKills()[0].detail).toContain('EPERM');
  });

  it('(b) 正常 kill(exit 如约到达)⇒ 残留记录为空,终态按 exit 事件结算', async () => {
    // 子进程收到 SIGTERM 后优雅退出(自身以 code 0 结束,非被信号打死)
    const proc = new FakeProc(() => {
      proc.exitCode = 0;
      queueMicrotask(() => proc.emit('exit', 0, null));
    });
    const pool = makePool(() => proc as unknown as ChildProcess);
    const pending = pool.spawn(REQ);
    await waitForStart(pool);
    await pool.shutdown();
    const resp = await pending;
    expect(resp.status).toBe('completed');
    expect(pool.getResidualKills()).toEqual([]);
    expect(pool.getResidualPid(resp.subagentId)).toBeUndefined();
  });

  it('(c) kill 成功但 exit 永不到(超预算)⇒ 残留记录带超预算细节,响应 failed', async () => {
    // kill 成功但从不触发 exit;预算缩到 30ms 便于测试
    const proc = new FakeProc(() => {});
    const pool = makePool(() => proc as unknown as ChildProcess, 30);
    const pending = pool.spawn(REQ);
    const id = await waitForStart(pool);
    await pool.shutdown();
    const resp = await pending;
    expect(resp.status).toBe('failed');
    expect(resp.error).toContain('residualPid=4242');
    expect(resp.error).toContain('exit 事件超过 30ms 未到');
    expect(pool.getResidualPid(id)).toBe(4242);
    const rec = pool.getResidualKills()[0];
    expect(rec.signal).toBe('SIGKILL'); // SIGTERM 超预算后升级 SIGKILL 再超 ⇒ 留下最后一轮证据
    expect(rec.reason).toBe('pool-shutdown-escalation');
  });
});

describe('G-998112 心跳 watchdog 路径', () => {
  it('(d) 心跳超时 kill 抛错 ⇒ 状态 dead + 残留记录(不得只写一句 warn)', async () => {
    vi.useFakeTimers();
    try {
      const proc = new FakeProc(() => {
        throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
      });
      const pool = new SubagentWorkerPool(
        defaultWorkerPoolConfig({ maxWorkers: 2, heartbeatTimeoutSeconds: 0 }),
        { forkImpl: () => proc as unknown as ChildProcess },
      );
      const pending = pool.spawn(REQ);
      // 心跳轮询每 5s 一跳;推进到第一跳触发 watchdog
      await vi.advanceTimersByTimeAsync(5_100);
      const id = pool.activeSubagentIds()[0];
      expect(pool.getResidualPid(id)).toBe(4242);
      expect(pool.getResidualKills()[0].reason).toBe('heartbeat-watchdog');
      // 残留路径必须把 spawn 响应收口成 failed + 结构化原因(经 resolver 或 awaitResult 可取)
      const resp = await pending;
      expect(resp.status).toBe('failed');
      expect(resp.error).toContain('residualPid=4242');
      expect(resp.error).toContain('ESRCH');
      // 第二跳不得重复派发/重复记录(残留确认只做一轮)
      await vi.advanceTimersByTimeAsync(5_100);
      expect(pool.getResidualKills()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
