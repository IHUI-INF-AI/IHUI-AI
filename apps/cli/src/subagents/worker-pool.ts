/**
 * SubagentWorkerPool — 子进程并行 worker 池,用 child_process.fork() 真正并行跑子 agent。
 *
 * 与 subagent-collab.ts 的 CollaborationManager 区别:
 *   - CollaborationManager 是单进程 async executor(非真并行,共享事件循环)
 *   - SubagentWorkerPool 用 fork() 起独立子进程,OS 级真并行(独立 V8 isolate + 事件循环)
 *
 * 设计:
 *   - 每个子 agent 一个 fork() 子进程,入口 worker-entry.ts
 *   - 主进程通过 IPC channel 收子进程 heartbeat,15s 无心跳标记 dead
 *   - 超时:timeoutSeconds 到期 SIGTERM 子进程,标记 failed
 *   - maxWorkers 限制并发(排队),非抢占式
 *   - isolation='worktree' 时调用现有 createWorktree,子进程在隔离工作区跑
 *   - 优雅关闭:SIGTERM → 5s → SIGKILL
 *
 * 仅依赖 Node.js 内置 + 现有 worktree 模块,不引入新依赖。
 */

import { fork, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorktree, removeWorktree, type WorktreeInfo } from './worktree.js';
import type {
  SubagentSpawnRequest,
  SubagentSpawnResponse,
  WorkerPoolConfig,
  WorkerState,
} from '@ihui/types';

// ───────────────────────────── 常量 ─────────────────────────────

const HEARTBEAT_INTERVAL_MS = 5_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;
const SHUTDOWN_GRACE_MS = 5_000;
const DEFAULT_MAX_WORKERS = 4;
const DEFAULT_TASK_TIMEOUT_SECONDS = 300;
const DEFAULT_MAX_QUEUE_SIZE = 100;
// P0-3 修复:buffer 上限,防长跑多 subagent OOM 主进程
const MAX_STDOUT_BUF_BYTES = 1_048_576; // 1MB
const MAX_STDERR_BUF_BYTES = 1_048_576; // 1MB
const STDERR_RATE_LIMIT_LINES_PER_SEC = 100;

// ───────────────────────────── 类型 ─────────────────────────────

/** 子进程 → 父进程 IPC 消息 */
type WorkerIPCMessage =
  | { type: 'heartbeat' }
  | { type: 'progress'; payload?: Record<string, unknown> };

/** 父进程 → 子进程 IPC 消息 */
interface StartIPCMessage {
  type: 'start';
  subagentId: string;
  persona: SubagentSpawnRequest['persona'];
  task: string;
  workspacePath: string;
  model?: string;
  capability?: SubagentSpawnRequest['capability'];
  maxIterations?: number;
}

/** 内部 worker 跟踪条目 */
interface WorkerEntry {
  subagentId: string;
  proc: ChildProcess;
  startedAt: number;
  lastHeartbeatAt: number;
  state: WorkerState;
  worktree?: WorktreeInfo;
  resolver?: (resp: SubagentSpawnResponse) => void;
  timeoutTimer?: NodeJS.Timeout;
  heartbeatTimer?: NodeJS.Timeout;
  stdoutBuf: string;
  stderrBuf: string;
  timedOut: boolean;
  // P0-3 修复:buffer 截断标记 + stderr rate limit 计数
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  stderrLastFlushAt: number;
  stderrLinesSinceFlush: number;
}

// ───────────────────────────── SubagentWorkerPool ─────────────────────────────

/**
 * 子进程并行 worker 池。
 *
 * 用法:
 *   const pool = new SubagentWorkerPool(defaultWorkerPoolConfig());
 *   const results = await pool.spawnParallel([
 *     { persona: 'coder', task: '重构 auth 模块' },
 *     { persona: 'reviewer', task: '审查 PR #123' },
 *   ]);
 *   await pool.shutdown();
 */
export class SubagentWorkerPool {
  readonly config: WorkerPoolConfig;
  private readonly workers: Map<string, WorkerEntry> = new Map();
  private readonly queue: Array<{ req: SubagentSpawnRequest; resolve: (r: SubagentSpawnResponse) => void }> = [];
  private activeCount = 0;
  private nextWorkerSeq = 0;
  private readonly entryPath: string;
  private shutDown = false;

