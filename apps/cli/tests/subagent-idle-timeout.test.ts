// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子智能体「无活动超时 ⇒ 自动转后台」回归(2026-09-27 票)。
 *
 * 判据走生产入口:测试调用 `SubagentWorkerPool.spawn()`(真实调度函数),
 * 时钟用 `vi.useFakeTimers()`(本仓既有注入形态,见 permission-lease / cloud-run-degrade),
 * `fork` 被 mock 成 EventEmitter —— 不打真子进程、不真 sleep。
 * 测试内**不内联任何超时判定逻辑**;所有断言打在池的公开出口上
 * (getLifecycleStatus / awaitResult / activeSubagentIds + spawn 响应)。
 *
 * 四条成对对照(票面口径):
 *   ① 一直在活动的长任务 ⇒ 不得被判超时(误杀防线)
 *   ② 无活动超阈 ⇒ 转后台且状态是显式 'detached_idle'
 *   ③ 转后台 ⇒ 没有被当成 completed/failed/cancelled(断言不在终态集合,不是断言文案)
 *   ④ 正常结束 ⇒ 与改动前行为一致(一次性 resolve 'completed',无后台迁移痕迹)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type { SubagentSpawnResponse } from '@ihui/types';

// ───────────────────────── fork mock(避免真子进程) ─────────────────────────

const fakes = vi.hoisted(() => ({ procs: [] as ChildProcess[] }));

vi.mock('node:child_process', async (importOriginal) => {
  // 保留其余真实导出(worker-pool 的模块图里 worktree.ts 还要 execFileSync 等),只换 fork;
  // 不写 `typeof import(...)`(本仓 eslint consistent-type-imports 判红,形态对齐 crash-handler.test.ts)
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fork: (): ChildProcess => {
      const proc = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
      proc.pid = 424_200 + fakes.procs.length;
      proc.send = vi.fn(() => true);
      proc.kill = vi.fn(() => true);
      // fork(stdio 含 pipe/ipc)下父进程拿到的是流对象;测试只需要可 on('data')
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
  resolveSubagentIdleTimeoutMs,
  SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS,
  SUBAGENT_IDLE_TIMEOUT_MAX_MS,
  SUBAGENT_IDLE_TIMEOUT_ENV,
} from '../src/subagents/worker-pool.js';
import { isSubagentTerminalStatus, SUBAGENT_STATUS_DETACHED_IDLE } from '../src/subagents/types.js';

// ───────────────────────── 夹具辅助(只喂事件,不写判据) ─────────────────────────

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

/** progress IPC:WorkerIPCMessage 既有档位之一,同样计活动 */
function emitProgress(proc: ChildProcess): void {
  proc.emit('message', { type: 'progress', payload: { iteration: 1 } });
}

function makePool(): SubagentWorkerPool {
  // taskTimeoutSeconds 放到 1h:确保测试读到的任何状态迁移都只可能来自无活动判据,
  // 而不是既有 taskTimeout/heartbeat watchdog 的边界
  return new SubagentWorkerPool(
    defaultWorkerPoolConfig({ maxWorkers: 1, taskTimeoutSeconds: 3600 }),
  );
}

let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  delete process.env[SUBAGENT_IDLE_TIMEOUT_ENV];
  fakes.procs.length = 0;
  // 池会向 process.stderr 转发/告警(转后台的机器码行等);测试吞掉噪音,行为断言不看 stderr
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderrSpy.mockRestore();
  vi.useRealTimers();
  delete process.env[SUBAGENT_IDLE_TIMEOUT_ENV];
});

