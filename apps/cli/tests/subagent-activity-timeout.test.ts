// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-426「无活动空闲超时」回归:子代理超时从"墙钟"改为"每次活动重排定时器"。
 *
 * 票面拍板:采纳上游 subagent/runner 的 reportActivity 语义 —— 仍在推进的慢子代理不再被杀,
 * 真正卡死的才会超时;错误 context 带 idleMs 与 recoverable/retryable 标记;绝对上限
 * (预算 × 3)兜底防无限续命。两个面各验三例(外加绝对上限一例):
 *
 *   A. in-process 执行器边界 `executeWithinExecBudget`(apps/cli/src/tools/index.ts):
 *      A1 持续活动 ⇒ 超过名义预算仍不被杀(模拟活动流);
 *      A2 真空闲 ⇒ 到点代结算 errorType='timeout';
 *      A3 错误 context 带 idleMs/totalMs/absoluteCapMs/recoverable/retryable;
 *      A4 持续活动跑到 budget×3 ⇒ 绝对上限兜底照样结算。
 *
 *   B. fork 池 `SubagentWorkerPool`(apps/cli/src/subagents/worker-pool.ts):
 *      B1 持续 stdout 活动 ⇒ 过了 timeoutSeconds 也不 SIGTERM(旧墙钟行为会杀);
 *      B2 真空闲 ⇒ 空闲窗耗尽 SIGTERM,错误带 idleMs 与 recoverable/retryable;
 *      B3 绝对上限到点且仍在推进 ⇒ 不杀,自动转后台(detached_idle),终态经 awaitResult 回收。
 *
 * 时钟一律 vi.useFakeTimers,fork mock 成 EventEmitter(形态对齐 subagent-idle-timeout.test.ts),
 * 断言全部打在生产出口(spawn 响应 / executeWithinExecBudget 返回值)上,测试内不内联超时判定。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type { SubagentSpawnResponse } from '@ihui/types';

import { executeWithinExecBudget, type ToolContext, type ToolResult } from '../src/tools/index.js';
import { SUBAGENT_STATUS_DETACHED_IDLE, isSubagentTerminalStatus } from '../src/subagents/types.js';

// ───────────────────────── A 面:in-process 执行器边界 ─────────────────────────

/** 测试档预算(真实档最小 1ms 起可声明;200ms 足以让虚拟时钟跑出对照) */
const BUDGET = 200;
const ctx: ToolContext = { workspacePath: '.' };
function budgetTool(): { name: string; execBudget: { ms: number } } {
  return { name: 'g426-fake-subagent', execBudget: { ms: BUDGET } };
}

