// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
// F-116 第五条链:终端输出也走统一背压闸(其余四条 ws-* 早已接入)。
// 终端帧不能像通知那样静默丢,故超水位时 pause PTY(数据留在 OS 缓冲不丢帧),
// drain 后 resume;另加超时兜底,防半死连接让命令永久暂停。
import { isWsBackpressured, sendWithBackpressure } from './ws-backpressure.js'
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

        // 3. 注册 PTY 数据监听器 → WebSocket 推送(带背压)
        // node-pty 有 pause/resume;SSH wrapper 可能没有,统一用可选调用安全降级。
        const ptyControl = entry.pty as unknown as {
          pause?: () => void
          resume?: () => void
        }
        let ptyPaused = false
        let pauseTimer: ReturnType<typeof setTimeout> | null = null
        const resumePty = (): void => {
          if (!ptyPaused) return
          ptyPaused = false
          if (pauseTimer) {
            clearTimeout(pauseTimer)
            pauseTimer = null
          }
          try { ptyControl.resume?.() } catch { /* SSH wrapper 不支持则忽略 */ }
        }
        const pausePty = (): void => {
          if (ptyPaused) return
          ptyPaused = true
          try { ptyControl.pause?.() } catch { /* SSH wrapper 不支持则忽略 */ }
          // 半死连接(既不读也不 drain)兜底:5s 后强制恢复。宁可让客户端丢几帧,
          // 也不能让后台命令因为一次暂停而永久卡住(对齐 kill-wait 的有界思想)。
          pauseTimer = setTimeout(resumePty, 5000)
        }
        const removeDataListener = onData(sessionId, (data) => {
          if (socket.readyState !== WS_OPEN) return
          if (isWsBackpressured(socket)) {
            pausePty()
            return
          }
          const outcome = sendWithBackpressure(
            socket,
            JSON.stringify({ type: 'output', data }),
            () => socket.close(1011, 'terminal write failed'),
          )
          if (outcome === 'skipped') pausePty()
        })
        // 消费端追上后恢复 PTY(不丢积压数据:node-pty pause 把数据留在 OS 缓冲)
        socket.on('drain', resumePty)

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
                entry.pty.resize(Math.max(1, msg.data.cols), Math.max(1, msg.data.rows))
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
          // 断线必须恢复 PTY:否则半死连接会把后台命令永久挂起
          resumePty()
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
