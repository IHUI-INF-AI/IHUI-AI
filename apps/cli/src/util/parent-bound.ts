// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * parent-bound —— 「父死子随死」看门狗(对照 WorkBuddy Win32 Job Object,取证见
 * docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/ 的 W1 §3④ / W2 §3 末条)。
 * 病灶:mcp-runtime 的 stdio 子进程只有**优雅断连**回收腿;CLI 被硬杀/崩溃时 MCP 树成为
 * 孤儿泄漏(端口/句柄/内存)。对方用 Job Object(KILL_ON_JOB_CLOSE)让内核兜底,Node 侧无
 * 等价原语 ⇒ 本模块用**脱离式看门狗进程**复现同一行为,三轴超越:① 判据纯函数化
 * (入库可测可 diff,对方藏原生层);② 看门狗自身有死亡机制(子先死即退 + maxLifetimeMs
 * 到点必退,对方靠 OS 无此概念);③ 观测不到 ⇒ 'unjudged' 绝不动手(§0.3,误杀风险消掉)。
 * 杀树判据零复制:一律 import spawn-isolated.js 的 killProcessTreeVerified(生前创建身份
 * 复核 + PID 复用防误认都住在那一份里,§0.6);本文件不出现 taskkill/kill(-pid) 第二份实现。
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { captureRootCreationIdentity, killProcessTreeVerified } from './spawn-isolated.js'

export type WatchdogVerdict = 'wait' | 'kill' | 'exit' | 'unjudged'

export interface WatchdogTickInput {
  /** true=父进程存活;false=已死;null=观测取不到(未判定)。 */
  parentAlive: boolean | null
  /** true=被看守的子进程存活;false=已死;null=观测取不到(未判定)。 */
  childAlive: boolean | null
  nowMs: number
  startedAtMs: number
  maxLifetimeMs: number
}

/**
 * 单轮裁决(纯判据:零 spawn/零信号/零 fs,形状由镜像测试锁死)。
 * 优先级:子已死 ⇒ 看门狗自退(不留僵尸看守);父死子活 ⇒ 回收树;
 * 双方都活且到达生命周期上限 ⇒ 自退(看门狗必须有死亡机制,AGENTS「工作队列必须有死亡机制」);
 * 观测缺失 ⇒ unjudged 绝不动手,但死亡机制不被观测缺失卡住 —— 超上限照样自退。
 * 注:父死+超上限时裁决为回收树,runner 完成回收后立即自退,死亡机制在 runner 层兑现。
 */
export function decideWatchdogTick(input: WatchdogTickInput): WatchdogVerdict {
  const { parentAlive, childAlive, nowMs, startedAtMs, maxLifetimeMs } = input
  const lifetimeReached = nowMs - startedAtMs >= maxLifetimeMs
  if (typeof parentAlive === 'boolean' && typeof childAlive === 'boolean') {
    if (!childAlive) return 'exit'
    if (!parentAlive) return 'kill'
    return lifetimeReached ? 'exit' : 'wait'
  }
  return lifetimeReached ? 'exit' : 'unjudged'
}

/** unjudged 时点名「是哪一维观测缺失」(§0.3:未判定必须可追责,不许含糊)。 */
export function unjudgedFieldsOf(input: WatchdogTickInput): Array<'parentAlive' | 'childAlive'> {
  const fields: Array<'parentAlive' | 'childAlive'> = []
  if (typeof input.parentAlive !== 'boolean') fields.push('parentAlive')
  if (typeof input.childAlive !== 'boolean') fields.push('childAlive')
  return fields
}

/**
 * `process.kill(pid, 0)` 语义观测:信号 0 不杀伤只探权。
 * ESRCH=进程不存在(死);EPERM=存在但无权(活 —— 把它读成死是本型判据最经典的反转错误);
 * 其余异常 ⇒ null(未判定,判据侧绝不猜)。
 */
export function observeProcessAlive(pid: number): boolean | null {
  if (!Number.isInteger(pid) || pid <= 0) return null
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false
    if (code === 'EPERM') return true
    return null
  }
}

export interface WatchdogStepDeps {
  observeParentAlive: () => boolean | null
  observeChildAlive: () => boolean | null
  /** 真正的回收动作(注入点:单测用 spy 断言「unjudged 绝不发起回收树动作」)。 */
  killTree: (childPid: number) => Promise<unknown>
  nowMs: () => number
}

export interface WatchdogRunConfig {
  childPid: number
  startedAtMs: number
  maxLifetimeMs: number
}

/** 观测 + 纯判据 + (仅 kill 档)执行 的组合步进;所有副作用都在 deps,判据本身零副作用。 */
export async function stepWatchdog(
  deps: WatchdogStepDeps,
  cfg: WatchdogRunConfig,
): Promise<WatchdogVerdict> {
  const verdict = decideWatchdogTick({
    parentAlive: deps.observeParentAlive(),
    childAlive: deps.observeChildAlive(),
    nowMs: deps.nowMs(),
    startedAtMs: cfg.startedAtMs,
    maxLifetimeMs: cfg.maxLifetimeMs,
  })
  if (verdict === 'kill') await deps.killTree(cfg.childPid)
  return verdict
}

// =============================================================================
// 以下为进程侧(有副作用)部分;decideWatchdogTick 之上保持纯。
// =============================================================================

const RUNNER_FLAG = '--ihui-parent-watchdog'
const DEFAULT_TICK_MS = 2_000
const MAX_LIFE_DEFAULT_MS = 24 * 60 * 60 * 1_000
const MIN_TICK_MS = 200
const MAX_TICK_MS = 60_000
const MAX_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000

