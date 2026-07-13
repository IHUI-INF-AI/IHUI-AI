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

import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { usersRoutes } from './routes/users.js'
import { workspaceRoutes } from './routes/workspace.js'
import { workspaceAiRoutes } from './routes/workspace-ai.js'
import { fileRoutes } from './routes/files.js'
import { adminRoutes } from './routes/admin.js'
import { notificationRoutes } from './routes/notifications.js'
import { billingRoutes } from './routes/billing.js'
import { searchRoutes } from './routes/search.js'
import { auditRoutes } from './routes/audit.js'
import { chatRoutes } from './routes/chat.js'
import { chatModelRoutes } from './routes/chat-models.js'
import { teamRoutes } from './routes/teams.js'
import { rbacRoutes } from './routes/rbac.js'
import { workflowRoutes } from './routes/workflows.js'
import { commentRoutes } from './routes/comments.js'
import { communityRoutes } from './routes/community.js'
import { socialRoutes } from './routes/social.js'
import { promotionRoutes, adminPromotionRoutes } from './routes/promotions.js'
import { gamificationRoutes } from './routes/gamification.js'
import { contentRoutes, adminContentRoutes } from './routes/content.js'
import { learnRoutes, adminLearnRoutes } from './routes/learn.js'
import { systemRoutes, adminSystemRoutes } from './routes/system.js'
import { examRoutes } from './routes/exam.js'
import { orderRoutes, adminOrderRoutes } from './routes/order.js'
import { liveRoutes, adminLiveRoutes } from './routes/live.js'
import { memberRoutes, adminMemberRoutes } from './routes/member.js'
import { resourceRoutes, adminResourceRoutes } from './routes/resource.js'
import { pointRoutes, adminPointRoutes } from './routes/point.js'
import { usercenterRoutes } from './routes/usercenter.js'
import { scheduleRoutes, adminScheduleRoutes } from './routes/schedule.js'
import { statisticsRoutes, adminStatisticsRoutes } from './routes/statistics.js'
import { messageRoutes, adminMessageRoutes } from './routes/message.js'
import { topicRoutes, adminTopicRoutes } from './routes/topic.js'
import { behaviorRoutes, adminBehaviorRoutes } from './routes/behavior.js'
import { visitTrackingRoutes, adminVisitTrackingRoutes } from './routes/visit-tracking.js'
import { ossRoutes, adminOssRoutes } from './routes/oss.js'
import { settingRoutes, adminSettingRoutes } from './routes/setting.js'
import { newsRoutes, adminNewsRoutes } from './routes/news.js'
import { certificateRoutes, adminCertificateRoutes } from './routes/certificate.js'
import { paymentGatewayRoutes, adminPaymentGatewayRoutes } from './routes/payment-gateway.js'
import { refundAuditRoutes, adminRefundAuditRoutes } from './routes/refund-audit.js'
import { financeRoutes } from './routes/finance.js'
import { authExtendedRoutes } from './routes/auth-extended.js'
import { authSsoRoutes } from './routes/auth-sso.js'
import { vipRoutes, adminVipRoutes } from './routes/vip.js'
import { agentsRoutes } from './routes/agents.js'
import { plazaRoutes } from './routes/plaza.js'
import { cozeVariablesRoutes } from './routes/coze-variables.js'
import { cozeRoutes } from './routes/coze.js'
import { agenticServiceRoutes } from './routes/agentic-service.js'
import { adminEduExtendedRoutes, adminCourseAuditRoutes } from './routes/edu-extended.js'
import aiCallbackRoutes from './routes/ai-callback.js'
import { adminSysRoutes } from './routes/admin-sys.js'
import { eduPublicRoutes } from './routes/edu-public.js'
import { aiVendorRoutes, adminAiVendorRoutes, aiVendorV2Routes } from './routes/ai-vendors.js'
import { aiAudioRoutes } from './routes/ai-audio.js'
import { customerServiceRoutes, adminCustomerServiceRoutes } from './routes/customer-service.js'
import { gdprRoutes } from './routes/gdpr.js'
import { clawdbotRoutes } from './routes/clawdbot.js'
import { tenantRoutes } from './routes/tenant.js'
import canaryRoutes from './routes/canary.js'
import tboxRoutes from './routes/tbox.js'
import stockRoutes from './routes/stock.js'
import agentExtendedRoutes from './routes/agent-extended.js'
import eduExtendedRoutes from './routes/edu-extended.js'
import systemExtendedRoutes, { adminCategoryDictionaryRoutes } from './routes/system-extended.js'
import aiExtendedRoutes from './routes/ai-extended.js'
import miscExtendedRoutes from './routes/misc-extended.js'
// M-20 补建：14 个 API 模块路由
import toolsRoutes from './routes/tools.js'
import rankingRoutes from './routes/ranking.js'
import checkinRoutes, { adminCheckinRoutes } from './routes/checkin.js'
import developerRoutes from './routes/developer.js'
import appVersionRoutes from './routes/app-version.js'
import monitorRoutes from './routes/monitor.js'
import webhooksRoutes from './routes/webhooks.js'
import packagesRoutes from './routes/packages.js'
import fundRoutes from './routes/fund.js'
import walletRoutes from './routes/wallet.js'
import traderRoutes from './routes/trader.js'
import sdksRoutes from './routes/sdks.js'
import miniprogramRoutes from './routes/miniprogram.js'
import productIdentityRoutes from './routes/product-identity.js'
import groupsRoutes from './routes/groups.js'
// M-23 补建：AI 定价引擎路由
import { pricingRoutes } from './routes/pricing.js'
// M-22 补建：散点缺失路由
import { aiUserModelChatRoutes } from './routes/ai-user-model-chat.js'
import { adminFaqRoutes } from './routes/admin-faq.js'
import { adminZoneRoutes } from './routes/admin-zone.js'
import { adminDemandSquareRoutes } from './routes/admin-demand-square.js'
import { zhsCourseRoutes, adminZhsCourseRoutes } from './routes/zhs-course.js'
import { shareContentRoutes } from './routes/share-content.js'
// 历史项目缺失端点补齐（集中实现）
import { legacyCompletionRoutes } from './routes/legacy-completion.js'
// P0-3/P0-4 补建：AI 资讯聚合 + AI 教育模块
import aiFeedRoutes from './routes/ai-feed.js'
import aiEducationRoutes from './routes/ai-education.js'
import { fileVersionRoutes } from './routes/file-version.js'
import { callbackLogRoutes } from './routes/callback-log.js'

