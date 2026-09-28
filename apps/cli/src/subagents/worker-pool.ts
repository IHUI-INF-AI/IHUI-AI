// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SubagentWorkerPool — 子进程并行 worker 池,用 child_process.fork() 真正并行跑子 agent。
 *
 * 与 subagent-collab.ts 的 CollaborationManager 区别:
 *   - CollaborationManager 是单进程 async executor(非真并行,共享事件循环)
 *   - SubagentWorkerPool 用 fork() 起独立子进程,OS 级真并行(独立 V8 isolate + 事件循环)
 *
 * 设计:
 *   - 每个子 agent 一个 fork() 子进程,入口 worker-entry.ts
 *   - 主进程通过 IPC channel 收子进程 heartbeat,超 heartbeatTimeoutSeconds(默认 60s)无心跳标记 dead
 *   - 超时:timeoutSeconds 到期 SIGTERM 子进程,标记 failed
 *   - 无活动超时(2026-09-27 票,见 getLifecycleStatus / awaitResult):
 *       最后一次"任务活动"(子进程 stdout/stderr 输出、progress IPC)距今超过阈值 ⇒
 *       **转后台** —— spawn Promise 以 wire 形态 status='running' 提前 resolve,
 *       生命周期状态机落 `detached_idle`(中间态,**不是** completed/failed/cancelled,
 *       见 types.ts 状态机注释与 AGENTS.md §30);子进程**不被杀死**,终态仍可经
 *       `awaitResult(subagentId)` 取回。
 *     · 活动信号只认真实事件,heartbeat **刻意不计活动**:worker-entry 无条件每 5s 发
 *       heartbeat(事件循环活着就发,与任务是否推进无关),把它算作活动 ⇒ 判据对本型恒不触发
 *       = 空转尺子;而"心跳也停了"的真卡死已由上面的 heartbeat watchdog SIGKILL 兜住。
 *     · 阈值唯一出口 `resolveSubagentIdleTimeoutMs`(常量只写这一处):默认 120s,
 *       远大于正常一次工具调用/provider 往返,也大于 heartbeat 窗口(60s)——即只有
 *       "进程活着但任务持续无输出"才会被挪到后台。env `IHUI_SUBAGENT_IDLE_TIMEOUT_MS`
 *       覆盖:`=0` 显式关闭(回退出口),非法值回落默认档,上界 30min 封顶(无上界的
 *       可调项会把默认档带跑,与 §12e"运行时版恒红事故"同理)。
 *   - maxWorkers 限制并发(排队),非抢占式
 *   - isolation='worktree' 时调用现有 createWorktree,子进程在隔离工作区跑
 *   - 优雅关闭:SIGTERM → 5s → SIGKILL,清理 worktree
 *
 * 仅依赖 Node.js 内置 + 现有 worktree 模块,不引入新依赖。
 */

import { fork, type ChildProcess, type ForkOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryParseJson, isRecord } from '../util/json.js';
import { createWorktree, removeWorktree, type WorktreeInfo } from './worktree.js';
import type {
  NetworkEgressPolicy,
  SubagentSpawnRequest,
  SubagentSpawnResponse,
  WorkerPoolConfig,
  WorkerResourceLimits,
  WorkerState,
} from '@ihui/types';

// 并发档位一律经单一出口解析(见 concurrency-budget.ts 头注:本文件不得再出现并发字面量)
import { notePoolClosed, notePoolCreated, resolveMaxConcurrency } from './concurrency-budget.js'

// 生命周期状态词汇的唯一声明处在 types.ts(本文件只引用,不另抄名单)
import {
  SUBAGENT_DETACH_REASON,
  SUBAGENT_STATUS_DETACHED_IDLE,
  isSubagentTerminalStatus,
  type SubagentLifecycleStatus,
} from './types.js'

// ───────────────────────────── 常量 ─────────────────────────────

