// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App webhook 事件体 Zod schema + 投递信封解析(D15 / G-20)。
 *
 * 纯数据层:不 import db、不发网络请求,可被单测直接覆盖。
 * 路由挂载与 barrel 注册由主会话单点接线,本文件只负责"把不透明 JSON 变成可判别联合类型"。
 */
import { z } from 'zod'

/** webhook 请求头名(与 GitHub 官方一致) */
export const WEBHOOK_EVENT_HEADER = 'x-github-event'
export const WEBHOOK_DELIVERY_HEADER = 'x-github-delivery'

// ---------------------------------------------------------------------------
// 公共子结构
// ---------------------------------------------------------------------------

/** GitHub 账号(用户 / 机器人 / 集成)最小字段集 */
const actorSchema = z.object({
  login: z.string(),
  id: z.number().int().nonnegative().optional(),
  type: z.string().optional(),
})

/** 仓库最小字段集(full_name 是所有下游调用的定位键) */
const repositorySchema = z.object({
  id: z.number().int().nonnegative().optional(),
  name: z.string().optional(),
  full_name: z.string(),
  owner: actorSchema.optional(),
  default_branch: z.string().optional(),
})

/** 安装实例:没有它就无法换取 installation token,整个 App 能力不可用 */
const installationSchema = z.object({
  id: z.number().int().positive(),
})

const prHeadSchema = z.object({ ref: z.string(), sha: z.string() })
const prBaseSchema = z.object({ ref: z.string(), sha: z.string() })

const pullRequestSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  state: z.string(),
  draft: z.boolean().default(false),
  head: prHeadSchema,
  base: prBaseSchema,
  user: actorSchema,
  html_url: z.string().optional(),
  body: z.string().nullable().optional(),
})

// ---------------------------------------------------------------------------
// 事件体
// ---------------------------------------------------------------------------

/** `pull_request` 事件(本 App 只消费 review 相关 action,见 PR_REVIEW_ACTIONS) */
export const pullRequestEventSchema = z.object({
  action: z.string(),
  number: z.number().int().positive().optional(),
  pull_request: pullRequestSchema,
  repository: repositorySchema,
  installation: installationSchema.optional(),
})
export type PullRequestEventPayload = z.infer<typeof pullRequestEventSchema>

/** `issue_comment` 事件(PR 讨论区的评论同样走这一事件名) */
export const issueCommentEventSchema = z.object({
  action: z.string(),
  issue: z.object({
    number: z.number().int().positive(),
    title: z.string().optional(),
    state: z.string().optional(),
    /** 非空 => 这条评论挂在 PR 讨论区;为空 => 纯 issue,本 App 不处理 */
    pull_request: z.unknown().optional(),
    repository: repositorySchema.optional(),
  }),
  comment: z.object({
    id: z.number().int().nonnegative().optional(),
    body: z.string(),
    user: actorSchema,
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  }),
  repository: repositorySchema,
  installation: installationSchema.optional(),
})
export type IssueCommentEventPayload = z.infer<typeof issueCommentEventSchema>

/** `ping` 事件体(GitHub 在保存 webhook 配置时发送,用于连通性自检) */
export const pingEventSchema = z.object({
  zen: z.string().optional(),
  hook_id: z.number().int().optional(),
})

/**
 * `installation` 事件体(D15①:安装映射落库的数据源)。
 * 本 App 只消费 created / deleted / new_permission_accepted 三个 action,其余忽略;
 * installation.id 是本表的唯一业务键,account/target_type 是展示字段。
 */
export const installationEventSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number().int().positive(),
    account: z.object({ login: z.string(), type: z.string().optional() }).optional(),
    target_type: z.string().optional(),
  }),
  requester: actorSchema.optional(),
  sender: actorSchema.optional(),
})
export type InstallationEventPayload = z.infer<typeof installationEventSchema>

