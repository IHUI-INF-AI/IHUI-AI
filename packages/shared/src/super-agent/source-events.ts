// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 事件源归一化层(RP-40):把 GitHub webhook / IM 回调 / 定时轮询三种上游形状,
 * 归一成引擎唯一的入口形状 IncomingTrigger。
 *
 * 三条硬纪律:
 * 1. 本层只做"形状翻译 + 事件→规则映射",**绝不做去重**。幂等唯一真源是
 *    SuperAgentHost.receive() 里的 triggers 集;同一条上游事件重复投递必须携带
 *    同一个 eventId,让引擎判 duplicate,而不是在适配器里再建第二套去重表。
 * 2. 映射配置单一真源(本文件的 DEFAULT_SOURCE_EVENT_ROUTES + parseSourceEventRoutes),
 *    不允许在路由/服务里散写第二份"某事件该开哪种工单"。
 * 3. strength 直接决定引擎语义:explicit ⇒ addressed + 非机器人(人点名,直接接单);
 *    inferred ⇒ 非 addressed + 机器人(只记账,慢路径再判)。
 *
 * 零 IO / 零 node: 内建:纯函数,测试可直接喂字面量。
 */

import type { IncomingTrigger, Strength } from './engine'

/** 已支持的事件来源种类。新增来源必须同时补 normalize 与配置装载。 */
export const EVENT_SOURCE_KINDS = ['github-webhook', 'im-callback', 'poll'] as const
export type EventSourceKind = (typeof EVENT_SOURCE_KINDS)[number]

/** 一条"事件→规则"映射。action 缺省=该事件任意 action。 */
export interface SourceEventRoute {
  source: EventSourceKind
  event: string
  /** 精确 action;缺省表示匹配该事件的所有 action(精确匹配优先)。 */
  action?: string
  /** 引擎侧规则名;会写进工单 scope 头部,供工人/面板辨认。 */
  ruleId: string
  /** 工作领域;与 ruleId 一起进 scope 头部。 */
  domain: string
  strength: Strength
  /** 仅当上游事件显式点名(comment @ / review_requested / issue assigned)才投递。 */
  mentionOnly?: boolean
}

/**
 * 默认映射表(唯一真源)。原则:
 * - 机器产生的事件一律 inferred(只记账,不替人开工);
 * - 只有"人明确点名机主"的事件才 explicit(评论 @、请求 review、指派 issue、IM @机器人)。
 */
export const DEFAULT_SOURCE_EVENT_ROUTES: readonly SourceEventRoute[] = [
  // GitHub:人点名机主的两类显式请求
  {
    source: 'github-webhook',
    event: 'pull_request',
    action: 'review_requested',
    ruleId: 'github.pr.review',
    domain: 'code-review',
    strength: 'explicit',
    mentionOnly: true,
  },
  {
    source: 'github-webhook',
    event: 'issues',
    action: 'assigned',
    ruleId: 'github.issue.triage',
    domain: 'issue-triage',
    strength: 'explicit',
    mentionOnly: true,
  },
  {
    source: 'github-webhook',
    event: 'issue_comment',
    action: 'created',
    ruleId: 'github.comment.mention',
    domain: 'chat',
    strength: 'explicit',
    mentionOnly: true,
  },
  // GitHub:机器事件,只记账
  {
    source: 'github-webhook',
    event: 'pull_request',
    action: 'opened',
    ruleId: 'github.pr.opened',
    domain: 'code-review',
    strength: 'inferred',
  },
  {
    source: 'github-webhook',
    event: 'pull_request',
    action: 'synchronize',
    ruleId: 'github.pr.sync',
    domain: 'code-review',
    strength: 'inferred',
  },
  {
    source: 'github-webhook',
    event: 'issues',
    action: 'opened',
    ruleId: 'github.issue.opened',
    domain: 'issue-triage',
    strength: 'inferred',
  },
  {
    source: 'github-webhook',
    event: 'workflow_run',
    action: 'completed',
    ruleId: 'github.ci.repair',
    domain: 'ci-repair',
    strength: 'inferred',
  },
  {
    source: 'github-webhook',
    event: 'code_scanning_alert',
    action: 'created',
    ruleId: 'github.code.scan',
    domain: 'security-repair',
    strength: 'inferred',
  },
  // IM:只有 @ 机器人才接单;其余先记账(仍受引擎主体白名单过滤)
  {
    source: 'im-callback',
    event: 'message',
    ruleId: 'im.message.mention',
    domain: 'chat',
    strength: 'explicit',
    mentionOnly: true,
  },
  {
    source: 'im-callback',
    event: 'message',
    ruleId: 'im.message.inbox',
    domain: 'chat',
    strength: 'inferred',
  },
  // 定时轮询:复用 automations 三源扫描条目
  {
    source: 'poll',
    event: 'issue',
    ruleId: 'poll.issue.repair',
    domain: 'issue-repair',
    strength: 'inferred',
  },
  {
    source: 'poll',
    event: 'code-scanning',
    ruleId: 'poll.code.scan',
    domain: 'security-repair',
    strength: 'inferred',
  },
  {
    source: 'poll',
    event: 'workflow-run',
    ruleId: 'poll.ci.repair',
    domain: 'ci-repair',
    strength: 'inferred',
  },
]