describe('A: executeWithinExecBudget 无活动空闲超时(G-426)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('A1 持续活动 ⇒ 超过名义预算仍在推进不被杀,最终成功结算(模拟活动流)', async () => {
    const run = async (
      _signal: AbortSignal | undefined,
      reportActivity?: () => void,
    ): Promise<ToolResult> => {
      expect(reportActivity).toBeTypeOf('function'); // 有预算窗 ⇒ 上报口必被注入
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 50)); // 虚拟时钟,由测试推进
        reportActivity?.(); // 每步真实推进都把空闲窗重排回完整预算
      }
      return { success: true, output: 'done' };
    };
    const p = executeWithinExecBudget(budgetTool(), ctx, run);
    await vi.advanceTimersByTimeAsync(1_000); // 10 × 50ms 全部走完
    const res = await p;
    // 总时长 500ms = 2.5 × 名义预算:旧墙钟在 200ms 就杀,现在活到了终点
    expect(res.success).toBe(true);
    expect(res.output).toBe('done');
  });

  it('A2 真空闲 ⇒ 名义预算到点代结算 errorType=timeout', async () => {
    const run = (): Promise<ToolResult> => new Promise<ToolResult>(() => {}); // 永不 settle 的挂死 handler
    const p = executeWithinExecBudget(budgetTool(), ctx, run);
    await vi.advanceTimersByTimeAsync(BUDGET + 5_000 + 1); // 预算到点 + 结算宽限
    const res = await p;
    expect(res.success).toBe(false);
    expect(res.errorType).toBe('timeout');
    expect(res.abortedByExecBudget).toBe('budget');
  });

  it('A3 错误 context 带 idleMs/totalMs/absoluteCapMs 与 recoverable/retryable 标记', async () => {
    const run = (): Promise<ToolResult> => new Promise<ToolResult>(() => {});
    const p = executeWithinExecBudget(budgetTool(), ctx, run);
    await vi.advanceTimersByTimeAsync(BUDGET + 5_000 + 1);
    const res = await p;
    // 从未上报活动 ⇒ idleMs 退化为全程时长(与旧墙钟同语义,不是"报了 0")
    expect(res.timeoutContext).toEqual({
      idleMs: BUDGET,
      totalMs: BUDGET,
      absoluteCapMs: BUDGET * 3,
      recoverable: true,
      retryable: false,
    });
    expect(res.error).toContain('No activity for the last');
  });

  it('A4 绝对上限:持续活动也只能活 budget×3(防无限续命的兜底)', async () => {
    const run = async (
      signal: AbortSignal | undefined,
      reportActivity?: () => void,
    ): Promise<ToolResult> => {
      for (let i = 0; i < 200; i++) {
        if (signal?.aborted) return new Promise<ToolResult>(() => {}); // 不合作 handler:挂住不结算
        await new Promise((r) => setTimeout(r, 50));
        reportActivity?.();
      }
      return { success: true, output: 'never' };
    };
    const p = executeWithinExecBudget(budgetTool(), ctx, run);
    await vi.advanceTimersByTimeAsync(BUDGET * 3 + 5_000 + 1);
    const res = await p;
    expect(res.success).toBe(false);
    expect(res.errorType).toBe('timeout');
    // 触发瞬间恰为绝对上限,而距最后一次活动只有一步(50ms 节奏内)⇒ 杀的是"总时长",不是空闲
    expect(res.timeoutContext?.totalMs).toBe(BUDGET * 3);
    expect(res.timeoutContext?.idleMs).toBeLessThan(100);
  });
});

// ───────────────────────── B 面:fork 池(worker-pool) ─────────────────────────

const fakes = vi.hoisted(() => ({ procs: [] as ChildProcess[] }));

vi.mock('node:child_process', async (importOriginal) => {
  // 保留其余真实导出(worker-pool 的模块图里 worktree.ts 还要 execFileSync 等),只换 fork
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fork: (): ChildProcess => {
      const proc = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
      proc.pid = 424_300 + fakes.procs.length;
      proc.send = vi.fn(() => true);
      proc.kill = vi.fn(() => true);
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      const full = proc as unknown as ChildProcess;
      fakes.procs.push(full);
      return full;
    },
  };
});

import {
  SubagentWorkerPool,
  defaultWorkerPoolConfig,
  SUBAGENT_IDLE_TIMEOUT_ENV,
} from '../src/subagents/worker-pool.js';

function lastProc(): ChildProcess {
  const p = fakes.procs[fakes.procs.length - 1];
  if (!p) throw new Error('fork mock 未收到 fork 调用');
  return p;
}

/** 存活信号:worker-entry 每 5s 无条件发 —— 它**不是**任务活动(见 worker-pool 头注) */
function sendHeartbeat(proc: ChildProcess): void {
  proc.emit('message', { type: 'heartbeat', rss: 50_000_000 });
}

/** 真实任务事件:stdout NDJSON(与 worker-entry 的 message_delta 形态逐字同形) */
function emitTaskOutput(proc: ChildProcess, text: string): void {
  proc.stdout?.emit('data', Buffer.from(JSON.stringify({ type: 'message_delta', message: text }) + '\n'));
}

