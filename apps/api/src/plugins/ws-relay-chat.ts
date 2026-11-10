// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ws-relay-chat.ts — 号池 relay 的长连接入口(2026-11-10 立)。
 *
 * 端点:GET /ws/relay/chat?token=<ws-ticket|access-token>
 *
 * 为什么要有这个端点(而不是让客户端继续打 HTTP SSE):
 * 号池此前对外只有 POST /v1/chat/completions 一条 SSE 通道。客户端每轮对话都要
 * 重新建连 + 重新鉴权 + 重新过一遍号池选号;移动端/桌面端在网络切换时尤其吃亏。
 * 本端点让**一条 WS 连接承载多轮请求**,并且单连接内可并发(带 id 多路复用),
 * 与既有的 /ws/relay/ops(运营推送)一起补齐 relay 的长连接面。
 *
 * 端到端链路:
 *   客户端 ⇄ WS ⇄ 本插件 ⇄ forwardToChannel(渠道直连 / 号池回落 / 记账 / 熔断)
 *                        ⇄ (上游 WS 或 HTTP SSE,由适配器声明)
 *
 * 关键点:**不重写转发语义**。选路、号池回落、字节记账、流中断罚号全部复用
 * forwardToChannel + pipeChannelStream,本插件只做"帧 ↔ 请求"的翻译与连接生命周期。
 *
 * 协议(客户端 → 服务端):
 *   { "type":"chat", "id":"c1", "model":"doubao/doubao-seed", "messages":[...], "stream":true }
 *   { "type":"cancel", "id":"c1" }
 *   "ping"（纯文本）
 *
 * 协议(服务端 → 客户端):
 *   { "type":"ready",   "userId":"..." }                    连接就绪
 *   { "type":"start",   "id":"c1" }                         已受理
 *   { "type":"chunk",   "id":"c1", "data":"{...}" }         SSE data 行(已去 data: 前缀)
 *   { "type":"result",  "id":"c1", "data":{...} }           非流式完整结果
 *   { "type":"done",    "id":"c1" }                         正常收尾(只发一次)
 *   { "type":"error",   "id":"c1", "message":"...", "status":401 }
 */
import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import {
  WsRateLimiter,
  WsUserConnectionLimiter,
  WS_CLOSE,
  wsAuth,
  wsUpgradeRequiresCredential,
} from './ws-helpers.js'
import { forwardToChannel, pipeChannelStream } from '../services/relay-upstream-forwarder.js'
import { logger } from '../utils/logger.js'

/** 单连接同时在途请求上限(防一条连接把整套号池并发吃满) */
const MAX_INFLIGHT_PER_CONNECTION = 4

interface ChatFrame {
  type?: unknown
  id?: unknown
  model?: unknown
  messages?: unknown
  stream?: unknown
  [key: string]: unknown
}

function safeSend(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== 1) return
  try {
    socket.send(JSON.stringify(payload))
  } catch {
    /* 发送竞态:连接已断,忽略 */
  }
}