function isSourceKind(v: unknown): v is EventSourceKind {
  return typeof v === 'string' && (EVENT_SOURCE_KINDS as readonly string[]).includes(v)
}

/**
 * 装载映射配置覆盖(env `IHUI_SUPER_AGENT_EVENT_ROUTES`,JSON 数组,整表替换)。
 * 形状不合法一律抛错(fail-closed):宁可启动时点名,也不带着半张映射表跑。
 */
export function parseSourceEventRoutes(raw: string | undefined | null): SourceEventRoute[] {
  if (!raw || raw.trim().length === 0) return [...DEFAULT_SOURCE_EVENT_ROUTES]
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error(`IHUI_SUPER_AGENT_EVENT_ROUTES 不是合法 JSON: ${(e as Error).message}`)
  }
  if (!Array.isArray(parsed)) throw new Error('IHUI_SUPER_AGENT_EVENT_ROUTES 必须是数组')
  return parsed.map((row, i) => validateRoute(row, i))
}

function validateRoute(row: unknown, index: number): SourceEventRoute {
  if (!row || typeof row !== 'object') throw new Error(`映射第 ${index} 项不是对象`)
  const r = row as Record<string, unknown>
  if (!isSourceKind(r.source)) throw new Error(`映射第 ${index} 项 source 非法`)
  if (typeof r.event !== 'string' || r.event.trim().length === 0) {
    throw new Error(`映射第 ${index} 项 event 非法`)
  }
  if (r.action !== undefined && typeof r.action !== 'string') {
    throw new Error(`映射第 ${index} 项 action 非法`)
  }
  if (typeof r.ruleId !== 'string' || r.ruleId.trim().length === 0) {
    throw new Error(`映射第 ${index} 项 ruleId 非法`)
  }
  if (typeof r.domain !== 'string' || r.domain.trim().length === 0) {
    throw new Error(`映射第 ${index} 项 domain 非法`)
  }
  if (r.strength !== 'explicit' && r.strength !== 'inferred') {
    throw new Error(`映射第 ${index} 项 strength 非法`)
  }
  if (r.mentionOnly !== undefined && typeof r.mentionOnly !== 'boolean') {
    throw new Error(`映射第 ${index} 项 mentionOnly 非法`)
  }
  const out: SourceEventRoute = {
    source: r.source,
    event: r.event,
    ruleId: r.ruleId.trim(),
    domain: r.domain.trim(),
    strength: r.strength,
  }
  if (typeof r.action === 'string') out.action = r.action
  if (r.mentionOnly === true) out.mentionOnly = true
  return out
}

/**
 * 选路:先按 event + action 精确匹配;同 action 下显式点名路由优先于兜底路由;
 * 未点名时跳过 mentionOnly 路由。找不到 = 该事件不上工单(不猜)。
 */
export function selectSourceEventRoute(
  routes: readonly SourceEventRoute[],
  input: { source: EventSourceKind; event: string; action?: string | null; mentioned: boolean },
): SourceEventRoute | null {
  const action = input.action ?? null
  const candidates = routes.filter((r) => r.source === input.source && r.event === input.event)
  // 精确 action 优先;action 缺省的映射作为兜底。
  const exact = candidates.filter((r) => r.action !== undefined && r.action === action)
  const wildcard = candidates.filter((r) => r.action === undefined)
  const allowed = [...exact, ...wildcard].filter(
    (r) => !(r.mentionOnly === true && !input.mentioned),
  )
  if (allowed.length === 0) return null
  // 点名命中时 explicit 优先(同一事件可同时配 explicit 与 inferred 兜底)。
  if (input.mentioned) {
    const explicit = allowed.find((r) => r.strength === 'explicit')
    if (explicit) return explicit
  }
  return allowed[0] ?? null
}

