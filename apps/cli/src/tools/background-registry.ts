// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务注册表 — 管理异步 spawn 进程的生命周期与状态。
 *
 * 灵感来源:参考行业 Agent 框架的 background commands + opencode 的 /loop。
 * 简化策略(做减法):
 *   - 模块级 Map 管理任务(不持久化,REPL 退出即丢失)
 *   - 进程退出后保留最近 100 个已完成任务(供 get_command_output 查询)
 *   - 不引入 cron 库,/loop 用 setInterval
 */

import type { ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';
// Worktree 并行隔离层:后台任务结束后自动清理其 worktree
import { cleanupWorktree } from './worktree.js';

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
  /** 后台任务关联的 worktree 路径(可选,注册时记录,任务结束自动清理) */
  worktreePath?: string;
  /** worktree 对应的源仓库路径(清理时作为 git 命令工作目录) */
  worktreeSourcePath?: string;
}

export interface BackgroundTaskMeta {
  id: string;
  command: string;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  status: BackgroundTaskStatus;
  /** 后台任务关联的 worktree 路径(可选) */
  worktreePath?: string;
}

const MAX_COMPLETED_TASKS = 100;
const MAX_OUTPUT_PER_TASK = 1024 * 1024;

const tasks = new Map<string, BackgroundTask>();

