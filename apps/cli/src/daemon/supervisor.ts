// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-01 反向守护拓扑 —— 独立 daemon supervisor + IPC 请求-应答握手状态机。
 *
 * 对照 WorkBuddy 5.11.3 的 daemon-supervisor（取证见
 * docs/benchmark-evidence/2026-11/deep-native-2026-11-23/block4-workbuddy.md §B4-01）：
 * supervisor 以 detached + 隐藏窗口 + unref 拉起 daemon，**绝不加入 worker 的 Job**；
 * 经独立 IPC 通道按请求 id 配对握手（发 start → 等 started 且 id 一致才算成功）；
 * 超时或通道断开 = 显式失败，绝不冒成功；名下无存活 worker 且父通道断开即自退
 * （一次性交接语义，不常驻空转）；命令形态 / 会话类型不符 ⇒ 拒绝并给具名原因。
 *
 * 与 `../util/parent-bound.ts` 的方向正好相反，两条路径必须共存且各有测试：
 *   - parent-bound = 正向「父死子随死」看门狗（父崩 ⇒ 回收子树）；
 *   - 本模块 = 反向「守护者脱离父组看护 daemon」（supervisor 不随父进程死亡，也不进 worker Job）。
 *
 * 分层：准入 / 握手状态机 / 交接判据 / worker 集合追踪全是纯判据（注入假 IPC 通道 + 假时钟，
 * 零真实副作用）；`spawnDetachedSupervisor` 是唯一有 spawn 副作用的薄 runner。
 * 本模块不接现有命令链的缺省路径（零缺省行为变化），入口待后续命令层显式接线。
 */

import { spawn, type SpawnOptions } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  canImportTsx,
  planSelfRunner,
  stripTypesSupported,
} from '../util/run-mode.js'

export const SESSION_KIND_ENV = 'IHUI_SESSION_KIND'
export const DAEMON_SESSION_KIND = 'daemon'
export const SERVE_FLAG = '--serve'
export const DEFAULT_HANDSHAKE_TIMEOUT_MS = 60_000
export const SUPERVISOR_RUNNER_FLAG = '--ihui-daemon-supervisor'

// ---------------------------------------------------------------------------
// 准入判据
// ---------------------------------------------------------------------------

export type AdmissionReason =
  | 'session-kind-unmeasured'
  | 'session-kind-mismatch'
  | 'command-form-invalid'

export type AdmissionDecision = { admitted: true } | { admitted: false; reason: AdmissionReason }

/**
 * worker 准入：会话类型必须是 daemon，命令形态必须带 `--serve`。
 * 会话类型取不到（null）⇒ unjudged 拒绝，不猜成 daemon。
 */
export function admitWorkerCommand(input: {
  argv: readonly string[]
  sessionKind: string | null
}): AdmissionDecision {
  if (input.sessionKind === null) return { admitted: false, reason: 'session-kind-unmeasured' }
  if (input.sessionKind !== DAEMON_SESSION_KIND) {
    return { admitted: false, reason: 'session-kind-mismatch' }
  }
  if (!input.argv.includes(SERVE_FLAG)) return { admitted: false, reason: 'command-form-invalid' }
  return { admitted: true }
}

