import Fastify, {
  type FastifyInstance,
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import underPressure from '@fastify/under-pressure'
import websocket from '@fastify/websocket'
import { pino } from 'pino'
import { join } from 'node:path'

import { registerRoutes } from './routes/index.js'

import { setFastify } from './utils/logger.js'
import { isAppError } from './errors/index.js'
import { config } from './config/index.js'
import authPlugin from './plugins/auth.js'
import rlsContextPlugin from './plugins/rls-context.js'
import auditPlugin from './plugins/audit.js'
import uploadScannerPlugin from './plugins/upload-scanner.js'
import apiLoggerPlugin from './plugins/api-logger.js'
import csrfPlugin from './plugins/csrf.js'
import responseSanitizerPlugin from './plugins/response-sanitizer.js'
import logSanitizerPlugin from './plugins/log-sanitizer.js'
import { metricsPlugin } from './plugins/metrics.js'
import { tracePlugin } from './plugins/trace.js'
import { redis } from './plugins/redis.js'
import { queue } from './plugins/queue.js'
import { scheduler } from './plugins/scheduler.js'
import { distributedRateLimit } from './plugins/distributed-rate-limit.js'
import { paymentIdempotency } from './plugins/payment-idempotency.js'
import { cacheResilience } from './plugins/cache-resilience.js'
import { wsNotifications } from './plugins/ws-notifications.js'
import { wsAi } from './plugins/ws-ai.js'
import { wsChat } from './plugins/ws-chat.js'
import { wsCustomerService } from './plugins/ws-customer-service.js'
import wsPayment from './plugins/ws-payment.js'
import { wsBroadcast } from './plugins/ws-broadcast.js'
import { wsMessages } from './plugins/ws-messages.js'
import { wsTasks } from './plugins/ws-tasks.js'
import otelPlugin from './plugins/otel.js'
import businessMetricsPlugin from './plugins/business-metrics.js'
import xssProtectionPlugin from './plugins/xss-protection.js'
import apiVersioningPlugin from './plugins/api-versioning.js'
import compressionPlugin from './plugins/compression.js'
import apiLoggerExtendedPlugin from './plugins/api-logger-extended.js'
import aiCostPlugin from './plugins/ai-cost.js'
import tenantPlugin from './plugins/tenant.js'
import { slowSqlKiller } from './plugins/slow-sql-killer.js'
import { dbKeepalive } from './plugins/db-keepalive.js'
import { n1Detector } from './plugins/n1-detector.js'
import { promptInjectionGuard } from './plugins/prompt-injection-guard.js'
import { tenantDbIsolation } from './plugins/tenant-db-isolation.js'
import tenantDbPlugin from './plugins/tenant-db.js'
import { tokenBalanceService } from './plugins/token-balance-service.js'
import { resilienceToolkit } from './plugins/resilience-toolkit.js'
import canaryRouterPlugin from './plugins/canary-router.js'
import { startAutoRollbackMonitor } from './services/auto-rollback.js'
import searchAspectPlugin from './plugins/search-aspect.js'
import watchAspectPlugin from './plugins/watch-aspect.js'
import pointAspectPlugin from './plugins/point-aspect.js'
// 2026-07-24 国安级安全升级(E2-E5):mTLS / 网络分段 / 审计链 / 反自动化
import mtlsPlugin from './plugins/mtls.js'
import networkSegmentPlugin from './plugins/network-segment.js'
import auditLoggerPlugin from './plugins/audit-logger.js'
import antiAutomationPlugin from './plugins/anti-automation.js'

// Fastify 5 的 logger 选项只接受配置对象(不接受 pino 实例)
const loggerConfig = {
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
}

// 独立 pino 实例(errorHandler 在 server 创建前定义,需要独立 logger)
const logger = pino(loggerConfig)

/**
 * 统一错误响应处理器。
 * 将抛出的带 statusCode 的错误转换为 { code, message } 格式。
 */
function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  const isZodErr =
    error.name === 'ZodError' && Array.isArray((error as { issues?: unknown[] }).issues)
  const statusCode = isZodErr
    ? 400
    : error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500

  if (statusCode >= 500) {
    logger.error({ err: error }, 'Unhandled error')
  } else {
    logger.warn({ err: error.message, statusCode }, 'Request error')
  }

  const errorCode = isAppError(error) ? error.errorCode : isZodErr ? 'VALIDATION_FAILED' : undefined
  const message = isZodErr
    ? ((error as { issues?: Array<{ message?: string }> }).issues?.[0]?.message ?? '参数错误')
    : statusCode >= 500
      ? '服务器错误'
      : error.message

  reply.status(statusCode).send({
    code: statusCode,
    message,
    ...(errorCode ? { errorCode } : {}),
  })
}

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: loggerConfig,
    // 2026-07-21 安全审计第十轮加固:严禁 trustProxy: true
    // 必须显式列出可信代理 IP/CIDR,否则任意客户端可伪造 X-Forwarded-For
    // 头绕过 IP 限流 / 登录失败计数 / IP 拉黑
    // 反向代理场景:运维按实际 nginx / cdn / cloudflared 出口 IP 填入 TRUSTED_PROXIES
    trustProxy: config.TRUSTED_PROXIES
      ? config.TRUSTED_PROXIES.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : false,
    bodyLimit: 1048576 * 10,
  })

  server.setErrorHandler(errorHandler)

  await registerPlugins(server)

  // 2026-07-24 国安级零信任策略:对所有 /api/admin/* 路由自动注入网络分段 + mTLS 配置
  // 设计原则:
  // - DRY:不逐个 admin 路由文件修改,用 onRoute hook 统一注入
  // - 不覆盖:保留路由已显式配置的 config(?? 合并)
  // - 降级:MTLS_CLIENT_CERT_REQUIRED=true 时强制 mTLS,false 时仅可选验证
  // - 网络分段:admin 路由默认禁止公网访问(allowExternal:false),仅内网可访问
  //   生产环境若需公网访问 admin,需在路由级显式 config.network.allowExternal=true
  const mtlsRequired = process.env.MTLS_CLIENT_CERT_REQUIRED === 'true'
  server.addHook('onRoute', (routeOptions) => {
    const url = routeOptions.url ?? ''
    if (url.startsWith('/api/admin/') || url === '/api/admin') {
      const existingConfig = (routeOptions.config ?? {}) as Record<string, unknown>
      routeOptions.config = {
        ...existingConfig,
        network: existingConfig.network ?? { allowExternal: false },
        mtls: existingConfig.mtls ?? { required: mtlsRequired },
      }
    }
  })

  registerRoutes(server)

  // 注入到统一 logger，使 service/util 层可通过 fastify pino 输出日志
  setFastify(server)

  // 启动金丝雀自动回滚监控（CANARY_ENABLED=true 时生效，默认空操作）
  startAutoRollbackMonitor()

  return server
}

