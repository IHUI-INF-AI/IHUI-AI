/**
 * 终端 WebSocket 插件 — /ws/terminal/:sessionId 双向流。
 *
 * 客户端连接:ws(s)://host/ws/terminal/:sessionId?token=<access_token>
 *
 * 消息协议(JSON):
 *   客户端 → 服务端:
 *     {type:'input',  data:string}
 *     {type:'resize', data:{cols:number, rows:number}}
 *     {type:'close'}
 *   服务端 → 客户端:
 *     {type:'output', data:string}
 *     {type:'exit',   data:string, code:number}
 *     {type:'error',  data:string}
 *   心跳:客户端发 'ping' 字符串,服务端回 'pong' 字符串
 *
 * 鉴权:连接时校验 JWT(query string token),失败 close(4001/4003)。
 * 安全:仅允许 session 归属用户连接(校验 PTYEntry.userId === JWT userId)。
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import { wsAuth } from './ws-helpers.js'
import {
  getPTYEntry,
  onData,
  onExit,
  writeInput,
  closeSession,
} from '../services/terminal-service.js'
import type { TerminalWSClientMessage } from '@ihui/types'

/** WebSocket readyState 常量(避免直接引用实例上的 OPEN 属性) */
const WS_OPEN = 1

const wsTerminalPlugin: FastifyPluginAsync = async (server) => {
  server.get(
    '/ws/terminal/:sessionId',
    { websocket: true },
    (socket: WebSocket, request: FastifyRequest) => {
      const { sessionId } = request.params as { sessionId: string }
      const token = (request.query as { token?: string }).token

      ;(async () => {
        // 1. JWT 鉴权(复用 ws-helpers.wsAuth)
        let userId: string | null
        try {
          userId = await wsAuth(socket, token)
        } catch {
          return
        }
        if (!userId) return

        // 2. 校验 session 存在且归属当前用户
        const entry = getPTYEntry(sessionId)
        if (!entry) {
          socket.send(JSON.stringify({ type: 'error', data: '终端会话不存在' }))
          socket.close(4004, 'session not found')
          return
        }
        if (entry.userId !== userId) {
          socket.send(JSON.stringify({ type: 'error', data: '无权访问此终端会话' }))
          socket.close(4003, 'forbidden')
          return
        }

        // 3. 注册 PTY 数据监听器 → WebSocket 推送
        const removeDataListener = onData(sessionId, (data) => {
          if (socket.readyState === WS_OPEN) {
            socket.send(JSON.stringify({ type: 'output', data }))
          }
        })

        // 4. 注册 PTY 退出监听器 → WebSocket 推送 + 关闭连接
        const removeExitListener = onExit(sessionId, (e) => {
          if (socket.readyState === WS_OPEN) {
            socket.send(
              JSON.stringify({
                type: 'exit',
                data: `Process exited with code ${e.exitCode}`,
                code: e.exitCode,
              }),
            )
            socket.close(1000, 'process exited')
          }
        })

        // 5. 处理客户端消息(input / resize / close / ping 心跳)
        socket.on('message', (raw: Buffer) => {
          const text = raw.toString()

          // 心跳:客户端发 'ping' 字符串,服务端回 'pong'(非 JSON,优先处理)
          if (text === 'ping') {
            socket.send('pong')
            return
          }

          let msg: TerminalWSClientMessage
          try {
            msg = JSON.parse(text) as TerminalWSClientMessage
          } catch {
            socket.send(JSON.stringify({ type: 'error', data: '无效的消息格式' }))
            return
          }

          switch (msg.type) {
            case 'input':
              writeInput(sessionId, msg.data)
              break
            case 'resize':
              try {
                entry.pty.resize(
                  Math.max(1, msg.data.cols),
                  Math.max(1, msg.data.rows),
                )
              } catch {
                /* resize 失败忽略 */
              }
              break
            case 'close':
              closeSession(sessionId, userId)
              socket.close(1000, 'client closed')
              break
          }
        })

        // 6. 连接关闭时清理监听器
        socket.on('close', () => {
          removeDataListener?.()
          removeExitListener?.()
        })
      })()
    },
  )
}

export const wsTerminal = fp(wsTerminalPlugin, {
  name: 'ws-terminal',
  fastify: '5.x',
})
