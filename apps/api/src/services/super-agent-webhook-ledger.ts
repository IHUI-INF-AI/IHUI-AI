// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-40 超级智能体 webhook 回调落账重放账本。
 *
 * 形态对照 services/automations/ledger.ts（内存 + 文件双保险、坏文件拒绝覆盖），
 * 落点同为 gitignore 的 .ihui-agent/tmp/；本票把「认领一次」扩成
 * 「落账一次、消费一次」：外部回调(部署反馈/告警)经路由落账为 pending 事件，
 * 泵循环经 TriggerSourcePort.fetchTriggers 取走并标记 consumed（至多一次交付），
 * 同 (sourceId, eventId) 重复回调不重复落账（幂等键）。
 *
 * 单一真相源纪律：账只记「收到了什么」，收单/开工判据全在 @ihui/shared/super-agent
 * 的 host.receive（其本身按 trigger.id 去重），本层零复算。
 *
 * 供值后即插即活的接缝：任何内部采集器（如未来的已授权 GitHub 轮询腿）只要
 * ① upsertWebhookSource 登记来源 ② recordWebhookEvent 落账 ③ registerTriggerSourcePort
 * 挂上 createWebhookReplayPort —— 泵下一拍自然进食，泵与账本零改造。
 */
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { IncomingTrigger, TriggerSourcePort } from '@ihui/shared/super-agent'
import { logger } from '../utils/logger.js'

/** 来源配置：sourceId → 归属登录主体 + HMAC 回调密钥（服务端生成或 admin 供值）。 */
export interface WebhookSourceConfig {
  sourceId: string
  ownerUserId: string
  secret: string
  createdAt: string
}

/** 账上一格：一次回调落账（trigger 为灌给 host 的规范化事件）。 */
export interface WebhookLedgerEntry {
  /** 幂等键：`${sourceId}\u0000${eventId}`。 */
  key: string
  sourceId: string
  eventId: string
  trigger: IncomingTrigger
  receivedAt: string
  consumedAt: string | null
}

export type RecordOutcome = 'recorded' | 'duplicate' | 'unknown_source' | 'saturated'

const MAX_SOURCES = 50
const MAX_EVENTS = 1000
/** 泵单拍单端口最多取走的事件数（防一拍灌爆 host）。 */
const DRAIN_BATCH_LIMIT = 50

interface LedgerFileShape {
  sources: Record<string, WebhookSourceConfig>
  events: WebhookLedgerEntry[]
}

function ledgerPath(): string {
  return (
    (process.env.IHUI_SUPER_AGENT_WEBHOOK_LEDGER_PATH ?? '').trim() ||
    join(process.cwd(), '.ihui-agent', 'tmp', 'super-agent-webhook-ledger.json')
  )
}

function nodeErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || !('code' in err)) return undefined
  const code = (err as { code: unknown }).code
  return typeof code === 'string' ? code : undefined
}

let state: LedgerFileShape | null = null

function loadFile(): LedgerFileShape {
  const path = ledgerPath()
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    const code = nodeErrorCode(err)
    if (code === 'ENOENT' || code === 'ENOTDIR') return { sources: {}, events: [] }
    logger.warn('super-agent webhook 账本读取失败，拒绝按空账本覆盖', { path, err: String(err) })
    throw new Error(`webhook 账本读不到，不能按空账本覆盖 (${code ?? 'unknown'})`)
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LedgerFileShape>
    if (parsed && typeof parsed === 'object' && parsed.sources && Array.isArray(parsed.events)) {
      return { sources: parsed.sources, events: parsed.events }
    }
  } catch {
    /* 落到下方拒绝 */
  }
  logger.warn('super-agent webhook 账本内容损坏，拒绝按空账本覆盖', { path })
  throw new Error('webhook 账本内容损坏，不能按空账本覆盖 (parse)')
}

function ensureState(): LedgerFileShape {
  if (!state) state = loadFile()
  return state
}

function persist(): void {
  if (!state) return
  const path = ledgerPath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf8')
  } catch (err) {
    // 写盘失败：内存账仍有效，不抛（回调已应答 202，落盘恢复后自然续写）。
    logger.warn('super-agent webhook 账本落盘失败，本轮仅内存记账', {
      path,
      err: String(err),
    })
  }
}

/** 事件 id 在 host 处全局去重；加 sourceId 前缀防跨来源撞 id 被误判 duplicate。 */
function triggerIdOf(sourceId: string, eventId: string): string {
  return `wh:${sourceId}:${eventId}`
}

function idempotencyKeyOf(sourceId: string, eventId: string): string {
  return `${sourceId}\u0000${eventId}`
}

