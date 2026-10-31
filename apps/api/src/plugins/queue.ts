// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Queue, QueueEvents, Worker, type ConnectionOptions, type Job } from 'bullmq'
import { config } from '../config/index.js'
import { queueNameWithDbIdentity } from '../services/relay-queue-name.js'

/**
 * 队列**基础名**(未解析的字面名)。只作为解析器的输入,不得直接投给 `new Queue` / `new Worker`。
 */
const QUEUE_BASE_NAMES = {
  email: 'email',
  notification: 'notification',
  aiCallback: 'ai-callback',
  notificationDispatch: 'notification-dispatch',
} as const

/**
 * 队列名常量(2026-10-31 起 = **经库身份解析后**的实际队列名)。
 *
 * 为什么解析在常量层做,而不是在每个调用点做:这四个名字同时是生产者(`new Queue`)与
 * 消费者(`createWorker` → `new Worker`,见 src/workers/{email,notification,ai-callback,
 * notification-dispatch}-worker.ts)唯一的取值来源。解析放在这里,两侧**结构上不可能分家**;
 * 放调用点则每加一处消费者就多一次"忘包一层"的机会(号池 7 天停摆的正是这一型)。
 * 主库(`ihui`、未设后缀)解析结果与旧字面量逐字节相同 ⇒ 生产队列名零扰动。
 */
export const QUEUE_NAMES = {
  email: queueNameWithDbIdentity(QUEUE_BASE_NAMES.email),
  notification: queueNameWithDbIdentity(QUEUE_BASE_NAMES.notification),
  aiCallback: queueNameWithDbIdentity(QUEUE_BASE_NAMES.aiCallback),
  notificationDispatch: queueNameWithDbIdentity(QUEUE_BASE_NAMES.notificationDispatch),
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
  reasoning?: string
  tokens?: number
  // G3 新增:LLM 扣费链路接通所需字段
  model?: string
  provider?: string
  promptTokens?: number
  completionTokens?: number
  idempotencyKey?: string // 幂等键,防 BullMQ 重试重复扣费
  metadata?: Record<string, unknown>
  // 票59(消息级版本切换 3/3,2026-10-22):regenerate 新回复的版本族坐标。
  // 走 payload **顶层键**而不是 metadata —— metadata 在回调端点被逐字段重建
  // (G-94 显式列举纪律),且坐标是 chat_messages 的**列**不是 jsonb 内容;
  // 缺省 = 普通回复(与存量落库行为逐字一致)。
  parentMessageId?: string
  siblingIndex?: number
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
 * 5. 队列名一律从 `QUEUE_NAMES` 取(该常量已在模块加载时经 `queueNameWithDbIdentity` 带上
 *    库身份后缀)。隔离库起的实例因此不会再从主库队列抢作业(2026-10-31 号池 7 天停摆的同型
 *    事故在 Redis 侧对这些队列族仍有 failed=500 残留,见 `.ihui-agent/tmp/queue-proof/PROOF.md`)。
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
 *
 * `queueName` **必须是已解析的实际队列名**(即 `QUEUE_NAMES.*`,或别的队列族经
 * `queueNameWithDbIdentity()` 解析出来的名字);传未解析的基础名 = 绕过隔离判据。
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
