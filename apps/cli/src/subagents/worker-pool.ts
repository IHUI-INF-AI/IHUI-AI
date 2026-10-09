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
 *   - taskTimeout(G-426 改语义):timeoutSeconds 是**无活动空闲窗**(默认 300s),每次真实任务
 *     活动(stdout/stderr/progress IPC,markActivity 唯一写入点)把窗口重排回完整值 —— 仍在
 *     推进的慢子代理不再被墙钟 SIGTERM,真正卡死的才超时;另设**从开始计时**的绝对上限
 *     = 窗口 × 3(TASK_TIMEOUT_ABSOLUTE_FACTOR),到点不杀(G-426 拍板第三件套:仍在推进的
 *     执行自动转后台,前台取消不再杀它),只有 idle 档(空闲窗整段耗尽)才 SIGTERM;
 *     错误 context 带 idleMs 与 recoverable/retryable 标记。旧行为"无条件 300s 墙钟到点即杀"已废。
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
const DEFAULT_TASK_TIMEOUT_SECONDS = 300;
/**
 * G-426:taskTimeout 绝对上限倍数。空闲窗改成"每次任务活动重排"后,必须留一个**从开始计时**
 * 的总上限收口,否则前台永远等不到结算。取窗口 3 倍而不是独立常量:timeoutSeconds
 * 是逐请求可调档(默认 300s),"多长的执行算滥用"应与该请求自己声明的合理时长同比例缩放 ——
 * 3 = 名义窗口之外再给两整段同额推进余量。G-426 拍板第三件套:到点的收口动作是**转后台**
 * (前台停止等待),不是 SIGTERM —— 真正卡死的死法归 idle 档。
 */
const TASK_TIMEOUT_ABSOLUTE_FACTOR = 3;
const DEFAULT_MAX_QUEUE_SIZE = 100;

/**
 * b76-04 票3:worker 结果回灌 caps 常量表(数字即契约,必须住在有名字的表里;
 * 照抄上游"执行侧不同就分表"的纪律 —— 下游判定侧与审计侧各立一名)。
 */
export const WORKER_RESULT_CAPS = {
  /**
   * 下游判定侧:回灌给调用方判定的结果 output 字节上限。
   * 超限 ⇒ 结构化拒绝并点名恢复动作,断然不交半截结果
   * ("截断把一份悄悄残缺的世界视图交给脚本,而脚本接下来会拿它去扇出")。
   */
  resultOutputMaxBytes: { cap: 8_192, enforcement: 'service 执行' },
  /** 审计侧:error/stderr 尾巴字符上限;超 ⇒ 有界化 + truncated 标记,诚实说被截了。 */
  errorTailMaxChars: { cap: 500, enforcement: 'service 执行' },
} as const;
/**
 * G-998112(T3):kill 后等待 exit 事件的有界预算。
 * 发起信号 ≠ 进程已退 —— kill 抛错(EPERM/ESRCH)或 exit 事件超预算未到 ⇒
 * 记 `residualPid` 结构化残留记录,账面终态写 failed,不得静默当成功。
 */
const KILL_EXIT_BUDGET_MS = 5_000;
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

/**
 * G-998112(T3):一次未确认回收的结构化残留记录。
 * 存在即回答"这个 pid 是否真的没了" ⇒ **没有确认它没了**(信号派发失败或 exit 超预算)。
 * 出口:`getResidualKills()` / `getResidualPid(subagentId)`;同时以
 * `residualPid=<pid>` 形态进 spawn/awaitResult 响应的 error 字段。
 */
export interface ResidualKillRecord {
  subagentId: string
  /** 信号派发失败或 exit 超预算时仍未确认退出的 pid */
  pid: number
  signal: NodeJS.Signals
  /** 归因:heartbeat-watchdog / task-timeout / pool-shutdown / pool-shutdown-escalation */
  reason: string
  /** 结构化原因细节(报错原文或超预算描述) */
  detail: string
  at: string
}

/** 测试注入口:fork 派生出口与 kill 后 exit 预算(缺省走真 fork + KILL_EXIT_BUDGET_MS)。 */
export interface WorkerPoolDeps {
  forkImpl?: (entryPath: string, args: string[], options: ForkOptions) => ChildProcess
  /** kill 后等待 exit 的预算 ms(测试用小值;生产缺省 KILL_EXIT_BUDGET_MS)。 */
  killExitBudgetMs?: number
}

/** G-998115(b76-08a):子进程退出归因三态 —— 判据不接受"非零 code 即异常"。 */
export type TerminationKind = 'expected' | 'watchdog_recycle' | 'unexpected'

/** G-998115:诊断尾巴上限(先脱敏再限长;上限与上游 zcodeAgentProcessManager 同值)。 */
export const DIAGNOSTIC_TAIL_MAX_LINES = 20
export const DIAGNOSTIC_TAIL_MAX_LINE_CHARS = 1000

/**
 * 诊断文本脱敏唯一出口:三类凭据形状替换为 [REDACTED]。
 * 调用方纪律:**先脱敏再限长**(脱敏占位符可能比原文长,限长必须在脱敏之后)。
 */
