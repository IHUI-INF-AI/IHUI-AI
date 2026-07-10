import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import IORedis, { type Redis } from 'ioredis'
import { verifyAccessToken } from '@ihui/auth'
import { config } from '../config/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    /** 向指定聊天房间广播消息(本机 + 跨实例).供系统消息等后端推送使用. */
    broadcastRoom(roomId: string, payload: unknown): void
  }
}

interface RoomMember {
  socket: WebSocket
  userId: string
  nickname: string
}

const ALLOWED_MSG_TYPES = new Set(['text', 'image', 'file', 'system'])

async function wsAuth(socket: WebSocket, token: string | undefined): Promise<string | null> {
  if (!token) {
    socket.close(4001, '缺少 token')
    return null
  }
  try {
    const payload = await verifyAccessToken(token)
    return payload.userId
  } catch {
    socket.close(4003, 'token 无效')
    return null
  }
}

const send = (socket: WebSocket, obj: unknown): void => {
  try {
    socket.send(JSON.stringify(obj))
  } catch {
    /* 连接已关闭 */
  }
}

/**
 * WebSocket 聊天室插件:房间维度实时消息广播.
 *
 * 架构:
 *   实例A: 用户 u1 加入 room1 → rooms["room1"] = {u1}
 *   实例B: 用户 u2 加入 room1 → rooms["room1"] = {u2}
 *   u1 发消息 → 本机直推(排除 u1) + publish 到 Redis "chatroom:room1"
 *            → 实例B 订阅器收到 → 推给本机 u2
 *
 * 客户端连接: ws://host/ws/room/:roomId?token=<access_token>&nickname=<昵称>
 * 消息类型: text / image / file / system / typing
 *
 * 降级: Redis 不可用时仅本机广播(单实例部署).
 */
const wsChatPlugin: FastifyPluginAsync = async (server) => {
  // roomId -> 本机成员集合
  const rooms = new Map<string, Set<RoomMember>>()
  // 实例标识:Pub/Sub 中识别本机发布的消息,避免本机重复推送
  const instanceId = Math.random().toString(36).slice(2)
  const channelFor = (roomId: string) => `chatroom:${roomId}`

  const localBroadcast = (roomId: string, payload: unknown, exclude?: WebSocket): void => {
    const members = rooms.get(roomId)
    if (!members || members.size === 0) return
    const msg = JSON.stringify(payload)
    for (const m of members) {
      if (m.socket === exclude) continue
      try {
        m.socket.send(msg)
      } catch {
        members.delete(m)
      }
    }
  }

  // Redis Pub/Sub 订阅器:监听所有 chatroom:* 频道(独立连接,订阅连接不能再发普通命令)
  let subscriber: Redis | null = null
  try {
    subscriber = new IORedis(config.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 200, 1000),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    subscriber.on('error', (err) => {
      server.log.warn({ err }, 'ws-chat pubsub subscriber error (degraded mode)')
    })
    subscriber.on('pmessage', (_pattern, channel, message) => {
      const roomId = channel.startsWith('chatroom:') ? channel.slice('chatroom:'.length) : null
      if (!roomId) return
      let envelope: { _src?: string; payload?: unknown }
      try {
        envelope = JSON.parse(message) as { _src?: string; payload?: unknown }
      } catch {
        return
      }
      // 跳过本机发布的消息(本机已在 publish 时直推,避免重复)
      if (envelope._src === instanceId) return
      localBroadcast(roomId, envelope.payload)
    })
    await subscriber.psubscribe('chatroom:*')
    server.log.info('ws-chat pubsub subscriber ready (multi-instance mode)')
  } catch (e) {
    server.log.warn({ err: e }, 'ws-chat pubsub init failed, fallback to single-instance mode')
  }

  // 广播:本机立即推送(排除发送者) + 跨实例 publish
  const publish = (roomId: string, payload: unknown, exclude?: WebSocket): void => {
    localBroadcast(roomId, payload, exclude)
    if (subscriber) {
      const publisher = (server as unknown as { redis?: Redis }).redis
      if (publisher) {
        void publisher.publish(channelFor(roomId), JSON.stringify({ _src: instanceId, payload }))
      }
    }
  }

  // 暴露给其他模块:向房间广播系统消息等
  server.decorate('broadcastRoom', (roomId: string, payload: unknown) => {
    publish(roomId, payload)
  })

  server.get('/ws/room/:roomId', { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string; nickname?: string }
    const roomId = (request.params as { roomId: string }).roomId
    ;(async () => {
      const userId = await wsAuth(socket, query.token)
      if (!userId) return
      const nickname = query.nickname || userId.slice(0, 8)
      const member: RoomMember = { socket, userId, nickname }

      if (!rooms.has(roomId)) rooms.set(roomId, new Set())
      rooms.get(roomId)!.add(member)

      // 通知房间其他成员有新人加入(跨实例广播,排除自己)
      publish(roomId, { type: 'room', event: 'member_join', user: userId, nickname, ts: Date.now() }, socket)
      // 回执加入者
      send(socket, { type: 'room', event: 'joined', room: roomId, you: userId })

      socket.on('message', (data: Buffer) => {
        const raw = data.toString()
        if (raw === 'ping') {
          socket.send('pong')
          return
        }
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(raw) as Record<string, unknown>
        } catch {
          return
        }
        const mtype = (msg.type as string) || 'text'
        // typing 事件:仅广播给他人,不回声自己
        if (mtype === 'typing') {
          publish(roomId, { type: 'typing', user: userId, nickname }, socket)
          return
        }
        if (!ALLOWED_MSG_TYPES.has(mtype)) return
        // 业务消息广播(跨实例)
        publish(roomId, {
          type: mtype,
          from: userId,
          nickname,
          text: (msg.text as string | undefined) ?? '',
          url: msg.url as string | undefined,
          filename: msg.filename as string | undefined,
          ts: Date.now(),
        })
      })

      socket.on('close', () => {
        const members = rooms.get(roomId)
        if (members) {
          members.delete(member)
          if (members.size === 0) rooms.delete(roomId)
        }
        publish(roomId, { type: 'room', event: 'member_leave', user: userId, nickname })
      })
    })()
  })

  // 应用关闭时清理订阅连接
  server.addHook('onClose', async () => {
    if (subscriber) {
      try {
        await subscriber.quit()
      } catch {
        /* ignore */
      }
    }
  })
}

export const wsChat = fp(wsChatPlugin, {
  name: 'ws-chat',
  fastify: '5.x',
})
