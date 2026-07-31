/**
 * BullMQ Queue 工厂 + batchQueue 单例(2026-08-01 立)。
 *
 * 与 plugins/queue.ts(4 个核心队列)和 plugins/registry-queue.ts(同步队列)同模式:
 * - createQueue 工厂:用指定 Redis 连接创建 Queue(复用 server.redisForQueue)
 * - getBatchQueue:惰性创建 batch 队列单例,避免重复创建
 *
 * Queue 连接用 server.redisForQueue(BullMQ 专用,不订阅频道,避免阻塞队列命令)。
 */
import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import { BATCH_QUEUE_NAME } from './batch-queue.js'

/**
 * BullMQ Queue 工厂:用指定 Redis 连接创建 Queue。
 * @param name 队列名
 * @param connection Redis 连接(建议传 server.redisForQueue)
 */
export function createQueue<T>(name: string, connection: Redis): Queue<T> {
  return new Queue<T>(name, { connection })
}

let batchQueue: Queue | null = null

/**
 * 获取(惰性创建)batch 队列单例。
 * 与 registry-queue.ts getRegistrySyncQueue 同模式,避免重复创建。
 * @param connection BullMQ 专用 Redis 连接(server.redisForQueue)
 */
export function getBatchQueue(connection: Redis): Queue {
  if (!batchQueue) {
    batchQueue = createQueue(BATCH_QUEUE_NAME, connection)
  }
  return batchQueue
}