  constructor(config: WorkerPoolConfig) {
    this.config = config;
    this.entryPath = resolveWorkerEntryPath();
  }

  /** fork 一个子进程跑子 agent,返回 spawn 响应(子进程完成后 resolve) */
  async spawn(req: SubagentSpawnRequest): Promise<SubagentSpawnResponse> {
    if (this.shutDown) {
      return {
        subagentId: `rejected_${Date.now().toString(36)}`,
        pid: 0,
        status: 'failed',
        error: 'worker pool已 shutdown',
      };
    }
    if (this.queue.length >= this.config.maxQueueSize) {
      return {
        subagentId: `rejected_${Date.now().toString(36)}`,
        pid: 0,
        status: 'failed',
        error: `任务队列已满(maxQueueSize=${this.config.maxQueueSize})`,
      };
    }
    return new Promise<SubagentSpawnResponse>((resolve) => {
      this.queue.push({ req, resolve });
      void this.drainQueue();
    });
  }

  /** 并行 spawn 多个子进程(限 maxWorkers 并发,超出排队) */
  async spawnParallel(reqs: SubagentSpawnRequest[]): Promise<SubagentSpawnResponse[]> {
    return Promise.all(reqs.map((r) => this.spawn(r)));
  }

  /** 查询子进程状态 */
  async getStatus(subagentId: string): Promise<SubagentSpawnResponse> {
    const w = this.workers.get(subagentId);
    if (!w) {
      return {
        subagentId,
        pid: 0,
        status: 'failed',
        error: `subagent ${subagentId} not found`,
      };
    }
    const status: SubagentSpawnResponse['status'] =
      w.state.status === 'busy' ? 'running' : w.state.status === 'idle' ? 'completed' : 'failed';
    return {
      subagentId: w.subagentId,
      pid: w.proc.pid ?? 0,
      status,
      durationMs: Date.now() - w.startedAt,
    };
  }

  /** 等待所有活跃子进程完成(不等待排队中的,因为排队会随活跃完成而启动) */
  async waitAll(): Promise<SubagentSpawnResponse[]> {
    while (this.activeCount > 0 || this.queue.length > 0) {
      await new Promise<void>((r) => setTimeout(r, 100));
    }
    return [...this.workers.values()].map((w) => this.entryToResponse(w, 'completed'));
  }

  /** 优雅关闭:SIGTERM 所有子进程 → 5s → SIGKILL,清理 worktree */
  async shutdown(): Promise<void> {
    this.shutDown = true;
    // P0-4 修复:shutdown 时先遍历 queue 调 resolve(failed) 再清空
    // 原实现直接 this.queue.length = 0 → 调用方 await pool.spawn(req) 永远 hang → Promise 泄漏
    // 在 spawnParallel 场景下 Promise.all 永不 resolve,调用方整个 await hang 住
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      item.resolve({
        subagentId: `rejected_shutdown_${item.req.persona ?? 'unknown'}`,
        pid: 0,
        status: 'failed',
        error: 'worker pool 已 shutdown,任务未启动',
      });
    }

    const entries = [...this.workers.values()];
    for (const w of entries) {
      if (w.timeoutTimer) clearTimeout(w.timeoutTimer);
      if (w.heartbeatTimer) clearInterval(w.heartbeatTimer);
      try { w.proc.kill('SIGTERM'); } catch { /* ignore */ }
    }

    if (entries.length > 0) {
      await new Promise<void>((resolve) => {
        const killTimer = setTimeout(() => {
          for (const w of entries) {
            try { w.proc.kill('SIGKILL'); } catch { /* ignore */ }
          }
          resolve();
        }, SHUTDOWN_GRACE_MS);
        Promise.all(
          entries.map((w) =>
            new Promise<void>((r) => w.proc.once('exit', () => r())),
          ),
        ).then(() => {
          clearTimeout(killTimer);
          resolve();
        });
      });
    }

