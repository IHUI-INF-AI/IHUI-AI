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
 *        事件不在白名单 → 200 accepted:false;事件体不合 schema → 400(带缺少的字段路径);
 *        CI 三类事件(check_suite / workflow_run / check_run)→ 200 + reason=ci_event_not_subscribed
 *        (Y-13:认得出、有话回,不再判 unsupported_event 静默丢弃;且**应答前不做任何外部 IO**
 *        —— 不落幂等表、不等 DB,那一枚 dur=10s 的 500 就是应答被幂等表拖住的形状);
 *        delivery guid 重复 → 200 duplicate(内存 LRU 一级 + deliveries 表二级;CI 忽略族只走一级);
 *        否则按事件种类派发,处理完成后投递落表 processed(D15②);
 *        派发抛错 → 结构化 500(带 requestId/delivery 供对账,不回显异常正文)。
 *
 * Y-91(2026-11-06 立)—— **先回 200,再异步处理**:pull_request / issue_comment 这两条
 * 要等外部 IO 的派发路径(动态取文本模型 + runPrReview/handleIssueComment 打 GitHub API +
 * 投递落表)整段进 `services/webhook-github-dispatch.ts` 的一次性内存队列,应答最多等
 * `responseBudgetMs`(env `GITHUB_WEBHOOK_RESPONSE_BUDGET_MS`,缺省 500ms;0 = 纯异步档)。
 * 预算内跑完 → 响应体带 `dispatch:'inline'` + 原有 `outcome`(响应形状因此不回退);
 * 预算到点 → 立刻 200 + `dispatch:'async'`,任务不取消、跑完照样落表。
 * 现场读数依据:应用侧 p95 2217ms / max 19720ms / ≥10s 10 枚,而公网腿 100/100 成功、
 * p95 1120ms、源站 /api/health p50 2ms、隧道 concurrent=0 ⇒ 长尾住在本文件同步等外部 IO 的
 * 这段里,**加源站并发买不到任何效果**。签名校验与事件体判定仍排在应答之前(401/400 面不动)。
 * 该队列不是常驻服务:无定时器、无轮询、无独立进程,派发节拍由 `schedule` 注入。
 *
 * 回调注册地址的腿位不变量(2026-10-29 实测立):GitHub App 的 `url` 必须登记成
 * `https://api.aizhs.top/api/github-app/webhook`,**不得**用裸域或 `www.` 那两条 ——
 * 二者都经 web 蓝绿 router,换流瞬间会对本入口连发 ECONNRESET(svc-web-router.log 里
 * 19:47–21:23Z 共 10 条),GitHub 侧表现为 522/超时并在 1–3 分钟一次重试;而 api 腿由
 * IHUI-API-ROUTER 单点接管、换流期不断流。仓内没有任何脚本写这个 url(只能经 GitHub
 * API/控制台改),所以这条只能靠读这里的人遵守:改址前先 `GET /app/hook/config` 取现值,
 * 换腿后用真实事件(不是重投——重投读到的可能是旧记录)核对投递落在哪条腿。
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
import {
  createWebhookDispatchQueue,
  resolveResponseBudgetMs,
  type DispatchJobDescriptor,
  type DispatchOutcome,
  type WebhookDispatchQueue,
} from '../services/webhook-github-dispatch.js'

/** 本路由**显式**注册的全部路径(相对挂载前缀)。新增路由必须同步登记,否则测试红。 */
export const GITHUB_APP_EXPLICIT_ROUTES = [
  { method: 'POST', url: '/webhook', admission: 'github-hmac-signature' },
  { method: 'GET', url: '/health', admission: 'public-status-flags-only' },
  { method: 'GET', url: '/installations', admission: 'admin-jwt' },
] as const

export const WEBHOOK_PATH = '/webhook'
export const HEALTH_PATH = '/health'
export const INSTALLATIONS_PATH = '/installations'

interface ApiFailure {
  code: number
  message: string
  data: null
}

/**
 * 成功信封不在端内重造:`success()`/`ApiSuccess` 的唯一实现住在 utils/response.ts,
 * 本文件的形状与它逐字节相同(code:0 / message:'success' / data),只留别名不换 16 处调用点。
 */