async function registerPlugins(server: FastifyInstance) {
  // 支付宝异步回调用 application/x-www-form-urlencoded,Fastify 默认只解析 JSON
  // 注册 content type parser,把 form-urlencoded 解析成 key-value 对象
  // Fastify 5 回调签名是 (req, body, done),body 是 string(parseAs: 'string')
  server.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const bodyStr = typeof body === 'string' ? body : String(body ?? '')
        const params = new URLSearchParams(bodyStr)
        const obj: Record<string, string> = {}
        params.forEach((value, key) => { obj[key] = value })
        done(null, obj)
      } catch (err) {
        done(err as Error)
      }
    },
  )
  // OpenTelemetry 追踪（最先注册，最大化 instrument 覆盖；OTEL_ENABLED=false 时自动跳过）
  await server.register(otelPlugin)
  await server.register(helmet, { contentSecurityPolicy: false })
  await server.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:8801').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  // 全局 IP 限流:按 NODE_ENV 分级(防止开发期热点路由反复触发 429)
  // - production: 100 req/min/IP(生产安全,DoS 防护)
  // - development: 1000 req/min/IP(单人开发几乎不触发,避免误伤 dev 体验)
  const isDev = process.env.NODE_ENV !== 'production'
  await server.register(rateLimit, {
    max: isDev ? 1000 : 100,
    timeWindow: '1 minute',
  })
  await server.register(underPressure, { maxEventLoopDelay: 1000 })
  // Swagger / OpenAPI 文档:开发环境默认开放,生产环境需 SWAGGER_ENABLED=true
  // 原因:Swagger 暴露全部 API 路由 + schema + 参数 + 返回类型,等同内部 API 文档
  // 开发环境默认开放便于联调;生产环境必须 SWAGGER_ENABLED=true 才挂载 /docs(默认 false)
  const swaggerEnabled = config.SWAGGER_ENABLED || process.env.NODE_ENV !== 'production'
  if (swaggerEnabled) {
    await server.register(swagger, {
      openapi: {
        info: {
          title: 'IHUI AI API',
          description: 'IHUI AI 平台 API 文档 — 对外公开 API(v1)+ 内部 API',
          version: '1.0.0',
        },
        servers: [
          { url: '/api', description: 'API 网关' },
        ],
        tags: [
          { name: 'Agents', description: 'Agent 管理与调用' },
          { name: 'Chat', description: '聊天补全(OpenAI 兼容)' },
          { name: 'Models', description: '模型列表' },
          { name: 'Files', description: '文件管理' },
          { name: 'AI Core', description: 'AI 核心能力(嵌入/视觉/MOA)' },
          { name: 'Multimodal', description: '多模态(图片/视频生成)' },
          { name: 'Knowledge', description: '知识库工具' },
          { name: 'Debug', description: 'DAP 调试器' },
          { name: 'Terminal', description: '终端 PTY 管理' },
        ],
      },
    })
    await server.register(swaggerUi, { routePrefix: '/docs' })
  }

  // multipart 插件：文件上传支持（限制单文件 100MB）
  await server.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 },
  })

  // 静态文件服务：暴露 uploads 目录（头像等公开资源）
  await server.register(fastifyStatic, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  })

  // auth 插件：注册 @fastify/jwt + request.userId 装饰器
  await server.register(authPlugin)

  // RLS 上下文：每个请求设置 PG 会话变量供 RLS 策略使用
  await server.register(rlsContextPlugin)

  // 多租户中间件：从 header/subdomain 解析租户, 装饰 request.tenantId
  await server.register(tenantPlugin)

  // Redis 客户端：server.redis + server.redisForQueue 装饰器（供 BullMQ / Pub/Sub 使用）
  await server.register(redis)

  // BullMQ 队列：server.emailQueue / notificationQueue / aiCallbackQueue 装饰器
  await server.register(queue)

  // 定时任务调度器：BullMQ repeatable jobs（cron），由 scheduler-worker 消费
  await server.register(scheduler)

  // 分布式限流：Redis 滑动窗口 + 公平权重 + 自适应负载（多实例生效）
  await server.register(distributedRateLimit)

  // 支付幂等性：Redis SETNX 锁，防止支付回调重复处理
  await server.register(paymentIdempotency)

  // 缓存韧性：熔断器 + singleflight + 双删一致性
  await server.register(cacheResilience)

  // WebSocket 实时通知推送：/ws/notifications + server.pushNotification 装饰器
  // 内部使用 Redis Pub/Sub 支持多实例横向扩展
  // 2026-07-24 安全加固:verifyClient 校验 Origin(CSWFH 防护,CWE-346)
  // 攻击场景:恶意网站 JS 用用户浏览器发起 WebSocket 连接窃听消息。
  // 防护:Origin 必须在 CORS_ORIGIN 白名单内;缺失 Origin(非浏览器客户端)允许通过,
  // 因为 ws-chat/ws-tasks 等已有 JWT wsAuth 认证,无 cookie 自动携带风险。
  const wsAllowedOrigins = new Set(
    (process.env.CORS_ORIGIN ?? 'http://localhost:8801')
      .split(',')
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean),
  )
  await server.register(websocket, {
    options: {
      // verifyClient callback:next(res: boolean, code?, reason?) — res=true 允许,res=false 拒绝
      verifyClient: (
        info: { origin: string },
        next: (res: boolean, code?: number, reason?: string) => void,
      ) => {
        const origin = (info.origin ?? '').toLowerCase()
        // 缺失 Origin(非浏览器/curl/服务端客户端):允许,依赖 JWT wsAuth
        if (!origin || wsAllowedOrigins.has(origin)) {
          next(true)
        } else {
          next(false, 403, 'Origin not allowed')
        }
      },
    },
  })
  await server.register(wsNotifications)
  // WebSocket AI 能力:agent_stream / tts_stream / realtime_pcm(1:1 流式连接)
  await server.register(wsAi)
  // WebSocket 聊天室:房间维度实时广播(Redis Pub/Sub 多实例)
  await server.register(wsChat)
  await server.register(wsCustomerService)
  // WebSocket 支付状态实时推送:/ws/payment/status/:orderNo
  await server.register(wsPayment)
  // WebSocket 公共广播推送:/ws/broadcast + server.broadcastToUser 装饰器
  await server.register(wsBroadcast)
  // WebSocket IM 消息推送:/ws/messages (Redis Pub/Sub 多实例,频道 im:user:{userId})
  await server.register(wsMessages)
  // WebSocket 任务进度推送:/ws/tasks/:taskId (Redis Pub/Sub 多实例,频道 task:{taskId})
  await server.register(wsTasks)

  // 审计日志插件：onResponse 异步记录所有 POST/PATCH/PUT/DELETE 写请求
  await server.register(auditPlugin)

  // P0-11 AOP 切面等价实现(Fastify 钩子):搜索索引 / 浏览去重 / 积分奖励
  await server.register(searchAspectPlugin)
  await server.register(watchAspectPlugin)
  await server.register(pointAspectPlugin)

  // 上传内容安全扫描：装饰 server.createUploadPreHandler + request.scannedFile
  await server.register(uploadScannerPlugin)

  // 请求指标收集插件：onRequest/onResponse 收集计数/响应时间，暴露 /metrics 端点
  await server.register(metricsPlugin)
  // Trace 中间件(P2-4):为每个请求生成/透传 W3C traceparent,记录端到端调用链
  await server.register(tracePlugin)
  // 业务漏斗与自定义业务指标（暴露 /business-metrics 端点）
  await server.register(businessMetricsPlugin)

  // API 日志插件：onResponse 异步记录所有 /api 请求到 api_logs
  await server.register(apiLoggerPlugin)
  // ELK 结构化日志管线：请求 ID 追踪 + 敏感字段脱敏（ELK_LOG_ENABLED 控制）
  await server.register(apiLoggerExtendedPlugin)

  // 全局安全插件（必须在路由注册前注册，Fastify 在路由注册时捕获钩子链）：
  // - 日志脱敏：onRequest 包装 request.log，自动脱敏敏感字段
  // - CSRF 防护：双提交 Cookie + GET /api/csrf-token 签发，写请求校验 X-CSRF-Token
  // - 响应脱敏管线：onSend 递归脱敏 JSON 响应敏感字段
  await server.register(logSanitizerPlugin)
  await server.register(csrfPlugin)
  await server.register(responseSanitizerPlugin)
  // XSS 防护：onRequest 净化输入 + onSend 安全头
  await server.register(xssProtectionPlugin)
  // API 版本控制：URL 路径 /api/v1/ + Header Accept-Version
  await server.register(apiVersioningPlugin)
  // AI 成本治理：token 预算控制 + prompt 缓存 + 成本记录 + 看板 API
  await server.register(aiCostPlugin)
  // 响应压缩（最后注册，压缩已脱敏的最终响应体）
  await server.register(compressionPlugin)
  // 数据库基础设施：慢 SQL 检测 + 连接保活
  await server.register(slowSqlKiller)
  await server.register(dbKeepalive)
  // 运维能力：N+1 查询检测 + Prompt 注入防护
  await server.register(n1Detector)
  await server.register(promptInjectionGuard)
  // 多租户 DB 级隔离：per-tenant schema + AsyncLocalStorage 上下文传递
  await server.register(tenantDbIsolation)
  // 多租户分库路由：per-tenant DATABASE_URL（物理分库），未配置时 fallback 到默认库
  await server.register(tenantDbPlugin)
  // Token 余额服务：用户 credit 余额管理（查询/扣减/缓存）
  await server.register(tokenBalanceService)

  // 韧性工具集：分布式锁 / 风控引擎 / 热配置 / DLQ / 退款DLQ / 租户审计
  await server.register(resilienceToolkit)

  // 金丝雀路由插件：CANARY_ENABLED=true 时按百分比路由流量到金丝雀版本（默认禁用）
  await server.register(canaryRouterPlugin)

  // 2026-07-24 国安级安全升级(E2-E5):
  // - 反自动化插件:onRequest 阶段 IP/UA/频率分析,扫描器即时封禁,>100/min 要求 CAPTCHA
  // - 网络分段:IP 分类 + 黑名单 + 路由级访问策略(高敏感路由仅内网访问)
  // - mTLS 客户端证书:高敏感路由要求双向证书认证(降级模式可关闭)
  // - HMAC 链审计日志:onResponse 记录所有写请求,链式哈希防篡改
  // 注意:顺序敏感,反自动化必须最先(onRequest 拦截),审计日志最后(覆盖全请求)
  await server.register(antiAutomationPlugin)
  await server.register(networkSegmentPlugin)
  await server.register(mtlsPlugin)
  await server.register(auditLoggerPlugin)
}
