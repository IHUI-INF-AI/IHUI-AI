/**
 * 后台任务注册表 — 管理异步 spawn 进程的生命周期与状态。
 *
 * 灵感来源:grok-build 的 background commands + opencode 的 /loop。
 * 简化策略(做减法):
 *   - 模块级 Map 管理任务(不持久化,REPL 退出即丢失)
 *   - 进程退出后保留最近 100 个已完成任务(供 get_command_output 查询)
 *   - 不引入 cron 库,/loop 用 setInterval
 */

import type { ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';

export type BackgroundTaskStatus = 'running' | 'exited' | 'killed' | 'error';

export interface BackgroundTask {
  id: string;
  command: string;
  process: ChildProcess | null;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  status: BackgroundTaskStatus;
  stdoutBuf: string;
  stderrBuf: string;
  truncated: boolean;
  timedOut: boolean;
}

export interface BackgroundTaskMeta {
  id: string;
  command: string;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  status: BackgroundTaskStatus;
}

const MAX_COMPLETED_TASKS = 100;
const MAX_OUTPUT_PER_TASK = 1024 * 1024;

const tasks = new Map<string, BackgroundTask>();

function genId(): string {
  return `bg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

/** 注册一个后台任务,返回 task id。 */
export function registerTask(process: ChildProcess | null, command: string): string {
  const id = genId();
  const task: BackgroundTask = {
    id,
    command,
    process,
    startedAt: new Date().toISOString(),
    status: 'running',
    stdoutBuf: '',
    stderrBuf: '',
    truncated: false,
    timedOut: false,
  };
  tasks.set(id, task);

  if (process) {
    process.stdout?.on('data', (chunk: Buffer) => {
      if (task.stdoutBuf.length < MAX_OUTPUT_PER_TASK) {
        task.stdoutBuf += chunk.toString('utf-8');
        if (task.stdoutBuf.length >= MAX_OUTPUT_PER_TASK) {
          task.truncated = true;
          task.stdoutBuf = task.stdoutBuf.slice(0, MAX_OUTPUT_PER_TASK);
        }
      }
    });
    process.stderr?.on('data', (chunk: Buffer) => {
      if (task.stderrBuf.length < MAX_OUTPUT_PER_TASK) {
        task.stderrBuf += chunk.toString('utf-8');
        if (task.stderrBuf.length >= MAX_OUTPUT_PER_TASK) {
          task.truncated = true;
          task.stderrBuf = task.stderrBuf.slice(0, MAX_OUTPUT_PER_TASK);
        }
      }
    });
    process.on('error', () => {
      task.status = 'error';
      task.exitedAt = new Date().toISOString();
      pruneCompleted();
    });
    process.on('close', (code, signal) => {
      task.exitedAt = new Date().toISOString();
      task.exitCode = code;
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        task.status = 'killed';
        task.timedOut = signal === 'SIGTERM';
      } else {
        task.status = 'exited';
      }
      task.process = null;
      pruneCompleted();
    });
  }

  return id;
}

/** 注册一个占位任务(用于沙盒预检失败的情况)。 */
export function registerFailedTask(command: string, errorMessage: string): string {
  const id = genId();
  const task: BackgroundTask = {
    id,
    command,
    process: null,
    startedAt: new Date().toISOString(),
    exitedAt: new Date().toISOString(),
    exitCode: null,
    status: 'error',
    stdoutBuf: '',
    stderrBuf: errorMessage,
    truncated: false,
    timedOut: false,
  };
  tasks.set(id, task);
  pruneCompleted();
  return id;
}

export function getTask(id: string): BackgroundTask | null {
  return tasks.get(id) ?? null;
}

export function listTasks(): BackgroundTaskMeta[] {
  const list: BackgroundTaskMeta[] = [];
  for (const t of tasks.values()) {
    list.push({
      id: t.id,
      command: t.command,
      startedAt: t.startedAt,
      exitedAt: t.exitedAt,
      exitCode: t.exitCode,
      status: t.status,
    });
  }
  return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export interface TaskOutput {
  id: string;
  status: BackgroundTaskStatus;
  stdout: string;
  stderr: string;
  truncated: boolean;
  exitCode?: number | null;
  startedAt: string;
  exitedAt?: string;
}

/** 获取任务输出,支持 tail 截取最后 N 行(默认全部)。 */
export function getTaskOutput(id: string, tailLines?: number): TaskOutput | null {
  const t = tasks.get(id);
  if (!t) return null;
  let stdout = t.stdoutBuf;
  let stderr = t.stderrBuf;
  if (tailLines !== undefined && tailLines > 0) {
    const stdoutLines = stdout.split('\n');
    const stderrLines = stderr.split('\n');
    stdout = stdoutLines.slice(-tailLines).join('\n');
    stderr = stderrLines.slice(-tailLines).join('\n');
  }
  return {
    id: t.id,
    status: t.status,
    stdout,
    stderr,
    truncated: t.truncated,
    exitCode: t.exitCode,
    startedAt: t.startedAt,
    exitedAt: t.exitedAt,
  };
}

/** 等待任务结束,timeoutMs 毫秒后返回当前状态(不杀进程)。 */
export async function waitForTask(id: string, timeoutMs = 30_000): Promise<BackgroundTask | null> {
  const t = tasks.get(id);
  if (!t) return null;
  if (t.status !== 'running') return t;

  return new Promise<BackgroundTask | null>((resolve) => {
    const start = Date.now();
    const check = () => {
      const cur = tasks.get(id);
      if (!cur) {
        resolve(null);
        return;
      }
      if (cur.status !== 'running') {
        resolve(cur);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(cur);
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

/** 终止任务,signal 默认 SIGTERM,5 秒后未退出强杀 SIGKILL。 */
export async function killTask(id: string): Promise<{ killed: boolean; reason?: string }> {
  const t = tasks.get(id);
  if (!t) return { killed: false, reason: `任务 ${id} 不存在` };
  if (t.status !== 'running') return { killed: false, reason: `任务已结束(状态: ${t.status})` };
  if (!t.process) return { killed: false, reason: '无进程引用' };

  try {
    t.process.kill('SIGTERM');
  } catch {
    return { killed: false, reason: 'kill 信号发送失败' };
  }

  // 等待 5 秒
  const exited = await waitForTask(id, 5000);
  if (exited && exited.status !== 'running') {
    return { killed: true };
  }

  // 强杀
  try {
    t.process.kill('SIGKILL');
  } catch { /* ignore */ }
  await waitForTask(id, 2000);
  return { killed: true };
}

/** 清理已完成任务,保留最近 MAX_COMPLETED_TASKS 个。 */
function pruneCompleted(): void {
  const completed = listTasks().filter((t) => t.status !== 'running');
  if (completed.length <= MAX_COMPLETED_TASKS) return;
  const toRemove = completed.slice(MAX_COMPLETED_TASKS);
  for (const t of toRemove) {
    tasks.delete(t.id);
  }
}

/** 清空所有任务(用于 REPL 退出或测试清理)。 */
export function clearAllTasks(): void {
  for (const t of tasks.values()) {
    if (t.process && t.status === 'running') {
      try { t.process.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
  tasks.clear();
}

// ==================== /loop 周期任务(内存版) ====================

export interface LoopTask {
  id: string;
  command: string;
  intervalMs: number;
  timer: NodeJS.Timeout;
  lastRunAt?: string;
  lastTaskId?: string;
  runCount: number;
}

const loops = new Map<string, LoopTask>();

function parseInterval(input: string): number | null {
  const m = /^(\d+)([smhd])$/.exec(input.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  const unit = m[2]!;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * multipliers[unit]!;
}

export interface StartLoopOptions {
  command: string;
  interval: string;
  spawn: (command: string) => string; // 注入 registerTask 的方式
}

export function startLoop(opts: StartLoopOptions): { id: string; intervalMs: number } | { error: string } {
  const intervalMs = parseInterval(opts.interval);
  if (intervalMs === null) {
    return { error: `非法间隔格式: "${opts.interval}",应为 Ns/Nm/Nh/Nd(如 5m / 1h)` };
  }
  if (intervalMs < 1000) {
    return { error: '间隔不能小于 1 秒' };
  }

  const id = `loop_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  const loopTask: LoopTask = {
    id,
    command: opts.command,
    intervalMs,
    timer: null as unknown as NodeJS.Timeout,
    runCount: 0,
  };

  const run = () => {
    loopTask.lastRunAt = new Date().toISOString();
    loopTask.lastTaskId = opts.spawn(opts.command);
    loopTask.runCount++;
  };

  // 立即执行一次,然后按间隔重复
  run();
  loopTask.timer = setInterval(run, intervalMs);
  loops.set(id, loopTask);

  return { id, intervalMs };
}

export function listLoops(): Array<{ id: string; command: string; intervalMs: number; runCount: number; lastRunAt?: string; lastTaskId?: string }> {
  return Array.from(loops.values()).map((l) => ({
    id: l.id,
    command: l.command,
    intervalMs: l.intervalMs,
    runCount: l.runCount,
    lastRunAt: l.lastRunAt,
    lastTaskId: l.lastTaskId,
  }));
}

export function stopLoop(id: string): boolean {
  const l = loops.get(id);
  if (!l) return false;
  clearInterval(l.timer);
  loops.delete(id);
  return true;
}

export function clearAllLoops(): void {
  for (const l of loops.values()) {
    clearInterval(l.timer);
  }
  loops.clear();
}