const HEARTBEAT_INTERVAL_MS = 5_000;
const SHUTDOWN_GRACE_MS = 5_000;
const DEFAULT_TASK_TIMEOUT_SECONDS = 300;
const DEFAULT_MAX_QUEUE_SIZE = 100;
// P0-3 修复:buffer 上限,防长跑多 subagent OOM 主进程
const MAX_STDOUT_BUF_BYTES = 1_048_576; // 1MB
const MAX_STDERR_BUF_BYTES = 1_048_576; // 1MB
const STDERR_RATE_LIMIT_LINES_PER_SEC = 100;

// ── 无活动超时 ⇒ 自动转后台(阈值唯一出口,判据见文件头"无活动超时"条) ──

/**
 * 默认档 120s:选"明显异常"那一档 —— 远大于正常一次工具调用/provider 往返(秒级到几十秒,
 * 期间 stdout 持续有 NDJSON 事件),且大于 heartbeat watchdog 窗口(60s),
 * 所以触发它的只有"进程活着但任务持续无任何输出"这一型(即本票立因的挂住场景)。
 */
export const SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS = 120_000;

/** 上界 30min:没有上界的可调项会把默认档带跑(前台实际又变回无限等)。 */
export const SUBAGENT_IDLE_TIMEOUT_MAX_MS = 1_800_000;

/** env 覆盖出口名;`IHUI_SUBAGENT_IDLE_TIMEOUT_MS=0` = 显式关闭转后台(回退出口)。 */
export const SUBAGENT_IDLE_TIMEOUT_ENV = 'IHUI_SUBAGENT_IDLE_TIMEOUT_MS';

/**
 * 无活动超时阈值唯一解析出口(形态对齐 concurrency-budget.ts 的 resolveMaxConcurrency:
 * 常量只写这一处,调用点不得再算)。
 * - 未设 / 空 / 非数字 / 负数 ⇒ 默认档(非法值不得把行为带偏)
 * - 显式 0 ⇒ 关闭转后台(回退出口)
 * - 正数 ⇒ 钳到 MAX
 */
export function resolveSubagentIdleTimeoutMs(raw?: string): number {
  if (raw === undefined || raw.trim() === '') return SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS;
  if (parsed === 0) return 0;
  return Math.min(parsed, SUBAGENT_IDLE_TIMEOUT_MAX_MS);
}

// ───────────────────────────── 类型 ─────────────────────────────

/** 子进程 → 父进程 IPC 消息 */
type WorkerIPCMessage =
  | { type: 'heartbeat'; rss?: number; heapUsed?: number }
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
  /** 网络出站策略(P1-5,worker-entry 调 installEgressGuard 注入) */
  networkEgressPolicy?: NetworkEgressPolicy;
  /** 资源限制(P1-3,memoryMb 供子进程自 OOM 检查,cpuCores/cpuSeconds 供轮询) */
  resourceLimits?: WorkerResourceLimits;
}

/** 内部 worker 跟踪条目 */
interface WorkerEntry {
  subagentId: string;
  proc: ChildProcess;
  startedAt: number;
  lastHeartbeatAt: number;
  /**
   * 最后一次"任务活动"时刻(ms epoch)。来源只允许是**真实事件**:
   * 子进程 stdout/stderr 输出、progress IPC。heartbeat **刻意不计入**(见文件头设计说明:
   * worker-entry 每 5s 无条件发 heartbeat,事件循环空闲即发,与任务是否推进无关;
   * 把它算作活动 ⇒ 判据永不触发 = 空转尺子)。单一写入点见 markActivity。
   */
  lastActivityAt: number;
  /** 生命周期状态机当前值(唯一清单见 types.ts SUBAGENT_LIFECYCLE_STATUSES) */
  lifecycle: SubagentLifecycleStatus;
  /** 是否已因无活动超阈被挪到后台(spawn Promise 已提前 resolve) */
  idleDetached: boolean;
  /** 后台终态 awaiter(awaitResult 在真正 exit 前登记的回调) */
  finalResolvers: Array<(resp: SubagentSpawnResponse) => void>;
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
  /** 心跳超时 ms(从 config.heartbeatTimeoutSeconds 读,默认 60s) */
  private readonly heartbeatTimeoutMs: number;
  /** 无活动超时阈值 ms(唯一出口 resolveSubagentIdleTimeoutMs 解析;0=关闭转后台) */
  private readonly idleTimeoutMs: number;
  /**
   * 已转后台 worker 的最终响应缓存(subagentId → exit 时写入)。
   * 只在转后台路径写:正常 await spawn 的调用方不需要它,不加缓存面
   * (缓存有界 = 本次池生命周期内转后台的任务数,量级 = workers 本身)。
   */
  private readonly detachedFinalResults = new Map<string, SubagentSpawnResponse>();
  /**
   * 已退出子 agent 的终态记录(含未转后台的正常路径),让 getLifecycleStatus 对
   * "本池任一生平管理过的 subagent"口径一致。值只有枚举字符串,上界 = 池生命周期内任务数。
   */
  private readonly finishedLifecycles = new Map<string, SubagentLifecycleStatus>();