type ApiOk<T> = ApiSuccess<T>
const ok = success

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
  /**
   * Y-91(2026-11-06)应答预算(ms):重活最多让提供方等多久,到点先回 200、任务在队列内跑完。
   * 缺省读 `GITHUB_WEBHOOK_RESPONSE_BUDGET_MS`(坏值回落 500);显式 0 = 一律先回 200 的纯异步档。
   */
  responseBudgetMs?: number
  /** Y-91:注入派发队列(测试用假节拍);缺省本插件作用域自建一次性内存队列,非常驻服务 */
  dispatchQueue?: WebhookDispatchQueue
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
 * /installations 的缺省 admin 闸门:懒加载形态的唯一实现住在
 * plugins/lazy-admin-guard.ts(此前与 automations.ts 各写一份逐字相同的 shim)。
 */
import { requireAdminGuardLazy } from '../plugins/lazy-admin-guard.js'
import { success, type ApiSuccess } from '../utils/response.js'

type IgnoredParse = Extract<WebhookParseResult, { status: 'ignored' }>

function ignoredReply(
  ignored: IgnoredParse,
): ApiOk<{ accepted: boolean; reason: string; event: string }> {
  return ok({ accepted: false, reason: ignored.reason, event: ignored.event })
}

/**
 * Y-91 派发出口:把"要等外部 IO 的重活"交给队列,并只在**应答预算**内等它。
 *
 * 三条语义(与 tests/github-webhook-async-dispatch.test.ts 逐条对照):
 * - 队列拒收(积压满/已关闭)⇒ 就地执行。宁可这一条慢,也绝不静默丢活(§0.10),并记 error 点名。
 * - 预算内跑完 ⇒ 结果照旧随 200 返回 ⇒ 既有响应形状不回退(旧测试的 `outcome` 断言仍然成立)。
 * - 预算到点 ⇒ `deferred`:调用方立刻回 200,任务不取消、不重投,后台跑完并落投递表。
 *   现场那 10 枚 ≥10s 与 max 19720ms 就是这一档 —— GitHub 侧 10s 超时前拿到 200,
 *   重投风暴与"它记失败/我方记重复"的对不上账因此从源头断掉。
 */
async function dispatchWithResponseBudget<T>(args: {
  dispatcher: WebhookDispatchQueue
  budgetMs: number
  job: DispatchJobDescriptor
  log: FastifyBaseLogger
  task: () => Promise<T>
}): Promise<DispatchOutcome<T>> {
  const { dispatcher, budgetMs, job, log, task } = args
  const handle = dispatcher.submit(job, task)

  if (!handle.accepted) {
    log.error(
      {
        delivery: job.deliveryId,
        event: job.event,
        reason: handle.rejectReason,
        depth: handle.depthAfterSubmit,
      },
      '[github-app] 派发队列拒绝受理 → 就地执行(不丢活,但要留痕)',
    )
    try {
      return { phase: 'completed', value: await task() }
    } catch (error) {
      return { phase: 'failed', error }
    }
  }

  const outcome = await handle.awaitWithin(budgetMs)
  if (outcome.phase === 'deferred') {
    log.info(
      { delivery: job.deliveryId, event: job.event, budgetMs, depth: dispatcher.depth() },
      '[github-app] 超应答预算 → 先回 200,重活在队列内继续跑完',
    )
  }
  return outcome
}

/**
 * 处理链错误边界(Y-13,2026-10-29 立)。
 *
 * 此前 handler 抛错由 Fastify 兜底成裸 500(`{"statusCode":500,"error":"Internal Server Error"}`):
 * GitHub 侧只留一条 500 + durationMs,既对不上是哪条投递,也没法与我们日志对账 —— 现场那条
 * `check_run / 500 / durationMs=10s` 就是这么丢的(既无 delivery 也没异常名)。
 * 这里统一转成结构化 500:带 requestId 与 delivery 供对账,**不回显**异常正文
 * (可能是上游响应片段或 DB 报错);异常名 + message 只进日志。
 */