export interface ParentWatchdogOptions {
  tickIntervalMs?: number
  maxLifetimeMs?: number
  label?: string
}

interface RunnerPayload {
  v: 1
  parentPid: number
  childPid: number
  /** 生前创建身份(spawn-isolated 单源的防误认凭据);采集失败 ⇒ null ⇒ fail-closed 不杀。 */
  identity: string | null
  startedAtMs: number
  tickIntervalMs: number
  maxLifetimeMs: number
  label: string
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(n)))
}

/**
 * 父侧入口:为已 spawn 的子进程拉起一个脱离式看门狗(自身模块的 runner 形态)。
 * 一切失败均折成 null(显式降级,不抛错不阻断连接主线):身份采不到 ⇒ 看门狗即使
 * 判到父死也只自退不杀(fail-closed,交身份复核那一环把关,绝不放行裸 PID 击杀)。
 */
export async function spawnParentWatchdog(
  child: ChildProcess,
  opts: ParentWatchdogOptions = {},
): Promise<{ pid: number } | null> {
  const childPid = child.pid
  if (typeof childPid !== 'number' || !Number.isInteger(childPid) || childPid <= 0) return null
  let modulePath: string
  try {
    modulePath = fileURLToPath(import.meta.url)
  } catch {
    return null // 非 file: 形态(如 SEA 快照)⇒ 无法自举 runner
  }
  if (!/\.(?:js|mjs|ts)$/i.test(modulePath)) return null
  const identity = await captureRootCreationIdentity(child).catch(() => null)
  const payload: RunnerPayload = {
    v: 1,
    parentPid: process.pid,
    childPid,
    identity,
    startedAtMs: Date.now(),
    tickIntervalMs: clamp(opts.tickIntervalMs ?? DEFAULT_TICK_MS, MIN_TICK_MS, MAX_TICK_MS),
    maxLifetimeMs: clamp(opts.maxLifetimeMs ?? MAX_LIFE_DEFAULT_MS, 1_000, MAX_LIFETIME_MS),
    label: typeof opts.label === 'string' ? opts.label.slice(0, 120) : 'parent-bound',
  }
  try {
    // §5b/§12g 派生纪律:detached(脱离父组,才配当父死的看守)+ stdio 显式 + windowsHide。
    const runner = spawn(process.execPath, [modulePath, RUNNER_FLAG, JSON.stringify(payload)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    runner.on('error', () => {
      // 异步 spawn 失败(dev TS 无加载器等形态)⇒ 静默降级;主线无感知
    })
    runner.unref()
    return typeof runner.pid === 'number' ? { pid: runner.pid } : null
  } catch {
    return null
  }
}

/**
 * 看守目标的最小观测形:killProcessTreeVerified 只读 pid/exitCode/signalCode 三键,且本调用点固定
 * 显式传 preMortemCreationIdentity(不查父侧 WeakMap)。看门狗结构上拿不到真实 ChildProcess ⇒ 以此形
 * 进入同一份判据:「子是否已死」先由 observeProcessAlive 裁决(子死 ⇒ 只自退不进杀档);「子死且 PID
 * 被复用」的窗口由该判据第④环(现测创建身份≠生前 ⇒ 目标集为空)拦住 —— 两道防线全住在 spawn-isolated,零复制。
 */
function observationTarget(pid: number): ChildProcess {
  return { pid, exitCode: null, signalCode: null } as unknown as ChildProcess
}

function parseRunnerPayload(raw: string): RunnerPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const p = parsed as Record<string, unknown>
  const numOk = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  if (p.v !== 1 || !numOk(p.parentPid) || !numOk(p.childPid) || !numOk(p.startedAtMs)) return null
  if (!numOk(p.tickIntervalMs) || !numOk(p.maxLifetimeMs)) return null
  if (typeof p.identity !== 'string' && p.identity !== null) return null
  if (typeof p.label !== 'string') return null
  return p as unknown as RunnerPayload
}

function sleep(ms: number): Promise<void> {
  // 计时器**不 unref**:看门狗的存活本身就靠它撑着(死亡机制见 maxLifetimeMs 档)
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** runner 主循环:每 tick 步进一次;kill/exit 为终态,unjudged/wait 继续看守。 */
export async function runWatchdogRunner(rawPayload: string): Promise<void> {
  const p = parseRunnerPayload(rawPayload)
  if (p === null) return
  const deps: WatchdogStepDeps = {
    observeParentAlive: () => observeProcessAlive(p.parentPid),
    observeChildAlive: () => observeProcessAlive(p.childPid),
    killTree: (pid) =>
      killProcessTreeVerified(observationTarget(pid), { preMortemCreationIdentity: p.identity }),
    nowMs: () => Date.now(),
  }
  for (;;) {
    await sleep(p.tickIntervalMs)
    const verdict = await stepWatchdog(deps, {
      childPid: p.childPid,
      startedAtMs: p.startedAtMs,
      maxLifetimeMs: p.maxLifetimeMs,
    })
    if (verdict === 'kill' || verdict === 'exit') return
  }
}

// §22d isDirectRun:仅被当 runner 直接执行才进主循环;被 import(测试/父进程)零副作用。异常退出不补杀(失败方向=保守,绝不冒进误杀)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun && process.argv[2] === RUNNER_FLAG) {
  runWatchdogRunner(process.argv[3] ?? '').then(
    () => process.exit(0),
    () => process.exit(2),
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