export const wsRelayChat: FastifyPluginAsync = async (server) => {
  const sockets = new Set<WebSocket>()
  const connLimiter = new WsUserConnectionLimiter(4)
  const rateLimiter = new WsRateLimiter(120, 60_000)

  server.get(
    '/ws/relay/chat',
    { websocket: true, preValidation: wsUpgradeRequiresCredential() },
    async (socket, request) => {
      const token = (request.query as { token?: string }).token
      const userId = await wsAuth(socket, token)
      if (!userId) return

      if (!connLimiter.acquire(userId)) {
        socket.close(WS_CLOSE.TOO_MANY_CONNECTIONS, '单用户连接数超限')
        return
      }
      sockets.add(socket)

      /** 在途请求:id → abort 句柄(客户端 cancel / 连接断开时统一中断) */
      const inflight = new Map<string, AbortController>()
      let closed = false

      const cleanup = (): void => {
        if (closed) return
        closed = true
        for (const controller of inflight.values()) {
          try {
            controller.abort()
          } catch {
            /* 已结束 */
          }
        }
        inflight.clear()
        sockets.delete(socket)
        connLimiter.release(userId)
        rateLimiter.reset(userId)
      }

      safeSend(socket, { type: 'ready', userId })

      const runChat = async (frame: ChatFrame): Promise<void> => {
        const id = typeof frame.id === 'string' && frame.id ? frame.id : null
        if (!id) {
          safeSend(socket, { type: 'error', message: '缺少 id' })
          return
        }
        if (inflight.size >= MAX_INFLIGHT_PER_CONNECTION) {
          safeSend(socket, {
            type: 'error',
            id,
            message: `单连接在途请求已达上限(${MAX_INFLIGHT_PER_CONNECTION}),请等待或取消其他请求`,
          })
          return
        }
        const model = typeof frame.model === 'string' ? frame.model.trim() : ''
        if (!model) {
          safeSend(socket, { type: 'error', id, message: '缺少 model' })
          return
        }
        if (!Array.isArray(frame.messages) || frame.messages.length === 0) {
          safeSend(socket, { type: 'error', id, message: 'messages 必须是非空数组' })
          return
        }

        const controller = new AbortController()
        inflight.set(id, controller)
        // 客户端断开时 abort 已经在 cleanup 里做;这里只需保证正常结束时释放槽位
        const release = (): void => {
          inflight.delete(id)
        }
        const stream = frame.stream !== false

        safeSend(socket, { type: 'start', id })

        try {
          const result = await forwardToChannel({
            model,
            messages: frame.messages as Array<{ role: string; content?: unknown }>,
            stream,
            userId,
            affinityKey: id,
            signal: controller.signal,
            temperature: typeof frame.temperature === 'number' ? frame.temperature : undefined,
            maxTokens: typeof frame.max_tokens === 'number' ? frame.max_tokens : undefined,
            topP: typeof frame.top_p === 'number' ? frame.top_p : undefined,
            stop: frame.stop as string | string[] | undefined,
            tools: Array.isArray(frame.tools) ? frame.tools : undefined,
            toolChoice: frame.tool_choice,
          })

          if (result === null) {
            safeSend(socket, {
              type: 'error',
              id,
              message: '无可用渠道或账号池候选(模型未配置/全部熔断/无可用号)',
            })
            return
          }
          if (!result.ok) {
            safeSend(socket, {
              type: 'error',
              id,
              message: result.reason,
              status: result.lastHttpStatus,
            })
            return
          }

          if (stream) {
            await pipeChannelStream(result.response, {
              writeLine: (line: string) => {
                // SSE 行形如 `data: {...}`;剥前缀后原样交客户端,由客户端自己 parse
                const data = line.startsWith('data:') ? line.slice(5).trim() : line
                safeSend(socket, { type: 'chunk', id, data })
              },
              signal: controller.signal,
            })
          } else {
            const json = (await result.response.json()) as unknown
            safeSend(socket, { type: 'result', id, data: json })
          }
          // 收尾帧只发一次(pipeChannelStream 已约定不转发上游 [DONE])
          safeSend(socket, { type: 'done', id })
        } catch (err) {
          const aborted = controller.signal.aborted
          safeSend(socket, {
            type: 'error',
            id,
            message: aborted
              ? '请求已取消'
              : `转发失败: ${err instanceof Error ? err.message : String(err)}`,
          })
        } finally {
          release()
        }
      }

      socket.on('message', (raw: Buffer) => {
        const text = raw.toString()
        if (text === 'ping') {
          try {
            socket.send('pong')
          } catch {
            /* 已断 */
          }
          return
        }
        if (!rateLimiter.allow(userId)) {
          socket.close(WS_CLOSE.RATE_LIMITED, '请求过于频繁')
          return
        }
        let frame: ChatFrame
        try {
          frame = JSON.parse(text) as ChatFrame
        } catch {
          safeSend(socket, { type: 'error', message: '非法 JSON' })
          return
        }
        if (frame?.type === 'cancel') {
          const id = typeof frame.id === 'string' ? frame.id : ''
          inflight.get(id)?.abort()
          return
        }
        if (frame?.type === 'chat') {
          void runChat(frame)
          return
        }
        safeSend(socket, { type: 'error', message: `未知帧类型: ${String(frame?.type)}` })
      })

      socket.on('close', cleanup)
      socket.on('error', cleanup)
    },
  )

  server.addHook('onClose', async () => {
    for (const ws of sockets) {
      try {
        ws.close(1001, 'server shutting down')
      } catch {
        /* 已断 */
      }
    }
    sockets.clear()
  })

  logger.info('ws-relay-chat 已注册:GET /ws/relay/chat(号池长连接入口)')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
