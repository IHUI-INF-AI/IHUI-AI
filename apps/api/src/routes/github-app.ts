// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App webhook 入口路由(D15 / G-20 最小可用闭环)。
 *
 * 挂载方式由主会话单点接线(见交付报告的"需要接线的确切代码"),本文件不注册自己。
 *
 * 鉴权面(AGENTS §5 红线:必须显式列举,禁止参数正则兜底):
 * - 本路由**只有两条**固定路径,见 GITHUB_APP_EXPLICIT_ROUTES,零参数路由、零通配段;
 * - `/webhook` 是机器调用面,不走用户 JWT,以 HMAC-SHA256 签名作为唯一准入;
 * - `/health` 只回布尔配置状态,不回任何凭据、不回仓库数据;
 * - 两条路径的 handler **都不读 request.userId**,因此未签名请求得到 401 而不是 500
 *   (fail-open 崩在鉴权层后面,比 401 更难发现 —— 本路由由测试钉死这条)。
 *
 * 处理链:secret 未配置 → 503;签名缺失/非法/不匹配 → 401;
 *        事件不在白名单 → 200 accepted:false;事件体不合 schema → 400;
 *        delivery guid 重复 → 200 duplicate;否则按事件种类派发。
 */
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify'

import {
  createDeliveryDeduper,
  parseWebhook,
  isPrReviewAction,
  HANDLED_GITHUB_EVENTS,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  type DeliveryDeduper,
  type WebhookParseResult,
} from '../services/github-app/events.js'
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
] as const

export const WEBHOOK_PATH = '/webhook'
export const HEALTH_PATH = '/health'

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

    // 4) 幂等:GitHub 重投同一 X-GitHub-Delivery,只处理一次
    const { envelope } = parsed.data
    if (envelope.deliveryId && !deduper.record(envelope.deliveryId)) {
      request.log.info({ delivery: envelope.deliveryId }, '[github-app] 重复投递,跳过')
      return reply.send(
        ok({ accepted: false, reason: 'duplicate_delivery', event: envelope.event }),
      )
    }
    if (parsed.data.kind === 'ping') {
      return reply.send(ok({ accepted: true, reason: 'pong', event: 'ping' }))
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
    return reply.send(ok({ accepted: true, event: 'issue_comment', outcome }))
  })
}

/** 文本模型缺失时不构造 review 模型 —— 交给 runPrReview 明确报 skipped */
function createReviewModelFromTextOrEmpty(textModel: TextCompletion | null): ReviewModel | null {
  return textModel ? createReviewModelFromText(textModel) : null
}

export default githubAppRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
