// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 事件源适配器装配与入口(RP-40)。
 *
 * 职责边界:
 * - 本层把"已通过来源鉴权"的上游事件归一成引擎入口并落进推送缓冲/轮询端口;
 * - **幂等不在本层**:重复投递照样入队,由 SuperAgentHost.receive() 判 duplicate;
 * - **鉴权不在本层**:GitHub HMAC 在 routes/github-webhook.ts、IM 适配器验签在
 *   routes/im-gateway.ts,本层只做"来源白名单"二次校验(仓库/平台/归属主体)。
 *
 * 装配失败(配置缺失/不合法)一律降级为"该来源未启用",并点名 issues;
 * 不抛异常打断 API 启动(与 automations 的 env 门控同型)。
 */

import {
  normalizeGithubWebhook,
  normalizeImWebhook,
  toIncomingTrigger,
  type EventSourceKind,
  type GithubWebhookInput,
  type ImWebhookInput,
  type SourceEventRoute,
} from '@ihui/shared/super-agent'
import { logger } from '../../utils/logger.js'
import type { FetchLike } from '../automations/types.js'
import {
  registerTriggerSourcePort,
  unregisterTriggerSourcePort,
} from '../super-agent-pump-service.js'
import { BufferedTriggerSourcePort } from './buffered-port.js'
import { loadEventSourceSettings, type EventSourceSettings } from './config.js'
import { createGithubPollPort } from './poll.js'

export const GITHUB_WEBHOOK_SOURCE_ID = 'github-webhook'
export const IM_CALLBACK_SOURCE_ID = 'im-callback'

export interface InstalledSource {
  sourceId: string
  kind: EventSourceKind
  ownerUserId: string
}

export interface InstallReport {
  enabled: boolean
  ownerUserId: string
  sources: InstalledSource[]
  /** 装载期问题(缺配置/非法项),启动日志点名。 */
  issues: string[]
  routeCount: number
}

export interface IngestRejection {
  reason: string
  detail?: string
}

export interface IngestResult {
  /** 该来源未启用/未装配 ⇒ false(上层照常处理自己的业务,不误报)。 */
  handled: boolean
  queued: number
  rejected: IngestRejection[]
}

interface HubState {
  settings: EventSourceSettings
  github: BufferedTriggerSourcePort | null
  im: BufferedTriggerSourcePort | null
  pollSourceIds: string[]
}

let hub: HubState | null = null

function emptyResult(handled: boolean, rejected: IngestRejection[] = []): IngestResult {
  return { handled, queued: 0, rejected }
}

/**
 * 装配事件源。重复调用先摘除上一轮端口(幂等);返回报告供启动日志/健康面读取。
 */
export function installSuperAgentEventSources(
  options: {
    env?: Record<string, string | undefined>
    transport?: FetchLike
    register?: (port: Parameters<typeof registerTriggerSourcePort>[0]) => void
  } = {},
): InstallReport {
  stopSuperAgentEventSources()
  const env = options.env ?? process.env
  const settings = loadEventSourceSettings(env)
  const register = options.register ?? registerTriggerSourcePort
  const transport: FetchLike = options.transport ?? ((url, init) => fetch(url, init))

  const sources: InstalledSource[] = []
  let github: BufferedTriggerSourcePort | null = null
  let im: BufferedTriggerSourcePort | null = null
  const pollSourceIds: string[] = []

  if (settings.github.enabled) {
    github = new BufferedTriggerSourcePort(GITHUB_WEBHOOK_SOURCE_ID, settings.ownerUserId)
    register(github)
    sources.push({
      sourceId: GITHUB_WEBHOOK_SOURCE_ID,
      kind: 'github-webhook',
      ownerUserId: settings.ownerUserId,
    })
  }

  if (settings.im.enabled) {
    im = new BufferedTriggerSourcePort(IM_CALLBACK_SOURCE_ID, settings.ownerUserId)
    register(im)
    sources.push({
      sourceId: IM_CALLBACK_SOURCE_ID,
      kind: 'im-callback',
      ownerUserId: settings.ownerUserId,
    })
  }

  if (settings.poll.enabled) {
    const pollSourceId = `poll:github:${settings.poll.repo}`
    const port = createGithubPollPort({
      sourceId: pollSourceId,
      ownerUserId: settings.ownerUserId,
      repo: settings.poll.repo,
      pat: settings.poll.pat,
      label: settings.poll.label,
      maxRuns: settings.poll.maxRuns,
      includeCodeScanning: settings.poll.includeCodeScanning,
      routes: settings.routes,
      transport,
      onWarn: (source, error) => logger.warn('super-agent 轮询单源失败', { source, error }),
    })
    register(port)
    pollSourceIds.push(pollSourceId)
    sources.push({ sourceId: pollSourceId, kind: 'poll', ownerUserId: settings.ownerUserId })
  }

  hub = { settings, github, im, pollSourceIds }
  if (settings.issues.length > 0) {
    logger.warn('super-agent 事件源配置不完整,已按缺失项关闭', { issues: settings.issues })
  }
  logger.info('super-agent 事件源装配完成', {
    sources: sources.map((s) => s.sourceId),
    routes: settings.routes.length,
  })
  return {
    enabled: settings.enabled,
    ownerUserId: settings.ownerUserId,
    sources,
    issues: settings.issues,
    routeCount: settings.routes.length,
  }
}

export function stopSuperAgentEventSources(): void {
  if (hub) {
    unregisterTriggerSourcePort(GITHUB_WEBHOOK_SOURCE_ID)
    unregisterTriggerSourcePort(IM_CALLBACK_SOURCE_ID)
    for (const id of hub.pollSourceIds) unregisterTriggerSourcePort(id)
    hub.github?.clear()
    hub.im?.clear()
  }
  hub = null
}