/** 归一化后的上游事件(尚未变 IncomingTrigger;保留 route 供审计/测试)。 */
export interface NormalizedSourceEvent {
  source: EventSourceKind
  /** 幂等键:同一上游事件重复投递必须相同;引擎据此判 duplicate。 */
  eventId: string
  event: string
  action: string | null
  threadId: string
  actorId: string
  text: string
  addressed: boolean
  fromBot: boolean
  mentioned: boolean
  /** 上游时间(ISO 8601);来源没给则在归一化时刻取时钟。 */
  at: string
  /** 上游事件可点击地址。 */
  url?: string
  /** 渠道:threadId 与顶层一致,url 为渠道根(仓库主页/群)。 */
  channel: { threadId: string; url?: string }
  /** 来源元数据(只读审计/归因,不参与路由)。 */
  meta: Record<string, unknown>
  route: SourceEventRoute
}

export interface NormalizeRejection {
  accepted: false
  reason:
    'unmapped_event' | 'mention_required' | 'missing_event_id' | 'not_failure' | 'unknown_source'
  detail?: string
}

export type NormalizeResult = { accepted: true; event: NormalizedSourceEvent } | NormalizeRejection

const TEXT_LIMIT = 600

function clip(text: string, limit = TEXT_LIMIT): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= limit ? t : `${t.slice(0, limit - 1)}…`
}

function scopeText(route: SourceEventRoute, summary: string): string {
  return clip(`[${route.domain}] ${route.ruleId}: ${summary}`)
}

/** 由 route 的 strength 推出引擎两字段语义(唯一判据,不散写)。 */
function deliveryShape(route: SourceEventRoute): { addressed: boolean; fromBot: boolean } {
  return route.strength === 'explicit'
    ? { addressed: true, fromBot: false }
    : { addressed: false, fromBot: true }
}

interface BuildEventInput {
  eventId: string
  event: string
  action: string | null
  threadId: string
  actorId: string
  mentioned: boolean
  summary: string
  /** 上游自带的时间;缺省取归一化时刻。 */
  at?: string
  /** 上游事件地址。 */
  url?: string
  /** 渠道根地址(仓库主页/群);渠道 threadId 恒等于顶层 threadId。 */
  channelUrl?: string
  meta: Record<string, unknown>
}

function buildEvent(route: SourceEventRoute, input: BuildEventInput): NormalizedSourceEvent {
  const event: NormalizedSourceEvent = {
    source: route.source,
    eventId: input.eventId,
    event: input.event,
    action: input.action,
    threadId: input.threadId,
    actorId: input.actorId,
    text: scopeText(route, input.summary),
    mentioned: input.mentioned,
    at: input.at && input.at.length > 0 ? input.at : new Date().toISOString(),
    channel: { threadId: input.threadId, ...(input.channelUrl ? { url: input.channelUrl } : {}) },
    meta: input.meta,
    ...deliveryShape(route),
    route,
  }
  if (input.url && input.url.length > 0) event.url = input.url
  return event
}

// ---------------------------------------------------------------------------
// GitHub webhook
// ---------------------------------------------------------------------------

export interface GithubWebhookInput {
  /** X-GitHub-Delivery(必填:幂等键来源;缺失即 fail-closed 拒绝)。 */
  deliveryId: string
  event: string
  action?: string | null
  /** payload 原样(只读结构化字段)。 */
  payload: Record<string, unknown>
  /** 已由路由层从 payload 解析的仓库全名(owner/repo)。 */
  repo?: string | null
  /** 该来源绑定的机主 uuid;来源白名单通过后,机器事件归属机主。 */
  ownerUserId: string
  /** 机主在该来源的账号/登录名集合,用于点名检测。 */
  ownerLogins: readonly string[]
  routes?: readonly SourceEventRoute[]
}

interface GithubObjectRef {
  kind: 'pull_request' | 'issue' | 'workflow_run' | 'code_scanning_alert'
  number: string
  title: string
  url: string
  updatedAt: string
  sender: string
}

