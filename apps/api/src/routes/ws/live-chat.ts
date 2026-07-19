/**
 * WebSocket live-chat 路由。
 *
 * 端点: ws://host/ws/live-chat?roomId={channelId}&token={access_token}
 *
 * 客户端 → 服务端消息外壳:
 *   { type: "send",     content, userName?, userAvatar? }
 *   { type: "history",  limit? }
 *   { type: "ping" }
 *
 * 服务端 → 客户端消息外壳:
 *   { type: "chat",     data: ChatMessage }                // 房间广播
 *   { type: "history",  data: ChatMessage[] }              // 私发请求者
 *   { type: "pong" }                                       // 心跳
 *   { type: "error",    code, message }                    // 错误
 *   { type: "system",   content: "joined"|"left"|"ping" }  // 入退/心跳
 *
 * 鉴权:复用现有 ws-helpers.wsAuth(token),与 ws-chat / ws-messages 一致。
 * 房间管理:getLiveChatServer().join/leave,自动清理空房间。
 */

import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import { wsAuth } from '../../plugins/ws-helpers.js'
import { getLiveChatServer } from '../../websocket/chat-server.js'

export const liveChatWsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/ws/live-chat', { websocket: true }, (socket: WebSocket, request) => {
    const query = request.query as { roomId?: string; token?: string }
    const roomId = query.roomId
    const token = query.token

    if (!roomId) {
      try {
        socket.send(JSON.stringify({ type: 'error', code: 400, message: '缺少 roomId' }))
        socket.close()
      } catch {
        /* ignore */
      }
      return
    }

    void (async () => {
      let userId: string | null
      try {
        userId = await wsAuth(socket, token)
      } catch {
        return
      }
      if (!userId) return

      const chatServer = getLiveChatServer()
      const room = chatServer.join(roomId, socket)
      try {
        socket.send(JSON.stringify({ type: 'system', content: 'joined', roomId }))
      } catch {
        chatServer.leave(roomId, socket)
        return
      }

      socket.on('message', (data: Buffer) => {
        const raw = data.toString()
        // 单条 ping 直接字符串
        if (raw === 'ping') {
          try {
            socket.send('pong')
          } catch {
            chatServer.leave(roomId, socket)
          }
          return
        }
        void chatServer
          .handleMessage(room, socket, raw, userId!)
          .catch((err) => {
            request.log.warn({ err, roomId }, 'live-chat handleMessage error')
            try {
              socket.send(
                JSON.stringify({ type: 'error', code: 500, message: '服务器内部错误' }),
              )
            } catch {
              /* ignore */
            }
          })
      })

      socket.on('close', () => {
        chatServer.leave(roomId, socket)
      })

      socket.on('error', () => {
        chatServer.leave(roomId, socket)
      })
    })()
  })
}