// R65 补建：M-52 分片上传 + M-54 财务扩展 + M-56 支付扩展 + M-67 实名认证
import { chunkedUploadRoutes } from './routes/chunked-upload.js'
import { financeExtendedRoutes } from './routes/finance-extended.js'
import { paymentExtendedRoutes } from './routes/payment-extended.js'
import { authIdentityRoutes } from './routes/auth-identity.js'

// R67 补建：M-55 通知扩展 + M-66 教育平台 + M-72 支付状态 WS
import { educationPlatformRoutes } from './routes/education-platform.js'

// R66 补建：M-44 remote + M-55 notification + M-57 content + M-60 org + M-61 AI图片编辑
import { remoteExtendedRoutes } from './routes/remote-extended.js'
import { notificationExtendedRoutes } from './routes/notification-extended.js'
import { contentExtendedRoutes } from './routes/content-extended.js'
import { organizationRoutes } from './routes/organization.js'
import { aiImageEditRoutes } from './routes/ai-image-edit.js'

// R68 补建：M-21 开放平台 Feature Center 后端路由
import { featureCenterRoutes } from './routes/feature-center.js'

// R68 补建：M-64 ask 模块扩展端点
import { askExtendedRoutes } from './routes/ask-extended.js'

// 死表激活：敏感词 / 协议 / 汇率 / 私信管理
import { adminSensitiveWordsRoutes } from './routes/admin-sensitive-words.js'
import { agreementPublicRoutes, adminAgreementsRoutes } from './routes/admin-agreements.js'
import { exchangeRatePublicRoutes, adminExchangeRateRoutes } from './routes/admin-exchange-rate.js'
import { adminPrivateLettersRoutes } from './routes/admin-private-letters.js'

// P0-3 补建：M-81 管理后台页面后端 API（菜单管理 + 需求审核 + 在线用户）
import { adminExtendedRoutes } from './routes/admin-extended.js'
// M-85/M-87 补建：SRS 媒体服务器 + 远程设备任务管理
import { srsRoutes } from './routes/srs.js'
import { remoteDeviceRoutes } from './routes/remote-device.js'

