import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import IORedis, { type Redis } from 'ioredis'
import { config } from '../config/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    /** 主 Redis 客户端（命令、键值读写、Pub/Sub 订阅） */
    redis: Redis
    /** 专用于 BullMQ 的 Redis 连接（不订阅频道，避免阻塞队列命令） */
    redisForQueue: Redis
  }
}

/**
 * Redis 客户端插件。
 *
 * 设计要点：
 * 1. 暴露两个连接（redis / redisForQueue），因为 BullMQ 文档明确要求 Queue/Worker
 *    使用独立连接，且订阅频道的连接不能再发普通命令。
 * 2. 使用 fp 包装，使 redis / redisForQueue 装饰器在全局可见。
 * 3. 应用关闭时优雅断开连接，避免内存泄漏与未完成命令。
 * 4. 连接失败时打印错误但不禁用进程（降级策略：调用方应捕获异常）。
 */
const redisPlugin: FastifyPluginAsync = async (server) => {
  const connectionOptions = {
    // 重连策略：最多每秒重试一次，避免狂打日志
    retryStrategy: (times: number) => Math.min(times * 200, 1000),
    maxRetriesPerRequest: null, // BullMQ 要求
    enableReadyCheck: true,
    lazyConnect: false,
  }

  const redis = new IORedis(config.REDIS_URL, connectionOptions)
  const redisForQueue = new IORedis(config.REDIS_URL, connectionOptions)

  redis.on('error', (err) => {
    server.log.error({ err }, 'redis client error')
  })
  redisForQueue.on('error', (err) => {
    server.log.error({ err }, 'redis-for-queue client error')
  })

  redis.on('connect', () => {
    server.log.info('redis client connected')
  })

  server.decorate('redis', redis)
  server.decorate('redisForQueue', redisForQueue)

  // 应用关闭时优雅断开
  server.addHook('onClose', async () => {
    try {
      await redis.quit()
    } catch {
      /* ignore */
    }
    try {
      await redisForQueue.quit()
    } catch {
      /* ignore */
    }
  })
}

export const redis = fp(redisPlugin, {
  name: 'redis',
  fastify: '5.x',
})
