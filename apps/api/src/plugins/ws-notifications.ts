// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import IORedis, { type Redis } from 'ioredis'
import { generateWsToken } from '@ihui/auth'
import { wsAuth, WS_CLOSE, WsUserConnectionLimiter } from './ws-helpers.js'
import { authenticate } from './auth.js'
import { success, error } from '../utils/response.js'
import { config } from '../config/index.js'
import { getWsAutoRecoveryManager } from './ws-auto-recovery.js'
import { removeIfSame, removeIfDead } from '../utils/connection-registry.js'

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
  // 2026-08-02 P1 安全审计:单用户并发连接数限制(防资源耗尽)
  const userConnectionLimiter = new WsUserConnectionLimiter(8)

  /** 更新 WebSocket 连接数 Gauge（同时更新 business 和 infra 两套指标） */
  function updateWsConnectionGauges(): void {
    try {
      server.recordWsConnections(wsConnectionCount)
      server.setWebsocketConnections(wsConnectionCount)
    } catch {
      /* 指标采集失败不影响业务 */
    }
  }

  /** ws readyState:2 CLOSING / 3 CLOSED —— 与 ws-auto-recovery 的僵尸判据同值 */
  const WS_READYSTATE_CLOSING = 2
  const WS_READYSTATE_CLOSED = 3
  const isSocketZombie = (s: WebSocket): boolean =>
    s.readyState === WS_READYSTATE_CLOSING || s.readyState === WS_READYSTATE_CLOSED

  /**
   * 摘掉一个连接,并**只按实际摘掉的那一个**同步 gauge。
   * 2026-09-26 反向缺陷收口:gauge 与 connections 表此前各说各话 —— 递减写在 close
   * 回调里无条件执行(连接若已被僵尸清理口或发送失败路径先带走,这里就是双扣,
   * 低于真实值并可穿负),而发送失败路径摘了人却不扣(高于真实值)。三条移除路径
   * 一律走这个出口后,不变量是「+1 只在成功注册时,-1 只在真的从表里摘掉时」。
   * removeIfSame 的返回值正是那本账:身份不在表里 ⇒ 迟到回调不是我的账 ⇒ 不扣。
   */
  const dropConnection = (userId: string, ws: WebSocket): void => {
    if (removeIfSame(connections, userId, ws)) {
      wsConnectionCount--
      updateWsConnectionGauges()
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
          dropConnection(userId, ws)
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
          dropConnection(userId, ws)
        }
      }
    }
  })

  // POST /ws/ticket — 用 access token 换取短期 WS 专用 token(5 分钟 TTL)
  // 根治 access token 经 URL query 暴露进访问日志的问题:access token 改走
  // Authorization header 换取 5 分钟一次性 WS token,即使经 URL 泄漏也无法
  // 访问 REST API(type='ws' 被严格类型隔离)。
  server.post('/ws/ticket', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
    }
    const userId = request.userId!
    const roleId = (request.jwtPayload as { roleId?: number } | undefined)?.roleId ?? 0
    const wsToken = await generateWsToken(userId, { roleId })
    // 2026-09-02 修复:response-sanitizer 将字段名含 "token" 的值遮蔽为 "***",
    // 导致本端点返回的 wsToken 恒为 "***",客户端换票后连 WS 必被 4003 拒绝。
    // 本端点已要求 Bearer 认证,wsToken 只交付给已认证调用者,无泄露风险,端点级跳过脱敏。
    request.skipResponseSanitization = true
    return reply.send(success({ wsToken, expiresIn: 300 }))
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
      // 2026-08-02 P1 安全审计:单用户并发连接数限制
      if (!userConnectionLimiter.acquire(userId)) {
        server.log.warn({ userId }, 'ws-notifications 拒绝连接:单用户连接数超限')
        try {
          server.recordWsAuthFailure('too_many_connections')
        } catch {
          /* 指标采集失败不影响业务 */
        }
        socket.close(WS_CLOSE.TOO_MANY_CONNECTIONS, '单用户连接数超限')
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
        // 2026-09-26:递减一律由"真的摘掉了人"驱动(见 dropConnection 的注释)
        dropConnection(userId, socket)
        // 2026-08-02 P1 安全审计:释放连接槽位
        userConnectionLimiter.release(userId)
      })
    })()
  })

  getWsAutoRecoveryManager().setFastify(server)
  getWsAutoRecoveryManager().registerPlugin('ws-notifications', {
    getConnections: () => connections as unknown as Map<string, WebSocket | Set<WebSocket>>,
    removeConnection: async (userId) => {
      // 2026-09-26 反向缺陷收口:只摘**当下确实死亡**的连接,gauge 按**实际移除量**递减。
      // 旧写法是 `wsConnectionCount -= conns.size` + `connections.delete(userId)`:
      // 扣的数取的是"这一刻该键下有几个成员"这个快照计数,而摘的是整键 —— 两个动作
      // 没有共同依据,只是恰好被调用方(ws-auto-recovery 的 isAllStale 在同一 tick 里
      // 先确认整组皆僵尸)对齐。这个对齐是脆的:一旦 getConnections 改成返回复制快照
      // (ws-chat 就是那种形态),活连接会被整键拆掉、gauge 还会多扣。removeIfDead 把
      // "摘了谁"和"摘了几个"收成同一份返回值,表与 gauge 再也不会各说各话。
      const removed = removeIfDead(connections, userId, isSocketZombie)
      if (removed > 0) {
        wsConnectionCount -= removed
        updateWsConnectionGauges()
      }
    },
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
