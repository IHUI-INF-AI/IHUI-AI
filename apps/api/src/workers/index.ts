import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { QUEUE_NAMES } from '../plugins/queue.js'
import { REGISTRY_SYNC_QUEUE_NAME } from '../plugins/registry-queue.js'
import { BATCH_QUEUE_NAME } from '../queue/batch-queue.js'
import { startEmailWorker } from './email-worker.js'
import { startNotificationWorker } from './notification-worker.js'
import { startAiCallbackWorker } from './ai-callback-worker.js'
import { startNotificationDispatchWorker } from './notification-dispatch-worker.js'
import { startRegistrySyncWorker } from './registry-sync-worker.js'
import {
  startRelayHealthCheckWorker,
  RELAY_HEALTH_CHECK_QUEUE_NAME,
} from './relay-health-check-worker.js'
import { startBatchWorker } from './batch-worker.js'
import { startUsdtPaymentWorker, USDT_PAYMENT_QUEUE_NAME } from './usdt-payment-worker.js'

/**
 * 启动所有 BullMQ Worker（异步任务消费者）。
 *
 * 已注册 Worker（8 个，与队列一一对应，无死代码）：
 * - email: 邮件发送（调用 sendEmail 完成 SMTP）
 * - notification: 通知处理（DB 落库 + WebSocket 推送 + 可选邮件触发）
 * - aiCallback: AI 回调处理（持久化 assistant 消息 + token + WebSocket 推送）
 * - notificationDispatch: 定向通知 email/sms 异步派发（send-targeted 端点入队）
 * - registrySync: 资源上游同步（MCP/Skill/Plugin 四源拉取 + upsert + 日志）
 * - relayHealthCheck: 中转站 Key 池健康巡检（每 5 分钟 ping /v1/models + 熔断）
 * - batch: 批量 API 异步处理（OpenAI/Anthropic Batch 逐请求调用 LLM + 50% 折扣计费）
 * - usdtPayment: USDT 支付轮询（每 1 分钟扫描 pending 订单，检测到账后自动确认）
 *
 * 拆分说明(2026-07-18):
 * - 每个 Worker 独立文件(email-worker.ts 等),便于单独维护与测试
 * - 本文件仅做聚合启动,职责单一
 * - docker-compose 提供 worker 独立 service,生产部署可独立扩缩
 */
export function startWorkers(server: FastifyInstance): Worker[] {
  const workers: Worker[] = [
    startEmailWorker(server),
    startNotificationWorker(server),
    startAiCallbackWorker(server),
    startNotificationDispatchWorker(server),
    startRegistrySyncWorker(server),
    startRelayHealthCheckWorker(server),
    startBatchWorker(server),
    startUsdtPaymentWorker(server),
  ]

  server.log.info(
    {
      workers: workers.length,
      names: [
        QUEUE_NAMES.email,
        QUEUE_NAMES.notification,
        QUEUE_NAMES.aiCallback,
        QUEUE_NAMES.notificationDispatch,
        REGISTRY_SYNC_QUEUE_NAME,
        RELAY_HEALTH_CHECK_QUEUE_NAME,
        BATCH_QUEUE_NAME,
        USDT_PAYMENT_QUEUE_NAME,
      ],
    },
    'BullMQ workers started (all 8 queues have consumers)',
  )

  return workers
}
