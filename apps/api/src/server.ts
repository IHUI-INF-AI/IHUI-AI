import Fastify, { type FastifyInstance, type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify'
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
import { fileRoutes } from './routes/files.js'
import { adminRoutes } from './routes/admin.js'
import { notificationRoutes } from './routes/notifications.js'
import { billingRoutes } from './routes/billing.js'
import { searchRoutes } from './routes/search.js'
import { auditRoutes } from './routes/audit.js'
import { chatRoutes } from './routes/chat.js'
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
import aiCallbackRoutes from './routes/ai-callback.js'
import authPlugin from './plugins/auth.js'
import auditPlugin from './plugins/audit.js'
import apiLoggerPlugin from './plugins/api-logger.js'
import { metricsPlugin } from './plugins/metrics.js'
import { redis } from './plugins/redis.js'
import { queue } from './plugins/queue.js'
import { wsNotifications } from './plugins/ws-notifications.js'

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
  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
    ? error.statusCode
    : 500

  if (statusCode >= 500) {
    // 仅 5xx 打详细日志
    logger.error({ err: error }, 'Unhandled error')
  } else {
    logger.warn({ err: error.message, statusCode }, 'Request error')
  }

  reply.status(statusCode).send({
    code: statusCode,
    message: statusCode >= 500 ? '服务器错误' : error.message,
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

  return server
}

async function registerPlugins(server: FastifyInstance) {
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

  // Redis 客户端：server.redis + server.redisForQueue 装饰器（供 BullMQ / Pub/Sub 使用）
  await server.register(redis)

  // BullMQ 队列：server.emailQueue / notificationQueue / aiCallbackQueue 装饰器
  await server.register(queue)

  // WebSocket 实时通知推送：/ws/notifications + server.pushNotification 装饰器
  // 内部使用 Redis Pub/Sub 支持多实例横向扩展
  await server.register(websocket)
  await server.register(wsNotifications)

  // 审计日志插件：onResponse 异步记录所有 POST/PATCH/PUT/DELETE 写请求
  await server.register(auditPlugin)

  // 请求指标收集插件：onRequest/onResponse 收集计数/响应时间，暴露 /metrics 端点
  await server.register(metricsPlugin)

  // API 日志插件：onResponse 异步记录所有 /api 请求到 api_logs
  await server.register(apiLoggerPlugin)
}

function registerRoutes(server: FastifyInstance) {
  server.register(healthRoutes, { prefix: '/api' })
  server.register(authRoutes, { prefix: '/api/auth' })
  server.register(usersRoutes, { prefix: '/api/users' })
  server.register(workspaceRoutes, { prefix: '/api/workspace' })
  // 文件管理增强 API：/api/files/*（/api/tags 已迁至 socialRoutes）
  server.register(fileRoutes, { prefix: '/api' })
  server.register(adminRoutes, { prefix: '/api/admin' })
  server.register(notificationRoutes, { prefix: '/api' })
  server.register(billingRoutes, { prefix: '/api' })
  server.register(searchRoutes, { prefix: '/api' })
  server.register(auditRoutes, { prefix: '/api/admin' })
  server.register(teamRoutes, { prefix: '/api/teams' })
  server.register(chatRoutes, { prefix: '/api/chat' })
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

  // AI 回调端点(由 AI service 推理完成后 POST 调用,入队 aiCallback)
  server.register(aiCallbackRoutes)
}
