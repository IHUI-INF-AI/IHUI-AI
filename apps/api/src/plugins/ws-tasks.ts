import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import IORedis, { type Redis } from 'ioredis'
import { wsAuth } from './ws-helpers.js'
import { config } from '../config/index.js'

/**
 * WebSocket 任务进度推送插件(多实例版本,使用 Redis Pub/Sub)。
 *
 * 客户端连接: ws://host/ws/tasks/:taskId?token=<access_token>
 * 服务端推送: TaskWsMessage { taskId, type, progress?, message?, result?, timestamp? }
 *             (type: 'progress' | 'completed' | 'failed' | 'log')
 *
 * Pub/Sub 频道: task:{taskId}  (业务侧 publish 序列化后的 TaskWsMessage)
 * 降级:Redis 不可用时仅本机直推,且维持 30s 心跳保活。
 */
const wsTasksPlugin: FastifyPluginAsync = async (server) => {
  const connections = new Map<string, Set<WebSocket>>()

  let subscriber: Redis | null = null
  try {
    subscriber = new IORedis(config.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 200, 1000),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    subscriber.on('error', (err) => {
      server.log.warn({ err }, 'ws-tasks pubsub subscriber error (degraded mode)')
    })
    subscriber.on('pmessage', (_pattern, channel, message) => {
      const taskId = channel.startsWith('task:') ? channel.slice('task:'.length) : null
      if (!taskId) return
      const conns = connections.get(taskId)
      if (!conns || conns.size === 0) return
      for (const ws of conns) {
        try {
          ws.send(message)
        } catch {
          conns.delete(ws)
        }
      }
    })
    await subscriber.psubscribe('task:*')
    server.log.info('ws-tasks pubsub subscriber ready (multi-instance mode)')
  } catch (e) {
    server.log.warn(
      { err: e },
      'ws-tasks pubsub subscriber init failed, fallback to single-instance mode',
    )
    subscriber = null
  }

  const heartbeatTimer = setInterval(() => {
    const ping = JSON.stringify({ type: 'ping' })
    for (const conns of connections.values()) {
      for (const ws of conns) {
        try {
          ws.send(ping)
        } catch {
          conns.delete(ws)
        }
      }
    }
  }, 30_000)

  server.get('/ws/tasks/:taskId', { websocket: true }, (socket, request) => {
    const { taskId } = request.params as { taskId: string }
    const token = (request.query as { token?: string }).token
    ;(async () => {
      let userId: string | null
      try {
        userId = await wsAuth(socket, token)
      } catch {
        return
      }
      if (!userId) return

      if (!connections.has(taskId)) connections.set(taskId, new Set())
      connections.get(taskId)!.add(socket)

      socket.on('message', (data: Buffer) => {
        const raw = data.toString()
        if (raw === 'ping') {
          socket.send('pong')
          return
        }
        try {
          const msg = JSON.parse(raw) as Record<string, unknown>
          if (msg.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }))
          }
        } catch {
          /* 忽略非 JSON 消息 */
        }
      })

      socket.on('close', () => {
        const conns = connections.get(taskId)
        if (conns) {
          conns.delete(socket)
          if (conns.size === 0) connections.delete(taskId)
        }
      })
    })()
  })

  server.addHook('onClose', async () => {
    clearInterval(heartbeatTimer)
    if (subscriber) {
      try {
        await subscriber.quit()
      } catch {
        /* ignore */
      }
    }
  })
}

export const wsTasks = fp(wsTasksPlugin, {
  name: 'ws-tasks',
  fastify: '5.x',
})
