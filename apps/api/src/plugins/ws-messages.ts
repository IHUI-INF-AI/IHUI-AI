import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import IORedis, { type Redis } from 'ioredis'
import { wsAuth } from './ws-helpers.js'
import { config } from '../config/index.js'

/**
 * WebSocket IM 消息推送插件(多实例版本,使用 Redis Pub/Sub)。
 *
 * 客户端连接: ws://host/ws/messages?token=<access_token>
 * 服务端推送: ImMessage { id?, type, conversationId, senderId?, content, createdAt?, isMine? }
 *             (type: 'text' | 'image' | 'file' | 'system')
 *
 * Pub/Sub 频道: im:user:{userId}  (业务侧 publish 序列化后的 ImMessage)
 * 降级:Redis 不可用时仅本机直推,且维持 30s 心跳保活。
 */
const wsMessagesPlugin: FastifyPluginAsync = async (server) => {
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
      server.log.warn({ err }, 'ws-messages pubsub subscriber error (degraded mode)')
    })
    subscriber.on('pmessage', (_pattern, channel, message) => {
      const userId = channel.startsWith('im:user:') ? channel.slice('im:user:'.length) : null
      if (!userId) return
      const conns = connections.get(userId)
      if (!conns || conns.size === 0) return
      for (const ws of conns) {
        try {
          ws.send(message)
        } catch {
          conns.delete(ws)
        }
      }
    })
    await subscriber.psubscribe('im:user:*')
    server.log.info('ws-messages pubsub subscriber ready (multi-instance mode)')
  } catch (e) {
    server.log.warn(
      { err: e },
      'ws-messages pubsub subscriber init failed, fallback to single-instance mode',
    )
    subscriber = null
  }

  const heartbeatTimer = setInterval(() => {
    const ping = JSON.stringify({ type: 'system', content: 'ping' })
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

  server.get('/ws/messages', { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string }).token
    ;(async () => {
      let userId: string | null
      try {
        userId = await wsAuth(socket, token)
      } catch {
        return
      }
      if (!userId) return

      if (!connections.has(userId)) connections.set(userId, new Set())
      connections.get(userId)!.add(socket)

      socket.on('message', (data: Buffer) => {
        const raw = data.toString()
        if (raw === 'ping') {
          socket.send('pong')
          return
        }
        try {
          const msg = JSON.parse(raw) as Record<string, unknown>
          if (msg.type === 'system' && msg.content === 'ping') {
            socket.send(JSON.stringify({ type: 'system', content: 'pong' }))
          }
        } catch {
          /* 忽略非 JSON 消息 */
        }
      })

      socket.on('close', () => {
        const conns = connections.get(userId)
        if (conns) {
          conns.delete(socket)
          if (conns.size === 0) connections.delete(userId)
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

export const wsMessages = fp(wsMessagesPlugin, {
  name: 'ws-messages',
  fastify: '5.x',
})
