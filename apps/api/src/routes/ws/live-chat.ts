// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import {
  wsAuth,
  wsUpgradeRequiresCredential,
  WS_CLOSE,
  WsUserConnectionLimiter,
} from '../../plugins/ws-helpers.js'
import { getLiveChatServer } from '../../websocket/chat-server.js'

/**
 * F-466:单用户并发连接上限。
 * 与 ws-messages / ws-broadcast(聊天类端点)同取 8;此前本路由只靠 MAX_ROOMS
 * 回收空房,单账号仍可无限开连接占满 rooms Map 与 socket。
 */
export const MAX_CONNECTIONS_PER_USER = 8

/** 连接处理器所需的指标出口(生产由 fastify 实例绑定,单测可注入空实现) */
export interface LiveChatMetricsSink {
  recordWsRooms(count: number): void
  setLiveOnline(roomId: string, size: number): void
  deleteLiveOnline(roomId: string): void
  recordWsMessageLatency(ms: number): void
}

/** 连接建立处理(导出以便回归测试直接调用,不依赖真实 WS 握手) */
export function createLiveChatConnectionHandler(
  metrics: LiveChatMetricsSink,
  limiter: WsUserConnectionLimiter,
): (socket: WebSocket, request: FastifyRequest) => void {
  return (socket, request) => {
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
      const uid = userId

      // F-466:单用户并发连接数超限直接拒绝(4005 与其余 ws 插件一致)
      if (!limiter.acquire(uid)) {
        request.log.warn({ userId: uid }, 'ws/live-chat 拒绝连接:单用户连接数超限')
        socket.close(WS_CLOSE.TOO_MANY_CONNECTIONS, '单用户连接数超限')
        return
      }

      // close 与 error 可能双触发,槽位只释放一次,防计数泄漏
      let released = false
      const releaseSlot = (): void => {
        if (released) return
        released = true
        limiter.release(uid)
      }

      const chatServer = getLiveChatServer()
      // F-466:无可回收空房且房间数已达硬上限时拒绝,不再照建新房间
      if (!chatServer.canJoinRoom(roomId)) {
        request.log.warn({ userId: uid, roomId }, 'ws/live-chat 拒绝连接:房间数已达上限')
        releaseSlot()
        socket.close(1008, '房间数已达上限')
        return
      }
      const room = chatServer.join(roomId, socket)
      /** 同步 live-chat 房间数 gauge(join/leave 后调用;采集失败不影响业务) */
      const syncRoomGauge = (): void => {
        try {
          metrics.recordWsRooms(chatServer.roomCount())
          // ihui_live_online_total(Gauge,per-room set 语义):房间清空时删序列防无界累积
          const online = chatServer.getRoomSize(roomId)
          if (online > 0) {
            metrics.setLiveOnline(roomId, online)
          } else {
            metrics.deleteLiveOnline(roomId)
          }
        } catch {
          /* ignore */
        }
      }
      /** 统一的断开/清理路径:退房 + 指标 + F-466 槽位释放 */
      const cleanup = (): void => {
        chatServer.leave(roomId, socket)
        syncRoomGauge()
        // F-467:断线不得重置全局限流窗口。窗口按 userId 共享、按时间自然过期,
        // 此前无条件 reset 会让"发满 60 条 → 断开重连"直接清桶绕过限流。
        releaseSlot()
      }
      syncRoomGauge()
      try {
        socket.send(JSON.stringify({ type: 'system', content: 'joined', roomId }))
      } catch {
        cleanup()
        return
      }

      socket.on('message', (data: Buffer) => {
        const raw = data.toString()
        // 单条 ping 直接字符串
        if (raw === 'ping') {
          try {
            socket.send('pong')
          } catch {
            cleanup()
          }
          return
        }
        const t0 = Date.now()
        void chatServer
          .handleMessage(room, socket, raw, uid)
          .catch((err) => {
            request.log.warn({ err, roomId }, 'live-chat handleMessage error')
            try {
              socket.send(JSON.stringify({ type: 'error', code: 500, message: '服务器内部错误' }))
            } catch {
              /* ignore */
            }
          })
          .finally(() => {
            try {
              metrics.recordWsMessageLatency(Date.now() - t0)
            } catch {
              /* ignore */
            }
          })
      })

      socket.on('close', cleanup)
      socket.on('error', cleanup)
    })()
  }
}

export const liveChatWsRoutes: FastifyPluginAsync = async (server) => {
  // F-466:每个插件一个 limiter 实例,连接建立 acquire、断开 release
  const limiter = new WsUserConnectionLimiter(MAX_CONNECTIONS_PER_USER)
  const handleConnection = createLiveChatConnectionHandler(
    {
      recordWsRooms: (count) => server.recordWsRooms(count),
      setLiveOnline: (roomId, size) => server.setLiveOnline(roomId, size),
      deleteLiveOnline: (roomId) => server.deleteLiveOnline(roomId),
      recordWsMessageLatency: (ms) => server.recordWsMessageLatency(ms),
    },
    limiter,
  )
  server.get(
    '/ws/live-chat',
    { websocket: true, preValidation: wsUpgradeRequiresCredential() },
    handleConnection,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