const CI_FAILURE_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'action_required',
  'startup_failure',
])

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

function githubObject(payload: Record<string, unknown>, event: string): GithubObjectRef | null {
  const sender = str(asRecord(payload.sender)?.login)
  if (event === 'pull_request') {
    const pr = asRecord(payload.pull_request)
    if (!pr) return null
    return {
      kind: 'pull_request',
      number: str(pr.number),
      title: str(pr.title),
      url: str(pr.html_url),
      updatedAt: str(pr.updated_at),
      sender,
    }
  }
  if (event === 'issues') {
    const issue = asRecord(payload.issue)
    if (!issue) return null
    return {
      kind: 'issue',
      number: str(issue.number),
      title: str(issue.title),
      url: str(issue.html_url),
      updatedAt: str(issue.updated_at),
      sender,
    }
  }
  if (event === 'issue_comment') {
    const issue = asRecord(payload.issue)
    const comment = asRecord(payload.comment)
    if (!issue) return null
    return {
      // 评论并入 issue 线程,后续同 issue 事件会 fanout 到同一张工单。
      kind: 'issue',
      number: str(issue.number),
      title: str(issue.title),
      url: str(comment?.html_url ?? issue.html_url),
      updatedAt: str(comment?.updated_at ?? issue.updated_at),
      sender,
    }
  }
  if (event === 'workflow_run') {
    const run = asRecord(payload.workflow_run)
    if (!run) return null
    return {
      kind: 'workflow_run',
      number: str(run.id ?? run.run_number),
      title: str(run.name ?? run.display_title),
      url: str(run.html_url),
      updatedAt: str(run.updated_at),
      sender,
    }
  }
  if (event === 'code_scanning_alert') {
    const alert = asRecord(payload.alert)
    if (!alert) return null
    return {
      kind: 'code_scanning_alert',
      number: str(alert.number),
      title: str(asRecord(alert.rule)?.description ?? alert.number),
      url: str(alert.html_url),
      updatedAt: str(alert.updated_at),
      sender,
    }
  }
  return null
}

function githubMentioned(
  payload: Record<string, unknown>,
  event: string,
  ownerLogins: readonly string[],
): boolean {
  if (ownerLogins.length === 0) return false
  const loginMatch = (v: unknown) => {
    const login = str(v).toLowerCase()
    return login.length > 0 && ownerLogins.some((o) => o.toLowerCase() === login)
  }
  const comment = asRecord(payload.comment)
  if (comment) {
    const body = str(comment.body).toLowerCase()
    if (ownerLogins.some((o) => body.includes(`@${o.toLowerCase()}`))) return true
  }
  if (event === 'pull_request' && loginMatch(asRecord(payload.requested_reviewer)?.login))
    return true
  if (event === 'issues' && loginMatch(asRecord(payload.assignee)?.login)) return true
  // pull_request.action=review_requested 时部分 payload 只给 requested_reviewers 数组
  const requested = payload.requested_reviewers
  if (Array.isArray(requested) && requested.some((r) => loginMatch(asRecord(r)?.login))) return true
  return false
}

function githubThreadId(repo: string, obj: GithubObjectRef): string {
  return `github:${repo}:${obj.kind}:${obj.number}`
}

/**
 * GitHub 适配器幂等键（本来源唯一规则，调用方不得另传 id）：
 * X-GitHub-Delivery 由 GitHub 为每次投递生成，Web 端手动 Redeliver 沿用同值，
 * 因此同一 delivery 重复到达必然得到同一个 eventId。
 */
export function githubDeliveryEventId(deliveryId: string): string | null {
  const id = deliveryId.trim()
  return id.length > 0 ? `github:${id}` : null
}

function githubFallbackId(
  repo: string,
  event: string,
  action: string | null,
  obj: GithubObjectRef,
): string {
  // 无 delivery 时用对象指纹做稳定键;同对象同状态重复投递仍判 duplicate。
  return `github:${repo}:${event}:${action ?? '-'}:${obj.kind}:${obj.number}:${obj.updatedAt}`
}

/**
 * GitHub webhook 归一化。签名/仓库白名单由路由层先做完,本函数只看形状。
 * 同一 delivery 必然得到同一个 eventId —— 幂等只靠引擎。
 */
