// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App webhook 入口路由(D15 / G-20 最小可用闭环)。
 *
 * 挂载方式由主会话单点接线(见交付报告的"需要接线的确切代码"),本文件不注册自己。
 *
 * 鉴权面(AGENTS §5 红线:必须显式列举,禁止参数正则兜底):
 * - 本路由**只有三条**固定路径,见 GITHUB_APP_EXPLICIT_ROUTES,零参数路由、零通配段;
 * - `/webhook` 是机器调用面,不走用户 JWT,以 HMAC-SHA256 签名作为唯一准入;
 * - `/health` 只回布尔配置状态,不回任何凭据、不回仓库数据;
 * - `/installations` 是 admin 查询面,走 requireAdmin(人用 JWT + roleId 门禁);
 * - 三条路径的 webhook/health handler **都不读 request.userId**,因此未签名请求得到
 *   401 而不是 500(fail-open 崩在鉴权层后面,比 401 更难发现 —— 本路由由测试钉死)。
 *
 * 处理链:secret 未配置 → 503;签名缺失/非法/不匹配 → 401;
 *        事件不在白名单 → 200 accepted:false;事件体不合 schema → 400;
 *        delivery guid 重复 → 200 duplicate(内存 LRU 一级 + deliveries 表二级);
 *        否则按事件种类派发,处理完成后投递落表 processed(D15②)。
 */
