// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体宿主侧接线：控制面单例、事件源端口注册表、Watchdog 节拍循环。
 *
 * 单一真相源纪律：工单/授权/租约判据全在 @ihui/shared/super-agent，本层零复算，
 * 只做「端口持有 + 定时器装配 + 派发到既有 subagentDispatchService」三件事。
 * 归属主体随派单载荷（WorkerAssignment.ownerUserId）下传，不建第二份索引。
 */
import { z } from 'zod'
import {
  SuperAgentHost,
  SuperAgentPump,
  type TriggerSourcePort,
  type WorkerAssignment,
} from '@ihui/shared/super-agent'
import {
  USER_PREFERENCE_GROUPS,
  findUserPreferences,
  upsertUserPreference,
} from '../db/user-preferences-queries.js'
import { logger } from '../utils/logger.js'
import { subagentDispatchService } from './subagent-dispatch-service.js'

const SUPER_AGENT_SNAPSHOT_KEY = 'state'
/** 快照归属的保留主体 uuid；机主供值前持久腿如实降级（不谎称已持久）。 */
function snapshotProvider(): string | null {
  const v = (process.env.IHUI_SUPER_AGENT_STATE_ACCOUNT ?? '').trim()
  return v.length > 0 ? v : null
}

type PersistStatus = 'unconfigured' | 'ok' | 'degraded'

let dirty = false
let lastPersistError: string | null = null
let persistStatus: PersistStatus = 'unconfigured'
let saveChain: Promise<void> = Promise.resolve()
let savedTakenAt = -1

/** host 构造位回调:声明提升让 onDirty 能引用后面初始化的 saveIfDirty。 */
function markSuperAgentDirty(): void {
  dirty = true
}

export const superAgentHost = new SuperAgentHost(undefined, undefined, {
  onDirty: markSuperAgentDirty,
})

async function doSave(): Promise<void> {
  const provider = snapshotProvider()
  if (!provider) {
    persistStatus = 'unconfigured'
    return
  }
  const snap = superAgentHost.snapshot()
  // 与已存快照同 takenAt(默认时钟即 Date.now)⇒ 无新内容，不写。
  if (snap.takenAt <= savedTakenAt) return
  await upsertUserPermissionSnapshot(provider, snap)
  savedTakenAt = snap.takenAt
  persistStatus = 'ok'
  lastPersistError = null
}

/** 串行写链：脏则写，失败点名并把状态挂出来（不得静默）。 */
function saveIfDirty(): void {
  if (!dirty) return
  dirty = false
  saveChain = saveChain
    .then(doSave)
    .then(() => saveIfDirty())
    .catch((e: unknown) => {
      lastPersistError = e instanceof Error ? e.message : String(e)
      persistStatus = 'degraded'
      logger.warn(
        { err: lastPersistError },
        'super-agent 快照持久失败；账面仍在内存，供值/修库后自动恢复写入',
      )
    })
}

async function upsertUserPermissionSnapshot(provider: string, snap: unknown): Promise<void> {
  await upsertUserPreference(
    provider,
    USER_PREFERENCE_GROUPS.superAgent,
    SUPER_AGENT_SNAPSHOT_KEY,
    JSON.stringify(snap),
  )
}

export interface LoadSnapshotResult {
  loaded: boolean
  status: PersistStatus
  rejectedReasons: string[]
  error?: string
}

/** 进程内一次:读回快照灌账面。版本/形状不匹配 ⇒ host 整场拒绝并点名。 */
export async function loadSuperAgentSnapshotOnce(): Promise<LoadSnapshotResult> {
  const provider = snapshotProvider()
  if (!provider) return { loaded: false, status: 'unconfigured', rejectedReasons: [] }
  try {
    const { list } = await findUserPreferences(provider, USER_PREFERENCE_GROUPS.superAgent)
    const row = list.find((r) => r.key === SUPER_AGENT_SNAPSHOT_KEY)
    if (!row?.value) return { loaded: false, status: 'ok', rejectedReasons: [] }
    const parsed = JSON.parse(row.value) as Parameters<typeof superAgentHost.restore>[0]
    const report = superAgentHost.restore(parsed)
    if (!report.ok) {
      persistStatus = 'degraded'
      lastPersistError = 'restore-rejected'
      return {
        loaded: false,
        status: persistStatus,
        rejectedReasons: report.rejected.map(
          (r) => `${r.reason}${r.ownerUserId ? `:${r.ownerUserId}` : ''}`,
        ),
      }
    }
    savedTakenAt = parsed.takenAt ?? 0
    persistStatus = 'ok'
    lastPersistError = null
    dirty = false
    return {
      loaded: true,
      status: 'ok',
      rejectedReasons: report.rejected.map(
        (r) => `${r.reason}${r.ownerUserId ? `:${r.ownerUserId}` : ''}`,
      ),
    }
  } catch (e) {
    persistStatus = 'degraded'
    lastPersistError = e instanceof Error ? e.message : String(e)
    return { loaded: false, status: 'degraded', rejectedReasons: [], error: lastPersistError }
  }
}

