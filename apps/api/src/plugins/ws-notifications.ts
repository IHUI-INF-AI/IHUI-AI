import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import IORedis, { type Redis } from 'ioredis'
import { wsAuth } from './ws-helpers.js'
import { config } from '../config/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * 推送实时通知给指定用户。
     * - 本机在线：直接通过 WebSocket 发送
     * - 多实例场景：通过 Redis Pub/Sub 广播到其他实例的连接
     */
    pushNotification(userId: string, payload: unknown): void
  }
}

/**
 * WebSocket 通知推送插件（多实例版本，使用 Redis Pub/Sub）。
 *
 * 架构：
 *   实例A: 用户 u1 连接 → connections["u1"] = {socket}
 *   实例B: 路由调用 server.pushNotification("u1", payload)
 *          → 本机 connections["u1"] 不存在或为空
 *          → publish 到 Redis 频道 "notify:u1"
 *          → 实例A 的订阅器收到消息 → 本机 connections["u1"] 推送给 socket
 *
 * 客户端连接: ws://host/ws/notifications?token=<access_token>
 * 服务端推送: { type: 'notification', data: {...} }
 *
 * 降级：Redis 不可用时仍可本机推送（单实例部署）。
 */
const wsNotificationsPlugin: FastifyPluginAsync = async (server) => {
  // 维护 userId -> WebSocket 连接集合的映射（同一用户可多端在线）
  const connections = new Map<string, Set<WebSocket>>()
  // 当前 WebSocket 连接总数（用于指标上报）
  let wsConnectionCount = 0

  /** 更新 WebSocket 连接数 Gauge（同时更新 business 和 infra 两套指标） */
  function updateWsConnectionGauges(): void {
    try {
      server.recordWsConnections(wsConnectionCount)
      server.setWebsocketConnections(wsConnectionCount)
    } catch {
      /* 指标采集失败不影响业务 */
    }
  }

  // Pub/Sub 频道命名：notify:<userId>
  const channelFor = (userId: string) => `notify:${userId}`

  // 订阅器：监听所有 notify:* 频道（pattern subscribe）
  // 使用独立连接（订阅连接不能再发普通命令）
  let subscriber: Redis | null = null
  try {
    subscriber = new IORedis(config.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 200, 1000),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    subscriber.on('error', (err) => {
      server.log.warn({ err }, 'ws pubsub subscriber error (degraded mode)')
    })
    // 上报 pub/sub 重连事件（区分首次连接与重连）
    let subscriberInitialConnected = false
    subscriber.on('connect', () => {
      if (subscriberInitialConnected) {
        try {
          server.recordWsPubsubReconnect('success')
        } catch {
          /* 指标采集失败不影响业务 */
        }
      }
      subscriberInitialConnected = true
    })
    subscriber.on('reconnecting', () => {
      try {
        server.recordWsPubsubReconnect('attempt')
      } catch {
        /* 指标采集失败不影响业务 */
      }
    })
    subscriber.on('pmessage', (_pattern, channel, message) => {
      // 上报 pub/sub 消息接收
      try {
        server.recordWsPubsubMessage(channel)
      } catch {
        /* 指标采集失败不影响业务 */
      }
      // channel 格式: notify:<userId>
      const userId = channel.startsWith('notify:') ? channel.slice('notify:'.length) : null
      if (!userId) return
      let payload: unknown
      try {
        payload = JSON.parse(message)
      } catch {
        return
      }
      const conns = connections.get(userId)
      if (!conns || conns.size === 0) return
      const msg = JSON.stringify({ type: 'notification', data: payload })
      // 上报房间广播（向用户所有连接广播）
      try {
        server.recordWsRoomBroadcast(userId)
      } catch {
        /* 指标采集失败不影响业务 */
      }
      for (const ws of conns) {
        try {
          ws.send(msg)
          // 上报通知送达
          try {
            server.recordNoticeDelivered(userId)
          } catch {
            /* 指标采集失败不影响业务 */
          }
        } catch {
          conns.delete(ws)
        }
      }
    })
    await subscriber.psubscribe('notify:*')
    server.log.info('ws pubsub subscriber ready (multi-instance mode)')
  } catch (e) {
    server.log.warn(
      { err: e },
      'ws pubsub subscriber init failed, fallback to single-instance mode',
    )
  }

  // 暴露给其他模块的推送函数
  // 修复重复推送 Bug:多实例模式下只 publish,由 subscriber 统一推送(含本机);
  // 单实例降级模式(subscriber 不可用)下直接本机推送。
  server.decorate('pushNotification', (userId: string, payload: unknown) => {
    // 上报通知推送（fire-and-forget）
    try {
      server.recordNoticePushed(userId, 'user')
    } catch {
      /* 指标采集失败不影响业务 */
    }
    if (subscriber) {
      // 多实例模式:只 publish,subscriber 会推送到所有实例(含本机)
      try {
        const publisher = (server as unknown as { redis?: Redis }).redis
        if (publisher) {
          void publisher.publish(channelFor(userId), JSON.stringify(payload))
          return
        }
      } catch {
        /* Redis publish 失败,降级到本机直推 */
      }
    }
    // 单实例降级模式(无 Redis):直接本机推送
    const conns = connections.get(userId)
    if (conns && conns.size > 0) {
      const msg = JSON.stringify({ type: 'notification', data: payload })
      // 上报房间广播（单实例降级模式）
      try {
        server.recordWsRoomBroadcast(userId)
      } catch {
        /* 指标采集失败不影响业务 */
      }
      for (const ws of conns) {
        try {
          ws.send(msg)
          // 上报通知送达（单实例降级模式）
          try {
            server.recordNoticeDelivered(userId)
          } catch {
            /* 指标采集失败不影响业务 */
          }
        } catch {
          conns.delete(ws)
        }
      }
    }
  })

  server.get('/ws/notifications', { websocket: true }, (socket, request) => {
    // 从 query 提取 token
    const token = (request.query as { token?: string }).token

    // wsAuth 统一鉴权(JWT + status),失败时已内部 close
    ;(async () => {
      let userId: string | null
      try {
        userId = await wsAuth(socket, token)
      } catch {
        try {
          server.recordWsAuthFailure('invalid_token')
        } catch {
          /* 指标采集失败不影响业务 */
        }
        return
      }
      if (!userId) {
        // 区分缺 token 与失效:wsAuth 已记录 close code,这里补充指标
        try {
          server.recordWsAuthFailure(token ? 'invalid_token' : 'missing_token')
        } catch {
          /* 指标采集失败不影响业务 */
        }
        return
      }

      // 注册连接
      if (!connections.has(userId)) connections.set(userId, new Set())
      connections.get(userId)!.add(socket)
      // 连接数递增并上报 Gauge
      wsConnectionCount++
      updateWsConnectionGauges()

      // 心跳：客户端发 ping，服务端回 pong
      socket.on('message', (data: Buffer) => {
        if (data.toString() === 'ping') socket.send('pong')
      })

      // 连接关闭时清理
      socket.on('close', () => {
        const conns = connections.get(userId)
        if (conns) {
          conns.delete(socket)
          if (conns.size === 0) connections.delete(userId)
        }
        // 连接数递减并上报 Gauge
        wsConnectionCount--
        updateWsConnectionGauges()
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

export const wsNotifications = fp(wsNotificationsPlugin, {
  name: 'ws-notifications',
  fastify: '5.x',
})