/**
 * CI 三类事件(check_suite / workflow_run / check_run)的最小事件体。
 *
 * Y-13(2026-10-29)立:此前这三个事件名不在任何白名单里,`parseWebhook` 归到
 * ignored/unsupported_event —— 自动化(评论触发/工单闭环)对这些事件**完全失聪**,
 * 且失败后没有任何可核对的分支。这里只认定位维(id/status/conclusion/head_sha):
 * 少一维就明确判 400 并把缺的字段名回给提供方(schema 诊断),多出来的字段一律放行 ——
 * GitHub 的 CI 正文是提供方自由文本(提交说明、job 名),字段集合随版本增长,
 * 按"全字段严格"校验会把更新后的合法投递判死(这正是本族 400 的另一半成因)。
 */
const ciCheckObjectSchema = z.object({
  id: z.number().int().nonnegative(),
  status: z.string(),
  conclusion: z.string().nullable().optional(),
  head_sha: z.string(),
  head_branch: z.string().nullable().optional(),
  name: z.string().optional(),
})

export const checkSuiteEventSchema = z.object({
  action: z.string(),
  repository: repositorySchema,
  installation: installationSchema.optional(),
  check_suite: ciCheckObjectSchema.extend({
    app: z.object({ slug: z.string().optional(), name: z.string().optional() }).optional(),
  }),
})
export type CheckSuiteEventPayload = z.infer<typeof checkSuiteEventSchema>

export const workflowRunEventSchema = z.object({
  action: z.string(),
  repository: repositorySchema,
  installation: installationSchema.optional(),
  workflow_run: ciCheckObjectSchema,
})
export type WorkflowRunEventPayload = z.infer<typeof workflowRunEventSchema>

export const checkRunEventSchema = z.object({
  action: z.string(),
  repository: repositorySchema,
  installation: installationSchema.optional(),
  check_run: ciCheckObjectSchema,
})
export type CheckRunEventPayload = z.infer<typeof checkRunEventSchema>

/** 归一后的 CI 事件摘要(降级响应/日志只带这些,不回显提供方正文) */
export interface CiEventSummary {
  id: number
  status: string
  conclusion: string | null
  headSha: string
  headBranch: string | null
  name: string | null
}

// ---------------------------------------------------------------------------
// 显式列举的处理面(AGENTS §5 红线:禁止用参数正则兜底公开面)
// ---------------------------------------------------------------------------

/** 本 App **订阅并真正处理**的事件名 —— 白名单,不是正则 */
export const HANDLED_GITHUB_EVENTS = ['ping', 'pull_request', 'issue_comment'] as const
export type HandledGithubEvent = (typeof HANDLED_GITHUB_EVENTS)[number]

/**
 * 仅落库消费的事件名(D15①):不进 HANDLED_GITHUB_EVENTS(那里被 /health
 * 契约测试钉死),单独列举 —— installation 事件只驱动 github_app_installations 表。
 */
export const PERSISTED_GITHUB_EVENTS = ['installation'] as const
export type PersistedGithubEvent = (typeof PERSISTED_GITHUB_EVENTS)[number]

/**
 * 能**辨认并校验**、但当前没有处理分支的 CI 事件名(Y-13)。
 * 刻意不进 HANDLED_GITHUB_EVENTS:/health 那条清单是"会驱动动作的事件"契约,
 * 这三类进来只会让运维以为 CI 事件已经接了业务。它们的落点是显式 200 + 忽略原因
 * (`ci_event_not_subscribed`),而不是静默丢弃 —— 静默与失聪在 GitHub 侧读数上同形。
 */
export const OBSERVED_CI_EVENTS = ['check_suite', 'workflow_run', 'check_run'] as const
export type ObservedCiEvent = (typeof OBSERVED_CI_EVENTS)[number]

export type KnownGithubEvent = HandledGithubEvent | PersistedGithubEvent | ObservedCiEvent

/** parseWebhook 能辨认的全部事件名(处理面 ∪ 落库面 ∪ CI 观察面) */
export const KNOWN_GITHUB_EVENTS: readonly KnownGithubEvent[] = [
  ...HANDLED_GITHUB_EVENTS,
  ...PERSISTED_GITHUB_EVENTS,
  ...OBSERVED_CI_EVENTS,
]