// 前端页面后端路由补齐
import { aiWorldRoutes } from './routes/ai-world.js'
import { biDashboardRoutes } from './routes/bi-dashboard.js'
import { dramaRoutes } from './routes/drama.js'
import { distributionRoutes } from './routes/distribution.js'
import { adminGrayReleaseRoutes } from './routes/admin-gray-release.js'
import { adminErrorDashboardRoutes } from './routes/admin-error-dashboard.js'
import { adminApiPlatformRoutes } from './routes/admin-api-platform.js'
// 前端管理端缺失路由补建（75 个路由：24 真实 CRUD + 51 空数据桩）
import { adminMissingRoutes } from './routes/admin-missing-routes.js'
// 前端用户端缺失路由补建（54 个路由：空数据桩）
import { missingUserRoutes } from './routes/missing-user-routes.js'

// P1-2 补建：报表生成器（接线 excel/pdf 孤儿服务）
import { adminReportRoutes } from './routes/report.js'

// P1-3 补建：推送服务（FCM + 个推 HTTP API，无 SDK 依赖）
import { pushRoutes, adminPushRoutes } from './routes/push.js'

// P1-4 补建：文件转码服务（FFmpeg 子进程封装）
import { transcodeRoutes, adminTranscodeRoutes } from './routes/transcode.js'

import { setFastify } from './utils/logger.js'
import { isAppError } from './errors/index.js'
import authPlugin from './plugins/auth.js'
import auditPlugin from './plugins/audit.js'
import uploadScannerPlugin from './plugins/upload-scanner.js'
import apiLoggerPlugin from './plugins/api-logger.js'
import csrfPlugin from './plugins/csrf.js'
import responseSanitizerPlugin from './plugins/response-sanitizer.js'
import logSanitizerPlugin from './plugins/log-sanitizer.js'
import { metricsPlugin } from './plugins/metrics.js'
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
import { tokenBalanceService } from './plugins/token-balance-service.js'
import { resilienceToolkit } from './plugins/resilience-toolkit.js'

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
    trustProxy: true,
    bodyLimit: 1048576 * 10,
  })

  server.setErrorHandler(errorHandler)

  await registerPlugins(server)
  registerRoutes(server)

  // 注入到统一 logger，使 service/util 层可通过 fastify pino 输出日志
  setFastify(server)

  return server
}

async function registerPlugins(server: FastifyInstance) {
  // OpenTelemetry 追踪（最先注册，最大化 instrument 覆盖；OTEL_ENABLED=false 时自动跳过）
  await server.register(otelPlugin)
  await server.register(helmet, { contentSecurityPolicy: false })
  await server.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await server.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await server.register(underPressure, { maxEventLoopDelay: 1000 })
  await server.register(swagger, {
    openapi: {
      info: { title: 'IHUI AI API', version: '1.0.0' },
    },
  })
  await server.register(swaggerUi, { routePrefix: '/docs' })

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
  await server.register(websocket)
  await server.register(wsNotifications)
  // WebSocket AI 能力:agent_stream / tts_stream / realtime_pcm(1:1 流式连接)
  await server.register(wsAi)
  // WebSocket 聊天室:房间维度实时广播(Redis Pub/Sub 多实例)
  await server.register(wsChat)
  await server.register(wsCustomerService)
  // WebSocket 支付状态实时推送:/ws/payment/status/:orderNo
  await server.register(wsPayment)

  // 审计日志插件：onResponse 异步记录所有 POST/PATCH/PUT/DELETE 写请求
  await server.register(auditPlugin)

  // 上传内容安全扫描：装饰 server.createUploadPreHandler + request.scannedFile
  await server.register(uploadScannerPlugin)

  // 请求指标收集插件：onRequest/onResponse 收集计数/响应时间，暴露 /metrics 端点
  await server.register(metricsPlugin)
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
  // Token 余额服务：用户 credit 余额管理（查询/扣减/缓存）
  await server.register(tokenBalanceService)

  // 韧性工具集：分布式锁 / 风控引擎 / 热配置 / DLQ / 退款DLQ / 租户审计
  await server.register(resilienceToolkit)
}