export function upsertWebhookSource(input: {
  sourceId: string
  ownerUserId: string
  secret?: string
}): { source: WebhookSourceConfig; created: boolean } {
  const s = ensureState()
  const existing = s.sources[input.sourceId]
  if (existing) {
    const next: WebhookSourceConfig = {
      ...existing,
      ownerUserId: input.ownerUserId,
      ...(input.secret ? { secret: input.secret } : {}),
    }
    s.sources[input.sourceId] = next
    persist()
    return { source: next, created: false }
  }
  if (Object.keys(s.sources).length >= MAX_SOURCES) {
    throw new Error(`webhook 来源数量已达上限(${MAX_SOURCES})`)
  }
  const source: WebhookSourceConfig = {
    sourceId: input.sourceId,
    ownerUserId: input.ownerUserId,
    // secret 服务端生成(256bit 随机)；admin 显式供值仅作轮换通道。
    secret: input.secret ?? randomBytes(32).toString('hex'),
    createdAt: new Date().toISOString(),
  }
  s.sources[input.sourceId] = source
  persist()
  return { source, created: true }
}

export function getWebhookSource(sourceId: string): WebhookSourceConfig | undefined {
  return ensureState().sources[sourceId]
}

export function listWebhookSources(): WebhookSourceConfig[] {
  return Object.values(ensureState().sources)
}

export function deleteWebhookSource(sourceId: string): boolean {
  const s = ensureState()
  if (!s.sources[sourceId]) return false
  delete s.sources[sourceId]
  // 来源注销后其未消费事件失去归属，一并清出账本（不留孤儿账）。
  s.events = s.events.filter((e) => e.sourceId !== sourceId)
  persist()
  return true
}

/**
 * 回调落账。幂等键 = (sourceId, eventId)：重复回调返回 duplicate，
 * 不重复入队（即便首条已被消费，重放也不会二次触发 —— host.receive 还按
 * trigger.id 做第二层去重，双保险）。
 */
export function recordWebhookEvent(input: {
  sourceId: string
  eventId: string
  text: string
  threadId?: string
  actorId?: string
  addressed?: boolean
  fromBot?: boolean
}): RecordOutcome {
  const s = ensureState()
  const source = s.sources[input.sourceId]
  if (!source) return 'unknown_source'
  const key = idempotencyKeyOf(input.sourceId, input.eventId)
  if (s.events.some((e) => e.key === key)) return 'duplicate'
  if (s.events.length >= MAX_EVENTS) {
    // 配额硬顶：优先淘汰最旧的已消费条目；全是未消费则拒收（点名，不静默挤掉）。
    const oldestConsumed = s.events.find((e) => e.consumedAt !== null)
    if (!oldestConsumed) return 'saturated'
    s.events = s.events.filter((e) => e !== oldestConsumed)
  }
  s.events.push({
    key,
    sourceId: input.sourceId,
    eventId: input.eventId,
    trigger: {
      id: triggerIdOf(input.sourceId, input.eventId),
      sourceId: input.sourceId,
      threadId: input.threadId ?? `webhook:${input.eventId}`,
      // 缺省归属即发单方：sessionIsAllowlist 策略下回调主体=登录主体本人。
      actorId: input.actorId ?? source.ownerUserId,
      addressed: input.addressed ?? true,
      fromBot: input.fromBot ?? false,
      text: input.text,
    },
    receivedAt: new Date().toISOString(),
    consumedAt: null,
  })
  persist()
  return 'recorded'
}

/**
 * 泵取账：按落账先后取该来源未消费事件并当场标记 consumed（至多一次交付）。
 * 泵不改造、Port 接口无 ack 回调，消费标记只能发生在交付时刻 —— 取走即记账。
 */
export function drainPendingWebhookEvents(
  sourceId: string,
  limit = DRAIN_BATCH_LIMIT,
): IncomingTrigger[] {
  const s = ensureState()
  const pending = s.events.filter((e) => e.sourceId === sourceId && e.consumedAt === null)
  const batch = pending.slice(0, Math.max(1, Math.min(limit, DRAIN_BATCH_LIMIT)))
  if (batch.length === 0) return []
  const now = new Date().toISOString()
  for (const entry of batch) entry.consumedAt = now
  persist()
  return batch.map((e) => ({ ...e.trigger }))
}

/** 既有 TriggerSourcePort 接口的 webhook 重放实现（泵每拍调 fetchTriggers 取未消费账）。 */
export function createWebhookReplayPort(source: {
  sourceId: string
  ownerUserId: string
}): TriggerSourcePort {
  return {
    sourceId: source.sourceId,
    ownerUserId: source.ownerUserId,
    fetchTriggers: async () => drainPendingWebhookEvents(source.sourceId),
  }
}

/** 健康读数（面板/哨兵用；不含 secret）。 */
export function superAgentWebhookLedgerStats() {
  const s = ensureState()
  return {
    sources: Object.keys(s.sources).length,
    pending: s.events.filter((e) => e.consumedAt === null).length,
    consumed: s.events.filter((e) => e.consumedAt !== null).length,
  }
}

/** 测试专用：清内存态，强制下次从盘重读（验证落盘/恢复腿）。生产代码不得调用。 */
export function __resetSuperAgentWebhookLedgerForTests(): void {
  state = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