function genId(): string {
  return `bg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

/** 清理任务关联的 worktree(收尾调用,失败吞掉不阻塞) */
function cleanupTaskWorktree(task: BackgroundTask): void {
  if (!task.worktreePath) return;
  cleanupWorktree(task.worktreePath, task.worktreeSourcePath ?? process.cwd(), true);
  task.worktreePath = undefined;
}

/**
 * 某一时刻的**任务快照** —— 冻结副本,不是注册表里那个还在被 stdout/stderr 回调
 * 与 close 事件就地改写的活对象。
 *
 * 刻意排除两个字段:
 *  - `process`:活的 ChildProcess 句柄,快照一旦带上它,"快照"就退化成"活对象的引用",
 *    调用方顺着就能读到之后才写进来的输出。
 *  - `worktreePath`:任务结束时会先清理 worktree 再置 undefined,同一条快照里
 *    "路径还在"与"已经清完"哪个是真的取决于读的时刻 —— 该字段请走 listTasks/getTask。
 */
export type BackgroundTaskSnapshot = Readonly<
  Pick<
    BackgroundTask,
    'id' | 'command' | 'startedAt' | 'exitedAt' | 'exitCode' | 'status' | 'stdoutBuf' | 'stderrBuf' | 'truncated' | 'timedOut'
  >
>;

function toSnapshot(t: BackgroundTask): BackgroundTaskSnapshot {
  return Object.freeze({
    id: t.id,
    command: t.command,
    startedAt: t.startedAt,
    exitedAt: t.exitedAt,
    exitCode: t.exitCode,
    status: t.status,
    stdoutBuf: t.stdoutBuf,
    stderrBuf: t.stderrBuf,
    truncated: t.truncated,
    timedOut: t.timedOut,
  });
}

/**
 * 终态监听器:task.id → 等待者集合。
 * 回调参数是**该任务那一刻的快照**;null 表示"任务已从注册表消失,无人能给出终态"。
 */
type SettleListener = (snapshot: BackgroundTaskSnapshot | null) => void;
const settleListeners = new Map<string, Set<SettleListener>>();

/**
 * 挂一个终态监听器,返回撤销函数。
 *
 * **必须在读状态之前登记**(调用方 `waitForTask` 里那条判序是载荷性的):
 * 反过来(先读到 running → 再挂监听)会在"读"与"挂"之间漏掉那次终态,
 * 于是这个等待者只能等自己的 deadline 到点,把一个**其实早就结束**的任务报成
 * `timed-out-unknown`。这类漏登记在单线程下也能发生 —— await 就是让出点。
 */
function addSettleListener(id: string, fn: SettleListener): () => void {
  let set = settleListeners.get(id);
  if (!set) {
    set = new Set();
    settleListeners.set(id, set);
  }
  set.add(fn);
  return () => {
    const current = settleListeners.get(id);
    if (!current) return;
    current.delete(fn);
    // 逐层删空集合:留着空 Set 就是让 Map 只增不减
    if (current.size === 0) settleListeners.delete(id);
  };
}

/** 任务进入终态:算一份快照,所有等待者拿同一份(而不是各读一次活对象)。 */
function notifySettled(task: BackgroundTask): void {
  const set = settleListeners.get(task.id);
  if (!set || set.size === 0) return;
  settleListeners.delete(task.id);
  const snapshot = toSnapshot(task);
  for (const fn of set) fn(snapshot);
}

/**
 * 注册一个后台任务,返回 task id。
 *
 * @param opts.worktreePath 可选 — 任务关联的 worktree 路径(Worktree 并行隔离层),
 *                          记录在任务上,任务结束(error/close)时自动清理
 * @param opts.worktreeSourcePath 可选 — worktree 对应的源仓库路径(默认 process.cwd())
 */
export function registerTask(
  process: ChildProcess | null,
  command: string,
  opts?: { worktreePath?: string; worktreeSourcePath?: string },
): string {
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
    worktreePath: opts?.worktreePath,
    worktreeSourcePath: opts?.worktreeSourcePath,
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
      // 任务异常结束,自动清理关联 worktree
      cleanupTaskWorktree(task);
      pruneCompleted();
      // 终态通知放在状态改写之后:等待者读到的快照必须已经是 'error',
      // 否则会出现"任务已通知结束而 status 仍是 running"这种自相矛盾的观测。
      notifySettled(task);
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
      // 任务结束,自动清理关联 worktree
      cleanupTaskWorktree(task);
      pruneCompleted();
      notifySettled(task);
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
      worktreePath: t.worktreePath,
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

/**
 * `waitForTask` 的四种结论,必须**互相可分辨**。
 *
 * 立论(机制来源:ZCode 第十轮 A10A-2):旧实现到点 `resolve(cur)`,把
 * "超时读到的中间状态"当成答案交给调用方 —— 而调用方只能靠
 * `result.status !== 'running'` 这一句去反推"到底是被我等到了,还是我没等到"。
 * 一旦哪天有人加了个 `if (result)` 就把它当成结束了,超时就被静默升格成结论。
 * 所以这次把"等待有没有产生结论"做成返回形状的一部分,让调用方**必须**分支。
 *
 *  - `settled`            在窗口内观察到终态 ⇒ 快照可作结论
 *  - `still-running`      非阻塞探询(timeoutMs<=0)时仍未终态 ⇒ 已知"还在跑",不是结论
 *  - `timed-out-unknown`  窗口用尽仍未终态 ⇒ **未知**;既不得当成功也不得当失败
 *  - `gone`               任务不在注册表里(不存在或已被裁掉)⇒ 无人能为其负责
 */
export type WaitForTaskState = 'settled' | 'still-running' | 'timed-out-unknown' | 'gone';

export interface WaitForTaskResult {
  state: WaitForTaskState;
  /** 与 state 同时刻取得的快照;`gone` 时为 null(没有任何东西可快照)。 */
  snapshot: BackgroundTaskSnapshot | null;
}

/**
 * 等待任务结束。
 *
 * timeoutMs <= 0 ⇒ 只做一次非阻塞观测(未终态即 `still-running`,不会挂到 deadline)。
 *
 * 三条实现判据(逐条都对应一次真实故障形态,改动前请一并看 addSettleListener 的注释):
 *  ① 先登记终态监听器、再读状态 —— 顺序反了会漏掉"读与挂之间"完成的那次终态;
 *  ② 交出的是快照而不是活对象 —— 一个会在背后自己变大的结果比一个保守的结果危险得多;
 *  ③ 到点是 `timed-out-unknown` 而不是"当前状态" —— **超时不等于静默**。
 */
export async function waitForTask(id: string, timeoutMs = 30_000): Promise<WaitForTaskResult> {
  return new Promise<WaitForTaskResult>((resolve) => {
    let settled = false;
    let removeListener: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = (): void => {
      settled = true;
      if (removeListener) {
        const r = removeListener;
        removeListener = null;
        r();
      }
      if (timer) {
        // 撤闹钟:一个还没响的 setTimeout 会把 CLI 的退出拖到上界
        clearTimeout(timer);
        timer = null;
      }
    };
    const finish = (result: WaitForTaskResult): void => {
      if (settled) return;
      cleanup();
      resolve(result);
    };

    // ① 登记在读取之前
    removeListener = addSettleListener(id, (snapshot) => {
      finish({ state: snapshot ? 'settled' : 'gone', snapshot });
    });

    const current = tasks.get(id);
    if (!current) {
      finish({ state: 'gone', snapshot: null });
      return;
    }
    if (current.status !== 'running') {
      finish({ state: 'settled', snapshot: toSnapshot(current) });
      return;
    }
    if (timeoutMs <= 0) {
      // 非阻塞探询:没等过任何东西,所以也谈不上"超时",只是"此刻仍在跑"
      finish({ state: 'still-running', snapshot: toSnapshot(current) });
      return;
    }
    timer = setTimeout(() => {
      const atDeadline = tasks.get(id);
      // ③ 到点:绝不把这一刻的中间状态升格成"已结束",也不压成"失败"
      finish({
        state: atDeadline ? 'timed-out-unknown' : 'gone',
        snapshot: atDeadline ? toSnapshot(atDeadline) : null,
      });
    }, timeoutMs);
    // 等待中的闹钟不该单独把进程钉住(任务本身有自己的句柄)
    timer.unref?.();
  });
}

/** 终止任务,signal 默认 SIGTERM,5 秒后未退出强杀 SIGKILL。 */
export async function killTask(id: string): Promise<{ killed: boolean; reason?: string; exitConfirmed: boolean }> {
  const t = tasks.get(id);
  if (!t) return { killed: false, exitConfirmed: false, reason: `任务 ${id} 不存在` };
  if (t.status !== 'running') return { killed: false, exitConfirmed: true, reason: `任务已结束(状态: ${t.status})` };
  if (!t.process) return { killed: false, exitConfirmed: false, reason: '无进程引用' };

  try {
    t.process.kill('SIGTERM');
  } catch {
    return { killed: false, exitConfirmed: false, reason: 'kill 信号发送失败' };
  }

  // 等待 5 秒
  const first = await waitForTask(id, 5000);
  if (first.state === 'settled') {
    return { killed: true, exitConfirmed: true };
  }
  // timed-out-unknown / gone / still-running:SIGTERM 没能收敛,继续走强杀。
  // 这一支就是"超时不等于已结束"必须显式处理的地方 —— 旧写法靠
  // `exited.status !== 'running'` 反推,读起来像在看结论,其实是在猜。

  // 进程组团灭(2026-09-10 CI 根修):runSandboxedAsync 以 detached+shell 派生,
  // SIGTERM 只杀 shell,孙进程(如 sleep)继承 stdio 管道,shell 死后 close 事件
  // 仍不触发 → 任务状态永久卡在 running(ubuntu CI 实测 SIGKILL 亦无效)。
  // detached 进程组 → kill(-pid) 团灭整组,管道随即关闭。
  if (t.process.pid && process.platform !== 'win32') {
    try {
      process.kill(-t.process.pid, 'SIGKILL');
    } catch {
      /* 进程组可能已退出 */
    }
  }
  // 强杀
  try {
    t.process.kill('SIGKILL');
  } catch { /* ignore */ }
  const second = await waitForTask(id, 2000);
  if (second.state === 'settled') {
    return { killed: true, exitConfirmed: true };
  }
  // 信号已经发出去了(这是事实),但**没有等到终态确认** —— 两件事必须分开说。
  // 刻意不把 unknown 洗成"终止成功",也不改口成"失败":
  // 前者会让人以为进程没了(实际可能还挂着管道),后者会诱使调用方再 kill 一次。
  return {
    killed: true,
    exitConfirmed: false,
    reason:
      second.state === 'gone'
        ? 'SIGKILL 已发送,但任务记录在确认前被清理,终态未确认'
        : 'SIGKILL 已发送,但等待窗口内未观察到终态(未确认退出,不等于已退出)',
  };
}

/** 清理已完成任务,保留最近 MAX_COMPLETED_TASKS 个。 */
function pruneCompleted(): void {
  const completed = listTasks().filter((t) => t.status !== 'running');
  if (completed.length <= MAX_COMPLETED_TASKS) return;
  const toRemove = completed.slice(MAX_COMPLETED_TASKS);
  for (const t of toRemove) {
    // 被裁掉的都是非 running 的任务 ⇒ 终态通知早已在 close/error 里发过。
    // 这里仍要摘监听器集合,否则一个"任务已被删除"的键会把监听器永久留在 Map 里。
    settleListeners.delete(t.id);
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
  // 整表清空前逐个结掉等待者:留一个没人回答的等待 = Promise 泄漏
  // (与本文件 killTask 处 P0-4 修复记的是同一型故障)。
  for (const id of settleListeners.keys()) {
    const set = settleListeners.get(id);
    if (!set) continue;
    settleListeners.delete(id);
    for (const fn of set) fn(null);
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