    // 清理 worktree
    for (const w of entries) {
      if (w.worktree) {
        try {
          removeWorktree(w.worktree.path, { sourcePath: w.worktree.parentId, force: true });
        } catch { /* ignore */ }
      }
    }
    this.workers.clear();
    this.activeCount = 0;
  }

  // ───────────────────────── 内部实现 ─────────────────────────

  private async drainQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeCount < this.config.maxWorkers && !this.shutDown) {
      const item = this.queue.shift()!;
      this.activeCount++;
      this.startWorker(item.req, item.resolve);
    }
  }

  private startWorker(req: SubagentSpawnRequest, resolve: (r: SubagentSpawnResponse) => void): void {
    const subagentId = generateSubagentId();
    const timeoutSec = req.timeoutSeconds ?? this.config.taskTimeoutSeconds;
    const baseWorkspace = req.workspacePath ?? process.cwd();
    let workspacePath = baseWorkspace;
    let worktree: WorktreeInfo | undefined;

    // isolation='worktree' 时创建隔离工作区
    if (req.isolation === 'worktree') {
      try {
        worktree = createWorktree('pool', subagentId, baseWorkspace);
        workspacePath = worktree.path;
      } catch (e) {
        resolve({
          subagentId,
          pid: 0,
          status: 'failed',
          error: `worktree creation failed: ${e instanceof Error ? e.message : String(e)}`,
        });
        this.activeCount--;
        void this.drainQueue();
        return;
      }
    }

    const workerId = `w${this.nextWorkerSeq++}`;
    const startedAt = Date.now();

    const proc = fork(this.entryPath, [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, IHUI_SUBAGENT_ID: subagentId },
      execArgv: process.execArgv, // 继承 tsx loader flags(dev 模式)
    });

    const entry: WorkerEntry = {
      subagentId,
      proc,
      startedAt,
      lastHeartbeatAt: startedAt,
      state: {
        workerId,
        type: 'cli-subprocess',
        status: 'busy',
        currentTaskId: subagentId,
        completedCount: 0,
        failedCount: 0,
        startedAt: new Date(startedAt).toISOString(),
        lastHeartbeatAt: new Date(startedAt).toISOString(),
      },
      worktree,
      resolver: resolve,
      stdoutBuf: '',
      stderrBuf: '',
      timedOut: false,
      stdoutTruncated: false,
      stderrTruncated: false,
      stderrLastFlushAt: startedAt,
      stderrLinesSinceFlush: 0,
    };
    this.workers.set(subagentId, entry);

    // IPC 消息:heartbeat / progress
    proc.on('message', (msg: WorkerIPCMessage) => {
      if (msg.type === 'heartbeat') {
        entry.lastHeartbeatAt = Date.now();
        entry.state.lastHeartbeatAt = new Date().toISOString();
      }
    });

    // stdout 收集(NDJSON 事件流)
    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      // P0-3 修复:buffer 加 1MB 上限,超出截断保留尾部(防长跑多 subagent OOM 主进程)
      if (entry.stdoutBuf.length + text.length > MAX_STDOUT_BUF_BYTES) {
        const keepLen = MAX_STDOUT_BUF_BYTES - text.length;
        entry.stdoutBuf = (keepLen > 0 ? entry.stdoutBuf.slice(-keepLen) : '') + text.slice(-MAX_STDOUT_BUF_BYTES);
        entry.stdoutTruncated = true;
      } else {
        entry.stdoutBuf += text;
      }
    });

    // stderr 收集(日志,转发到主进程 stderr)
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      // P0-3 修复:buffer 加 1MB 上限
      if (entry.stderrBuf.length + text.length > MAX_STDERR_BUF_BYTES) {
        const keepLen = MAX_STDERR_BUF_BYTES - text.length;
        entry.stderrBuf = (keepLen > 0 ? entry.stderrBuf.slice(-keepLen) : '') + text.slice(-MAX_STDERR_BUF_BYTES);
        entry.stderrTruncated = true;
      } else {
        entry.stderrBuf += text;
      }
      // P0-3 修复:stderr 转发加 rate limit(每秒最多 100 行,防子进程大量日志淹没主进程)
      const now = Date.now();
      if (now - entry.stderrLastFlushAt > 1000) {
        entry.stderrLastFlushAt = now;
        entry.stderrLinesSinceFlush = 0;
      }
      entry.stderrLinesSinceFlush++;
      if (entry.stderrLinesSinceFlush <= STDERR_RATE_LIMIT_LINES_PER_SEC) {
        process.stderr.write(`[subagent ${subagentId}] ${text}`);
      }
    });

    // 进程退出
    proc.on('exit', (code, signal) => {
      this.handleWorkerExit(subagentId, code, signal, entry);
    });

    // 进程错误(spawn 失败等)
    // P0-1 修复:spawn 失败时 Node 只触发 'error' 不触发 'exit'(参见 Node.js child_process 文档)
    // 若不在此补清理,activeCount 永久占位 → drainQueue 条件 activeCount < maxWorkers 永远少一格
    // → worker 池容量逐次缩减至 0
    proc.on('error', (err) => {
      if (entry.resolver) {
        entry.resolver({
          subagentId,
          pid: proc.pid ?? 0,
          status: 'failed',
          error: `process error: ${err.message}`,
          durationMs: Date.now() - startedAt,
        });
        entry.resolver = undefined;
      }
      // 防御重复清理(handleWorkerExit 可能已执行)
      if (!this.workers.has(subagentId)) return;
      if (entry.timeoutTimer) clearTimeout(entry.timeoutTimer);
      if (entry.heartbeatTimer) clearInterval(entry.heartbeatTimer);
      this.workers.delete(subagentId);
      this.activeCount--;
      // 清理 worktree(spawn 失败时 worktree 已创建但子进程未启动)
      if (entry.worktree) {
        try {
          removeWorktree(entry.worktree.path, { sourcePath: entry.worktree.parentId, force: true });
        } catch { /* ignore */ }
      }
      void this.drainQueue();
    });

    // 发送任务参数到子进程
    const startMsg: StartIPCMessage = {
      type: 'start',
      subagentId,
      persona: req.persona,
      task: req.task,
      workspacePath,
      model: req.model,
      capability: req.capability,
      maxIterations: req.maxIterations,
    };
    proc.send(startMsg);

    // 超时定时器
    entry.timeoutTimer = setTimeout(() => {
      this.handleTimeout(subagentId, entry, timeoutSec);
    }, timeoutSec * 1000);

    // 心跳超时检测(每 5s 检查)
    entry.heartbeatTimer = setInterval(() => {
      this.checkHeartbeat(entry);
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** 心跳检查:15s 无心跳 → 标记 dead,SIGKILL */
  private checkHeartbeat(entry: WorkerEntry): void {
    if (Date.now() - entry.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
      entry.state.status = 'dead';
      try { entry.proc.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }

  /** 超时处理:SIGTERM 子进程,resolve failed */
  private handleTimeout(subagentId: string, entry: WorkerEntry, timeoutSec: number): void {
    entry.timedOut = true;
    try { entry.proc.kill('SIGTERM'); } catch { /* ignore */ }
    // exit handler 会 resolve;但以防 exit 不触发,这里也 resolve 一次(幂等)
    if (entry.resolver) {
      const resp: SubagentSpawnResponse = {
        subagentId,
        pid: entry.proc.pid ?? 0,
        status: 'failed',
        error: `timeout after ${timeoutSec}s`,
        durationMs: Date.now() - entry.startedAt,
      };
      entry.resolver(resp);
      entry.resolver = undefined;
    }
  }

  /** 子进程退出处理:解析 stdout NDJSON,resolve 响应,清理 worktree */
  private handleWorkerExit(
    subagentId: string,
    code: number | null,
    signal: NodeJS.Signals | null,
    entry: WorkerEntry,
  ): void {
    if (entry.timeoutTimer) clearTimeout(entry.timeoutTimer);
    if (entry.heartbeatTimer) clearInterval(entry.heartbeatTimer);

    const durationMs = Date.now() - entry.startedAt;
    const isTimeout = entry.timedOut || code === 2;
    const isError = code !== 0 && code !== null;
    const isFailed = isTimeout || isError || signal !== null;

    // 更新 state
    if (entry.state.status !== 'dead') {
      entry.state.status = isFailed ? 'dead' : 'idle';
      if (isFailed) entry.state.failedCount++;
      else entry.state.completedCount++;
    }

    // 解析 stdout NDJSON 提取结果
    const parsed = parseWorkerStdout(entry.stdoutBuf);
    const output = parsed.assistantText || (entry.stderrBuf.trim().slice(-2000) || undefined);

    if (entry.resolver) {
      const resp: SubagentSpawnResponse = {
        subagentId,
        pid: entry.proc.pid ?? 0,
        status: isFailed ? 'failed' : 'completed',
        output,
        error: isFailed
          ? (isTimeout ? `timeout (exit code ${code})` : (entry.stderrBuf.trim().slice(-500) || `exit code ${code} signal ${signal}`))
          : undefined,
        durationMs,
      };
      entry.resolver(resp);
      entry.resolver = undefined;
    }

    // P1-4 修复:worktree 清理策略
    // - 成功完成:清理
    // - 失败:默认也清理(防磁盘泄漏),除非配置 keepWorktreeOnFailure=true 保留供调试
    const shouldCleanWorktree = entry.worktree && (!isFailed || !this.config.keepWorktreeOnFailure);
    if (shouldCleanWorktree && entry.worktree) {
      try {
        removeWorktree(entry.worktree.path, { sourcePath: entry.worktree.parentId, force: true });
      } catch { /* ignore */ }
    } else if (isFailed && entry.worktree && this.config.keepWorktreeOnFailure) {
      // 保留失败任务的 worktree 供调试,记录路径供用户查找
      process.stderr.write(
        `[subagent ${subagentId}] worktree retained for debugging: ${entry.worktree.path}\n`,
      );
    }

    this.workers.delete(subagentId);
    this.activeCount--;
    void this.drainQueue();
  }

  private entryToResponse(w: WorkerEntry, status: SubagentSpawnResponse['status']): SubagentSpawnResponse {
    return {
      subagentId: w.subagentId,
      pid: w.proc.pid ?? 0,
      status,
      durationMs: Date.now() - w.startedAt,
    };
  }
}

// ───────────────────────────── 辅助函数 ─────────────────────────────

/** 生成子 agent ID */
function generateSubagentId(): string {
  return `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 解析 worker stdout(NDJSON 事件流),提取 assistantText 和 complete 事件。
 * - message_delta 事件拼接为 assistantText
 * - complete 事件包含 stopReason/iterations/usage
 * - 非 JSON 行跳过(runAgent 在 silent 模式下不应有非 JSON 输出,但兜底)
 */
function parseWorkerStdout(stdout: string): {
  assistantText: string;
  stopReason?: string;
  iterations?: number;
} {
  const lines = stdout.split('\n');
  let assistantText = '';
  let stopReason: string | undefined;
  let iterations: number | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed) as { type?: string; text?: string; stopReason?: string; iterations?: number };
      if (evt.type === 'message_delta' && typeof evt.text === 'string') {
        assistantText += evt.text;
      } else if (evt.type === 'complete') {
        stopReason = evt.stopReason;
        iterations = evt.iterations;
      } else if (evt.type === 'error' && typeof evt.text === 'string') {
        assistantText += evt.text;
      }
    } catch {
      // 非 JSON 行,跳过
    }
  }

  return { assistantText, stopReason, iterations };
}

/**
 * 解析 worker-entry 入口文件路径。
 * 优先用 dist 编译产物(worker-entry.js);dev 场景(tsx)用源码 worker-entry.ts。
 */
function resolveWorkerEntryPath(): string {
  const hereDir = path.dirname(fileURLToPath(import.meta.url));
  const distCandidate = path.join(hereDir, 'worker-entry.js');
  if (fs.existsSync(distCandidate)) return distCandidate;
  const srcCandidate = path.join(hereDir, 'worker-entry.ts');
  if (fs.existsSync(srcCandidate)) return srcCandidate;
  // 兜底:返回 dist 路径(让 fork 抛错暴露问题,提示用户先 build)
  return distCandidate;
}

/**
 * 默认 WorkerPoolConfig 工厂(用户未传完整 config 时用)。
 * maxWorkers=4,taskTimeoutSeconds=300,maxQueueSize=100。
 */
export function defaultWorkerPoolConfig(overrides?: Partial<WorkerPoolConfig>): WorkerPoolConfig {
  return {
    maxWorkers: DEFAULT_MAX_WORKERS,
    taskTimeoutSeconds: DEFAULT_TASK_TIMEOUT_SECONDS,
    maxQueueSize: DEFAULT_MAX_QUEUE_SIZE,
    idleWorkerTtlSeconds: 60,
    preemptive: false,
    ...overrides,
  };
}
