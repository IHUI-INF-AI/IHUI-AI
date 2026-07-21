import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import IORedis, { type Redis } from 'ioredis'
import { z } from 'zod'
import { authenticate } from './auth.js'
import { wsAuth } from './ws-helpers.js'
import { success, error } from '../utils/response.js'
import { config } from '../config/index.js'
import { getWsAutoRecoveryManager } from './ws-auto-recovery.js'
import { generateCompactId } from '../utils/crypto-random.js'

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
  /** 该成员当前已加入的所有房间(支持中途切换/加入多个房间) */
  rooms: Set<string>
}

const ALLOWED_MSG_TYPES = new Set(['text', 'image', 'file', 'system'])

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
  // 2026-07-21 加固:用 generateCompactId 替代 Math.random,防止 CWE-330 可预测实例标识导致 Pub/Sub 消息伪造
  const instanceId = generateCompactId('inst')
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

  // 持久化聊天消息到 Redis（最近 200 条），供 HTTP 历史查询
  const persistMessage = (roomId: string, payload: Record<string, unknown>): void => {
    const publisher = (server as unknown as { redis?: Redis }).redis
    if (!publisher) return
    const key = `chatroom:messages:${roomId}`
    void publisher.lpush(key, JSON.stringify(payload))
    void publisher.ltrim(key, 0, 199)
  }

  // HTTP 鉴权辅助
  const httpAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<string | null> => {
    try {
      await authenticate(request)
      return request.userId ?? null
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
      return null
    }
  }

  // Redis 客户端获取（HTTP 端点用）
  const getRedis = (): Redis | null => (server as unknown as { redis?: Redis }).redis ?? null

  // ===== 聊天室 HTTP 端点（房间 CRUD + 消息历史 + 成员）=====

  const createRoomSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  })

  // POST /chat-room/rooms — 创建房间
  server.post('/chat-room/rooms', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const parsed = createRoomSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const redis = getRedis()
    if (!redis) return reply.status(503).send(error(503, 'Redis 未配置,无法创建房间'))
    // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成房间 ID
    // 风险:可预测房间 ID → 攻击者枚举加入他人房间 → 消息窃听/伪造
    const roomId = generateCompactId('room')
    const meta = {
      roomId,
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      createdBy: userId,
      createdAt: new Date().toISOString(),
    }
    await redis.hset(`chatroom:meta:${roomId}`, meta)
    await redis.sadd('chatroom:list', roomId)
    return reply.send(success(meta))
  })

  // GET /chat-room/rooms — 房间列表
  server.get('/chat-room/rooms', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const redis = getRedis()
    if (!redis) {
      // Redis 不可用时返回本机内存中的房间
      const localRooms = Array.from(rooms.keys()).map((r) => ({ roomId: r, name: r, local: true }))
      return reply.send(success({ items: localRooms, total: localRooms.length }))
    }
    const roomIds = await redis.smembers('chatroom:list')
    const items: Record<string, unknown>[] = []
    for (const roomId of roomIds) {
      const meta = await redis.hgetall(`chatroom:meta:${roomId}`)
      if (meta && Object.keys(meta).length > 0) {
        items.push({
          roomId: meta.roomId ?? roomId,
          name: meta.name,
          description: meta.description,
          createdBy: meta.createdBy,
          createdAt: meta.createdAt,
        })
      }
    }
    return reply.send(success({ items, total: items.length }))
  })

  // GET /chat-room/rooms/:roomId — 房间详情
  server.get('/chat-room/rooms/:roomId', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const { roomId } = request.params as { roomId: string }
    const redis = getRedis()
    if (!redis) return reply.send(success({ roomId, name: roomId, local: true }))
    const meta = await redis.hgetall(`chatroom:meta:${roomId}`)
    if (!meta || Object.keys(meta).length === 0)
      return reply.status(404).send(error(404, '房间不存在'))
    const onlineCount = rooms.get(roomId)?.size ?? 0
    return reply.send(success({ ...meta, onlineCount }))
  })

  // DELETE /chat-room/rooms/:roomId — 删除房间
  server.delete('/chat-room/rooms/:roomId', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const { roomId } = request.params as { roomId: string }
    const redis = getRedis()
    if (!redis) return reply.status(503).send(error(503, 'Redis 未配置'))
    const meta = await redis.hgetall(`chatroom:meta:${roomId}`)
    if (!meta || Object.keys(meta).length === 0)
      return reply.status(404).send(error(404, '房间不存在'))
    if (meta.createdBy && meta.createdBy !== userId)
      return reply.status(403).send(error(403, '仅创建者可删除房间'))
    await redis.del(`chatroom:meta:${roomId}`)
    await redis.del(`chatroom:messages:${roomId}`)
    await redis.srem('chatroom:list', roomId)
    // 通知房间内成员房间已关闭
    publish(roomId, { type: 'system', event: 'room_closed', roomId, ts: Date.now() })
    return reply.send(success({ deleted: true, roomId }))
  })

  // GET /chat-room/rooms/:roomId/messages — 房间消息历史
  server.get('/chat-room/rooms/:roomId/messages', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const { roomId } = request.params as { roomId: string }
    const { limit = '50', before } = request.query as { limit?: string; before?: string }
    const redis = getRedis()
    if (!redis) return reply.send(success({ items: [], message: 'Redis 未配置,无历史消息' }))
    const count = Math.min(parseInt(limit, 10) || 50, 200)
    const rawMessages = await redis.lrange(`chatroom:messages:${roomId}`, 0, count - 1)
    const items = rawMessages
      .map((raw) => {
        try {
          return JSON.parse(raw) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .reverse() as Record<string, unknown>[]
    const filtered = before ? items.filter((m) => Number(m.ts ?? 0) < parseInt(before, 10)) : items
    return reply.send(success({ items: filtered, total: filtered.length }))
  })

  // GET /chat-room/rooms/:roomId/members — 房间成员（当前在线）
  server.get('/chat-room/rooms/:roomId/members', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const { roomId } = request.params as { roomId: string }
    const members = rooms.get(roomId)
    if (!members || members.size === 0)
      return reply.send(success({ items: [], total: 0, message: '当前无在线成员(可能其他实例有)' }))
    const items = Array.from(members).map((m) => ({
      userId: m.userId,
      nickname: m.nickname,
    }))
    return reply.send(success({ items, total: items.length }))
  })

  const renameRoomSchema = z.object({ name: z.string().min(1).max(100) })

  // GET /chat-room/users/:uuid/rooms — 用户加入的房间列表(仅本人或 admin)
  server.get('/chat-room/users/:uuid/rooms', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const { uuid } = request.params as { uuid: string }
    if (userId !== uuid && (request.jwtPayload?.roleId ?? 0) < 1) {
      return reply.status(403).send(error(403, '无权查看他人房间列表'))
    }
    const redis = getRedis()
    if (!redis) return reply.send(success({ items: [], total: 0 }))
    const roomIds = await redis.smembers(`chatroom:user_rooms:${uuid}`)
    const items: Record<string, unknown>[] = []
    for (const roomId of roomIds) {
      const meta = await redis.hgetall(`chatroom:meta:${roomId}`)
      if (meta && Object.keys(meta).length > 0) {
        items.push({
          roomId: meta.roomId ?? roomId,
          name: meta.name,
          description: meta.description,
          createdBy: meta.createdBy,
          createdAt: meta.createdAt,
        })
      }
    }
    return reply.send(success({ items, total: items.length }))
  })

  // DELETE /chat-room/messages/:id — 删除消息(仅作者或 admin)
  server.delete('/chat-room/messages/:id', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const { id } = request.params as { id: string }
    const redis = getRedis()
    if (!redis) return reply.status(503).send(error(503, 'Redis 未配置'))
    const roomIds = await redis.smembers('chatroom:list')
    let foundRoomId: string | null = null
    let foundRaw: string | null = null
    let foundFrom: string | undefined
    for (const rid of roomIds) {
      const raws = await redis.lrange(`chatroom:messages:${rid}`, 0, -1)
      for (const raw of raws) {
        try {
          const m = JSON.parse(raw) as Record<string, unknown>
          if (String(m.id ?? '') === id) {
            foundRoomId = rid
            foundRaw = raw
            foundFrom = m.from as string | undefined
            break
          }
        } catch {
          continue
        }
      }
      if (foundRoomId) break
    }
    if (!foundRoomId || !foundRaw) {
      return reply.status(404).send(error(404, '消息不存在'))
    }
    if (foundFrom !== userId && (request.jwtPayload?.roleId ?? 0) < 1) {
      return reply.status(403).send(error(403, '无权删除他人消息'))
    }
    await redis.lrem(`chatroom:messages:${foundRoomId}`, 0, foundRaw)
    return reply.send(success({ id, deleted: true }))
  })

  // POST /chat-room/rooms/:roomId/rename — 重命名房间(仅创建者或 admin)
  server.post('/chat-room/rooms/:roomId/rename', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const { roomId } = request.params as { roomId: string }
    const parsed = renameRoomSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '房间名无效'))
    }
    const redis = getRedis()
    if (!redis) return reply.status(503).send(error(503, 'Redis 未配置'))
    const meta = await redis.hgetall(`chatroom:meta:${roomId}`)
    if (!meta || Object.keys(meta).length === 0) {
      return reply.status(404).send(error(404, '房间不存在'))
    }
    if (meta.createdBy !== userId && (request.jwtPayload?.roleId ?? 0) < 1) {
      return reply.status(403).send(error(403, '无权重命名房间'))
    }
    await redis.hset(`chatroom:meta:${roomId}`, { name: parsed.data.name })
    return reply.send(success({ id: roomId, name: parsed.data.name }))
  })

  // DELETE /chat-room/users/:uuid/rooms/:roomId — 用户退出房间(房主不能退出)
  server.delete('/chat-room/users/:uuid/rooms/:roomId', async (request, reply) => {
    const userId = await httpAuth(request, reply)
    if (!userId) return
    const { uuid, roomId } = request.params as { uuid: string; roomId: string }
    if (userId !== uuid && (request.jwtPayload?.roleId ?? 0) < 1) {
      return reply.status(403).send(error(403, '无权操作'))
    }
    const redis = getRedis()
    if (!redis) return reply.status(503).send(error(503, 'Redis 未配置'))
    const meta = await redis.hgetall(`chatroom:meta:${roomId}`)
    if (!meta || Object.keys(meta).length === 0) {
      return reply.status(404).send(error(404, '房间不存在'))
    }
    if (meta.createdBy === uuid) {
      return reply.status(400).send(error(400, '房主不能退出,请先转让房主'))
    }
    await redis.srem(`chatroom:members:${roomId}`, uuid)
    await redis.srem(`chatroom:user_rooms:${uuid}`, roomId)
    return reply.send(success({ success: true }))
  })

  server.get('/ws/room/:roomId', { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string; nickname?: string }
    const roomId = (request.params as { roomId: string }).roomId
    ;(async () => {
      const userId = await wsAuth(socket, query.token)
      if (!userId) return
      const nickname = query.nickname || userId.slice(0, 8)
      const member: RoomMember = { socket, userId, nickname, rooms: new Set<string>() }

      // 加入指定房间(辅助函数, 可在中途切换时复用)
      const joinRoom = (targetRoom: string): void => {
        if (member.rooms.has(targetRoom)) {
          // 已在房间: 仅回执
          send(socket, { type: 'room', event: 'joined', room: targetRoom, you: userId })
          return
        }
        member.rooms.add(targetRoom)
        if (!rooms.has(targetRoom)) rooms.set(targetRoom, new Set())
        rooms.get(targetRoom)!.add(member)
        // 持久化成员关系到 Redis(跨实例共享,支持 HTTP 查询用户房间列表)
        const r = getRedis()
        if (r) {
          void r.sadd(`chatroom:members:${targetRoom}`, userId)
          void r.sadd(`chatroom:user_rooms:${userId}`, targetRoom)
        }
        // 通知房间其他成员有新人加入(跨实例广播,排除自己)
        publish(
          targetRoom,
          { type: 'room', event: 'member_join', user: userId, nickname, ts: Date.now() },
          socket,
        )
        // 回执加入者
        send(socket, { type: 'room', event: 'joined', room: targetRoom, you: userId })
      }

      // 离开指定房间(辅助函数)
      const leaveRoom = (targetRoom: string): void => {
        if (!member.rooms.has(targetRoom)) {
          send(socket, { type: 'room', event: 'not_joined', room: targetRoom })
          return
        }
        member.rooms.delete(targetRoom)
        const members = rooms.get(targetRoom)
        if (members) {
          members.delete(member)
          if (members.size === 0) rooms.delete(targetRoom)
        }
        // 同步移除 Redis 成员关系
        const r = getRedis()
        if (r) {
          void r.srem(`chatroom:members:${targetRoom}`, userId)
          void r.srem(`chatroom:user_rooms:${userId}`, targetRoom)
        }
        // 通知房间其他成员有人离开
        publish(targetRoom, {
          type: 'room',
          event: 'member_leave',
          user: userId,
          nickname,
          ts: Date.now(),
        })
        send(socket, { type: 'room', event: 'left', room: targetRoom })
      }

      // 初始加入 URL 中的房间
      joinRoom(roomId)

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

        // 中途切换房间: {"type":"room","action":"join|leave","room":"..."}
        if (mtype === 'room' && typeof msg.action === 'string' && typeof msg.room === 'string') {
          const action = msg.action as string
          const targetRoom = msg.room as string
          if (action === 'join') {
            joinRoom(targetRoom)
          } else if (action === 'leave') {
            leaveRoom(targetRoom)
          } else {
            send(socket, { type: 'room', event: 'error', message: `unknown action: ${action}` })
          }
          return
        }

        // typing 事件:仅广播给他人,不回声自己
        if (mtype === 'typing') {
          publish(roomId, { type: 'typing', user: userId, nickname }, socket)
          return
        }
        if (!ALLOWED_MSG_TYPES.has(mtype)) return
        // 业务消息广播(跨实例)
        // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成消息 ID
        // 风险:可预测消息 ID → 攻击者伪造/重放消息
        const messagePayload = {
          id: generateCompactId('msg'),
          type: mtype,
          from: userId,
          nickname,
          text: (msg.text as string | undefined) ?? '',
          url: msg.url as string | undefined,
          filename: msg.filename as string | undefined,
          ts: Date.now(),
        }
        publish(roomId, messagePayload)
        // 持久化到 Redis 供 HTTP 历史查询（system 类型不存）
        if (mtype !== 'system') persistMessage(roomId, messagePayload)
      })

      socket.on('close', () => {
        // 清理该成员所在的所有房间(支持中途加入的多个房间)
        for (const targetRoom of member.rooms) {
          const members = rooms.get(targetRoom)
          if (members) {
            members.delete(member)
            if (members.size === 0) rooms.delete(targetRoom)
          }
          publish(targetRoom, { type: 'room', event: 'member_leave', user: userId, nickname })
        }
        member.rooms.clear()
      })
    })()
  })

  // 应用关闭时清理订阅连接
  getWsAutoRecoveryManager().setFastify(server)
  getWsAutoRecoveryManager().registerPlugin('ws-chat', {
    getConnections: () => {
      const m = new Map<string, WebSocket | Set<WebSocket>>()
      for (const [roomId, members] of rooms) {
        const sockets = new Set<WebSocket>()
        for (const mem of members) sockets.add(mem.socket)
        m.set(roomId, sockets)
      }
      return m
    },
    removeConnection: async (roomId) => {
      rooms.delete(roomId)
    },
  })

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