function registerRoutes(server: FastifyInstance) {
  server.register(healthRoutes, { prefix: '/api' })
  server.register(authRoutes, { prefix: '/api/auth' })
  server.register(usersRoutes, { prefix: '/api/users' })
  server.register(workspaceRoutes, { prefix: '/api/workspace' })
  // Workspace AI 能力：swarm/subagents/agent_loop/sandbox/computer_use/codebase_index/permissions 等 15 个子模块
  server.register(workspaceAiRoutes, { prefix: '/api/workspace' })
  // 文件管理增强 API：/api/files/*（/api/tags 已迁至 socialRoutes）
  server.register(fileRoutes, { prefix: '/api' })
  server.register(adminRoutes, { prefix: '/api/admin' })
  server.register(notificationRoutes, { prefix: '/api' })
  server.register(billingRoutes, { prefix: '/api' })
  server.register(searchRoutes, { prefix: '/api' })
  server.register(auditRoutes, { prefix: '/api/admin' })
  server.register(teamRoutes, { prefix: '/api/teams' })
  server.register(chatRoutes, { prefix: '/api/chat' })
  // Chat 多模型直连:deepseek/deepseek_ws/kling/multi/qwen/qwen_omni/zhipu/history/coze
  server.register(chatModelRoutes, { prefix: '/api/chat' })
  // RBAC: /api/roles /api/permissions /api/users/:id/roles /api/admin/rbac/check
  server.register(rbacRoutes, { prefix: '/api' })
  server.register(workflowRoutes, { prefix: '/api' })
  // 评论与反馈：/api/comments/* /api/feedbacks/* /api/admin/feedbacks/*
  server.register(commentRoutes, { prefix: '/api' })
  // 社区圈子与问答：/api/circles/* /api/asks/*
  server.register(communityRoutes, { prefix: '/api' })
  // 社交关系：/api/follows /api/favorites /api/subscriptions /api/tags
  server.register(socialRoutes, { prefix: '/api' })
  // 邀请码 / 活动 / 优惠券：/api/invitations /api/activities /api/coupons + /api/admin/activities /api/admin/coupons
  server.register(promotionRoutes, { prefix: '/api' })
  server.register(adminPromotionRoutes, { prefix: '/api/admin' })
  // 公告 / 帮助 / 文档：/api/announcements /api/help/* /api/docs + /api/admin/announcements /api/admin/help/articles /api/admin/docs
  server.register(contentRoutes, { prefix: '/api' })
  server.register(adminContentRoutes, { prefix: '/api/admin' })
  // 学习模块：/api/learn/* + /api/admin/learn/*
  server.register(learnRoutes, { prefix: '/api' })
  server.register(adminLearnRoutes, { prefix: '/api/admin' })
  // 积分 / 等级 / 签到：/api/points /api/sign-in /api/levels /api/leaderboard
  server.register(gamificationRoutes, { prefix: '/api' })
  // 系统配置 / 集成 / API 日志 / 系统事件：/api/configs + /api/admin/configs /api/admin/integrations /api/admin/logs /api/admin/events
  server.register(systemRoutes, { prefix: '/api' })
  server.register(adminSystemRoutes, { prefix: '/api/admin' })
  // 考试模块：/api/exam/papers /api/exam/records + /api/admin/exam/papers /api/admin/exam/questions
  server.register(examRoutes, { prefix: '/api' })
  // 教育订单：/api/orders/* + /api/admin/orders/*
  server.register(orderRoutes, { prefix: '/api' })
  server.register(adminOrderRoutes, { prefix: '/api/admin' })
  // 直播模块：/api/live/* + /api/admin/live/*
  server.register(liveRoutes, { prefix: '/api' })
  server.register(adminLiveRoutes, { prefix: '/api/admin' })
  // 会员模块：/api/members/* + /api/admin/members/*
  server.register(memberRoutes, { prefix: '/api' })
  server.register(adminMemberRoutes, { prefix: '/api/admin' })
  // 资源库：/api/resources/* + /api/admin/resources/*
  server.register(resourceRoutes, { prefix: '/api' })
  server.register(adminResourceRoutes, { prefix: '/api/admin' })
  // 教育积分：/api/edu-points/* + /api/admin/edu-points/*
  server.register(pointRoutes, { prefix: '/api' })
  server.register(adminPointRoutes, { prefix: '/api/admin' })
  // 用户中心扩展：/api/admin/usercenter/*
  server.register(usercenterRoutes, { prefix: '/api/admin' })
  // 排课任务：/api/schedule/* + /api/admin/schedule/*
  server.register(scheduleRoutes, { prefix: '/api' })
  server.register(adminScheduleRoutes, { prefix: '/api/admin' })
  // 统计模块：/api/statistics/* + /api/admin/statistics/*
  server.register(statisticsRoutes, { prefix: '/api' })
  server.register(adminStatisticsRoutes, { prefix: '/api/admin' })
  // 站内消息：/api/messages/* + /api/admin/messages/*
  server.register(messageRoutes, { prefix: '/api' })
  server.register(adminMessageRoutes, { prefix: '/api/admin' })
  // 专题模块：/api/topics/* + /api/admin/topics/*
  server.register(topicRoutes, { prefix: '/api' })
  server.register(adminTopicRoutes, { prefix: '/api/admin' })
  // 行为追踪：/api/behavior/* + /api/admin/behavior/*
  server.register(behaviorRoutes, { prefix: '/api' })
  server.register(adminBehaviorRoutes, { prefix: '/api/admin' })
  // 访问追踪：/api/visit-tracking/* + /api/admin/visit-tracking/*
  server.register(visitTrackingRoutes, { prefix: '/api' })
  server.register(adminVisitTrackingRoutes, { prefix: '/api/admin' })
  // 对象存储：/api/oss/* + /api/admin/oss/*
  server.register(ossRoutes, { prefix: '/api' })
  server.register(adminOssRoutes, { prefix: '/api/admin' })
  // 教育设置：/api/edu-settings/* + /api/admin/edu-settings/*
  server.register(settingRoutes, { prefix: '/api' })
  server.register(adminSettingRoutes, { prefix: '/api/admin' })
  // 资讯模块：/api/news/* + /api/admin/news/*
  server.register(newsRoutes, { prefix: '/api' })
  server.register(adminNewsRoutes, { prefix: '/api/admin' })
  // 证书模块：/api/certificates/* + /api/admin/certificates/*
  server.register(certificateRoutes, { prefix: '/api' })
  server.register(adminCertificateRoutes, { prefix: '/api/admin' })
  // 教育扩展模块：/api/admin/edu/notes /api/admin/edu/offline-records /api/admin/edu/uploaded-certs /api/admin/edu/uploaded-papers
  server.register(adminEduExtendedRoutes, { prefix: '/api' })
  // 系统管理后端(迁移自 admin_panel.py):/api/admin/menu /api/admin/logininfor /api/admin/notice /api/admin/job /api/admin/online /api/admin/dept /api/admin/post /api/admin/config /api/admin/dict
  server.register(adminSysRoutes, { prefix: '/api/admin' })
  // 代理 / 广场 / Coze 变量 / Agent 服务
  server.register(agentsRoutes, { prefix: '/api' })
  server.register(plazaRoutes, { prefix: '/api/plaza' })
  server.register(cozeVariablesRoutes, { prefix: '/api/coze/variables' })
  // Coze 平台集成:apps/audio/chat-audio/conversations/datasets/files/review/templates/workflows/workspaces/bot
  server.register(cozeRoutes, { prefix: '/api/coze' })
  server.register(agenticServiceRoutes, { prefix: '/api/agent' })

  // AI 回调端点(由 AI service 推理完成后 POST 调用,入队 aiCallback)
  server.register(aiCallbackRoutes)

  // 支付网关：微信/支付宝/基金/对账（R1 补完）
  server.register(paymentGatewayRoutes, { prefix: '/api' })
  server.register(adminPaymentGatewayRoutes, { prefix: '/api/admin' })
  // 退款审核管理：退款列表/审核/驳回/详情/统计
  server.register(refundAuditRoutes, { prefix: '/api' })
  server.register(adminRefundAuditRoutes, { prefix: '/api/admin' })
  // 财务模块：佣金/分销/Token/提现（R1 补完）
  server.register(financeRoutes, { prefix: '/api' })
  // 多登录扩展：密码/邮箱/用户名/OAuth2/Google/微信/企微/验证码/绑定/SK（R1 补完）
  server.register(authExtendedRoutes, { prefix: '/api' })
  // SSO 统一登录：code 生成/交换/统一登出/token 验证（跨子项目共享登录态）
  server.register(authSsoRoutes, { prefix: '/api/auth' })
  // VIP 会员：等级/购买/我的 + admin（R1 补完）
  server.register(vipRoutes, { prefix: '/api' })
  server.register(adminVipRoutes, { prefix: '/api/admin' })

  // 学员中心：我的课程/笔记/证书/报告/错题/线下记录/论文（R2 补完）
  server.register(eduPublicRoutes, { prefix: '/api' })

  // AI 厂商专属多模态：dashscope/doubao/gemini/suno/sora2/coze + 通用工具（R4 补完）
  server.register(aiVendorRoutes, { prefix: '/api/ai' })
  server.register(adminAiVendorRoutes, { prefix: '/api/admin/ai' })
  // AI 厂商 v2 路由：基于 R4 重构的 callVendor(ctx, reply) 新签名（dashscope/doubao/gemini 部分端点）
  // 与原 /api/ai/* 共存，前端可逐步迁移到 /api/ai/v2/*
  server.register(aiVendorV2Routes, { prefix: '/api/ai' })
  // AI audio 子模块：TTS/ASR/声纹/实时语音 WebSocket（R4 补完）
  server.register(aiAudioRoutes, { prefix: '/api/ai' })

  // 客服系统：工单 + 实时会话（工单流程：提交→分配→处理→评级→关闭）
  server.register(customerServiceRoutes, { prefix: '/api/customer-service' })
  server.register(adminCustomerServiceRoutes, { prefix: '/api/admin/customer-service' })

  // GDPR 数据擦除：/api/gdpr/export /api/gdpr/erase /api/gdpr/portability
  server.register(gdprRoutes, { prefix: '/api/gdpr' })

  // Clawdbot AI Bot 服务：/api/clawdbot/*
  server.register(clawdbotRoutes, { prefix: '/api' })

  // 多租户管理：/api/tenants CRUD + 成员管理 + 配额管理
  server.register(tenantRoutes, { prefix: '/api/tenants' })

  // Canary 阶段化门控部署：/api/canary/configs /api/canary/audit /api/canary/traffic
  server.register(canaryRoutes, { prefix: '/api/canary' })

  // TBox IoT 设备管理：设备注册/查询/指令下发/事件通知接收
  server.register(tboxRoutes, { prefix: '/api/tbox' })

  // Stock 股票分析：Token 余额/分析/历史记录（迁移自旧架构 stock_analyse_service）
  server.register(stockRoutes, { prefix: '/api/stock' })

  // 旧架构补建模块：Agent 扩展（need_task/upload/usedetail）
  server.register(agentExtendedRoutes, { prefix: '/api/agent-ext' })
  // 教育扩展（course_audit 课程审核）
  server.register(eduExtendedRoutes, { prefix: '/api/edu-ext' })
  // 管理员 course-audit 路由（前缀 /api/admin/course-audit）
  server.register(adminCourseAuditRoutes, { prefix: '/api/admin' })
  // 管理/系统扩展（category_dictionary/bot_sites/ws_admin/compat_routes）
  server.register(systemExtendedRoutes, { prefix: '/api/system-ext' })
  server.register(adminCategoryDictionaryRoutes, { prefix: '/api/admin' })
  // AI 扩展（capabilities/model_info/outbound_routes/video_routes/developer model_test）
  server.register(aiExtendedRoutes, { prefix: '/api/ai-ext' })
  // 其他扩展（remote/user_agent_context/docs）
  server.register(miscExtendedRoutes, { prefix: '/api/misc-ext' })

  // ===== M-20 补建：14 个 API 模块路由 =====
  // 用户端工具目录：/api/tools/*
  server.register(toolsRoutes, { prefix: '/api/tools' })
  // 排行榜系统：/api/ranking/*
  server.register(rankingRoutes, { prefix: '/api/ranking' })
  // 签到体系：/api/checkin/* + /api/admin/checkin/*
  server.register(checkinRoutes, { prefix: '/api/checkin' })
  server.register(adminCheckinRoutes, { prefix: '/api/admin/checkin' })
  // 开发者 API 密钥管理：/api/developer/*
  server.register(developerRoutes, { prefix: '/api/developer' })
  // 应用版本管理：/api/app-version/*
  server.register(appVersionRoutes, { prefix: '/api/app-version' })
  // 监控系统：/api/monitor/*
  server.register(monitorRoutes, { prefix: '/api/monitor' })
  // Webhook 管理：/api/developer/webhooks/*
  server.register(webhooksRoutes, { prefix: '/api/developer/webhooks' })
  // 套餐管理：/api/packages/*
  server.register(packagesRoutes, { prefix: '/api/packages' })
  // 资金管理：/api/fund/*
  server.register(fundRoutes, { prefix: '/api/fund' })
  // 钱包管理：/api/wallet/*
  server.register(walletRoutes, { prefix: '/api/wallet' })
  // 交易员管理：/api/trader/*
  server.register(traderRoutes, { prefix: '/api/trader' })
  // SDK 管理：/api/sdks/*
  server.register(sdksRoutes, { prefix: '/api/sdks' })
  // 小程序后台管理：/api/miniprogram/*
  server.register(miniprogramRoutes, { prefix: '/api/miniprogram' })
  // 产品标识管理：/api/product-identity/*
  server.register(productIdentityRoutes, { prefix: '/api/product-identity' })
  // 用户组管理：/api/groups/*
  server.register(groupsRoutes, { prefix: '/api/groups' })

  // ===== M-23 补建：AI 定价引擎 =====
  // 定价管理：/api/pricing/*
  server.register(pricingRoutes, { prefix: '/api' })

  // ===== M-22 补建：散点缺失路由 =====
  // 用户自定义模型对话：/api/ai/user-model-chat/*
  server.register(aiUserModelChatRoutes, { prefix: '/api/ai' })
  // FAQ 管理：/api/admin/faq/*
  server.register(adminFaqRoutes, { prefix: '/api/admin/faq' })
  // 区域/分区管理：/api/admin/zones/*
  server.register(adminZoneRoutes, { prefix: '/api/admin/zones' })
  // 需求广场管理：/api/admin/demand-square/*
  server.register(adminDemandSquareRoutes, { prefix: '/api/admin/demand-square' })

  // ZHS 课程模块 CRUD：/api/course/*（迁移自 ZHS_Server_java 历史项目）
  server.register(zhsCourseRoutes, { prefix: '/api/course' })
  server.register(adminZhsCourseRoutes, { prefix: '/api/admin/course' })

  // 分享内容 H5：/api/share/content/:code（迁移自 share-h5 历史项目）
  server.register(shareContentRoutes, { prefix: '/api/share' })

  // ===== 历史项目缺失端点补齐（集中实现）=====
  // 考试报名/收藏/学习统计/专题/直播订阅/问答/OSS/错题等散点端点
  server.register(legacyCompletionRoutes, { prefix: '/api/legacy' })

  // ===== P0-3/P0-4 补建：AI 资讯聚合 + AI 教育模块 =====
  // AI 资讯聚合：/api/ai-feed/sources /items /trends /stats + collect/summarize/translate（管理）
  server.register(aiFeedRoutes, { prefix: '/api/ai-feed' })
  // AI 教育模块：5 张表 CRUD（policy/teacher-certification/aigc-tool/k12-curriculum/university-course）
  server.register(aiEducationRoutes, { prefix: '/api/ai-education' })

  // 文件版本管理：版本创建/列表/详情/回滚/删除/对比
  server.register(fileVersionRoutes, { prefix: '/api' })
  // 通用回调日志：外呼/短信/支付回调记录 + 列表/详情/删除
  server.register(callbackLogRoutes, { prefix: '/api/callback-log' })

  // ===== R65 补建：M-52/M-54/M-56/M-67 =====
  // M-52: 分片上传（大文件上传核心功能）: init/upload/merge/cancel/status
  server.register(chunkedUploadRoutes, { prefix: '/api' })
  // M-54: 财务扩展（分销统计/Agent提现/管理员工具）
  server.register(financeExtendedRoutes, { prefix: '/api' })
  // M-56: 支付扩展（提现回调/同步返回/连续订阅）
  server.register(paymentExtendedRoutes, { prefix: '/api' })
  // M-67: 实名认证（提交/查询/列表/审核）
  server.register(authIdentityRoutes, { prefix: '/api' })

  // ===== R66 补建：M-44/M-55/M-57/M-60/M-61 =====
  // M-44: 远程设备/三方请求模块（12端点）
  server.register(remoteExtendedRoutes, { prefix: '/api' })
  // M-55: 通知渠道管理扩展（7端点）
  server.register(notificationExtendedRoutes, { prefix: '/api' })
  // M-57: 内容管理扩展（12端点）
  server.register(contentExtendedRoutes, { prefix: '/api' })
  // M-60: 组织管理（9端点）
  server.register(organizationRoutes, { prefix: '/api' })
  // M-61: AI图片编辑（8端点）
  server.register(aiImageEditRoutes, { prefix: '/api' })

  // ===== R68 补建：M-21 开放平台 Feature Center =====
  // M-21: Feature Center 后端路由（6端点）
  server.register(featureCenterRoutes, { prefix: '/api/feature-center' })

  // ===== R68 补建：M-64 ask 模块扩展端点 =====
  // M-64: ask 扩展（12端点：回答编辑/删除+点赞+收藏+评论+分类CRUD+树+统计）
  server.register(askExtendedRoutes, { prefix: '/api' })

  // ===== R67 补建：M-66 教育平台 + M-72 支付状态 WS =====
  // M-66: 教育平台同步管理（6端点）
  server.register(educationPlatformRoutes, { prefix: '/api/education-platform' })
  server.register(educationPlatformRoutes, { prefix: '/api/admin/education-platform' })

  // ===== 死表激活：敏感词 / 协议 / 汇率 / 私信管理 =====
  // 敏感词管理：/api/admin/sensitive-words CRUD + 内容过滤
  server.register(adminSensitiveWordsRoutes, { prefix: '/api/admin' })
  // 协议管理：/api/agreements/current（公共）+ /api/admin/agreements CRUD
  server.register(agreementPublicRoutes, { prefix: '/api' })
  server.register(adminAgreementsRoutes, { prefix: '/api/admin' })
  // 汇率管理：/api/exchange-rates/rate + convert（公共）+ /api/admin/exchange-rates CRUD
  server.register(exchangeRatePublicRoutes, { prefix: '/api' })
  server.register(adminExchangeRateRoutes, { prefix: '/api/admin' })
  // 私信管理：/api/admin/private-letters 列表
  server.register(adminPrivateLettersRoutes, { prefix: '/api/admin' })

  // ===== P0-3 补建：M-81 管理后台页面后端 API =====
  // 菜单管理 + 需求审核 + 在线用户
  server.register(adminExtendedRoutes, { prefix: '/api/admin' })

  // ===== M-85 补建：SRS 媒体服务器管理 =====
  // RTMP 推流 / WebRTC 拉流 / HLS / FLV 流管理
  server.register(srsRoutes, { prefix: '/api/srs' })

  // ===== M-87 补建：远程设备任务管理 =====
  // IoT 设备注册 + 任务下发 + 心跳 + 状态管理
  server.register(remoteDeviceRoutes, { prefix: '/api' })

  // ===== 前端页面后端路由补齐 =====
  server.register(aiWorldRoutes, { prefix: '/api' })
  server.register(biDashboardRoutes, { prefix: '/api/admin' })
  server.register(dramaRoutes, { prefix: '/api' })
  server.register(distributionRoutes, { prefix: '/api' })
  server.register(adminGrayReleaseRoutes, { prefix: '/api/admin' })
  server.register(adminErrorDashboardRoutes, { prefix: '/api/admin' })
  server.register(adminApiPlatformRoutes, { prefix: '/api/admin' })

  // ===== 前端管理端缺失路由补建（75 个路由）=====
  // 24 条有表路由（真实 CRUD）+ 51 条无表路由（空数据桩）
  // 覆盖：内容运营 / 鉴权 / 教务 / 平台 / 监控 / 商城 等模块
  server.register(adminMissingRoutes, { prefix: '/api/admin' })

  // ===== 前端用户端缺失路由补建（54 个路由）=====
  // 全部空数据桩，覆盖：文章 / 内容生成 / 知识库 / 技能 / 学习记录 / MCP / OpenClaw
  // 代理类 / 用户设置 / AI 补充 / 开发者扩展 / 分销 / VIP 权益 / 优惠券 / 通知详情 / 消息详情
  server.register(missingUserRoutes, { prefix: '/api' })

  // ===== P1-2 补建：报表生成器（接线 excel/pdf 孤儿服务）=====
  server.register(adminReportRoutes, { prefix: '/api/admin' })

  // ===== P1-3 补建：推送服务（FCM + 个推 HTTP API）=====
  server.register(pushRoutes, { prefix: '/api' })
  server.register(adminPushRoutes, { prefix: '/api/admin' })

  // ===== P1-4 补建：文件转码服务（FFmpeg 子进程封装）=====
  server.register(transcodeRoutes, { prefix: '/api' })
  server.register(adminTranscodeRoutes, { prefix: '/api/admin' })
}