  constructor(config: WorkerPoolConfig) {
    this.config = config;
    this.entryPath = resolveWorkerEntryPath();
    this.heartbeatTimeoutMs = (config.heartbeatTimeoutSeconds ?? 60) * 1000;
    this.idleTimeoutMs = resolveSubagentIdleTimeoutMs(process.env[SUBAGENT_IDLE_TIMEOUT_ENV]);
    // 可观测:并发总量 = 各池 maxWorkers 之和,池数是那个"2×maxWorkers"放大倍数的来源
    notePoolCreated();
  }

  /**
   * 查询子 agent 的生命周期状态机当前值(唯一状态视图)。
   * - 运行中 ⇒ 'running';无活动超阈已转后台 ⇒ 'detached_idle'(**中间态,不是终态**);
   * - 已退出 ⇒ 'completed' / 'failed';
   * - 池内查无此 id ⇒ undefined。
   * 判"钩子/后台迁移无终态"的消费端一律走这里 + isSubagentTerminalStatus,
   * 不得自行内联三档终态名单(AGENTS.md §30「钩子无终态不得渲染成"完成"」)。
   */
  getLifecycleStatus(subagentId: string): SubagentLifecycleStatus | undefined {
    const w = this.workers.get(subagentId);
    if (w) return w.lifecycle;
    return this.finishedLifecycles.get(subagentId);
  }