/** 触发自动 review 的 pull_request action —— 白名单 */
export const PR_REVIEW_ACTIONS = ['opened', 'synchronize', 'reopened', 'ready_for_review'] as const
export type PrReviewAction = (typeof PR_REVIEW_ACTIONS)[number]

function isKnownEvent(name: string): name is KnownGithubEvent {
  return (KNOWN_GITHUB_EVENTS as readonly string[]).includes(name)
}

function isObservedCiEvent(name: string): name is ObservedCiEvent {
  return (OBSERVED_CI_EVENTS as readonly string[]).includes(name)
}

export function isPrReviewAction(action: string): action is PrReviewAction {
  return (PR_REVIEW_ACTIONS as readonly string[]).includes(action)
}

/** 从 `owner/repo` 形态的 full_name 拆出两段;形态不符返回 null */
export function splitRepoFullName(fullName: string): { owner: string; repo: string } | null {
  const parts = fullName.split('/')
  if (parts.length !== 2) return null
  const owner = parts[0]?.trim() ?? ''
  const repo = parts[1]?.trim() ?? ''
  if (!owner || !repo) return null
  return { owner, repo }
}

// ---------------------------------------------------------------------------
// 投递信封 + 解析结果
// ---------------------------------------------------------------------------

/** 与事件种类无关的信封字段,所有下游处理器都要用 */
export interface WebhookEnvelope {
  event: KnownGithubEvent
  action: string
  /** X-GitHub-Delivery(GitHub 为每次投递生成的 UUID,重投时不变 => 幂等键) */
  deliveryId: string
  repoFullName: string
  /** 为 null 时 App 无法换取 installation token,处理器必须跳过而不是崩 */
  installationId: number | null
}

/** 解析后的事件:判别联合,处理器 switch `kind` 后拿到精确类型 */
export type ParsedWebhook =
  | { kind: 'ping'; envelope: WebhookEnvelope }
  | { kind: 'pull_request'; envelope: WebhookEnvelope; payload: PullRequestEventPayload }
  | { kind: 'issue_comment'; envelope: WebhookEnvelope; payload: IssueCommentEventPayload }
  | { kind: 'installation'; envelope: WebhookEnvelope; payload: InstallationEventPayload }
  | {
      kind: 'ci_event'
      envelope: WebhookEnvelope
      event: ObservedCiEvent
      summary: CiEventSummary
    }

/** 事件名不在白名单 / 缺事件头 —— 合法投递,只是不处理,按 200 返回 */
export type WebhookIgnoreReason = 'missing_event_header' | 'unsupported_event'

export type WebhookParseResult =
  | { status: 'ok'; data: ParsedWebhook }
  | { status: 'ignored'; reason: WebhookIgnoreReason; event: string }
  | { status: 'invalid'; message: string }

function headerToString(header: string | string[] | undefined): string {
  if (typeof header === 'string') return header
  if (Array.isArray(header)) return header[0] ?? ''
  return ''
}

/**
 * zod 失败 → 只回**字段路径**,不回取值。
 * 理由与 agent-event-trigger 的 intakeInvalidFields 同款:错误响应会被 CI 打印、也会进日志,
 * 而 CI 正文里是提交说明/job 名,不得成为请求体的回显通道。这一句就是 Y-13 要的
 * "缺哪一维"的答案(例:`check_run 事件体不符合 schema(...: check_run.id, repository.full_name)`)。
 */
function invalidSchemaMessage(event: string, issues: readonly z.ZodIssue[]): string {
  const paths = [...new Set(issues.map((issue) => issue.path.join('.') || '(root)'))].slice(0, 6)
  return `${event} 事件体不符合 schema(缺字段或类型不符: ${paths.join(', ')})`
}

/** 三类 CI 事件解析后的统一形状(供 envelope + 摘要共用) */
interface ParsedCiEvent {
  action: string
  repoFullName: string
  installationId: number | null
  summary: CiEventSummary
}