describe('① 误杀防线:持续有任务事件的长任务不得被无活动判据挪走', () => {
  it('跑 6 分钟、每 10s 一个 stdout 事件 + 心跳 ⇒ spawn Promise 始终不 resolve,状态始终 running', async () => {
    const pool = makePool();
    const respRef: { value?: SubagentSpawnResponse; count: number } = { count: 0 };
    const spawnP = pool.spawn({ persona: 'coder', task: '长任务' });
    void spawnP.then((r) => {
      respRef.value = r;
      respRef.count++;
    });

    const proc = lastProc();
    // 36 × 10s = 360s,是默认阈值 120s 的 3 倍;心跳照常(进程活着),任务事件照常
    for (let i = 0; i < 36; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sendHeartbeat(proc);
      emitTaskOutput(proc, `tick${i}`);
    }
    await vi.advanceTimersByTimeAsync(60_000);
    sendHeartbeat(proc);

    expect(respRef.value).toBeUndefined(); // 从未提前 resolve
    expect(pool.activeSubagentIds()).toHaveLength(1);
    const id = pool.activeSubagentIds()[0]!;
    expect(pool.getLifecycleStatus(id)).toBe('running');
    expect(proc.kill).not.toHaveBeenCalled();

    // 正常收尾也证明①的对照不是"永远不结束":exit(0) ⇒ completed
    proc.emit('exit', 0, null);
    const resp = await spawnP;
    expect(resp.status).toBe('completed');
    expect(respRef.count).toBe(1); // 只 resolve 一次
    expect(pool.getLifecycleStatus(resp.subagentId)).toBe('completed');
  });

  it('progress IPC 与 stderr 输出同样是活动信号(不得只认 stdout)', async () => {
    const pool = makePool();
    const spawnP = pool.spawn({ persona: 'coder', task: '只用 progress/stderr' });
    let resolved: SubagentSpawnResponse | undefined;
    void spawnP.then((r) => { resolved = r });

    const proc = lastProc();
    for (let i = 0; i < 15; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sendHeartbeat(proc);
      if (i % 2 === 0) emitProgress(proc);
      else proc.stderr?.emit('data', Buffer.from(`诊断行 ${i}\n`));
    }
    // 150s 内每 10s 都有 progress/stderr 事件(> 默认阈值 120s)⇒ 从未转后台
    expect(resolved).toBeUndefined();
    expect(pool.getLifecycleStatus(pool.activeSubagentIds()[0]!)).toBe('running');
    proc.emit('exit', 0, null);
    const resp = await spawnP;
    expect(resp.status).toBe('completed');
  });
});

describe('② 无活动超阈 ⇒ 转后台,状态是显式 detached_idle', () => {
  it('进程活着(心跳不断)但任务事件静默超过阈值 ⇒ spawn resolve 形态 running,生命周期 detached_idle,进程未被杀', async () => {
    const pool = makePool();
    let resolved: SubagentSpawnResponse | undefined;
    const spawnP = pool.spawn({ persona: 'coder', task: '挂住' });
    void spawnP.then((r) => { resolved = r });

    const proc = lastProc();
    // 先正常活动一轮,建立 lastActivityAt 基线
    emitTaskOutput(proc, '开工');
    sendHeartbeat(proc);

    // 之后 150s(> 默认 120s)只剩心跳 —— 没有任何任务事件
    for (let i = 0; i < 15; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sendHeartbeat(proc);
    }

    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe('running');
    expect(resolved!.subagentId).toBeTruthy();
    expect(resolved!.output).toBeUndefined();
    expect(pool.getLifecycleStatus(resolved!.subagentId)).toBe(SUBAGENT_STATUS_DETACHED_IDLE);
    // 转后台 ≠ 杀死:进程没有被 kill,仍被池跟踪
    expect(proc.kill).not.toHaveBeenCalled();
    expect(pool.activeSubagentIds()).toContain(resolved!.subagentId);
    // 且只 resolve 了一次
    proc.stdout?.emit('data', Buffer.from(JSON.stringify({ type: 'complete', stopReason: 'end_turn' }) + '\n'));
    proc.emit('exit', 0, null);
    const finalResp = await pool.awaitResult(resolved!.subagentId);
    expect(finalResp.status).toBe('completed');
    expect(resolved!.status).toBe('running'); // 先前那次 resolve 没被终态改写
  });

  it('阈值默认档落在"明显异常"位置,且被 env 上界封住(不测 sleep,纯函数对账生产出口)', () => {
    expect(resolveSubagentIdleTimeoutMs(undefined)).toBe(SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS);
    expect(SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS).toBeGreaterThanOrEqual(120_000); // 远大于正常一次工具调用
    expect(SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS).toBeLessThan(300_000); // 早于默认 taskTimeout(300s)杀进程
    expect(resolveSubagentIdleTimeoutMs('0')).toBe(0); // 显式回退出口
    expect(resolveSubagentIdleTimeoutMs('999999999')).toBe(SUBAGENT_IDLE_TIMEOUT_MAX_MS); // 封顶
    expect(resolveSubagentIdleTimeoutMs('abc')).toBe(SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS); // 非法值不改默认档
    expect(resolveSubagentIdleTimeoutMs('-5')).toBe(SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS);
    expect(resolveSubagentIdleTimeoutMs('')).toBe(SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS);
  });

  it('env IHUI_SUBAGENT_IDLE_TIMEOUT_MS=0 ⇒ 关闭转后台,回到改动前"前台等到底"的行为', async () => {
    process.env[SUBAGENT_IDLE_TIMEOUT_ENV] = '0';
    const pool = makePool();
    const spawnP = pool.spawn({ persona: 'coder', task: '静默但继续等' });
    let resolved: SubagentSpawnResponse | undefined;
    void spawnP.then((r) => { resolved = r });
    const proc = lastProc();
    emitTaskOutput(proc, '开工');
    for (let i = 0; i < 45; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sendHeartbeat(proc);
    }
    expect(resolved).toBeUndefined(); // 450s 无任何任务事件也不转后台(关闭态)
    expect(pool.activeSubagentIds()).toHaveLength(1);
    proc.emit('exit', 0, null);
    const resp = await spawnP;
    expect(resp.status).toBe('completed');
    expect(pool.getLifecycleStatus(resp.subagentId)).toBe('completed');
  });
});