import type { FastifyBaseLogger, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'

import {
  createDeliveryDeduper,
  parseWebhook,
  isPrReviewAction,
  HANDLED_GITHUB_EVENTS,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  type DeliveryDeduper,
  type InstallationEventPayload,
  type WebhookEnvelope,
  type WebhookParseResult,
} from '../services/github-app/events.js'
import type { GithubAppStore, GithubAppInstallationRow } from '../services/github-app/store.js'
import { resolveGithubAppStore } from '../services/github-app/store.js'
import {
  readWebhookSecret,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from '../services/github-app/signature.js'
import {
  createGithubTransport,
  readGithubAppIdentity,
  createInstallationTokenProvider,
  type GithubTransport,
} from '../services/github-app/jwt.js'
import {
  createReviewModelFromText,
  runPrReview,
  toPrCoordinates,
  withInstallationAuth,
  type PrReviewOutcome,
  type ReviewModel,
  type TextCompletion,
} from '../services/github-app/pr-review.js'
import {
  decideCommentTrigger,
  handleIssueComment,
  type CommentTriggerOutcome,
} from '../services/github-app/comment-trigger.js'

/** 本路由**显式**注册的全部路径(相对挂载前缀)。新增路由必须同步登记,否则测试红。 */
export const GITHUB_APP_EXPLICIT_ROUTES = [
  { method: 'POST', url: '/webhook', admission: 'github-hmac-signature' },
  { method: 'GET', url: '/health', admission: 'public-status-flags-only' },
  { method: 'GET', url: '/installations', admission: 'admin-jwt' },
] as const

export const WEBHOOK_PATH = '/webhook'
export const HEALTH_PATH = '/health'
export const INSTALLATIONS_PATH = '/installations'

interface ApiOk<T> {
  code: 0
  message: 'success'
  data: T
}

interface ApiFailure {
  code: number
  message: string
  data: null
}

function ok<T>(data: T): ApiOk<T> {
  return { code: 0, message: 'success', data }
}

function fail(code: number, message: string): ApiFailure {
  return { code, message, data: null }
}

/** 未签名 / 签名不符时的统一响应:恒 4xx,且不带任何内部信息 */
function rejected(reason: string): ApiFailure {
  return fail(401, `webhook 签名校验未通过(${reason})`)
}

export interface GithubAppRouteOptions {
  /** 覆盖 GitHub API transport(测试注入假实现);缺省走 fetch */
  transport?: GithubTransport
  /** 覆盖 review 模型;缺省由 textModel 组合 */
  reviewModel?: ReviewModel | null
  /** 覆盖文本模型;缺省在 AI_SERVICE_URL 已配置时接项目内 ai-service */
  textModel?: TextCompletion | null
  /** 覆盖 webhook secret(仅测试用);缺省读 env */
  webhookSecret?: string | null
  env?: NodeJS.ProcessEnv
  deduper?: DeliveryDeduper
  /**
   * 持久层(D15①②)。undefined = 惰性接真实 db;null = 显式禁用(单测);
   * 注入实例 = 单测假实现。webhook 面在 store 不可用时降级为纯内存幂等,绝不 5xx。
   */
  store?: GithubAppStore | null
  /** 覆盖 /installations 的 admin 闸门(测试注入);缺省懒加载 require-permission 的 requireAdmin */
  adminGuard?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
}

/** 请求头统一取值(Fastify 会把重头折叠成数组) */
function headerValue(headers: Record<string, unknown>, name: string): string | undefined {
  const raw = headers[name]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : undefined
  return undefined
}

/** 把 body 归一成原始字符串:签名基于未解析字节,parseAs:'string' 已保证是 string */
function rawBodyOf(body: unknown): string | null {
  if (typeof body === 'string') return body
  return null
}

/** 惰性组装默认文本模型:动态 import 让本模块的加载链不拖进 ai-service / db */
async function resolveDefaultTextModel(
  env: NodeJS.ProcessEnv,
  log: FastifyBaseLogger,
): Promise<TextCompletion | null> {
  const baseUrl = env['AI_SERVICE_URL']?.trim()
  if (!baseUrl) return null
  try {
    const { aiServiceFetch } = await import('../utils/ai-service-fetch.js')
    const { createAiServiceTextModel } = await import('../services/github-app/pr-review.js')
    return createAiServiceTextModel({
      call: (path, init) => aiServiceFetch(null, path, init),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    log.warn(`[github-app] 文本模型接线失败,机器人能力降级为跳过:${message}`)
    return null
  }
}

/** 组装带 installation 鉴权的 transport;App 凭据未配置返回 null */
function buildGithubTransport(
  options: GithubAppRouteOptions,
  installationId: number,
  log: FastifyBaseLogger,
): GithubTransport | null {
  if (options.transport) return options.transport
  const identity = readGithubAppIdentity(options.env ?? process.env)
  if (!identity) {
    log.warn('[github-app] GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY 未配置,无法调用 GitHub API')
    return null
  }
  const base = createGithubTransport()
  return withInstallationAuth(base, createInstallationTokenProvider(identity, base), installationId)
}

/** 惰性解析持久层:显式注入(null/实例)优先,否则走 store.ts 的动态 import 缺省链 */
async function resolveStore(
  options: GithubAppRouteOptions,
  log: FastifyBaseLogger,
): Promise<GithubAppStore | null> {
  if (options.store !== undefined) return options.store
  return resolveGithubAppStore(log)
}

/** 处理完成后把投递落表;存储故障只告警 —— webhook 面绝不因幂等表 5xx */
async function recordProcessedDelivery(
  store: GithubAppStore | null,
  envelope: WebhookEnvelope,
  log: FastifyBaseLogger,
): Promise<void> {
  if (!store || !envelope.deliveryId) return
  try {
    await store.recordDelivery(envelope.deliveryId, envelope.event)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    log.warn({ delivery: envelope.deliveryId }, `[github-app] 投递落表失败(不影响响应):${message}`)
  }
}

/** installation 事件的处理结果:applied=已落表;skipped 带原因 */
export interface InstallationOutcome {
  status: 'applied' | 'skipped'
  reason?: 'unsupported_action' | 'store_unavailable' | 'store_error'
  installationId?: number
}

/** 本 App 消费的 installation action → 落表状态(白名单,非这两个一律忽略) */
const INSTALLATION_ACTION_STATUS: Record<string, 'active' | 'removed'> = {
  created: 'active',
  deleted: 'removed',
  new_permission_accepted: 'active',
}

/**
 * 把 installation 事件映射成安装表 upsert(D15①)。
 * created / new_permission_accepted → active,deleted → removed;
 * 事件体缺 sender 时 installed_by_user_id 落 NULL(拿不到就是拿不到,不造数)。
 */
async function applyInstallationEvent(
  store: GithubAppStore | null,
  event: InstallationEventPayload,
  log: FastifyBaseLogger,
): Promise<InstallationOutcome> {
  const status = INSTALLATION_ACTION_STATUS[event.action]
  if (!status) return { status: 'skipped', reason: 'unsupported_action' }
  if (!store) return { status: 'skipped', reason: 'store_unavailable' }
  try {
    await store.applyInstallationEvent({
      installationId: event.installation.id,
      accountLogin: event.installation.account?.login ?? null,
      targetType: event.installation.target_type ?? null,
      installedByUserId: event.sender?.id ?? null,
      status,
    })
    return { status: 'applied', installationId: event.installation.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    log.warn({ installationId: event.installation.id }, `[github-app] 安装事件落表失败:${message}`)
    return { status: 'skipped', reason: 'store_error' }
  }
}

/**
 * /installations 的缺省 admin 闸门:懒加载 require-permission(其静态链拖 auth/rbac/db,
 * 不能在模块顶层 import,否则 webhook 单测的加载面被污染)。
 */
async function requireAdminGuardLazy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { requireAdmin } = await import('../plugins/require-permission.js')
  return requireAdmin(request, reply)
}

type IgnoredParse = Extract<WebhookParseResult, { status: 'ignored' }>

function ignoredReply(
  ignored: IgnoredParse,
): ApiOk<{ accepted: boolean; reason: string; event: string }> {
  return ok({ accepted: false, reason: ignored.reason, event: ignored.event })
}

export const githubAppRoutes: FastifyPluginAsync<GithubAppRouteOptions> = async (
  server,
  options,
) => {
  const deduper = options.deduper ?? createDeliveryDeduper()

  // 本作用域内保留原始 JSON 字符串:HMAC 基于原始字节,不能被 Fastify 先解析成对象
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body)
  })

  server.get(HEALTH_PATH, async () => {
    const env = options.env ?? process.env
    return ok({
      webhookSecretConfigured: readWebhookSecret(env) !== null,
      appCredentialsConfigured: readGithubAppIdentity(env) !== null,
      handledEvents: [...HANDLED_GITHUB_EVENTS],
      explicitRoutes: GITHUB_APP_EXPLICIT_ROUTES.map((route) => route.url),
    })
  })

  // D15③:admin 查询面 —— 安装台账 + 配置状态(只报布尔,绝不回任何 secret 值)
  server.get(
    INSTALLATIONS_PATH,
    { preHandler: options.adminGuard ?? requireAdminGuardLazy },
    async (request, reply) => {
      const store = await resolveStore(options, request.log)
      if (!store) return reply.status(503).send(fail(503, 'GitHub App 持久层未就绪'))
      let installations: GithubAppInstallationRow[]
      try {
        installations = await store.listInstallations()
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        request.log.warn(`[github-app] 安装列表查询失败:${message}`)
        return reply.status(500).send(fail(500, '安装列表查询失败'))
      }
      const env = options.env ?? process.env
      return ok({
        installations,
        config: {
          webhookSecretConfigured: readWebhookSecret(env) !== null,
          appCredentialsConfigured: readGithubAppIdentity(env) !== null,
        },
      })
    },
  )

  server.post(WEBHOOK_PATH, async (request, reply) => {
    const env = options.env ?? process.env
    const secret =
      options.webhookSecret === undefined ? readWebhookSecret(env) : options.webhookSecret

    // 1) secret 未配置 => 503。绝不因为"没配密钥"放行(fail-open 是本路由的第一号禁令)
    if (!secret) {
      request.log.warn('[github-app] webhook secret 未配置,拒绝接收')
      return reply.status(503).send(fail(503, 'webhook secret 未配置'))
    }

    // 2) 签名校验在最前,且在任何解析/派发之前
    const rawBody = rawBodyOf(request.body)
    if (rawBody === null) {
      return reply.status(415).send(fail(415, '请求体必须是 application/json 原始字符串'))
    }
    const verification = verifyWebhookSignature({
      rawBody,
      signatureHeader: headerValue(request.headers, WEBHOOK_SIGNATURE_HEADER),
      secret,
    })
    if (!verification.ok) {
      request.log.warn(
        {
          reason: verification.reason,
          delivery: headerValue(request.headers, WEBHOOK_DELIVERY_HEADER),
          ip: request.ip,
        },
        '[github-app] 签名校验失败',
      )
      return reply.status(401).send(rejected(verification.reason))
    }

    // 3) 事件体解析(白名单事件 + Zod)
    let payload: unknown
    try {
      payload = JSON.parse(rawBody) as unknown
    } catch {
      return reply.status(400).send(fail(400, 'payload 非合法 JSON'))
    }
    const parsed = parseWebhook({
      eventHeader: headerValue(request.headers, WEBHOOK_EVENT_HEADER),
      deliveryHeader: headerValue(request.headers, WEBHOOK_DELIVERY_HEADER),
      payload,
    })
    if (parsed.status === 'ignored') return reply.send(ignoredReply(parsed))
    if (parsed.status === 'invalid') {
      return reply.status(400).send(fail(400, parsed.message))
    }

    // 4) 幂等(两级,D15②):一级内存 LRU 吃分钟级重投;二级 deliveries 表吃跨重启重投。
    //    表查询失败时按"未处理"继续(fail-open),由处理器自身的 (repo, pr, commit) 幂等兜底。
    const { envelope } = parsed.data
    if (envelope.deliveryId && !deduper.record(envelope.deliveryId)) {
      request.log.info({ delivery: envelope.deliveryId }, '[github-app] 重复投递,跳过')
      return reply.send(
        ok({ accepted: false, reason: 'duplicate_delivery', event: envelope.event }),
      )
    }
    const store = await resolveStore(options, request.log)
    if (envelope.deliveryId && store) {
      let seenInDb = false
      try {
        seenInDb = await store.hasDelivery(envelope.deliveryId)
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        request.log.warn(
          { delivery: envelope.deliveryId },
          `[github-app] 投递查表失败,按未处理继续:${message}`,
        )
      }
      if (seenInDb) {
        request.log.info(
          { delivery: envelope.deliveryId },
          '[github-app] 重复投递(持久层命中),跳过',
        )
        return reply.send(
          ok({ accepted: false, reason: 'duplicate_delivery', event: envelope.event }),
        )
      }
    }
    if (parsed.data.kind === 'ping') {
      await recordProcessedDelivery(store, envelope, request.log)
      return reply.send(ok({ accepted: true, reason: 'pong', event: 'ping' }))
    }

    // 4.5) installation 事件:只驱动安装映射表(D15①),不碰 GitHub API
    if (parsed.data.kind === 'installation') {
      const outcome = await applyInstallationEvent(store, parsed.data.payload, request.log)
      await recordProcessedDelivery(store, envelope, request.log)
      return reply.send(
        ok({
          accepted: outcome.status === 'applied',
          event: 'installation',
          action: envelope.action,
          outcome,
        }),
      )
    }

    // 5) 派发
    if (parsed.data.kind === 'pull_request') {
      const event = parsed.data.payload
      if (!isPrReviewAction(envelope.action)) {
        return reply.send(
          ok({
            accepted: false,
            reason: 'action_not_reviewed',
            event: 'pull_request',
            action: envelope.action,
          }),
        )
      }
      const coordinates = toPrCoordinates(
        envelope.repoFullName,
        event.pull_request.number,
        envelope.installationId,
      )
      if (!coordinates) {
        return reply.send(
          ok({ accepted: false, reason: 'no_installation_or_repo', event: 'pull_request' }),
        )
      }
      const transport = buildGithubTransport(options, coordinates.installationId, request.log)
      if (!transport) {
        return reply.send(
          ok({ accepted: false, reason: 'app_credentials_not_configured', event: 'pull_request' }),
        )
      }
      const textModel =
        options.textModel !== undefined
          ? options.textModel
          : await resolveDefaultTextModel(env, request.log)
      const reviewModel =
        options.reviewModel === undefined
          ? createReviewModelFromTextOrEmpty(textModel)
          : options.reviewModel
      const outcome: PrReviewOutcome = await runPrReview(
        { transport, reviewModel },
        {
          title: event.pull_request.title,
          description: event.pull_request.body ?? null,
          baseRef: event.pull_request.base.ref,
          headRef: event.pull_request.head.ref,
          commitSha: event.pull_request.head.sha,
          coordinates,
          isDraft: event.pull_request.draft,
          log: (level, message) => request.log[level](message),
        },
      )
      // 到这里处理已收敛(runPrReview 不抛,失败也是 outcome.status),投递落表
      await recordProcessedDelivery(store, envelope, request.log)
      return reply.send(
        ok({ accepted: true, event: 'pull_request', action: envelope.action, outcome }),
      )
    }

    const event = parsed.data.payload
    const decision = decideCommentTrigger({
      action: envelope.action,
      commentBody: event.comment.body,
      commenterLogin: event.comment.user.login,
      isPullRequestDiscussion:
        event.issue.pull_request !== null && event.issue.pull_request !== undefined,
    })
    if (!decision.handle) {
      return reply.send(ok({ accepted: false, reason: decision.reason, event: 'issue_comment' }))
    }
    const coordinates = toPrCoordinates(
      envelope.repoFullName,
      event.issue.number,
      envelope.installationId,
    )
    if (!coordinates) {
      return reply.send(
        ok({ accepted: false, reason: 'no_installation_or_repo', event: 'issue_comment' }),
      )
    }
    const transport = buildGithubTransport(options, coordinates.installationId, request.log)
    if (!transport) {
      return reply.send(
        ok({ accepted: false, reason: 'app_credentials_not_configured', event: 'issue_comment' }),
      )
    }
    const textModel =
      options.textModel !== undefined
        ? options.textModel
        : await resolveDefaultTextModel(env, request.log)
    const outcome: CommentTriggerOutcome = await handleIssueComment(
      { transport, complete: textModel },
      {
        coordinates,
        prTitle: event.issue.title ?? '',
        instruction: decision.mention.instruction,
        mention: decision.mention,
        isDraft: false,
        log: (level, message) => request.log[level](message),
      },
    )
    await recordProcessedDelivery(store, envelope, request.log)
    return reply.send(ok({ accepted: true, event: 'issue_comment', outcome }))
  })
}

/** 文本模型缺失时不构造 review 模型 —— 交给 runPrReview 明确报 skipped */
function createReviewModelFromTextOrEmpty(textModel: TextCompletion | null): ReviewModel | null {
  return textModel ? createReviewModelFromText(textModel) : null
}

export default githubAppRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