export function normalizeGithubWebhook(input: GithubWebhookInput): NormalizeResult {
  const routes = input.routes ?? DEFAULT_SOURCE_EVENT_ROUTES
  const repo = (input.repo ?? '').trim()
  if (!repo) return { accepted: false, reason: 'missing_event_id', detail: 'repo' }
  const eventId = githubDeliveryEventId(input.deliveryId)
  if (!eventId) return { accepted: false, reason: 'missing_event_id', detail: 'delivery' }
  const obj = githubObject(input.payload, input.event)
  if (!obj) return { accepted: false, reason: 'unmapped_event', detail: input.event }
  const mentioned = githubMentioned(input.payload, input.event, input.ownerLogins)
  if (input.event === 'workflow_run') {
    const run = asRecord(input.payload.workflow_run)
    const conclusion = str(run?.conclusion)
    if (conclusion.length > 0 && !CI_FAILURE_CONCLUSIONS.has(conclusion)) {
      return { accepted: false, reason: 'not_failure', detail: conclusion }
    }
  }
  const route = selectSourceEventRoute(routes, {
    source: 'github-webhook',
    event: input.event,
    action: input.action ?? null,
    mentioned,
  })
  if (!route) {
    const mentionMissing = routes.some(
      (r) =>
        r.source === 'github-webhook' &&
        r.event === input.event &&
        r.mentionOnly === true &&
        r.action !== undefined &&
        r.action === (input.action ?? null),
    )
    return {
      accepted: false,
      reason: mentionMissing ? 'mention_required' : 'unmapped_event',
      detail: `${input.event}/${input.action ?? '-'}`,
    }
  }
  if (route.mentionOnly === true && !mentioned) {
    return {
      accepted: false,
      reason: 'mention_required',
      detail: `${input.event}/${input.action ?? '-'}`,
    }
  }
  const summary = `${repo} ${input.event}/${input.action ?? '-'}${obj.number ? ` #${obj.number}` : ''}: ${obj.title}${obj.sender ? ` by @${obj.sender}` : ''}`
  return {
    accepted: true,
    event: buildEvent(route, {
      eventId,
      event: input.event,
      action: input.action ?? null,
      threadId: githubThreadId(repo, obj),
      actorId: input.ownerUserId,
      mentioned,
      summary,
      at: obj.updatedAt,
      url: obj.url,
      channelUrl: `https://github.com/${repo}`,
      meta: {
        source: 'github-webhook',
        deliveryId: input.deliveryId,
        event: input.event,
        action: input.action ?? null,
        repo,
        kind: obj.kind,
        number: obj.number,
        sender: obj.sender || null,
      },
    }),
  }
}

/** 无 delivery 的上游(如服务端补投)用对象指纹生成稳定 eventId。 */
export function githubStableEventId(input: Omit<GithubWebhookInput, 'deliveryId'>): string | null {
  const repo = (input.repo ?? '').trim()
  if (!repo) return null
  const obj = githubObject(input.payload, input.event)
  return obj ? githubFallbackId(repo, input.event, input.action ?? null, obj) : null
}

// ---------------------------------------------------------------------------
// IM 回调
// ---------------------------------------------------------------------------

export interface ImWebhookInput {
  platform: string
  /** 该回调已由来源适配器鉴权并绑定到的机主 uuid。 */
  ownerUserId: string
  /** 平台消息 id(必填:幂等键来源)。 */
  messageId: string
  chatId: string
  senderId: string
  text: string
  /** 是否在消息里 @ 了机器人。 */
  mentioned: boolean
  /** 被允许代表机主的平台账号;未命中则 actorId=发送者,由引擎白名单 fail-closed。 */
  ownerAccounts: readonly string[]
  /** 平台给出的消息时间(ISO 8601);缺省取归一化时刻。 */
  at?: string
  routes?: readonly SourceEventRoute[]
}

/**
 * IM 适配器幂等键（本来源唯一规则）：
 * 平台消息 id 在会话内唯一，重复回调（重试/重放）必然得到同一个 eventId。
 */
export function imStableEventId(platform: string, messageId: string): string | null {
  const p = platform.trim()
  const m = messageId.trim()
  return p.length > 0 && m.length > 0 ? `im:${p}:${m}` : null
}