describe('B: SubagentWorkerPool taskTimeout 无活动空闲窗(G-426)', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    delete process.env[SUBAGENT_IDLE_TIMEOUT_ENV];
    fakes.procs.length = 0;
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    stderrSpy.mockRestore();
    vi.useRealTimers();
    delete process.env[SUBAGENT_IDLE_TIMEOUT_ENV];
  });

  it('B1 持续 stdout 活动 ⇒ 过了 timeoutSeconds(60s)也不 SIGTERM,正常收尾 completed', async () => {
    const pool = new SubagentWorkerPool(defaultWorkerPoolConfig({ maxWorkers: 1, taskTimeoutSeconds: 60 }));
    const spawnP = pool.spawn({ persona: 'coder', task: '长任务' });
    const proc = lastProc();
    // 15 × 10s = 150s ≫ 60s 旧墙钟(< 180s 绝对上限);旧行为在第 60s 就 SIGTERM
    for (let i = 0; i < 15; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sendHeartbeat(proc);
      emitTaskOutput(proc, `tick${i}`);
    }
    expect(proc.kill).not.toHaveBeenCalled();
    proc.emit('exit', 0, null);
    const resp = await spawnP;
    expect(resp.status).toBe('completed');
  });

  it('B2 真空闲 ⇒ 空闲窗(60s)耗尽才 SIGTERM,错误带 idleMs 与 recoverable/retryable', async () => {
    const pool = new SubagentWorkerPool(defaultWorkerPoolConfig({ maxWorkers: 1, taskTimeoutSeconds: 60 }));
    const spawnP = pool.spawn({ persona: 'coder', task: '挂死' });
    const proc = lastProc();
    emitTaskOutput(proc, '开工'); // 建立活动基线,此后只剩心跳(不算活动)
    sendHeartbeat(proc);
    for (let i = 0; i < 7; i++) {
      await vi.advanceTimersByTimeAsync(10_000); // 70s > 60s 空闲窗
      sendHeartbeat(proc);
    }
    const resp = await spawnP;
    expect(resp.status).toBe('failed');
    expect(resp.error).toContain('timeout');
    expect(resp.error).toContain('idleMs=');
    expect(resp.error).toContain('recoverable=true');
    expect(resp.error).toContain('retryable=false');
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('B3 绝对上限到点且仍在推进 ⇒ 不 SIGTERM,自动转后台(detached_idle),真终态经 awaitResult 回收', async () => {
    const pool = new SubagentWorkerPool(defaultWorkerPoolConfig({ maxWorkers: 1, taskTimeoutSeconds: 60 }));
    let resolved: SubagentSpawnResponse | undefined;
    void pool.spawn({ persona: 'coder', task: '永动机' }).then((r) => {
      resolved = r;
    });
    const proc = lastProc();
    // 19 × 10s = 190s > 60s × 3 = 180s 绝对上限,每 10s 都有真实任务事件:
    // G-426 拍板第三件套 —— 能活到总上限的执行一路有真实活动,该收口的是"前台等待"不是
    // 任务:spawn Promise 以 wire 既有档 'running' 提前 resolve,进程不被 SIGTERM。
    for (let i = 0; i < 19; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sendHeartbeat(proc);
      emitTaskOutput(proc, `tick${i}`);
    }
    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe('running');
    expect(proc.kill).not.toHaveBeenCalled();
    // 转后台 = 显式中间态 detached_idle,不是任何终态;条目仍在池内被跟踪
    expect(pool.getLifecycleStatus(resolved!.subagentId)).toBe(SUBAGENT_STATUS_DETACHED_IDLE);
    expect(isSubagentTerminalStatus(SUBAGENT_STATUS_DETACHED_IDLE)).toBe(false);
    expect(pool.activeSubagentIds()).toContain(resolved!.subagentId);
    // 自然退出 ⇒ 真终态不丢:awaitResult 取回 completed(转后台 ≠ 失败,不设 timedOut)
    proc.emit('exit', 0, null);
    const final = await pool.awaitResult(resolved!.subagentId);
    expect(final.status).toBe('completed');
    expect(pool.getLifecycleStatus(resolved!.subagentId)).toBe('completed');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