/** 从 env 读会话类型；空串 / 缺失 ⇒ null（未判定）。 */
export function sessionKindFromEnv(env: NodeJS.ProcessEnv): string | null {
  const raw = env[SESSION_KIND_ENV]
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

// ---------------------------------------------------------------------------
// IPC 通道契约（注入点：测试喂假通道，判据层不碰 process.channel）
// ---------------------------------------------------------------------------

export interface SupervisorStartRequest {
  readonly id: string
  readonly argv: readonly string[]
  readonly sessionKind: string
}

export type SupervisorOutboundMessage =
  | { readonly type: 'start'; readonly id: string; readonly argv: readonly string[]; readonly sessionKind: string }
  | { readonly type: 'handed-off'; readonly id: string }

export type SupervisorInboundMessage =
  | { readonly type: 'started'; readonly id: string }
  | { readonly type: 'start-failed'; readonly id: string; readonly reason: string }

export interface SupervisorChannel {
  send(message: SupervisorOutboundMessage): void
  onMessage(handler: (msg: SupervisorInboundMessage) => void): void
  onDisconnect(handler: () => void): void
}

// ---------------------------------------------------------------------------
// 握手状态机（纯判据：通道与时钟全部注入）
// ---------------------------------------------------------------------------

export type HandshakeStatus =
  | 'idle'
  | 'pending'
  | 'started'
  | 'timed-out'
  | 'disconnected'
  | 'failed'
  | 'refused'

export interface HandshakeState {
  readonly status: HandshakeStatus
  readonly requestId: string | null
  readonly reason: string | null
  readonly startedAtMs: number | null
}

export interface HandshakeDeps {
  readonly channel: SupervisorChannel
  readonly nowMs: () => number
  readonly timeoutMs: number
}

const IDLE_STATE: HandshakeState = { status: 'idle', requestId: null, reason: null, startedAtMs: null }

/**
 * 请求-应答配对握手机。
 * 状态迁移：idle —requestStart(准入过)—> pending —started 同 id—> started；
 * pending —超时/断开/start-failed—> 对应终态失败；准入不过 ⇒ refused（不发消息）。
 * id 不配对的 started 一律忽略，不成交；终态后再收到消息不改判。
 */
export class DaemonSupervisorHandshake {
  private state: HandshakeState = IDLE_STATE

  constructor(private readonly deps: HandshakeDeps) {
    deps.channel.onMessage((msg) => this.handleMessage(msg))
    deps.channel.onDisconnect(() => this.handleDisconnect())
  }  /** 发起拉起：先准入，过了才向通道发 start 并进入 pending；拒绝时不发任何消息。 */
  requestStart(input: SupervisorStartRequest): HandshakeState {
    const admission = admitWorkerCommand({ argv: input.argv, sessionKind: input.sessionKind })
    if (!admission.admitted) {
      this.state = { status: 'refused', requestId: input.id, reason: admission.reason, startedAtMs: null }
      return this.snapshot()
    }
    this.deps.channel.send({
      type: 'start',
      id: input.id,
      argv: input.argv,
      sessionKind: input.sessionKind,
    })
    this.state = {
      status: 'pending',
      requestId: input.id,
      reason: null,
      startedAtMs: this.deps.nowMs(),
    }
    return this.snapshot()
  }

  /** 时钟步进：pending 超过 timeoutMs ⇒ timed-out；其余状态不动。 */
  tick(): HandshakeState {
    if (this.state.status !== 'pending' || this.state.startedAtMs === null) return this.snapshot()
    if (this.deps.nowMs() - this.state.startedAtMs >= this.deps.timeoutMs) {
      this.state = { ...this.state, status: 'timed-out', reason: 'handshake-timeout' }
    }
    return this.snapshot()
  }

  snapshot(): HandshakeState {
    return { ...this.state }
  }

  private handleMessage(msg: SupervisorInboundMessage): void {
    if (this.state.status !== 'pending') return
    if (msg.id !== this.state.requestId) return // id 不配对：忽略，不成交
    if (msg.type === 'started') {
      this.state = { status: 'started', requestId: msg.id, reason: null, startedAtMs: this.state.startedAtMs }
      return
    }
    this.state = {
      status: 'failed',
      requestId: msg.id,
      reason: msg.reason,
      startedAtMs: this.state.startedAtMs,
    }
  }

  private handleDisconnect(): void {
    // 等待期通道断开 = 显式失败；已 started 之后的断开交交接判据，不在握手层改判。
    if (this.state.status === 'pending') {
      this.state = { ...this.state, status: 'disconnected', reason: 'channel-disconnected' }
    }
  }
}

// ---------------------------------------------------------------------------
// 交接判据 + worker 集合追踪
// ---------------------------------------------------------------------------

export type HandoffVerdict = 'stay' | 'exit' | 'unjudged'

/**
 * 一次性交接自退判据：名下无存活 worker 且父通道已断开 ⇒ exit；
 * 任一维观测取不到 ⇒ unjudged（不冒自退，也不冒常驻）。
 */
export function decideSupervisorSelfExit(input: {
  workerCount: number | null
  parentDisconnected: boolean | null
}): HandoffVerdict {
  if (input.workerCount === null || input.parentDisconnected === null) return 'unjudged'
  if (input.workerCount <= 0 && input.parentDisconnected) return 'exit'
  return 'stay'
}

/** 名下 worker pid 集合（纯内存，零副作用）；交接判据只认 count。 */
export class WorkerTracker {
  private readonly pids = new Set<number>()

  add(pid: number): void {
    if (Number.isInteger(pid) && pid > 0) this.pids.add(pid)
  }

  remove(pid: number): void {
    this.pids.delete(pid)
  }

  count(): number {
    return this.pids.size
  }
}

/** 装配握手状态机的默认出口：时钟取 Date.now，超时取 DEFAULT_HANDSHAKE_TIMEOUT_MS；测试可覆盖。 */
export function createDaemonSupervisorHandshake(
  channel: SupervisorChannel,
  opts: { nowMs?: () => number; timeoutMs?: number } = {},
): DaemonSupervisorHandshake {
  return new DaemonSupervisorHandshake({
    channel,
    nowMs: opts.nowMs ?? (() => Date.now()),
    timeoutMs: opts.timeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS,
  })
}

// ---------------------------------------------------------------------------
// 薄 runner（唯一有 spawn 副作用的部分）
// ---------------------------------------------------------------------------

export interface SupervisorSpawnResult {
  readonly pid: number
}

/** 注入用 spawn 签名：返回值在 runner 内部收窄为 pid/unref/on 最小形；测试可喂任意假子进程。 */
export type SupervisorSpawnFn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => unknown

export interface SupervisorSpawnDeps {
  readonly spawn?: SupervisorSpawnFn
  readonly execPath?: string
  readonly entryPath?: string
  readonly runnerArgs?: readonly string[]
}

/**
 * 以 detached + 隐藏窗口 + unref 拉起 supervisor 自身 runner。
 * 结构上**不加入 worker 的 Job**：与 parent-bound 正向看门狗方向相反，这里只脱离父组、
 * 看护 daemon，不承担回收后代的职责。形态 / 加载器判据复用 run-mode 单源；plan 不成立
 * ⇒ 返回 null（显式降级，不冒充已拉起）。
 */
export function spawnDetachedSupervisor(deps: SupervisorSpawnDeps = {}): SupervisorSpawnResult | null {
  const execPath = deps.execPath ?? process.execPath
  let modulePath: string
  try {
    modulePath = deps.entryPath ?? fileURLToPath(import.meta.url)
  } catch {
    return null // 非 file: 形态（SEA 快照）⇒ 无法自举 runner
  }
  const plan = planSelfRunner({
    execPath,
    entryPath: modulePath,
    runnerArgs: deps.runnerArgs ?? [SUPERVISOR_RUNNER_FLAG],
    loaderAvailable: canImportTsx(),
    stripTypesSupported: stripTypesSupported(process.versions.node),
  })
  if (!plan.ok) return null

  const spawnFn = deps.spawn ?? (spawn as unknown as SupervisorSpawnFn)
  const options: SpawnOptions = {
    detached: true,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  }
  try {
    const runner = spawnFn(plan.command, plan.args, options) as {
      pid?: number
      unref(): void
      on(event: string, listener: (...args: unknown[]) => void): unknown
    }
    runner.on('error', () => {
      // 异步 spawn 失败（ENOENT / EPERM 等）⇒ 静默降级；主线无感知，不冒充成功。
    })
    runner.unref()
    if (typeof runner.pid !== 'number') return null
    return { pid: runner.pid }
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