/** 健康读数:端口是否装配、缓冲积压多少(不参与幂等判断)。 */
export function superAgentEventSourceHealth(): {
  installed: boolean
  sources: InstalledSource[]
  pending: { sourceId: string; pending: number; taken: number }[]
  issues: string[]
} {
  if (!hub) return { installed: false, sources: [], pending: [], issues: [] }
  const pending: { sourceId: string; pending: number; taken: number }[] = []
  if (hub.github) pending.push({ sourceId: hub.github.sourceId, ...hub.github.health() })
  if (hub.im) pending.push({ sourceId: hub.im.sourceId, ...hub.im.health() })
  return {
    installed: true,
    sources: listHubSources(hub),
    pending,
    issues: hub.settings.issues,
  }
}

function listHubSources(state: HubState): InstalledSource[] {
  const out: InstalledSource[] = []
  if (state.github) {
    out.push({
      sourceId: state.github.sourceId,
      kind: 'github-webhook',
      ownerUserId: state.settings.ownerUserId,
    })
  }
  if (state.im) {
    out.push({
      sourceId: state.im.sourceId,
      kind: 'im-callback',
      ownerUserId: state.settings.ownerUserId,
    })
  }
  for (const id of state.pollSourceIds) {
    out.push({ sourceId: id, kind: 'poll', ownerUserId: state.settings.ownerUserId })
  }
  return out
}

function repoFromPayload(payload: Record<string, unknown>): string | null {
  const repository = payload.repository
  if (!repository || typeof repository !== 'object') return null
  const fullName = (repository as Record<string, unknown>).full_name
  return typeof fullName === 'string' && fullName.length > 0 ? fullName : null
}

export interface GithubWebhookHookInput {
  deliveryId: string
  event: string
  action?: string | null
  payload: Record<string, unknown>
  repo?: string | null
}

/**
 * GitHub webhook 入口:调用方必须已完成 HMAC 验签。
 * 未知仓库/未装配来源一律拒绝(fail-closed),且不抛异常污染既有 webhook 响应。
 */
export function ingestGithubWebhook(input: GithubWebhookHookInput): IngestResult {
  const state = hub
  if (!state || !state.settings.github.enabled || !state.github) {
    return emptyResult(false, [{ reason: 'source_disabled' }])
  }
  try {
    const repo = (input.repo ?? repoFromPayload(input.payload) ?? '').trim()
    if (!repo) return emptyResult(true, [{ reason: 'unknown_source', detail: 'repo_missing' }])
    if (!state.settings.github.repos.includes(repo)) {
      return emptyResult(true, [{ reason: 'unknown_source', detail: repo }])
    }
    const normalized = normalizeGithubWebhook({
      deliveryId: input.deliveryId,
      event: input.event,
      action: input.action ?? null,
      payload: input.payload,
      repo,
      ownerUserId: state.settings.ownerUserId,
      ownerLogins: state.settings.github.ownerLogins,
      routes: state.settings.routes,
    } satisfies GithubWebhookInput)
    if (!normalized.accepted) {
      return emptyResult(true, [{ reason: normalized.reason, detail: normalized.detail }])
    }
    state.github.enqueue(toIncomingTrigger(normalized.event, state.github.sourceId))
    return { handled: true, queued: 1, rejected: [] }
  } catch (e) {
    return emptyResult(true, [
      { reason: 'normalize_error', detail: e instanceof Error ? e.message : String(e) },
    ])
  }
}

export interface ImWebhookHookInput {
  /** 已由 IM 适配器验签得到的归属主体 uuid。 */
  userId: string
  platform: string
  messageId: string
  chatId: string
  senderId: string
  text: string
  mentioned: boolean
}

/**
 * IM 回调入口:调用方必须已完成适配器验签。
 * 归属主体/平台白名单不匹配 ⇒ 拒绝;非机主账号发来的消息仍入队,
 * 但 actorId 保留真实发送者,由引擎 sessionIsAllowlist 过滤(fail-closed)。
 */
export function ingestImWebhook(input: ImWebhookHookInput): IngestResult {
  const state = hub
  if (!state || !state.settings.im.enabled || !state.im) {
    return emptyResult(false, [{ reason: 'source_disabled' }])
  }
  try {
    if (!state.settings.im.platforms.includes(input.platform)) {
      return emptyResult(true, [{ reason: 'unknown_source', detail: input.platform }])
    }
    if (input.userId !== state.settings.ownerUserId) {
      return emptyResult(true, [{ reason: 'unknown_source', detail: 'owner_mismatch' }])
    }
    const normalized = normalizeImWebhook({
      platform: input.platform,
      ownerUserId: state.settings.ownerUserId,
      messageId: input.messageId,
      chatId: input.chatId,
      senderId: input.senderId,
      text: input.text,
      mentioned: input.mentioned,
      ownerAccounts: state.settings.im.ownerAccounts,
      routes: state.settings.routes,
    } satisfies ImWebhookInput)
    if (!normalized.accepted) {
      return emptyResult(true, [{ reason: normalized.reason, detail: normalized.detail }])
    }
    state.im.enqueue(toIncomingTrigger(normalized.event, state.im.sourceId))
    return { handled: true, queued: 1, rejected: [] }
  } catch (e) {
    return emptyResult(true, [
      { reason: 'normalize_error', detail: e instanceof Error ? e.message : String(e) },
    ])
  }
}

/** 仅供测试/面板:读当前路由表,避免测试另抄一份映射。 */
export function currentEventRoutes(): SourceEventRoute[] {
  return hub?.settings.routes ?? []
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
