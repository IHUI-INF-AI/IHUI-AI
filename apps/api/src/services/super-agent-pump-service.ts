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
  type RuleAssessment,
  type SlowDecision,
  type SlowDirection,
  type SlowJudgeCall,
  type SlowJudgeInput,
  type SuperAgentSnapshot,
  type TriggerSourcePort,
  type WorkerAssignment,
} from '@ihui/shared/super-agent'
import {
  USER_PREFERENCE_GROUPS,
  findUserPreferences,
  upsertUserPreference,
} from '../db/user-preferences-queries.js'
import { logger } from '../utils/logger.js'
import {
  setTenantConcurrencyLimitResolver,
  subagentDispatchService,
} from './subagent-dispatch-service.js'
import { assertWorkerGitConfigSafe } from './worker-dispatch-env.js'
import { materializeWorkerDirectory } from './worker-workspace.js'

const SUPER_AGENT_SNAPSHOT_KEY = 'state'
/** 快照归属的保留主体 uuid；机主供值前持久腿如实降级（不谎称已持久）。 */
function snapshotProvider(): string | null {
  const v = (process.env.IHUI_SUPER_AGENT_STATE_ACCOUNT ?? '').trim()
  return v.length > 0 ? v : null
}

type PersistStatus = 'unconfigured' | 'ok' | 'degraded'

let dirty = false
/** 脏代际：每次账面变更 +1；落库成功只在代际未变时清 dirty（期间有新写不误清）。 */
let dirtySeq = 0
let lastPersistError: string | null = null
let persistStatus: PersistStatus = 'unconfigured'
/** 同一时刻只允许一条落库在飞；在飞期间的新请求记一笔，本条写完后补写。 */
let saveInFlight = false
let saveRequested = false
/** 失败退避：重试定时器与当前指数档位（失败不得紧循环、周期腿仍可直接接上重试）。 */
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempt = 0
let savedTakenAt = -1

const RETRY_BASE_MS = 1_000
const RETRY_MAX_MS = 30_000

/** host 构造位回调:声明提升让 onDirty 能引用后面初始化的 saveIfDirty。 */
function markSuperAgentDirty(): void {
  dirty = true
  dirtySeq += 1
}

export let superAgentHost = new SuperAgentHost(undefined, undefined, {
  onDirty: markSuperAgentDirty,
})

/**
 * 并发闸单一真相源(2026-11-07 收敛):
 * 下游 subagentDispatchService 的「单租户在跑上限」不再用自己那份默认值,改为读宿主当前
 * policyFor(owner).maxWorkers —— 与接收/开工判据同一字段。改 maxWorkers 不会再出现
 * 「引擎认为还有槽、下游却判超限」的两套账。未归属租户(owner 为空)不参与宿主策略,
 * 返回 undefined 让下游回落到通用默认值。
 */
setTenantConcurrencyLimitResolver((ownerUserId) =>
  ownerUserId ? superAgentHost.maxWorkersFor(ownerUserId) : undefined,
)

/**
 * 落库一次；返回是否真的写了库（同 takenAt ⇒ 无新内容，返回 false）。
 *
 * 纪律：读取时的 dirty 只作本次输入，**写库前不得清模块级 dirty**；仅当本次落库期间
 * 没有新的账面变更（代际未变）才在成功后清脏，避免把并发新写误清。
 */
async function doSave(): Promise<boolean> {
  const provider = snapshotProvider()
  if (!provider) {
    persistStatus = 'unconfigured'
    return false
  }
  const seq = dirtySeq
  const snap = superAgentHost.snapshot()
  // 与已存快照同 takenAt(默认时钟即 Date.now)⇒ 无新内容，不写。
  if (snap.takenAt <= savedTakenAt) return false
  await upsertUserPermissionSnapshot(provider, snap)
  savedTakenAt = snap.takenAt
  persistStatus = 'ok'
  lastPersistError = null
  retryAttempt = 0
  if (dirtySeq === seq) dirty = false
  return true
}

function clearRetryTimer(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

/** 有界指数退避：1s 起、封顶 30s；返回本次排到的延迟（已排过则 0）。 */
function scheduleRetry(): number {
  if (retryTimer !== null) return 0
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(retryAttempt, 5))
  retryAttempt += 1
  const timer = setTimeout(() => {
    retryTimer = null
    saveIfDirty()
  }, delay)
  // Node 下不钉住事件循环；浏览器宿主本就不该跑此服务。
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
    ;(timer as { unref(): void }).unref()
  }
  retryTimer = timer
  return delay
}

/** 串行写链：脏则写，失败点名、把脏标回并按退避重排（不得静默、不得紧循环）。 */
function saveIfDirty(): void {
  if (!dirty) return
  if (saveInFlight) {
    // 同一时刻只允许一条在飞（定时周期与退避重试不得并发双写）。
    saveRequested = true
    return
  }
  // 周期腿的显式请求优先：撤掉已排的退避定时器，避免同一笔写两次。
  clearRetryTimer()
  saveInFlight = true
  void drainSaves()
}

