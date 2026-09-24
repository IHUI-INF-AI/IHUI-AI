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

// ---------------------------------------------------------------------------
// 显式列举的处理面(AGENTS §5 红线:禁止用参数正则兜底公开面)
// ---------------------------------------------------------------------------

/** 本 App **订阅并真正处理**的事件名 —— 白名单,不是正则 */
export const HANDLED_GITHUB_EVENTS = ['ping', 'pull_request', 'issue_comment'] as const
export type HandledGithubEvent = (typeof HANDLED_GITHUB_EVENTS)[number]

/** 触发自动 review 的 pull_request action —— 白名单 */
export const PR_REVIEW_ACTIONS = ['opened', 'synchronize', 'reopened', 'ready_for_review'] as const
export type PrReviewAction = (typeof PR_REVIEW_ACTIONS)[number]

function isHandledEvent(name: string): name is HandledGithubEvent {
  return (HANDLED_GITHUB_EVENTS as readonly string[]).includes(name)
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
  event: HandledGithubEvent
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
 * 把 (事件头, 投递头, 已解析的 JSON 体) 归一成可判别联合。
 *
 * 设计要点:
 * - 事件名**必须**落在 HANDLED_GITHUB_EVENTS 里,否则 ignored(不猜测、不放行未知形态);
 * - 事件体不符 zod schema => invalid(路由回 400),绝不带病往下派发;
 * - 缺 installation 不视为非法:仍返回 ok,由 installationId=null 让处理器自行跳过并给出原因。
 */
export function parseWebhook(input: {
  eventHeader: string | string[] | undefined
  deliveryHeader: string | string[] | undefined
  payload: unknown
}): WebhookParseResult {
  const eventRaw = headerToString(input.eventHeader).trim()
  if (!eventRaw) return { status: 'ignored', reason: 'missing_event_header', event: '' }
  if (!isHandledEvent(eventRaw))
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
 * 内存 LRU + TTL 去重器。
 *
 * 取舍(为什么不是 onConflictDoNothing 落库):
 * - 落库需要新增表 + 迁移,而迁移属另一会话领地(本票禁止改 packages/database);
 * - 去重只需覆盖 GitHub 的重投窗口(分钟级),内存表足够,重启后最坏是"重投被再处理一次",
 *   而 review/comment 处理器本身按 (repo, pr, commit) 幂等,不会因此重复刷屏;
 * - 多实例部署时内存去重不共享 —— 这是已知边界,升级路径是换成同一张 DB 表或 Redis SETNX,
 *   接线点只有本函数一个。
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