function toCiEvent(
  action: string,
  repository: { full_name: string },
  installation: { id: number } | undefined,
  subject: {
    id: number
    status: string
    conclusion?: string | null
    head_sha: string
    head_branch?: string | null
    name?: string
  },
): ParsedCiEvent {
  return {
    action,
    repoFullName: repository.full_name,
    installationId: installation?.id ?? null,
    summary: {
      id: subject.id,
      status: subject.status,
      conclusion: subject.conclusion ?? null,
      headSha: subject.head_sha,
      headBranch: subject.head_branch ?? null,
      name: subject.name ?? null,
    },
  }
}

/**
 * CI 三类事件的事件体校验(Y-13)。
 * 三者的差别只在主体字段名(check_suite / workflow_run / check_run),故分开 safeParse、
 * 共用同一个 toCiEvent 归一 —— 不用联合 schema 猜主体,猜错就把合法投递判 400。
 */
function parseCiEvent(
  event: ObservedCiEvent,
  payload: unknown,
): ({ ok: true } & ParsedCiEvent) | { ok: false; message: string } {
  if (event === 'check_suite') {
    const parsed = checkSuiteEventSchema.safeParse(payload)
    if (!parsed.success)
      return { ok: false, message: invalidSchemaMessage(event, parsed.error.issues) }
    const body = parsed.data
    return {
      ok: true,
      ...toCiEvent(body.action, body.repository, body.installation, body.check_suite),
    }
  }
  if (event === 'workflow_run') {
    const parsed = workflowRunEventSchema.safeParse(payload)
    if (!parsed.success)
      return { ok: false, message: invalidSchemaMessage(event, parsed.error.issues) }
    const body = parsed.data
    return {
      ok: true,
      ...toCiEvent(body.action, body.repository, body.installation, body.workflow_run),
    }
  }
  const parsed = checkRunEventSchema.safeParse(payload)
  if (!parsed.success)
    return { ok: false, message: invalidSchemaMessage(event, parsed.error.issues) }
  const body = parsed.data
  return { ok: true, ...toCiEvent(body.action, body.repository, body.installation, body.check_run) }
}

/**
 * 把 (事件头, 投递头, 已解析的 JSON 体) 归一成可判别联合。
 *
 * 设计要点:
 * - 事件名**必须**落在 KNOWN_GITHUB_EVENTS 里,否则 ignored(不猜测、不放行未知形态);
 * - CI 三类事件(check_suite / workflow_run / check_run)辨认 + 校验后走 ci_event,
 *   由路由回显式 200 + 忽略原因,不再落进 unsupported_event 那条静默通道(Y-13);
 * - 事件体不符 zod schema => invalid(路由回 400 并把缺的字段名回给提供方),绝不带病往下派发;
 * - 缺 installation 不视为非法:仍返回 ok,由 installationId=null 让处理器自行跳过并给出原因。
 */