async function drainSaves(): Promise<void> {
  try {
    for (;;) {
      saveRequested = false
      await doSave()
      if (!saveRequested) break
    }
  } catch (e) {
    lastPersistError = e instanceof Error ? e.message : String(e)
    persistStatus = 'degraded'
    // 失败必须把脏标回：否则后续周期因 dirty=false 直接 return，重启丢最后一批状态。
    dirty = true
    const retryInMs = scheduleRetry()
    logger.warn('super-agent 快照持久失败；账面仍在内存，退避后自动重试', {
      err: lastPersistError,
      retryInMs,
    })
  } finally {
    saveInFlight = false
  }
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
    const parsed = JSON.parse(row.value) as SuperAgentSnapshot
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
    // 逻辑目录 → 服务端绝对目录,派发前落地。执行器拿到的是可写真实路径,
    // 而不是只写在 prompt 里的一句话;两个工人各写同名文件因此不会互相覆盖。
    const workerDirectory = materializeWorkerDirectory(work.directory)
    // 起工人前的 git config 闸门：出现 credential.* / http.*extraheader 就拒绝启动。
    // 只记键名与目录，不记配置值；失败走下方统一出口 deliveryFailed 记录原因。
    try {
      await assertWorkerGitConfigSafe(workerDirectory)
    } catch (e) {
      logger.warn('super-agent 工人启动被拒绝：目标目录 git config 不安全', {
        sessionId: work.sessionId,
        directory: workerDirectory,
        reason: e instanceof Error ? e.message : String(e),
      })
      throw e
    }
    const result = await subagentDispatchService.dispatch({
      goal: work.goal,
      affectedFiles: [],
      verifyCommands: [],
      constraints: work.constraints,
      deliverables: work.deliverables,
      agentRole: 'coder',
      ownerUserId,
      // 隔离身份随派单全链下传:sessionId 落到下游执行会话,directory 落到派单记录 + prompt。
      sessionId: work.sessionId,
      directory: workerDirectory,
      // 宿主已按 maxWorkers 给该工人占槽;下游不得再用优先级档二次拦它(租户/全局闸仍生效)。
      capacityReserved: true,
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

/**
 * 慢路径判定适配器:调 ai-service /api/super-agent/slow-path/judge。
 * 动态 import 默认通道(测试注入 fake 时零 config 拉起,与 automations 执行器同法);
 * 任何非 ok/形状不符 ⇒ throw,由 host.judgeRecorded 折成"未判定"保留积压(§0.3)。
 */
export function createSlowJudgeCall(
  fetcher?: (path: string, init: RequestInit) => Promise<Response>,
): SlowJudgeCall {
  return async (inputs: SlowJudgeInput[]) => {
    const call = fetcher ?? (await import('../utils/ai-service-fetch.js')).aiServiceSystemFetch
    const body = {
      items: inputs.map((i) => ({
        id: i.id,
        text: i.text,
        observed_at: i.observedAt,
        requesters: i.requesters,
        enabled_rules: i.enabledRules,
        companions: i.companions.map((c) => ({ id: c.id, text: c.text })),
        related_tickets: i.relatedTickets.map((t) => ({
          id: t.id,
          title: t.title,
          scope: t.scope,
          strength: t.strength,
          stage: t.stage,
        })),
        thread_window: i.threadWindow.map((m) => ({
          actor_id: m.actorId,
          from_bot: m.fromBot,
          addressed: m.addressed,
          text: m.text,
        })),
      })),
    }
    const resp = await call('/api/super-agent/slow-path/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      throw new Error(
        `slow-path judge → ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 160)}`,
      )
    }
    const envelope = (await resp.json()) as {
      code?: number
      data?: {
        model?: string
        verdicts?: Record<
          string,
          {
            decision?: string
            confidence?: number
            rule_assessments?: unknown
            direction?: unknown
            intent_evidence?: unknown
            title?: unknown
            scope?: unknown
            worktree_name?: unknown
            reason?: unknown
          }
        >
      }
    }
    const verdicts = envelope.data?.verdicts
    if (envelope.code !== 0 || !verdicts) throw new Error('slow-path judge envelope rejected')
    // 谁判的：模型名缺失 ⇒ 判不出身份，整批 fail-closed（不允许空串冒充）。
    const model = envelope.data?.model
    if (typeof model !== 'string' || model.trim().length === 0) {
      throw new Error('slow-path judge missing model identity')
    }
    const judge = `ai-service:${model}`
    const out: Record<string, SlowDecision> = {}
    const at = Date.now()
    for (const input of inputs) {
      const row = verdicts[input.id]
      if (!row) continue // 少一条=该条未判定,不回退猜
      const decision = row.decision
      if (decision !== 'accept' && decision !== 'ignore' && decision !== 'unavailable') {
        // 单条形状坏 ⇒ 整批不落（模型输出半可信 = 不判）。
        throw new Error(`slow-path judge bad decision for ${input.id}: ${String(decision)}`)
      }
      const confidence = row.confidence
      if (
        typeof confidence !== 'number' ||
        !Number.isFinite(confidence) ||
        confidence < 0 ||
        confidence > 1
      ) {
        throw new Error(`slow-path judge bad confidence for ${input.id}: ${String(confidence)}`)
      }
      const assessments = parseRuleAssessments(row.rule_assessments, input.id)
      const direction = parseDirection(row.direction, input.id)
      const intentEvidence = requireString(row.intent_evidence, 'intent_evidence', input.id)
      const title = requireString(row.title, 'title', input.id)
      const scope = requireString(row.scope, 'scope', input.id)
      const worktreeName = parseOptionalString(row.worktree_name, 'worktree_name', input.id)
      const reason = requireString(row.reason, 'reason', input.id)
      out[input.id] = {
        decision,
        ruleAssessments: assessments,
        direction,
        confidence,
        intentEvidence,
        title,
        scope,
        ...(worktreeName === undefined ? {} : { worktreeName }),
        reason: reason.slice(0, 300),
        at,
        judge,
      }
    }
    return out
  }
}

function requireString(value: unknown, field: string, id: string): string {
  if (typeof value !== 'string') {
    throw new Error(`slow-path judge bad ${field} for ${id}: ${String(value)}`)
  }
  return value
}

function parseOptionalString(value: unknown, field: string, id: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return requireString(value, field, id)
}

function parseRuleAssessments(value: unknown, id: string): RuleAssessment[] {
  if (!Array.isArray(value)) {
    throw new Error(`slow-path judge bad rule_assessments for ${id}`)
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`slow-path judge bad rule_assessment for ${id}`)
    }
    const e = entry as Record<string, unknown>
    const ruleId = requireString(e.rule_id, 'rule_id', id)
    if (typeof e.matched !== 'boolean') {
      throw new Error(`slow-path judge bad matched for ${id}`)
    }
    const reason = requireString(e.reason, 'rule_reason', id)
    return { ruleId, matched: e.matched, reason: reason.slice(0, 300) }
  })
}

