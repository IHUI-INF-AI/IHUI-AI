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
import { subagentDispatchService } from './subagent-dispatch-service.js'

export const superAgentHost = new SuperAgentHost()

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
  },
)

let interval: ReturnType<typeof setInterval> | null = null

export function startSuperAgentPumpLoop(intervalMs = 60_000): void {
  if (interval !== null) return
  interval = setInterval(() => {
    void superAgentPump.runOnce().catch(() => {
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