export function normalizeImWebhook(input: ImWebhookInput): NormalizeResult {
  const routes = input.routes ?? DEFAULT_SOURCE_EVENT_ROUTES
  if (!input.messageId || input.messageId.trim().length === 0) {
    return { accepted: false, reason: 'missing_event_id', detail: 'messageId' }
  }
  if (!input.platform || input.platform.trim().length === 0) {
    return { accepted: false, reason: 'unknown_source', detail: 'platform' }
  }
  const eventId = imStableEventId(input.platform, input.messageId)
  if (!eventId) return { accepted: false, reason: 'missing_event_id', detail: 'messageId' }
  const route = selectSourceEventRoute(routes, {
    source: 'im-callback',
    event: 'message',
    action: null,
    mentioned: input.mentioned,
  })
  if (!route) return { accepted: false, reason: 'unmapped_event', detail: 'im/message' }
  if (route.mentionOnly === true && !input.mentioned) {
    return { accepted: false, reason: 'mention_required', detail: 'im/message' }
  }
  const sender = input.senderId.trim()
  const isOwnerAccount = sender.length > 0 && input.ownerAccounts.some((a) => a === sender)
  return {
    accepted: true,
    event: buildEvent(route, {
      eventId,
      event: 'message',
      action: null,
      threadId: `im:${input.platform}:${input.chatId}`,
      actorId: isOwnerAccount ? input.ownerUserId : sender || 'unknown',
      mentioned: input.mentioned,
      summary: `${input.platform} ${input.chatId} from ${sender || 'unknown'}: ${input.text}`,
      at: input.at,
      meta: {
        source: 'im-callback',
        platform: input.platform,
        messageId: input.messageId,
        chatId: input.chatId,
        senderId: sender,
      },
    }),
  }
}

// ---------------------------------------------------------------------------
// 定时轮询(复用 automations 三源扫描条目)
// ---------------------------------------------------------------------------

export interface PollItemInput {
  source: 'issue' | 'code-scanning' | 'workflow-run'
  key: string
  title: string
  detail?: string
  url?: string | null
  repo: string
  ownerUserId: string
  routes?: readonly SourceEventRoute[]
}

/**
 * 轮询适配器幂等键（本来源唯一规则）：
 * 仓库 + 扫描条目 key（issue 编号 / 告警编号 / run id）构成内容指纹；
 * 轮询每轮重扫同一批条目会重复投递，靠引擎判 duplicate，不在适配器里另建游标表。
 */
export function pollStableEventId(repo: string, key: string): string | null {
  const r = repo.trim()
  const k = key.trim()
  return r.length > 0 && k.length > 0 ? `poll:${r}:${k}` : null
}

export function normalizePollItem(input: PollItemInput): NormalizeResult {
  const routes = input.routes ?? DEFAULT_SOURCE_EVENT_ROUTES
  if (!input.key || input.key.trim().length === 0) {
    return { accepted: false, reason: 'missing_event_id', detail: 'key' }
  }
  const eventId = pollStableEventId(input.repo, input.key)
  if (!eventId) return { accepted: false, reason: 'missing_event_id', detail: 'repo' }
  const route = selectSourceEventRoute(routes, {
    source: 'poll',
    event: input.source,
    action: null,
    mentioned: false,
  })
  if (!route) return { accepted: false, reason: 'unmapped_event', detail: `poll/${input.source}` }
  return {
    accepted: true,
    event: buildEvent(route, {
      eventId,
      event: input.source,
      action: null,
      threadId: eventId,
      actorId: input.ownerUserId,
      mentioned: false,
      summary: `${input.repo} ${input.key}: ${input.title}${input.url ? ` (${input.url})` : ''}`,
      url: input.url ?? undefined,
      meta: {
        source: 'poll',
        repo: input.repo,
        key: input.key,
        item: input.source,
        detail: input.detail ?? null,
      },
    }),
  }
}

/** 归一化结果 → 引擎入口形状。唯一转换点,防止各适配器各写一份字段拼装。 */
export function toIncomingTrigger(event: NormalizedSourceEvent, sourceId: string): IncomingTrigger {
  const trigger: IncomingTrigger = {
    id: event.eventId,
    sourceId,
    threadId: event.threadId,
    actorId: event.actorId,
    addressed: event.addressed,
    fromBot: event.fromBot,
    text: event.text,
    at: event.at,
    channel: { ...event.channel },
    meta: { ...event.meta },
  }
  if (event.url) trigger.url = event.url
  return trigger
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