function withDiagnosableFailure(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
): (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> {
  return async (request, reply) => {
    try {
      return await handler(request, reply)
    } catch (error) {
      const delivery = headerValue(request.headers, WEBHOOK_DELIVERY_HEADER) ?? ''
      request.log.error(
        {
          err: error instanceof Error ? { name: error.name, message: error.message } : error,
          delivery,
          event: headerValue(request.headers, WEBHOOK_EVENT_HEADER) ?? '',
          requestId: request.id,
        },
        '[github-app] 处理链异常(已捕获,返回可诊断 500)',
      )
      if (reply.sent) throw error
      return reply
        .status(500)
        .send(
          fail(500, `处理链异常,已记录(requestId=${request.id}, delivery=${delivery || 'none'})`),
        )
    }
  }
}

export const githubAppRoutes: FastifyPluginAsync<GithubAppRouteOptions> = async (
  server,
  options,
) => {
  const deduper = options.deduper ?? createDeliveryDeduper()
  // Y-91:本插件作用域内的一条一次性内存队列(无定时器/无轮询/无独立进程 ⇒ 不是常驻服务)。
  // 后台任务的失败必须在这里就落进日志 —— 队列内已捕获,日志是它唯一的出口。
  const dispatcher =
    options.dispatchQueue ??
    createWebhookDispatchQueue({
      onError: (error, job) => {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        server.log.error(
          { delivery: job.deliveryId, event: job.event, err: message },
          '[github-app] 异步派发任务失败(已捕获,不影响已发出的 2xx)',
        )
      },
    })

  // 本作用域内保留原始 JSON 字符串:HMAC 基于原始字节,不能被 Fastify 先解析成对象
  // 根实例已有自定义 application/json(server.ts)⇒ 先 remove 再 add,否则抛 ALREADY_PRESENT。
  server.removeContentTypeParser('application/json')
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
      // Y-91:异步派发的现场读数(队列深度 + 应答预算)—— 长尾是否被预算吃掉要能量得到,不能靠感觉
      dispatch: {
        depth: dispatcher.depth(),
        closed: dispatcher.closed,
        responseBudgetMs: options.responseBudgetMs ?? resolveResponseBudgetMs(env),
      },
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

  server.post(
    WEBHOOK_PATH,
    {
      // 2026-10-29 实测:近 4 小时该路径 59 条 400 全部来自 sqli-guard 命中(GitHub 侧同刻的
      // App 投递也记 400,集中在 workflow_run / check_suite)——提供方正文里的引号/分号 ∧ SQL
      // 结构签名被当成语句注入,投递判失败并重试成风暴。本端点准入是 HMAC-SHA256 签名(见本文件
      // 头注),拿不到 webhook secret 就构造不出请求;正文只进 Drizzle 参数化查询,不拼 SQL。
      // 同型先例:/api/ai/callback(2026-08-06 生产故障立)、internal-tool-invocation-ledger。
      config: { sqliGuard: { enabled: false } },
    },
    withDiagnosableFailure(async (request, reply) => {
      const env = options.env ?? process.env
      // Y-91 应答预算:每条投递现读(env 可在运行期被运维改),显式注入优先
      const responseBudgetMs = options.responseBudgetMs ?? resolveResponseBudgetMs(env)
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
      // 4.5) CI 三类事件(Y-13,2026-10-29 立;2026-11-06 收尾:应答路径**零外部 IO**)。
      //      check_suite / workflow_run / check_run 没有处理分支,位置因此刻意排在
      //      resolveStore + hasDelivery **之前**:为一次"我们不处理"的投递去等幂等表,
      //      等于把应答挂在提供方的超时预算上。现场那枚 `check_run / 500 / dur=10s` 就是这一型 ——
      //      实测(把 store.hasDelivery 换成永不 settle 的 Promise)改前这条路径**根本不出响应**,
      //      应答由幂等表决定;上游等不到就先记 500,我方连一条 error 日志都留不下。
      //      二级幂等表只对有副作用的事件有意义(ping/installation/pull_request/issue_comment);
      //      CI 这族重投的代价只是"再忽略一次",因此一级内存去重(deduper,零 IO)照常生效、
      //      二级表不落。要区分"看到了但没订阅"与"没收到",看下面这条 info 日志的 delivery/repo/ci。
      //      这三类要真正驱动动作(评论触发/工单闭环)需另开一票定义动作面,届时再回两级幂等。
      if (parsed.data.kind === 'ci_event') {
        const { event: ciEvent, summary } = parsed.data
        request.log.info(
          {
            delivery: envelope.deliveryId,
            event: ciEvent,
            action: envelope.action,
            repo: envelope.repoFullName,
            ci: summary,
          },
          '[github-app] CI 事件已识别,当前无订阅处理分支 → 显式忽略(不落幂等表,应答零 IO)',
        )
        return reply.send(
          ok({
            accepted: false,
            reason: 'ci_event_not_subscribed',
            event: ciEvent,
            action: envelope.action,
            ci: {
              id: summary.id,
              status: summary.status,
              conclusion: summary.conclusion,
              headSha: summary.headSha,
              headBranch: summary.headBranch,
              unresolved: summary.unresolved,
            },
          }),
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

      // 4.6) installation 事件:只驱动安装映射表(D15①),不碰 GitHub API
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
            ok({
              accepted: false,
              reason: 'app_credentials_not_configured',
              event: 'pull_request',
            }),
          )
        }
        // Y-91:评审整段(取模型 → runPrReview → 投递落表)交异步派发。
        // `resolveDefaultTextModel` 在缺省链上会动态 import ai-service 并打一次模型目录,
        // `runPrReview` 打 GitHub API —— 这两处就是现场 p95 2217ms / max 19720ms 的成因,
        // 因此**连同落表一起**放进任务体,而不是只把 runPrReview 挪出去、把取模型留在应答路径上。
        const dispatched = await dispatchWithResponseBudget<PrReviewOutcome>({
          dispatcher,
          budgetMs: responseBudgetMs,
          job: { deliveryId: envelope.deliveryId, event: 'pull_request' },
          log: request.log,
          task: async () => {
            const textModel =
              options.textModel !== undefined
                ? options.textModel
                : await resolveDefaultTextModel(env, request.log)
            const reviewModel =
              options.reviewModel === undefined
                ? createReviewModelFromTextOrEmpty(textModel)
                : options.reviewModel
            const review: PrReviewOutcome = await runPrReview(
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
            // 处理收敛后投递落表(二级幂等):异步档也必须落,否则重启后同 delivery 会被重放
            await recordProcessedDelivery(store, envelope, request.log)
            return review
          },
        })
        if (dispatched.phase === 'completed') {
          return reply.send(
            ok({
              accepted: true,
              event: 'pull_request',
              action: envelope.action,
              dispatch: 'inline',
              outcome: dispatched.value,
            }),
          )
        }
        if (dispatched.phase === 'failed') throw dispatched.error
        return reply.send(
          ok({
            accepted: true,
            event: 'pull_request',
            action: envelope.action,
            dispatch: 'async',
          }),
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
      // Y-91:同 pull_request —— 取模型 + 回写评论 + 落表整段进队列,应答只等预算。
      const dispatchedComment = await dispatchWithResponseBudget<CommentTriggerOutcome>({
        dispatcher,
        budgetMs: responseBudgetMs,
        job: { deliveryId: envelope.deliveryId, event: 'issue_comment' },
        log: request.log,
        task: async () => {
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
          return outcome
        },
      })
      if (dispatchedComment.phase === 'completed') {
        return reply.send(
          ok({
            accepted: true,
            event: 'issue_comment',
            dispatch: 'inline',
            outcome: dispatchedComment.value,
          }),
        )
      }
      if (dispatchedComment.phase === 'failed') throw dispatchedComment.error
      return reply.send(ok({ accepted: true, event: 'issue_comment', dispatch: 'async' }))
    }),
  )
}

/** 文本模型缺失时不构造 review 模型 —— 交给 runPrReview 明确报 skipped */
function createReviewModelFromTextOrEmpty(textModel: TextCompletion | null): ReviewModel | null {
  return textModel ? createReviewModelFromText(textModel) : null
}

export default githubAppRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