export function parseWebhook(input: {
  eventHeader: string | string[] | undefined
  deliveryHeader: string | string[] | undefined
  payload: unknown
}): WebhookParseResult {
  const eventRaw = headerToString(input.eventHeader).trim()
  if (!eventRaw) return { status: 'ignored', reason: 'missing_event_header', event: '' }
  if (!isKnownEvent(eventRaw))
    return { status: 'ignored', reason: 'unsupported_event', event: eventRaw }

  const deliveryId = headerToString(input.deliveryHeader).trim()

  if (eventRaw === 'ping') {
    const parsed = pingEventSchema.safeParse(input.payload)
    if (!parsed.success) {
      return { status: 'invalid', message: 'ping 事件体不符合 schema' }
    }
    return {
      status: 'ok',
      data: {
        kind: 'ping',
        envelope: {
          event: 'ping',
          action: 'ping',
          deliveryId,
          repoFullName: '',
          installationId: null,
        },
      },
    }
  }

  if (eventRaw === 'installation') {
    const parsed = installationEventSchema.safeParse(input.payload)
    if (!parsed.success) {
      return { status: 'invalid', message: 'installation 事件体不符合 schema' }
    }
    const body = parsed.data
    return {
      status: 'ok',
      data: {
        kind: 'installation',
        envelope: {
          event: 'installation',
          action: body.action,
          deliveryId,
          repoFullName: '',
          // installation 事件的主体就是安装实例本身,这里必然有值
          installationId: body.installation.id,
        },
        payload: body,
      },
    }
  }

  if (isObservedCiEvent(eventRaw)) {
    const parsed = parseCiEvent(eventRaw, input.payload)
    if (!parsed.ok) return { status: 'invalid', message: parsed.message }
    return {
      status: 'ok',
      data: {
        kind: 'ci_event',
        event: eventRaw,
        envelope: {
          event: eventRaw,
          action: parsed.action,
          deliveryId,
          repoFullName: parsed.repoFullName,
          installationId: parsed.installationId,
        },
        summary: parsed.summary,
      },
    }
  }

  if (eventRaw === 'pull_request') {
    const parsed = pullRequestEventSchema.safeParse(input.payload)
    if (!parsed.success) {
      return { status: 'invalid', message: 'pull_request 事件体不符合 schema' }
    }
    const body = parsed.data
    return {
      status: 'ok',
      data: {
        kind: 'pull_request',
        envelope: {
          event: 'pull_request',
          action: body.action,
          deliveryId,
          repoFullName: body.repository.full_name,
          installationId: body.installation?.id ?? null,
        },
        payload: body,
      },
    }
  }

  const parsed = issueCommentEventSchema.safeParse(input.payload)
  if (!parsed.success) {
    return { status: 'invalid', message: 'issue_comment 事件体不符合 schema' }
  }
  const body = parsed.data
  return {
    status: 'ok',
    data: {
      kind: 'issue_comment',
      envelope: {
        event: 'issue_comment',
        action: body.action,
        deliveryId,
        repoFullName: body.repository.full_name,
        installationId: body.installation?.id ?? null,
      },
      payload: body,
    },
  }
}

// ---------------------------------------------------------------------------
// 幂等去重(GitHub 会重投同一 delivery guid)
// ---------------------------------------------------------------------------

export interface DeliveryDeduper {
  /** 首次见到返回 true(应处理);重复投递返回 false(应跳过) */
  record(deliveryId: string): boolean
  size(): number
  clear(): void
}

export interface DeliveryDeduperOptions {
  /** 保留的投递条数上限,超出按写入顺序淘汰最旧项 */
  maxEntries?: number
  /** 单条记录的存活时长;GitHub 重试窗口远小于此值即可 */
  ttlMs?: number
}

const DEFAULT_MAX_ENTRIES = 2000
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000

/**
 * 内存 LRU + TTL 去重器(D15② 起为一级缓存)。
 *
 * 两级幂等设计:
 * - 一级:本内存表,吃下 GitHub 分钟级重投窗口,零 IO;
 * - 二级:github_app_deliveries 表(services/github-app/store.ts),覆盖 API 重启
 *   后的跨进程重投 —— 路由在一级未命中时查表,处理成功后落 processed。
 * - 多实例部署时内存一级不共享,二级表是共享事实源 —— 升级路径是 Redis SETNX,
 *   接线点只有路由里的幂等段一处。
 */
export function createDeliveryDeduper(opts: DeliveryDeduperOptions = {}): DeliveryDeduper {
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  const seen = new Map<string, number>()

  return {
    record(deliveryId: string): boolean {
      if (!deliveryId) return true
      const now = Date.now()
      const previous = seen.get(deliveryId)
      if (previous !== undefined && now - previous <= ttlMs) return false
      seen.delete(deliveryId)
      seen.set(deliveryId, now)
      while (seen.size > maxEntries) {
        const oldest = seen.keys().next()
        if (oldest.done) break
        seen.delete(oldest.value)
      }
      return true
    },
    size(): number {
      return seen.size
    },
    clear(): void {
      seen.clear()
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
