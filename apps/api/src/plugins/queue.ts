import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Queue, QueueEvents, Worker, type ConnectionOptions, type Job } from 'bullmq'
import { config } from '../config/index.js'

/**
 * 队列名常量。集中定义避免散落字符串拼写错误。
 */
export const QUEUE_NAMES = {
  email: 'email',
  notification: 'notification',
  aiCallback: 'ai-callback',
  notificationDispatch: 'notification-dispatch',
} as const

export type QueueName = keyof typeof QUEUE_NAMES

/**
 * 邮件任务 payload。
 */
export interface EmailJobData {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * 通知任务 payload（用于异步落库 + WebSocket 推送 + 邮件触发）。
 */
export interface NotificationJobData {
  userId: string
  type: string
  title: string
  content: string
  data?: Record<string, unknown>
  email?: string
  userName?: string
}

/**
 * AI 回调任务 payload。AI service 完成异步任务后通过 HTTP 回调 API，
 * API 入队后由 Worker 异步处理（更新会话、推送 WebSocket 等）。
 */
export interface AICallbackJobData {
  conversationId: string
  userId: string
  messageId: string
  content: string
  tokens?: number
  metadata?: Record<string, unknown>
}

/**
 * 定向通知派发任务 payload（send-targeted 端点的 email/sms 异步派发）。
 * in_app 渠道保持同步（WebSocket 实时推送），email/sms 入队由 Worker 异步处理。
 */
export interface TargetedDispatchJobData {
  userId: string
  channel: 'email' | 'sms'
  email: string | null
  phone: string | null
  nickname: string | null
  title: string
  content: string
  msgType: string
}

declare module 'fastify' {
  interface FastifyInstance {
    /** 邮件队列 */
    emailQueue: Queue<EmailJobData>
    /** 通知队列 */
    notificationQueue: Queue<NotificationJobData>
    /** AI 回调队列 */
    aiCallbackQueue: Queue<AICallbackJobData>
    /** 定向通知派发队列（send-targeted 的 email/sms 异步派发） */
    notificationDispatchQueue: Queue<TargetedDispatchJobData>
  }
}

/**
 * BullMQ 队列插件。
 *
 * 设计要点：
 * 1. 仅创建 Queue（生产者），Worker（消费者）放在同一进程以简化部署；
 *    多实例部署时可通过 ENABLE_WORKER=false 让某些实例只生产不消费。
 * 2. 队列使用 server.redisForQueue 连接（独立连接避免阻塞）。
 * 3. Worker 的实际处理逻辑由 routes/services 注册（decouple），
 *    本插件只负责基础设施初始化，避免循环依赖。
 * 4. 队列默认重试 3 次，指数退避；失败入 dead-letter（BullMQ 内置 failed 集）。
 */
const queuePlugin: FastifyPluginAsync = async (server) => {
  const connection: ConnectionOptions = {
    url: config.REDIS_URL,
    maxRetriesPerRequest: null,
  }

  const defaultJobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  }

  const emailQueue = new Queue<EmailJobData>(QUEUE_NAMES.email, {
    connection,
    defaultJobOptions,
  })
  const notificationQueue = new Queue<NotificationJobData>(QUEUE_NAMES.notification, {
    connection,
    defaultJobOptions,
  })
  const aiCallbackQueue = new Queue<AICallbackJobData>(QUEUE_NAMES.aiCallback, {
    connection,
    defaultJobOptions,
  })
  const notificationDispatchQueue = new Queue<TargetedDispatchJobData>(
    QUEUE_NAMES.notificationDispatch,
    {
      connection,
      defaultJobOptions,
    },
  )

  server.decorate('emailQueue', emailQueue)
  server.decorate('notificationQueue', notificationQueue)
  server.decorate('aiCallbackQueue', aiCallbackQueue)
  server.decorate('notificationDispatchQueue', notificationDispatchQueue)

  // QueueEvents 用于全局事件监听（失败、完成等），便于日志
  const queueEvents = new QueueEvents(QUEUE_NAMES.email, { connection })
  queueEvents.on('failed', ({ jobId, failedReason }) => {
    server.log.warn({ jobId, queue: QUEUE_NAMES.email, err: failedReason }, 'job failed')
  })

  server.addHook('onClose', async () => {
    try {
      await queueEvents.close()
    } catch {
      /* ignore */
    }
    try {
      await emailQueue.close()
    } catch {
      /* ignore */
    }
    try {
      await notificationQueue.close()
    } catch {
      /* ignore */
    }
    try {
      await aiCallbackQueue.close()
    } catch {
      /* ignore */
    }
    try {
      await notificationDispatchQueue.close()
    } catch {
      /* ignore */
    }
  })
}

export const queue = fp(queuePlugin, {
  name: 'queue',
  fastify: '5.x',
})

/**
 * Worker 注册辅助函数。
 * 由 routes/services 在启动时调用，将实际处理逻辑绑定到队列。
 *
 * 用法：
 *   const worker = createWorker(server, QUEUE_NAMES.email, async (job) => { ... })
 *   // onClose: await worker.close()
 */
export function createWorker<T>(
  server: Parameters<FastifyPluginAsync>[0],
  queueName: string,
  processor: (job: Job<T>) => Promise<unknown>,
): Worker<T> {
  const connection: ConnectionOptions = {
    url: config.REDIS_URL,
    maxRetriesPerRequest: null,
  }
  const worker = new Worker<T>(queueName, processor, {
    connection,
    concurrency: 5,
  })
  worker.on('error', (err) => {
    server.log.error({ err, queue: queueName }, 'worker error')
  })
  return worker
}

export type { QueueEvents, Job }
