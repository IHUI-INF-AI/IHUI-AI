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
import { wsAuth } from './ws-helpers.js'

declare module 'fastify' {
  interface FastifyInstance {
    broadcastToUser(userId: string, event: string, data: unknown): void
  }
}

const wsBroadcastPlugin: FastifyPluginAsync = async (server) => {
  const connections = new Map<string, Set<WebSocket>>()

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
    })
  })
}

export const wsBroadcast = fp(wsBroadcastPlugin, {
  name: 'ws-broadcast',
  fastify: '5.x',
})