  /**
   * 取回已转后台子 agent 的**最终**结果(真正的 completed/failed + stdout 解析输出)。
   * - 已 exit ⇒ 立即 resolve 缓存的最终响应;
   * - 仍在后台运行 ⇒ 登记 awaiter,exit 时 resolve;
   * - 池内查无此 id ⇒ resolve not-found(形态对齐 getStatus)。
   * 语义要点:转后台 ≠ 杀死 —— 本方法的存在就是"没有丢终态"的出口。
   */
  awaitResult(subagentId: string): Promise<SubagentSpawnResponse> {
    const final = this.detachedFinalResults.get(subagentId);
    if (final) return Promise.resolve(final);
    const w = this.workers.get(subagentId);
    if (!w) {
      return Promise.resolve({
        subagentId,
        pid: 0,
        status: 'failed',
        error: `subagent ${subagentId} not found`,
      });
    }
    return new Promise<SubagentSpawnResponse>((resolve) => {
      w.finalResolvers.push(resolve);
    });
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

  /**
   * 当前仍在池内跟踪的 subagent id(含已转后台、进程仍在跑的)。
   * 只读观测面:判"转后台后进程没有被杀死、仍被跟踪"用这个出口,不得靠内部 Map 结构。
   */
  activeSubagentIds(): string[] {
    return [...this.workers.keys()];
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
    // 只数首次 shutdown(重复调用不得把 activePools 打成负数)
    if (!this.shutDown) notePoolClosed();
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
    // worktree 源路径优先级:config.workspaceSourcePath > req.workspacePath > process.cwd()
    const sourcePath = this.config.workspaceSourcePath ?? req.workspacePath ?? process.cwd();
    let workspacePath = sourcePath;
    let worktree: WorktreeInfo | undefined;

    // isolation='worktree' 时创建隔离工作区(需源仓库路径,空=不启用,对齐类型契约)
    if (req.isolation === 'worktree') {
      if (!this.config.workspaceSourcePath && !req.workspacePath) {
        resolve({
          subagentId,
          pid: 0,
          status: 'failed',
          error: 'worktree 隔离需要 workspaceSourcePath 或 workspacePath,两者都为空(类型契约:空=不启用 worktree 隔离)',
        });
        this.activeCount--;
        void this.drainQueue();
        return;
      }
      try {
        worktree = createWorktree('pool', subagentId, sourcePath);
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

    // P1-3 修复:V8 heap 软限制(跨平台,覆盖子 agent 90% JS heap 内存)
    // 不覆盖 native 模块内存,但比无限好;完整限制需 OS 沙箱(Job Object / setrlimit)
    // 注意:@types/node 22.x 的 ForkOptions 缺少 resourceLimits 类型定义,但 Node.js 12+ 运行时支持
    const forkOptions: ForkOptions = {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, IHUI_SUBAGENT_ID: subagentId },
      execArgv: process.execArgv, // 继承 tsx loader flags(dev 模式)
    };
    if (this.config.resourceLimits) {
      (forkOptions as Record<string, unknown>).resourceLimits = {
        maxOldGenerationSizeMb: this.config.resourceLimits.maxOldGenerationSizeMb,
        maxYoungGenerationSizeMb: this.config.resourceLimits.maxYoungGenerationSizeMb,
      };
    }
    const proc = fork(this.entryPath, [], forkOptions);

    const entry: WorkerEntry = {
      subagentId,
      proc,
      startedAt,
      lastHeartbeatAt: startedAt,
      lastActivityAt: startedAt,
      lifecycle: 'running',
      idleDetached: false,
      finalResolvers: [],
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
        // P1-3 修复:记录子进程 RSS(用于监控内存趋势)
        if (msg.rss) {
          const rssMb = msg.rss / 1024 / 1024;
          const limitMb = this.config.resourceLimits?.memoryMb;
          if (limitMb && rssMb > limitMb * 0.8) {
            // 接近 80% 阈值时告警(第二层软监控,第一层在子进程内自退出)
            process.stderr.write(
              `[subagent ${subagentId}] RSS 接近上限: ${rssMb.toFixed(0)}MB / ${limitMb}MB\n`,
            );
          }
        }
        // 注意:heartbeat 是"存活信号"而非"任务活动信号",**不更新 lastActivityAt**。
        // worker-entry 无条件每 5s 发(事件循环空闲即发),把它计入活动 ⇒ 判据永不触发。
      } else if (msg.type === 'progress') {
        // progress IPC = 真实任务事件(状态变更),计活动
        this.markActivity(entry);
      }
    });

    // stdout 收集(NDJSON 事件流)
    proc.stdout?.on('data', (chunk: Buffer) => {
      this.markActivity(entry);
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
      // stderr 输出同样是真实任务事件(诊断/进度日志),计活动
      this.markActivity(entry);
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
      // exit 已收口(或 error 重放)时不得覆盖真实终态 —— 原实现靠"resolver 已被消费"
      // 达成,现靠生命周期终态标志,方向一致:后到的信号不改写先落定的终态
      if (isSubagentTerminalStatus(entry.lifecycle)) return;
      const errResp: SubagentSpawnResponse = {
        subagentId,
        pid: proc.pid ?? 0,
        status: 'failed',
        error: `process error: ${err.message}`,
        durationMs: Date.now() - startedAt,
      };
      // 终态收口与 handleWorkerExit 同形:转后台过的条目终态也要能经 awaitResult 取回
      entry.lifecycle = 'failed';
      if (entry.idleDetached) {
        this.detachedFinalResults.set(subagentId, errResp);
      }
      if (entry.resolver) {
        entry.resolver(errResp);
        entry.resolver = undefined;
      }
      for (const resolveFinal of entry.finalResolvers.splice(0)) {
        resolveFinal(errResp);
      }
      // 防御重复清理(handleWorkerExit 可能已执行)
      if (!this.workers.has(subagentId)) return;
      if (entry.timeoutTimer) clearTimeout(entry.timeoutTimer);
      if (entry.heartbeatTimer) clearInterval(entry.heartbeatTimer);
      this.workers.delete(subagentId);
      this.finishedLifecycles.set(subagentId, entry.lifecycle);
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
      networkEgressPolicy: this.config.networkEgressPolicy,
      resourceLimits: this.config.resourceLimits,
    };
    proc.send(startMsg);

    // 超时定时器
    entry.timeoutTimer = setTimeout(() => {
      this.handleTimeout(subagentId, entry, timeoutSec);
    }, timeoutSec * 1000);

    // 心跳超时检测(每 5s 检查)
    entry.heartbeatTimer = setInterval(() => {
      this.checkHeartbeat(entry);
      // 无活动超时检测与心跳检测同频(复用同一个 5s 轮询,不新起定时器)
      this.checkIdleTimeout(subagentId, entry);
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** 活动信号唯一写入点(判"有没有活动"只读 lastActivityAt,别处不得另记一份) */
  private markActivity(entry: WorkerEntry): void {
    entry.lastActivityAt = Date.now();
  }

  /**
   * 无活动超时 ⇒ 自动转后台(状态迁移,非杀死)。
   * 触发条件全部成立才迁移:阈值已设(>0)、未转过后台、未进终态、距最后一次真实
   * 任务事件超过 idleTimeoutMs。迁移动作:
   *   - lifecycle → 'detached_idle'(中间态,**不进** completed/failed/cancelled);
   *   - 提前 resolve spawn Promise,wire 状态用**既有档位** 'running'(不新增 SSE 事件名、
   *     不改 wire 契约字段词汇 —— 'running' 语义本就是"仍在执行");
   *   - **不 kill 子进程、不清 timeoutTimer** —— 后台继续跑,taskTimeout/心跳 watchdog
   *     仍是它的最终边界,真终态经 awaitResult()/detachedFinalResults 取回。
   */
  private checkIdleTimeout(subagentId: string, entry: WorkerEntry): void {
    if (this.idleTimeoutMs <= 0) return;
    if (entry.idleDetached) return;
    if (entry.lifecycle !== 'running') return;
    if (Date.now() - entry.lastActivityAt <= this.idleTimeoutMs) return;
    this.detachToBackground(subagentId, entry);
  }

  /** checkIdleTimeout 的迁移动作(单独成函数:测试与人工核验都能对同一份实现问责) */
  private detachToBackground(subagentId: string, entry: WorkerEntry): void {
    entry.idleDetached = true;
    entry.lifecycle = SUBAGENT_STATUS_DETACHED_IDLE;
    process.stderr.write(
      `[subagent ${subagentId}] ${SUBAGENT_DETACH_REASON}: ` +
        `无任务事件超过 ${this.idleTimeoutMs}ms,已转后台(进程未被杀死,awaitResult 可取回终态)\n`,
    );
    if (entry.resolver) {
      // 前台从此不再等待:wire 状态如实回 'running'(仍在执行),不得写成任何终态
      entry.resolver({
        subagentId,
        pid: entry.proc.pid ?? 0,
        status: 'running',
        durationMs: Date.now() - entry.startedAt,
      });
      entry.resolver = undefined;
    }
  }

  /** 心跳检查:超过 heartbeatTimeoutMs 无心跳 → 标记 dead,SIGKILL */
  private checkHeartbeat(entry: WorkerEntry): void {
    if (Date.now() - entry.lastHeartbeatAt > this.heartbeatTimeoutMs) {
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
    // P2 修复:区分 exit 3(OOM)/ exit 4(CPU limit)语义,资源超限非代码 bug 可重试
    const isOOM = code === 3;
    const isCpuLimit = code === 4;
    const isError = code !== 0 && code !== null && !isOOM && !isCpuLimit;
    const isFailed = isTimeout || isError || isOOM || isCpuLimit || signal !== null;

    // 更新 state
    if (entry.state.status !== 'dead') {
      entry.state.status = isFailed ? 'dead' : 'idle';
      if (isFailed) entry.state.failedCount++;
      else entry.state.completedCount++;
    }

    // 解析 stdout NDJSON 提取结果
    const parsed = parseWorkerStdout(entry.stdoutBuf);
    const output = parsed.assistantText || (entry.stderrBuf.trim().slice(-2000) || undefined);

    // 生命周期终态落档:'running' / 'detached_idle' 都只在此处收口为 completed/failed。
    // 已转后台的条目 spawn Promise 早以 'running' resolve 过,真终态只走
    // detachedFinalResults + finalResolvers(= awaitResult 的出口),不冒充、不丢失。
    entry.lifecycle = isFailed ? 'failed' : 'completed';
    const resp: SubagentSpawnResponse = {
      subagentId,
      pid: entry.proc.pid ?? 0,
      status: isFailed ? 'failed' : 'completed',
      output,
      error: isFailed
        ? (isTimeout
            ? `timeout (exit code ${code})`
            : isOOM
              ? `[OOM] worker self-OOM exit, stdout: ${entry.stdoutBuf.slice(-500)}`
              : isCpuLimit
                ? `[CPU_LIMIT] worker CPU limit exit, stdout: ${entry.stdoutBuf.slice(-500)}`
                : (entry.stderrBuf.trim().slice(-500) || `exit code ${code} signal ${signal}`))
        : undefined,
      durationMs,
    };
    if (entry.idleDetached) {
      this.detachedFinalResults.set(subagentId, resp);
    }
    if (entry.resolver) {
      entry.resolver(resp);
      entry.resolver = undefined;
    }
    for (const resolveFinal of entry.finalResolvers.splice(0)) {
      resolveFinal(resp);
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
    this.finishedLifecycles.set(subagentId, entry.lifecycle);
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
      const evt = tryParseJson(trimmed);
      if (!isRecord(evt)) continue;
      // P0 修复:同时识别 text 和 message 字段(worker-entry 写 message,容错多种命名)
      const evtText = [evt.text, evt.message, evt.payload].find((v): v is string => typeof v === 'string');
      if (evt.type === 'message_delta' && evtText !== undefined) {
        assistantText += evtText;
      } else if (evt.type === 'complete') {
        if (typeof evt.stopReason === 'string') stopReason = evt.stopReason;
        if (typeof evt.iterations === 'number') iterations = evt.iterations;
      } else if (evt.type === 'error' && evtText !== undefined) {
        assistantText += evtText;
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
 * maxWorkers 由 concurrency-budget 单一出口解析(未传 ⇒ CPU 推导;传了 ⇒ 钳到 [1, 硬上限]),
 * taskTimeoutSeconds=300,maxQueueSize=100。
 *
 * 注意 `maxWorkers` 必须放在 `...overrides` **之后**:否则调用方(含模型自填的 999)
 * 会在最后一刻把钳制结果覆盖掉,钳制形同不存在。
 */
export function defaultWorkerPoolConfig(overrides?: Partial<WorkerPoolConfig>): WorkerPoolConfig {
  return {
    taskTimeoutSeconds: DEFAULT_TASK_TIMEOUT_SECONDS,
    maxQueueSize: DEFAULT_MAX_QUEUE_SIZE,
    idleWorkerTtlSeconds: 60,
    preemptive: false,
    ...overrides,
    maxWorkers: resolveMaxConcurrency(overrides?.maxWorkers),
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