describe('③ 转后台不被当成任何终态', () => {
  it('detached_idle 不在终态集合;迁移瞬间 spawn 响应也不是 completed/failed', async () => {
    const pool = makePool();
    let resolved: SubagentSpawnResponse | undefined;
    void pool.spawn({ persona: 'reviewer', task: '挂住' }).then((r) => { resolved = r });
    const proc = lastProc();
    for (let i = 0; i < 15; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sendHeartbeat(proc);
    }
    expect(resolved).toBeDefined();
    // 判据是"不在终态集合",不是断言文案
    const wire = resolved!.status;
    expect(wire).not.toBe('completed');
    expect(wire).not.toBe('failed');
    const lifecycle = pool.getLifecycleStatus(resolved!.subagentId);
    expect(lifecycle).toBeDefined();
    expect(isSubagentTerminalStatus(lifecycle!)).toBe(false);
    // 并且转后台后进程真还活着(没被 kill、没进 workers 删除路径)
    expect(proc.kill).not.toHaveBeenCalled();
    expect(pool.activeSubagentIds()).toContain(resolved!.subagentId);
  });
});

describe('④ 正常结束 ⇒ 与改动前行为一致', () => {
  it('秒级完成 ⇒ 一次性 resolve completed,生命周期 completed,从未出现 detached_idle', async () => {
    const pool = makePool();
    const spawnP = pool.spawn({ persona: 'coder', task: '快任务' });
    const proc = lastProc();
    sendHeartbeat(proc);
    emitTaskOutput(proc, 'hello');
    proc.emit('exit', 0, null);
    const resp = await spawnP;
    expect(resp.status).toBe('completed');
    expect(resp.output).toBe('hello');
    expect(pool.getLifecycleStatus(resp.subagentId)).toBe('completed');
    expect(pool.activeSubagentIds()).toHaveLength(0);
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it('失败退出(exit 1)⇒ 与改动前同形:resolve failed + 生命周期 failed', async () => {
    const pool = makePool();
    const spawnP = pool.spawn({ persona: 'coder', task: '坏任务' });
    const proc = lastProc();
    sendHeartbeat(proc);
    proc.emit('exit', 1, null);
    const resp = await spawnP;
    expect(resp.status).toBe('failed');
    expect(pool.getLifecycleStatus(resp.subagentId)).toBe('failed');
    expect(isSubagentTerminalStatus('failed')).toBe(true);
  });

  it('转后台后进程超时退出 ⇒ 终态经 awaitResult 如实收口为 failed(不静默、不冒充完成)', async () => {
    const pool = makePool();
    let resolved: SubagentSpawnResponse | undefined;
    void pool.spawn({ persona: 'coder', task: '挂住后到边界' }).then((r) => { resolved = r });
    const proc = lastProc();
    for (let i = 0; i < 15; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sendHeartbeat(proc);
    }
    expect(resolved!.status).toBe('running');
    const finalP = pool.awaitResult(resolved!.subagentId);
    // taskTimeout 边界到(1h)→ handleTimeout SIGTERM → exit 由测试代播
    proc.kill('SIGTERM');
    proc.emit('exit', 2, null);
    const final = await finalP;
    expect(final.status).toBe('failed');
    expect(final.error).toContain('timeout');
    expect(pool.getLifecycleStatus(resolved!.subagentId)).toBe('failed');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