/** 健康读数:供哨兵/面板判"持久腿到底通没通"（§0.3 不冒充）。 */
export function superAgentPersistHealth() {
  return {
    status: persistStatus,
    providerConfigured: snapshotProvider() !== null,
    dirty,
    lastPersistError,
  }
}

const ports = new Map<string, TriggerSourcePort>()

export function registerTriggerSourcePort(port: TriggerSourcePort): void {
  ports.set(port.sourceId, port)
}

export function unregisterTriggerSourcePort(sourceId: string): boolean {
  return ports.delete(sourceId)
}

export function listTriggerSourcePorts(): { sourceId: string; ownerUserId: string }[] {
  return [...ports.values()].map((port) => ({
    sourceId: port.sourceId,
    ownerUserId: port.ownerUserId,
  }))
}

const conversationIdSchema = z.string().uuid()

/** sessionId = `worker-<ticketId>`（roles.executionFor 的唯一形态）。 */
function ticketIdOfSession(sessionId: string): string {
  return sessionId.startsWith('worker-') ? sessionId.slice('worker-'.length) : sessionId
}

/**
 * 占槽工人的派发出口：conversationId 只在 threadId 是 uuid 时写入。
 * 失败经 deliveryFailed 归因入面板（路由层与泵共用这一条出口，不分叉）。
 */
export async function dispatchWorkerWork(work: WorkerAssignment): Promise<{
  ok: boolean
  dispatchId?: string
  error?: string
}> {
  const ownerUserId = work.ownerUserId
  if (!ownerUserId) return { ok: false, error: 'no_owner' }
  const ticket = superAgentHost.getTicket(ticketIdOfSession(work.sessionId), ownerUserId)
  const threadId = ticket?.threadId
  const conversationId = threadId ? conversationIdSchema.safeParse(threadId) : null
  try {
    const result = await subagentDispatchService.dispatch({
      goal: work.goal,
      affectedFiles: [],
      verifyCommands: [],
      constraints: work.constraints,
      deliverables: work.deliverables,
      agentRole: 'coder',
      ownerUserId,
      ...(conversationId?.success ? { conversationId: conversationId.data } : {}),
    })
    const outcome = (result as { outcome?: string }).outcome ?? 'ok'
    const out = {
      ok: outcome === 'ok',
      dispatchId: (result as { dispatch?: { id?: string } }).dispatch?.id,
      error: outcome === 'ok' ? undefined : ((result as { error?: string }).error ?? outcome),
    }
    if (!out.ok && ticket) {
      superAgentHost.deliveryFailed(ownerUserId, ticket.id, out.error ?? 'dispatch_failed')
    }
    return out
  } catch (e) {
    const error = e instanceof Error ? e.message : 'dispatch_failed'
    if (ticket) superAgentHost.deliveryFailed(ownerUserId, ticket.id, error)
    return { ok: false, error }
  }
}

/**
 * 路由与泵共用：把本轮新占槽的工人交给派单。
 * threadId 仅为兼容旧调用点保留；归属一律取载荷 ownerUserId，不从参数猜。
 */
export async function dispatchStartedWork(
  threadId?: string,
): Promise<{ sessionId: string; dispatchId?: string; error?: string }[]> {
  void threadId
  const dispatched: { sessionId: string; dispatchId?: string; error?: string }[] = []
  for (const work of superAgentHost.takeStarted()) {
    const r = await dispatchWorkerWork(work)
    dispatched.push({ sessionId: work.sessionId, dispatchId: r.dispatchId, error: r.error })
  }
  return dispatched
}

const pumpLog: { at: number; kind: string; source: string; note: string }[] = []
const PUMP_LOG_CAP = 200

function logPumpRow(row: { at: number; kind: string; source: string; note: string }): void {
  pumpLog.push(row)
  if (pumpLog.length > PUMP_LOG_CAP) pumpLog.splice(0, pumpLog.length - PUMP_LOG_CAP)
}

export function readSuperAgentPumpLog(limit = 50) {
  return pumpLog.slice(-Math.max(1, Math.min(limit, PUMP_LOG_CAP)))
}

export const superAgentPump = new SuperAgentPump(
  superAgentHost,
  () => [...ports.values()],
  dispatchWorkerWork,
  {
    onLog: logPumpRow,
    onCycle: () => saveIfDirty(),
  },
)

let interval: ReturnType<typeof setInterval> | null = null

export async function startSuperAgentPumpLoop(intervalMs = 60_000): Promise<void> {
  if (interval !== null) return
  // 启动序:先恢复（版本 fail-closed，拒绝只点名半灌绝不），再开节拍。
  await loadSuperAgentSnapshotOnce().catch(() => undefined)
  interval = setInterval(() => {
    void superAgentPump
      .runOnce()
      .then(() => saveIfDirty())
      .catch(() => {
        /* 泵内故障逐端口隔离并计数；循环腿自身不得崩服务 */
      })
  }, intervalMs)
  // Node 下不钉住事件循环；浏览器宿主本就不该跑此服务。
  if (typeof interval === 'object' && interval !== null && 'unref' in interval) {
    ;(interval as { unref(): void }).unref()
  }
}

export function stopSuperAgentPumpLoop(): void {
  if (interval !== null) {
    clearInterval(interval)
    interval = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
