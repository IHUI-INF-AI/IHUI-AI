/**
 * 公共 Socket 广播推送插件(迁移自 coze_zhs_py/api/public_socket.py)。
 *
 * 提供 server.broadcastToUser(userId, event, data) 装饰器,
 * 复用 ws-helpers.ts 的 wsAuth 鉴权,维护本机 userId → WebSocket 连接集合。
 *
 * 端点: GET /ws/broadcast?token=<access_token>
 *   客户端连接后接收 { event, data } 推送消息。
 *
 * 注册(server.ts):
 *   await server.register(wsBroadcast)
 *
 * 注意:与 ws-notifications 的 pushNotification 区别:
 *   - pushNotification 推送 { type: 'notification', data }
 *   - broadcastToUser 推送 { event, data }(通用事件广播,语义更宽)
 */
import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import { wsAuth, WS_CLOSE, WsUserConnectionLimiter } from './ws-helpers.js'
import { getWsAutoRecoveryManager } from './ws-auto-recovery.js'

declare module 'fastify' {
  interface FastifyInstance {
    broadcastToUser(userId: string, event: string, data: unknown): void
  }
}

const wsBroadcastPlugin: FastifyPluginAsync = async (server) => {
  const connections = new Map<string, Set<WebSocket>>()
  // 2026-08-02 P1 安全审计:单用户并发连接数限制(防资源耗尽)
  const userConnectionLimiter = new WsUserConnectionLimiter(8)

  server.decorate('broadcastToUser', (userId: string, event: string, data: unknown) => {
    const conns = connections.get(userId)
    if (!conns || conns.size === 0) return
    const msg = JSON.stringify({ event, data })
    for (const ws of conns) {
      try {
        ws.send(msg)
      } catch {
        conns.delete(ws)
      }
    }
  })

  server.get('/ws/broadcast', { websocket: true }, async (socket, request) => {
    const token = (request.query as { token?: string }).token
    const userId = await wsAuth(socket, token)
    if (!userId) return
    // 2026-08-02 P1 安全审计:单用户并发连接数限制
    if (!userConnectionLimiter.acquire(userId)) {
      server.log.warn({ userId }, 'ws-broadcast 拒绝连接:单用户连接数超限')
      socket.close(WS_CLOSE.TOO_MANY_CONNECTIONS, '单用户连接数超限')
      return
    }

    if (!connections.has(userId)) connections.set(userId, new Set())
    connections.get(userId)!.add(socket)

    socket.on('message', (data: Buffer) => {
      if (data.toString() === 'ping') socket.send('pong')
    })

    socket.on('close', () => {
      const conns = connections.get(userId)
      if (conns) {
        conns.delete(socket)
        if (conns.size === 0) connections.delete(userId)
      }
      // 2026-08-02 P1 安全审计:释放连接槽位
      userConnectionLimiter.release(userId)
    })
  })

  getWsAutoRecoveryManager().setFastify(server)
  getWsAutoRecoveryManager().registerPlugin('ws-broadcast', {
    getConnections: () => connections as unknown as Map<string, WebSocket | Set<WebSocket>>,
    removeConnection: async (userId) => {
      connections.delete(userId)
    },
  })
}

export const wsBroadcast = fp(wsBroadcastPlugin, {
  name: 'ws-broadcast',
  fastify: '5.x',
})