export function redactDiagnosticText(text: string): string {
  let out = String(text ?? '')
  // 顺序即判据:Bearer/Basic 形状必须先于赋值式 —— 否则 'Authorization: Bearer x'
  // 的值会被赋值式吃成 'Bearer',真凭据反而裸奔。
  out = out.replace(/\b(bearer|basic)\s+(\S+)/gi, (_m, scheme: string) => `${scheme} [REDACTED]`)
  out = out.replace(
    /\b(api[-_]?key|authorization|cookie|credential|password|secret|token)\b["']?(\s*[=:]\s*)(\S+)/gi,
    (_m, key: string, sep: string) => `${key}${sep}[REDACTED]`,
  )
  out = out.replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
  return out
}

/**
 * 诊断尾巴唯一采集口:先脱敏、再取末 20 行、单行限 1000 字符,并带原始行数。
 * 子代理 stderr/stdout 尾巴进 result.output / error 前必须走这里(禁平行采集)。
 */
export function boundedRedactedTail(
  stderr: string,
): { lines: string[]; lineCount: number } {
  const redacted = redactDiagnosticText(String(stderr ?? ''))
  const allLines = redacted.split(/\r?\n/)
  const tail = allLines
    .slice(-DIAGNOSTIC_TAIL_MAX_LINES)
    .map((l) =>
      l.length > DIAGNOSTIC_TAIL_MAX_LINE_CHARS
        ? `${l.slice(0, DIAGNOSTIC_TAIL_MAX_LINE_CHARS)}…[truncated:true]`
        : l,
    )
  return { lines: tail, lineCount: allLines.length }
}

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
  /** 是否已转后台(无活动超阈或绝对上限到点;spawn Promise 已提前 resolve) */
  idleDetached: boolean;
  /** 后台终态 awaiter(awaitResult 在真正 exit 前登记的回调) */
  finalResolvers: Array<(resp: SubagentSpawnResponse) => void>;
  state: WorkerState;
  worktree?: WorktreeInfo;
  resolver?: (resp: SubagentSpawnResponse) => void;
  timeoutTimer?: NodeJS.Timeout;
  heartbeatTimer?: NodeJS.Timeout;
  /**
   * G-426:taskTimeout 从"无条件墙钟"改为"无活动空闲窗 + 绝对上限"后的两枚锚点。
   * `taskTimeoutWindowMs` = timeoutSeconds × 1000(空闲窗,每次真实任务活动重排);
   * `taskDeadlineAt` = start + window × TASK_TIMEOUT_ABSOLUTE_FACTOR(从开始计时的总上限,
   * 不随活动重排 —— 防一个持续输出事件的死循环无限续命)。两者都在 arm 时写定,
   * markActivity 只读它们重排定时器;缺省(undefined)= taskTimeout 未装配,重排为 no-op。
   */
  taskTimeoutWindowMs?: number;
  taskDeadlineAt?: number;
  stdoutBuf: string;
  stderrBuf: string;
  timedOut: boolean;
  // P0-3 修复:buffer 截断标记 + stderr rate limit 计数
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  stderrLastFlushAt: number;
  stderrLinesSinceFlush: number;
  /** G-998115:退出归因(host 主动回收时写;exit 时按 terminationKind ?? unexpected 判)。 */
  terminationKind?: TerminationKind;
  /** G-998115:首因锁定 —— 首次 cleanup 写入归因后,后续幂等回收不得改写。 */
  terminationKindLocked: boolean;
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
  /**
   * G-654① —— 运行计数**不得是第二份真相**。
   *
   * 旧写法是 `private activeCount = 0` 自己 ++/--:配对要靠 8 处调用点各自记得,而本文件
   * 那句「若不在此补清理,… → drainQueue 条件永远少一格」正是它自己的供状 —— 漏一处就泄一格,
   * 多减一处会变成**负数**(负数让 `< maxWorkers` 反而多放行一格)。
   * 现由**应计入的集合之和**派生(唯一计算口 `activeCountNow()`):
   *  - `workers` —— 已登记在跑的条目(含已转后台、进程仍活着的那些:旧计数器同样数它们,
   *    行为不变,见 `checkIdleTimeout` 那条"转后台 ≠ 杀死");
   *  - `reservedStarts` —— drainQueue 已决定启动、但 `startWorker` 还没把它写进 `workers`
   *    的那一格(占位形状与旧写法"`activeCount++` 早于 startWorker"一致 ⇒ 并发上界不松口)。
   * 集合是真相,数字只是它的投影:从集合里摘掉就等于减了一格,不存在"忘了 --"这条路。
   */
  private readonly reservedStarts = new Set<string>();
  private nextReservedSlot = 0;
  /**
   * 上一次**发布出去**的派生计数值 —— 「算出来的值与上次相同 ⇒ 不发事件/不重复通知」的参照位。
   * 只在 `publishActiveCountIfChanged()` 里读写(它不是计数,只是发射台账)。
   */
  private lastPublishedActiveCount = 0;
  private readonly activeCountListeners = new Set<(next: number, prev: number) => void>();
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
  /**
   * G-998112:未确认回收的残留记录(subagentId → 证据)。有终态(exit 事件)那一半
   * 仍是唯一收口点;这里只补"发信号了但 OS 退没退没有证据"的那一半。
   */
  private readonly residualKills = new Map<string, ResidualKillRecord>();
  private readonly forkImpl: (entryPath: string, args: string[], options: ForkOptions) => ChildProcess;
  private readonly killExitBudgetMs: number;

  constructor(config: WorkerPoolConfig, deps: WorkerPoolDeps = {}) {
    this.config = config;
    this.entryPath = resolveWorkerEntryPath();
    this.forkImpl = deps.forkImpl ?? fork;
    this.killExitBudgetMs = deps.killExitBudgetMs ?? KILL_EXIT_BUDGET_MS;
    this.heartbeatTimeoutMs = (config.heartbeatTimeoutSeconds ?? 60) * 1000;
    this.idleTimeoutMs = resolveSubagentIdleTimeoutMs(process.env[SUBAGENT_IDLE_TIMEOUT_ENV]);
    // 可观测:并发总量 = 各池 maxWorkers 之和,池数是那个"2×maxWorkers"放大倍数的来源
    notePoolCreated();
  }

  /**
   * G-998112 残留证据出口:返回所有"信号已发但 OS 退出未确认"的记录。
   * 空数组 = 本池每次回收都拿到了 exit 证据。
   */
  getResidualKills(): ResidualKillRecord[] {
    return [...this.residualKills.values()];
  }

  /** 某个子代理是否存在未确认回收(有 ⇒ 返回残留 pid;无 ⇒ undefined)。 */
  getResidualPid(subagentId: string): number | undefined {
    return this.residualKills.get(subagentId)?.pid;
  }

  /**
   * G-998112 kill 唯一出口:发起信号 + 有界等待 exit 事件。
   * 两条失败路径都记 residualPid 并把该子代理终态写成 failed + 结构化原因:
   *  1. 信号派发本身抛错(EPERM/ESRCH)⇒ pid 状态未知,不得当成功;
   *  2. exit 事件超过预算未到 ⇒ 不装"已回收"。
   * 返回值 = 是否在预算内观察到 exit 事件。
   */
  private signalWorker(w: WorkerEntry, signal: NodeJS.Signals, reason: string, budgetMs?: number): Promise<boolean> {
    try {
      w.proc.kill(signal);
    } catch (e) {
      this.recordResidualKill(w, signal, reason, `信号派发失败:${e instanceof Error ? e.message : String(e)}`);
      return Promise.resolve(false);
    }
    if (w.proc.exitCode !== null || w.proc.signalCode !== null) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const budget = budgetMs ?? this.killExitBudgetMs;
      const timer = setTimeout(() => {
        w.proc.removeListener('exit', onExit);
        this.recordResidualKill(w, signal, reason, `exit 事件超过 ${budget}ms 未到`);
        resolve(false);
      }, budget);
      const onExit = () => {
        clearTimeout(timer);
        resolve(true);
      };
      w.proc.once('exit', onExit);
    });
  }

  /** 残留记录唯一写入点:结构化记录 + 终态写 failed(经既有收口面,exit 后到时以真终态为准)。 */
  private recordResidualKill(w: WorkerEntry, signal: NodeJS.Signals, reason: string, detail: string): void {
    const pid = w.proc.pid ?? 0;
    this.residualKills.set(w.subagentId, {
      subagentId: w.subagentId,
      pid,
      signal,
      reason,
      detail,
      at: new Date().toISOString(),
    });
    const resp: SubagentSpawnResponse = {
      subagentId: w.subagentId,
      pid,
      status: 'failed',
      error: `residualPid=${pid} signal=${signal} (${reason}): ${detail}`,
      durationMs: Date.now() - w.startedAt,
    };
    entryStateFailed(w);
    if (w.idleDetached) {
      this.detachedFinalResults.set(w.subagentId, resp);
    }
    if (w.resolver) {
      w.resolver(resp);
      w.resolver = undefined;
    }
    for (const resolveFinal of w.finalResolvers.splice(0)) {
      resolveFinal(resp);
    }
    process.stderr.write(
      `[subagent ${w.subagentId}] residualPid=${pid} signal=${signal} reason=${reason} detail=${detail}\n`,
    );
  }

  /**
   * G-998115 waitForStderrDrain 等价:exit 事件早于 stdio flush,归因 error 日志必须等
   * stderr 流尽(end/close)或 200ms 预算到再发,保证尾巴采集完整;once 守卫保证恰 1 条。
   */
  private emitUnexpectedExitLog(
    subagentId: string,
    code: number | null,
    signal: NodeJS.Signals | null,
    entry: WorkerEntry,
  ): void {
    let done = false;
    const emit = (): void => {
      if (done) return;
      done = true;
      const tail = boundedRedactedTail(entry.stderrBuf);
      process.stderr.write(
        `[subagent ${subagentId}] [error] exit attribution=unexpected exitCode=${String(code)} signal=${String(signal)}; ` +
          `stderr tail 已脱敏(取末 ${tail.lines.length}/${tail.lineCount} 行):\n${tail.lines.join('\n')}\n`,
      );
    };
    const s = entry.proc.stderr;
    if (!s || s.readableEnded) {
      emit();
      return;
    }
    const budget = setTimeout(emit, 200);
    s.once('end', () => {
      clearTimeout(budget);
      emit();
    });
    s.once('close', () => {
      clearTimeout(budget);
      emit();
    });
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

  /**
   * G-713:改并发上界的**唯一**入口 —— 抬档位必须同时给出唤醒,不得只改字段。
   *
   * 为什么这不是一层语法糖:`drainQueue()` 的重扫时机只有三个(入队时、worker 结算时、
   * 取消/关闭时)。把 `maxWorkers` 从 1 抬到 2 而不调它,队列里那条等待项**没有任何事件**
   * 会再去问一次 `派生计数 < maxWorkers`(G-654①:该判据读 `activeCountNow()`,占的仍是同一格)
   * —— 于是"上界抬高了"这件事在盘面上是真的、在行为上是假的,表现为"任务卡在队列里永远不启动"。
   * 上游同一条结论写在
   * `engine/scheduler.ts:384-403,425-428`(「抬高上界后必须显式 `pumpAll()` ——
   * 除结算外没有任何事件会触发重扫」)。
   *
   * 钳制一律走并发档唯一出口 `resolveMaxConcurrency`(见 concurrency-budget.ts 头注:
   * 本文件不得再出现并发字面量),所以传进来的数**不会**越过硬上限,也不会被降到 0
   * (0 会让 `派生计数 < maxWorkers` 永不成立 ⇒ 整池饿死;下限 MIN_CONCURRENCY=1 就是这一格守卫)。
   *
   * 非抢占式(与 `maxWorkers 限制并发(排队),非抢占式` 那条设计一致):调低只拦**后续**启动,
   * 已在跑的 worker 一个都不动 —— 这里没有任何 kill/abort 逻辑,不得加进来。
   *
   * @param requested 期望的并发数(越界即钳制,不抛错)
   * @returns 钳制后真正生效的那一档
   */
  setMaxWorkers(requested: number): number {
    const next = resolveMaxConcurrency(requested);
    this.config.maxWorkers = next;
    // 唤醒必须紧跟赋值,且顺序不可颠倒:drainQueue 读的就是 this.config.maxWorkers,
    // 先唤醒后赋值会白醒一次(赋值还在后面 ⇒ 重扫时读到的仍是旧档)。
    void this.drainQueue();
    return next;
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
    while (this.activeCountNow() > 0 || this.queue.length > 0) {
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
    }
    // G-998112:SIGTERM 一轮(有界等待 exit;超预算/派发失败 ⇒ 记 residualPid + 终态 failed),
    // 未退者升级 SIGKILL 再等一轮 —— 两轮都拿到证据才静默,任何残留都留在 getResidualKills()。
    // 预算缺省与 SHUTDOWN_GRACE_MS 同值(5s);deps.killExitBudgetMs 可注入缩小(测试)。
    // G-998115:shutdown 属宿主主动回收 ⇒ 先写归因 expected(首因锁定)。
    for (const w of entries) this.setTerminationKind(w, 'expected');
    const ungraceful = new Set<WorkerEntry>();
    await Promise.all(
      entries.map(async (w) => {
        const exited = await this.signalWorker(w, 'SIGTERM', 'pool-shutdown');
        if (!exited) ungraceful.add(w);
      }),
    );
    await Promise.all(
      [...ungraceful].map((w) => this.signalWorker(w, 'SIGKILL', 'pool-shutdown-escalation')),
    );

    // 清理 worktree
    for (const w of entries) {
      if (w.worktree) {
        try {
          removeWorktree(w.worktree.path, { sourcePath: w.worktree.parentId, force: true });
        } catch { /* ignore */ }
      }
    }
    this.workers.clear();
    // G-654①:这里不再"把计数抹回 0"(那是旧写法盖住真相的第二只手)。集合清空即计数归零;
    // 占位格一并还掉,否则 shutdown 会把 drainQueue 的格子永久占住。
    // 迟到的 exit/error 事件此后只会对**已不在集合里**的条目做功 ⇒ 派生值不会被减成负数
    // (旧写法会:那正是"第二份真相"漏出来的形状)。
    this.reservedStarts.clear();
    this.publishActiveCountIfChanged();
  }

  // ───────────────────────── 内部实现 ─────────────────────────

  /**
   * G-654① 派生运行计数唯一计算口:**应计入并发的集合之和**。
   * 不缓存、不自增自减 —— 每次读都是对真相面的一次投影,所以"漏减/多减"在这一层无法表达。
   */
  private activeCountNow(): number {
    return this.workers.size + this.reservedStarts.size;
  }

  /**
   * G-654① 计数发射唯一出口,判据只有一条:**算出来的值与上次发布值相同 ⇒ 什么都不发**
   * (不发事件、不回调、不重复通知)。调用次数不等于发射次数 —— 同一个值上重复结算
   * (迟到的 exit、重复的 shutdown、幂等的占位归还)必须问不出第二声。
   */
  private publishActiveCountIfChanged(): void {
    const next = this.activeCountNow();
    if (next === this.lastPublishedActiveCount) return;
    const prev = this.lastPublishedActiveCount;
    this.lastPublishedActiveCount = next;
    // 迭代副本:回调体内可能撤销自己(与 background-registry 的投递同一条纪律)
    for (const listener of [...this.activeCountListeners]) listener(next, prev);
  }

  /** 只读观测面:当前派生运行计数(running 集合 + 已占位尚未登记的启动格)。 */
  activeWorkerCount(): number {
    return this.activeCountNow();
  }

  /**
   * G-654① 计数变化观测点(可选注册,默认无人注册 ⇒ 不产生任何输出)。
   * 返回撤销函数。回调只在派生值**发生变化**时被调用。
   */
  onActiveCountChange(listener: (next: number, prev: number) => void): () => void {
    this.activeCountListeners.add(listener);
    return () => {
      this.activeCountListeners.delete(listener);
    };
  }

  /**
   * 归还 drainQueue 的启动占位格(两条路径:早退未起进程、正常交接给 `workers`)。
   * 归还即可能为 drainQueue 让出一格 ⇒ 随后调用方自己负责重扫(与旧写法一致)。
   */
  private releaseReservedStart(slot: string): void {
    this.reservedStarts.delete(slot);
    this.publishActiveCountIfChanged();
  }

  private async drainQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeCountNow() < this.config.maxWorkers && !this.shutDown) {
      const item = this.queue.shift()!;
      // 旧写法这一格是 `this.activeCount++`;现是一枚占位 token —— 性质相同(先占格再启动),
      // 但归还得走集合(早退路径 releaseReservedStart / 正常路径交接给 workers),不会漏。
      const slot = `slot_${this.nextReservedSlot++}`;
      this.reservedStarts.add(slot);
      this.publishActiveCountIfChanged();
      this.startWorker(item.req, item.resolve, slot);
    }
  }

  private startWorker(
    req: SubagentSpawnRequest,
    resolve: (r: SubagentSpawnResponse) => void,
    slot: string,
  ): void {
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
        this.releaseReservedStart(slot);
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
        this.releaseReservedStart(slot);
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
    const proc = this.forkImpl(this.entryPath, [], forkOptions);

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
      terminationKindLocked: false,
    };
    this.workers.set(subagentId, entry);
    // 交接:条目进了 `workers`(计数真相面之一),占位格立刻还掉 —— 两格之和在这一拍不变,
    // 所以并发上界既不松也不紧(派生值与旧计数器同值),发射台账也听不见这一拍(值没变 ⇒ 不发)。
    // **顺序即判据:必须先入集合、再还占位。** 反过来会让 publish 在中间读到一个假 0,
    // 于是"1→0"被这一拍提前消耗,真那次结算反而哑掉 —— 发射台账就此与真相面脱钩。
    this.releaseReservedStart(slot);

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
    // 若不在此补清理,条目会永久留在 workers 里占位 → drainQueue 条件(派生计数 < maxWorkers)
    // 永远少一格 → worker 池容量逐次缩减至 0。
    // G-654① 换了计数口径,**这条清理照样一句不能少**:计数由集合派生只是让"忘了 --"不再可能,
    // "忘了从集合里摘掉"仍然是同一格泄漏 —— 真相面漏了,投影跟着漏。
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
      // G-654①:摘出集合就是减一格(旧写法这里 ++/-- 一只管自己,现在没有那只手了)。
      this.publishActiveCountIfChanged();
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

    // 超时定时器(G-426:无活动空闲窗 + 绝对上限,装配与重排唯一入口在 armTaskTimeout)
    this.armTaskTimeout(subagentId, entry, timeoutSec);

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
    // G-426:每次真实任务活动把 taskTimeout 空闲窗重排回完整窗口 —— 仍在推进的慢子代理
    // 不再被"墙钟到点"误杀(SIGTERM),真正卡死的才会在窗口耗尽时超时。重排只经这一条路:
    // 判"活动"与"重排"在同一处收口,不存在第二份记时。
    this.rearmTaskTimeout(entry.subagentId, entry);
  }

  /**
   * G-426:taskTimeout 装配唯一入口(spawn 时一次)。窗口 = timeoutSeconds × 1000;
   * 绝对上限 = start + 窗口 × TASK_TIMEOUT_ABSOLUTE_FACTOR,从开始计时、不随活动重排。
   */
  private armTaskTimeout(subagentId: string, entry: WorkerEntry, timeoutSec: number): void {
    const windowMs = timeoutSec * 1000;
    entry.taskTimeoutWindowMs = windowMs;
    entry.taskDeadlineAt = Date.now() + windowMs * TASK_TIMEOUT_ABSOLUTE_FACTOR;
    this.rearmTaskTimeout(subagentId, entry);
  }

  /**
   * G-426:空闲窗重排唯一实现。剩余时间 = min(完整窗口, 距绝对上限的余额):
   * 活动只把"空闲"这一维清零,"总时长"这一维永远在走。remaining ≤ 0 ⇒ 绝对上限到点,
   * 即使仍有活动也按 absolute 归因收口(防无限续命)。
   */
  private rearmTaskTimeout(subagentId: string, entry: WorkerEntry): void {
    if (entry.taskTimeoutWindowMs === undefined || entry.taskDeadlineAt === undefined) return;
    if (entry.timedOut) return; // 已按超时收口(SIGTERM 宽限期内残余事件不得把归因翻回来)
    if (entry.timeoutTimer) clearTimeout(entry.timeoutTimer);
    const remaining = Math.min(entry.taskTimeoutWindowMs, entry.taskDeadlineAt - Date.now());
    if (remaining <= 0) {
      this.handleTimeout(subagentId, entry, 'absolute');
      return;
    }
    // 归因跟随**约束方**:剩余时间被绝对上限压短(≤ 完整窗口)⇒ 这枚定时器到点就是总时长到头,
    // 归因 absolute;否则是空闲窗自然耗尽,归因 idle。混用会让"持续活动被上限收口"谎报成空闲。
    const reason: 'idle' | 'absolute' =
      entry.taskDeadlineAt - Date.now() <= entry.taskTimeoutWindowMs ? 'absolute' : 'idle';
    entry.timeoutTimer = setTimeout(() => {
      this.handleTimeout(subagentId, entry, reason);
    }, remaining);
  }

  /**
   * G-998115 归因唯一写入点:首因锁定 —— 首次 cleanup 的原因不可被后续幂等回收改写。
   * (上游 zcodeAgentProcessManager:672-687 同判据:重复 cleanup 不得把
   * watchdog_recycle 洗成 expected。)
   */
  private setTerminationKind(w: WorkerEntry, kind: TerminationKind): void {
    if (w.terminationKindLocked) return;
    w.terminationKind = kind;
    w.terminationKindLocked = true;
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
    this.detachToBackground(subagentId, entry, 'idle');
  }

  /**
   * checkIdleTimeout / handleTimeout('absolute') 共用的迁移动作(单独成函数:测试与人工
   * 核验都能对同一份实现问责)。cause 只影响报名行的归因细节,状态迁移两路完全同形:
   * lifecycle → detached_idle、spawn Promise 以 'running' 提前 resolve、进程不杀。
   */
  private detachToBackground(
    subagentId: string,
    entry: WorkerEntry,
    cause: 'idle' | 'absolute-cap',
  ): void {
    entry.idleDetached = true;
    entry.lifecycle = SUBAGENT_STATUS_DETACHED_IDLE;
    // 报名行刻意 ASCII(守门 70 棘轮:本文件中文行只减不增;机器码 SUBAGENT_DETACH_REASON 之外
    // 的归因细节是给日志筛读的,ASCII 足够)。
    const detail =
      cause === 'idle'
        ? `no task event for ${this.idleTimeoutMs}ms`
        : `absolute cap reached despite activity (window=${entry.taskTimeoutWindowMs}ms x${TASK_TIMEOUT_ABSOLUTE_FACTOR})`;
    process.stderr.write(
      `[subagent ${subagentId}] ${SUBAGENT_DETACH_REASON}: ${detail};` +
        ` detached to background (process NOT killed, awaitResult returns the final state)\n`,
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
    if (entry.state.status === 'dead') return; // G-998112:残留确认只做一轮,不做每 5s 重复派发
    if (Date.now() - entry.lastHeartbeatAt > this.heartbeatTimeoutMs) {
      entry.state.status = 'dead';
      // G-998115:watchdog 回收 ⇒ 先写归因(首因锁定),再发信号
      this.setTerminationKind(entry, 'watchdog_recycle');
      // G-998112:发信号后必须有界等待 exit;pid 没真的退 ⇒ 记 residualPid(账面不得只写 dead)
      void this.signalWorker(entry, 'SIGKILL', 'heartbeat-watchdog');
    }
  }

  /**
   * 超时处理:SIGTERM 子进程,resolve failed。
   * G-426:两档归因 —— `idle` = 空闲窗内没有任何真实任务活动(真正卡死);
   * `absolute` = 总时长越过窗口 × TASK_TIMEOUT_ABSOLUTE_FACTOR(持续活动也到头了)。
   * 错误 context 按票面口径带 idleMs 与 recoverable/retryable 标记(ASCII,消费方是模型)。
   *
   * G-426 拍板第三件套「超阈值自动后台化 detachParent」:`absolute` 到点不再 SIGTERM ——
   * 能活到总上限的执行必然一路有真实活动把空闲窗重排到底(真正卡死的死法是 `idle` 那一档,
   * 且更早的无活动转后台(120s)通常已先发生),所以该被收口的是"前台等待"而不是任务本身:
   * 走与无活动转后台同一迁移出口(detachToBackground),spawn Promise 以 wire 既有档位
   * 'running' 提前 resolve,进程不杀,跑到自然终态经 awaitResult 回收。已转后台的条目
   * (idleDetached)到点一律幂等返回:上限已消费,不再重排也不再杀 —— 前台取消不再杀它。
   */
  private handleTimeout(subagentId: string, entry: WorkerEntry, reason: 'idle' | 'absolute'): void {
    if (reason === 'absolute') {
      if (!entry.idleDetached) {
        this.detachToBackground(subagentId, entry, 'absolute-cap');
      }
      // 不设 timedOut:转后台 ≠ 失败,自然 exit(0) 仍按 completed 收口(handleWorkerExit)。
      return;
    }
    entry.timedOut = true;
    // G-998115:超时属宿主 watchdog 回收 ⇒ 先写归因(首因锁定),再发信号
    this.setTerminationKind(entry, 'watchdog_recycle');
    // G-998112:有界等待 exit;超预算 ⇒ 记 residualPid + 终态 failed + 结构化原因
    void this.signalWorker(entry, 'SIGTERM', 'task-timeout');
    // exit handler 会 resolve;但以防 exit 不触发,这里也 resolve 一次(幂等)
    if (entry.resolver) {
      const now = Date.now();
      const idleMs = now - (entry.lastActivityAt ?? entry.startedAt);
      const totalMs = now - entry.startedAt;
      const windowMs = entry.taskTimeoutWindowMs;
      const shared =
        ` (idleMs=${idleMs}, totalMs=${totalMs}, recoverable=true, retryable=false; ` +
        `every stdout/stderr/progress event rearms the idle window)`;
      const error =
        reason === 'idle'
          ? `timeout: no task activity for the whole ${windowMs}ms idle window${shared}`
          : `timeout: absolute cap reached after ${totalMs}ms despite activity (cap = 3x idle window ${windowMs}ms)${shared}`;
      const resp: SubagentSpawnResponse = {
        subagentId,
        pid: entry.proc.pid ?? 0,
        status: 'failed',
        error,
        durationMs: totalMs,
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
    // G-998115(b76-08a):退出归因 —— host 主动回收写过 terminationKind;没有 ⇒ unexpected
    // (判据不接受"非零 code 即异常":signal crash 与 agent 自行 exit 0 都是非预期)。
    const terminationKind: TerminationKind = entry.terminationKind ?? 'unexpected';
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

    // G-998115:归因 unexpected ⇒ stderr tail 升为 error 级日志(先脱敏再限长,
    // waitForStderrDrain 等价:等 stderr 流尽再采);expected/watchdog_recycle 不升。
    if (terminationKind === 'unexpected') {
      this.emitUnexpectedExitLog(subagentId, code, signal, entry);
    }

    // 解析 stdout NDJSON 提取结果
    const parsed = parseWorkerStdout(entry.stdoutBuf);
    // b76-04 票3(下游判定侧):回灌 output 超 cap ⇒ 结构化拒绝点名恢复动作,不交半截结果
    const outputBytes = Buffer.byteLength(parsed.assistantText, 'utf8');
    const outputOverCap = outputBytes > WORKER_RESULT_CAPS.resultOutputMaxBytes.cap;
    // b76-04 票3(审计侧):error/stderr 尾巴有界化 + truncated 标记(不许静默夹半截)
    const output = outputOverCap ? undefined : parsed.assistantText || boundedTail(entry.stderrBuf, WORKER_RESULT_CAPS.errorTailMaxChars.cap) || undefined;

    // 生命周期终态落档:'running' / 'detached_idle' 都只在此处收口为 completed/failed。
    // 已转后台的条目 spawn Promise 早以 'running' resolve 过,真终态只走
    // detachedFinalResults + finalResolvers(= awaitResult 的出口),不冒充、不丢失。
    entry.lifecycle = outputOverCap || isFailed ? 'failed' : 'completed';
    const resp: SubagentSpawnResponse = {
      subagentId,
      pid: entry.proc.pid ?? 0,
      status: outputOverCap || isFailed ? 'failed' : 'completed',
      output,
      error: outputOverCap
        ? `结果超上限(${outputBytes} 字节 > cap ${WORKER_RESULT_CAPS.resultOutputMaxBytes.cap});` +
          `恢复动作:缩小任务范围或拆分子任务后重跑,不要要求本池静默截断结果`
        : isFailed
        ? (isTimeout
            ? `timeout (exit code ${code})`
            : isOOM
              ? `[OOM] worker self-OOM exit, stdout tail: ${boundedTail(entry.stdoutBuf, WORKER_RESULT_CAPS.errorTailMaxChars.cap)}`
              : isCpuLimit
                ? `[CPU_LIMIT] worker CPU limit exit, stdout tail: ${boundedTail(entry.stdoutBuf, WORKER_RESULT_CAPS.errorTailMaxChars.cap)}`
                : (boundedTail(entry.stderrBuf, WORKER_RESULT_CAPS.errorTailMaxChars.cap) || `exit code ${code} signal ${signal}`))
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
    // G-654① 结算:条目出集合 ⇒ 派生计数自然减一格;值真的变了才发一次通知(没变 ⇒ 一声不出)。
    this.publishActiveCountIfChanged();
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
 * G-998112:残留路径的账面落点 —— 状态写 dead、生命周期落 failed(若未终态)。
 * failedCount 不在此处增:exit 事件仍是唯一计数收口点(见 handleWorkerExit :691 守卫)。
 */
function entryStateFailed(w: WorkerEntry): void {
  w.state.status = 'dead';
  if (!isSubagentTerminalStatus(w.lifecycle)) w.lifecycle = 'failed';
}

/**
 * b76-04 票3(审计侧):有界尾巴 —— 先脱敏、再限长 + truncated 标记,"宁可诚实地说被截了"。
 * 只用于事后审计的诊断尾巴;喂给下游判定的数据不走这里(走 WORKER_RESULT_CAPS 拒绝)。
 */
function boundedTail(text: string, cap: number): string {
  const trimmed = redactDiagnosticText(text).trim();
  if (trimmed.length <= cap) return trimmed;
  return `${trimmed.slice(-cap)}…[truncated:true 原长 ${trimmed.length}]`;
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
/** kill 信号发出证据(G-998112):回答"kill 发出否"。 */
export interface WorkerKillEvidence {
  signal: NodeJS.Signals;
  pid: number;
  /** kill() 是否成功发出(返回 true 且未抛错)。 */
  sent: boolean;
  /** 发出失败时的错误信息(含返回 false 与抛错两型)。 */
  error?: string;
}

/** 进程退出证据(G-998112):回答"进程真退否 + exit code/signal"。 */
export interface WorkerExitEvidence {
  pid: number;
  /** OS 是否确认进程已退(exit 事件 code/signal 非空,或存活探针确认已不在)。 */
  exited: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  /** 存活探针结果(true=仍在,false=已不在,null=未探/未知)。 */
  alive: boolean | null;
  /** 发出过的 kill 证据(按序)。 */
  kills: WorkerKillEvidence[];
}

/** 退出归因(G-998112):有 OS 证据才定终态,无证据记未判定并报名。 */
export type WorkerExitAttribution =
  | { kind: 'decided'; terminal: 'failed' | 'completed'; evidence: WorkerExitEvidence; reason: string }
  | { kind: 'undetermined'; reason: string; evidence: WorkerExitEvidence };

/** attemptKillSignal / probeWorkerLiveness 的最小 proc 面(ChildProcess 满足;单测用假对象)。 */
export interface KillableProcLike {
  pid?: number;
  exitCode?: number | null;
  signalCode?: NodeJS.Signals | null;
  kill(signal: NodeJS.Signals | 0): boolean;
}

/**
 * 发出 kill 信号并记录证据(G-998112)。
 * 永不抛错、永不静默:发出否 + 抛错信息都在返回值里,调用方必须用
 * formatKillEvidenceReport 报名。调用点不得再静默吞错。
 * (exit 收口见各调用点下方的 once exit 等待;残留进程的退出证据由 exit 事件收口。)
 */
export function attemptKillSignal(
  proc: KillableProcLike,
  signal: NodeJS.Signals,
  pidFallback = 0,
): WorkerKillEvidence {
  const pid = proc.pid ?? pidFallback;
  try {
    // exit 证据由调用点收口(residual 残留进程见 exit 事件);此处只记 kill 发出结果。
    const sent = proc.kill(signal);
    if (sent) return { signal, pid, sent: true };
    return { signal, pid, sent: false, error: 'kill returned false (signal not delivered)' };
  } catch (err) {
    return { signal, pid, sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 存活探针(G-998112):回答"进程还活着否",供退出归因当 OS 证据。
 * 顺序:先读 exitCode / signalCode 快照(有值 ⇒ 已退,不发信号);
 * 否则发 0 信号探针(ESRCH ⇒ 已不在;EPERM/EACCES ⇒ 仍在;其他/未知 ⇒ null 未判定)。
 * 永不抛错;探针信号 0 无副作用。
 * (残留判断见调用方的 exit 事件收口,本探针只回答当下是否仍在。)
 */
export function probeWorkerLiveness(proc: KillableProcLike): boolean | null {
  try {
    if (proc.exitCode !== null && proc.exitCode !== undefined) return false;
    if (proc.signalCode !== null && proc.signalCode !== undefined) return false;
    try {
      const reachable = proc.kill(0);
      return reachable ? true : false;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException | null)?.code;
      if (code === 'ESRCH') return false;
      if (code === 'EPERM' || code === 'EACCES') return true;
      return null;
    }
  } catch {
    return null;
  }
}

/** shouldMarkDeadAfterKill 的输入(OS 证据快照)。 */
export interface DeadGateInput {
  exitCode?: number | null;
  signalCode?: NodeJS.Signals | null;
  /** 存活探针结果(true=仍在,false=已不在,null=未探/未知)。 */
  alive: boolean | null;
}

/**
 * 记账门(G-998112,纯函数):有 OS 证据才记 dead,仍存活/未知时记未判定。
 * - exit code/signal 非空 ⇒ 已退 ⇒ 可记 dead;
 * - 探针确认已不在 ⇒ 可记 dead;
 * - 探针确认仍在 ⇒ 不记 dead(未判定并报名,调用方必须报);
 * - 未探/未知 ⇒ 不记 dead(宁可报名,不把"没判"写成"已判")。
 * 调度语义不在这里,checkHeartbeat 用它做门;exit 事件收口不受此门影响。
 */
export function shouldMarkDeadAfterKill(input: DeadGateInput): { markDead: boolean; reason: string } {
  const { exitCode = null, signalCode = null, alive } = input;
  if (exitCode !== null || signalCode !== null) {
    return { markDead: true, reason: `exit evidence: exitCode=${exitCode} signal=${signalCode}` };
  }
  if (alive === false) {
    return { markDead: true, reason: 'liveness probe confirms process gone (exit snapshot / kill ESRCH)' };
  }
  if (alive === true) {
    return { markDead: false, reason: 'undetermined: process still alive, no exit code/signal' };
  }
  return { markDead: false, reason: 'undetermined: no exit code/signal and liveness unknown' };
}

/** attributeWorkerExit 的输入(纯数据,单测直接喂)。 */
export interface AttributeWorkerExitInput {
  pid: number;
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  kills: WorkerKillEvidence[];
  /** 存活探针结果(true=仍在,false=已不在,null=未探/未知)。 */
  alive: boolean | null;
}

/**
 * 退出归因(G-998112,纯函数):有 OS 证据才定终态。
 * - exit code/signal 非空 ⇒ OS 证据成立 ⇒ 按既有终态语义定 failed/completed
 *   (timeout/OOM=3/CPU=4/signal ⇒ failed;其余非 0 ⇒ failed;0 ⇒ completed);
 * - 无 code/signal 但探针确认已不在 ⇒ 视为已退,终态 failed(无 0 码不得记 completed);
 * - 无 code/signal 且仍在 ⇒ 未判定(不记 dead/failed,调用方必须报名);
 * - 无 code/signal 且未知 ⇒ 超时任务维持原终态 failed(超时本身是任务失败理由,
 *   但如实记"无退出证据",不断言新证据);非超时 ⇒ 未判定。
 * (残留进程的最终收口仍是 exit 事件,本函数只做归因判定。)
 */
export function attributeWorkerExit(input: AttributeWorkerExitInput): WorkerExitAttribution {
  const { pid, code, signal, timedOut, kills, alive } = input;
  const isOOM = code === 3;
  const isCpuLimit = code === 4;
  if (code !== null || signal !== null) {
    const evidence: WorkerExitEvidence = { pid, exited: true, exitCode: code, signal, alive, kills };
    const isError = code !== 0 && code !== null && !isOOM && !isCpuLimit;
    const failed = timedOut || isError || isOOM || isCpuLimit || signal !== null;
    const reason = `exit evidence: code=${code} signal=${signal} timedOut=${timedOut} kills=${kills.length}`;
    return { kind: 'decided', terminal: failed ? 'failed' : 'completed', evidence, reason };
  }
  if (alive === true) {
    const evidence: WorkerExitEvidence = { pid, exited: false, exitCode: code, signal, alive, kills };
    return {
      kind: 'undetermined',
      reason: `undetermined: pid ${pid} still alive, no exit code/signal (kills=${kills.length})`,
      evidence,
    };
  }
  if (alive === false) {
    const evidence: WorkerExitEvidence = { pid, exited: true, exitCode: code, signal, alive, kills };
    return {
      kind: 'decided',
      terminal: 'failed',
      evidence,
      reason: `liveness confirms gone: pid ${pid} no exit code/signal timedOut=${timedOut} kills=${kills.length}`,
    };
  }
  const evidence: WorkerExitEvidence = { pid, exited: false, exitCode: code, signal, alive, kills };
  if (timedOut) {
    return {
      kind: 'decided',
      terminal: 'failed',
      evidence,
      reason: `timeout without OS exit evidence: pid ${pid} kills=${kills.length} (task failed by timeout, no exit claim)`,
    };
  }
  return {
    kind: 'undetermined',
    reason: `undetermined: pid ${pid} no exit code/signal, liveness unknown, not timed out (kills=${kills.length})`,
    evidence,
  };
}

/** kill 发出报名行(G-998112,纯函数;调用方负责写 stderr,不得静默)。 */
export function formatKillEvidenceReport(subagentId: string, evidence: WorkerKillEvidence): string {
  const outcome = evidence.sent ? 'sent' : `NOT sent${evidence.error ? `: ${evidence.error}` : ''}`;
  return `[subagent ${subagentId}] kill ${evidence.signal} pid=${evidence.pid} ${outcome}\n`;
}

/** 未判定报名行(G-998112,纯函数;调用方负责写 stderr,不得静默)。 */
export function formatUndeterminedReport(
  subagentId: string,
  detail: {
    pid: number;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    alive: boolean | null;
    kills: WorkerKillEvidence[];
  },
): string {
  const aliveText = detail.alive === true ? 'still alive' : detail.alive === false ? 'gone' : 'unknown liveness';
  return (
    `[subagent ${subagentId}] exit undetermined: pid=${detail.pid} ${aliveText} ` +
    `exitCode=${detail.exitCode} signal=${detail.signal} kills=${detail.kills.length} ` +
    `(no OS exit evidence, not marking dead)\n`
  );
}

/** 退出证据摘要(G-998112,纯函数;拼进 failed 响应的 error,不改终态词汇)。 */
export function formatExitEvidenceSuffix(evidence: WorkerExitEvidence): string {
  const kills = evidence.kills.map((k) => `${k.signal}:${k.sent ? 'sent' : 'NOT sent'}`).join(',');
  return `killEvidence=[${kills}] exitCode=${evidence.exitCode} signal=${evidence.signal} exited=${evidence.exited}`;
}

// ==================== 默认配置 ====================

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
