// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * 连接参数单源:主客户端、队列客户端、限流专用客户端共用同一套。
 * 三处各写一份必然漂移(AGENTS.md §0.6),新增连接请走 createRedisClient。
 */
export const REDIS_CONNECTION_OPTIONS = {
  // 重连策略：最多每秒重试一次，避免狂打日志
  retryStrategy: (times: number) => Math.min(times * 200, 1000),
  maxRetriesPerRequest: null, // BullMQ 要求
  enableReadyCheck: true,
  lazyConnect: false,
} as const

/**
 * 建一条独立 Redis 连接。
 *
 * 存在的理由:某些消费方必须在 **redis 插件注册之前** 拿到客户端实例
 * (典型是 `@fastify/rate-limit` —— 它在路由注册前就要构造 store,
 * 而把 redis 插件整体上移会改变 onClose 的执行顺序,连带影响队列/调度的优雅关闭)。
 * 这类消费方用本函数自建连接并自己负责 quit,不要依赖 server.redis 的时序。
 */
export function createRedisClient(onError?: (err: Error) => void): Redis {
  const client = new IORedis(config.REDIS_URL, REDIS_CONNECTION_OPTIONS)
  if (onError) client.on('error', onError)
  return client
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
  const redis = createRedisClient((err) => {
    server.log.error({ err }, 'redis client error')
  })
  const redisForQueue = createRedisClient((err) => {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