function parseDirection(value: unknown, id: string): SlowDirection {
  if (!value || typeof value !== 'object') {
    throw new Error(`slow-path judge bad direction for ${id}`)
  }
  const d = value as Record<string, unknown>
  if (typeof d.implementation_requested !== 'boolean') {
    throw new Error(`slow-path judge bad implementation_requested for ${id}`)
  }
  if (typeof d.requires_design_decision !== 'boolean') {
    throw new Error(`slow-path judge bad requires_design_decision for ${id}`)
  }
  const basis = d.target_basis
  if (basis !== 'specified' && basis !== 'existing-standard' && basis !== 'undetermined') {
    throw new Error(`slow-path judge bad target_basis for ${id}: ${String(basis)}`)
  }
  const evidence = requireString(d.evidence, 'direction_evidence', id)
  return {
    implementationRequested: d.implementation_requested,
    targetBasis: basis,
    requiresDesignDecision: d.requires_design_decision,
    evidence,
  }
}

const PUMP_LOG_CAP = 200

function logPumpRow(row: { at: number; kind: string; source: string; note: string }): void {
  pumpLog.push(row)
  if (pumpLog.length > PUMP_LOG_CAP) pumpLog.splice(0, pumpLog.length - PUMP_LOG_CAP)
}

export function readSuperAgentPumpLog(limit = 50) {
  return pumpLog.slice(-Math.max(1, Math.min(limit, PUMP_LOG_CAP)))
}

function createSuperAgentPump(): SuperAgentPump {
  return new SuperAgentPump(superAgentHost, () => [...ports.values()], dispatchWorkerWork, {
    onLog: logPumpRow,
    onCycle: () => saveIfDirty(),
    // 慢路径 env 门控:未开启 = 泵完全不碰推断积压（与持久腿同型"未开启零动作"）。
    ...(process.env.IHUI_SUPER_AGENT_SLOW_PATH === 'true'
      ? { slowJudge: createSlowJudgeCall() }
      : {}),
  })
}

export let superAgentPump = createSuperAgentPump()

/**
 * 测试专用:替换宿主单例。
 *
 * 路由层用例需要一个确定性时钟(租约剩余/回收判据不依赖真实时间),而生产路径的宿主是
 * 模块加载时创建的。这里把 host 与泵一并换掉,保证「路由 → 派发出口 → 泵」读到同一个实例;
 * **生产代码不得调用**。
 */
export function __installSuperAgentHostForTests(next: SuperAgentHost): void {
  superAgentHost = next
  superAgentPump = createSuperAgentPump()
}

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
  // 停循环即停退避重试，避免停机后仍有落库定时器在飞。
  clearRetryTimer()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
