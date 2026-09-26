// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 丢帧喊话的节流窗口 —— 与本仓既有台账同档
 * (services/upload-merge-gate.ts 的 UPLOAD_MERGE_NOTICE_THROTTLE_MS = 60s)。
 */
const SEND_FAILURE_NOTICE_THROTTLE_MS = 60_000

/**
 * 「台账 + 首次喊话 + 节流复读」形态,取自本仓既有出口而非另起一套:
 * 首次立即喊 → 窗口内只静默计数 → 超窗复读并带累计数。
 * 既不静默丢帧,也不每帧刷屏(断线的客户端可能长期挂在集合里)。
 */
function createSendFailureLedger(now: () => number): {
  record(): boolean
  total(): number
} {
  let count = 0
  let lastAtMs = 0
  return {
    /** @returns 本次是否应当喊话 */
    record(): boolean {
      count += 1
      const t = now()
      const due = count === 1 || t - lastAtMs >= SEND_FAILURE_NOTICE_THROTTLE_MS
      if (due) lastAtMs = t
      return due
    },
    total(): number {
      return count
    },
  }
}

const wsBroadcastPlugin: FastifyPluginAsync = async (server) => {
  const connections = new Map<string, Set<WebSocket>>()
  // 2026-08-02 P1 安全审计:单用户并发连接数限制(防资源耗尽)
  const userConnectionLimiter = new WsUserConnectionLimiter(8)
  const sendFailures = createSendFailureLedger(Date.now)

  server.decorate('broadcastToUser', (userId: string, event: string, data: unknown) => {
    const conns = connections.get(userId)
    if (!conns || conns.size === 0) return
    const msg = JSON.stringify({ event, data })
    for (const ws of conns) {
      // 2026-09-26 修「丢帧且无人知」。现读实测:原写法是同步 `try { ws.send(msg) } catch { conns.delete(ws) }`
      // —— 与票面写的 `.catch(吞)` 形态不同,但结果一致:既不计数也不出声。
      // 更要紧的是 ws 在连接已关闭时把 send 的错误交给 **callback** 而非抛出,
      // 所以旧写法在"连接已断"这一主场景下连 catch 都不会命中,摘线与计数全落空。
      // 故两条路径都要接上:callback 收异步错误,catch 收同步抛出。
      const noteDropped = (): void => {
        conns.delete(ws)
        // ① 计数一律走既有观测出口 server.metrics(/metrics 与 /health/metrics 都读它),
        //   不新建第二套 metrics 体系。语义映射:本插件视角"这条连接已死"就是既有
        //   ws_disconnects_total 那一件事,且一帧丢 = 一次摘线,一一对应不重复计。
        if (server.metrics) server.metrics.wsDisconnectsTotal += 1
        // ② 首次 warn + 节流复读。字段只有计数与 userId,**不含事件名与会话内容**。
        if (sendFailures.record()) {
          server.log.warn(
            { userId, droppedFramesTotal: sendFailures.total() },
            'ws-broadcast 发送失败,已摘线并计数(首次或超 60s 复读)',
          )
        }
        // ③ 不抛错:广播主流程继续把这一帧发给其余连接。
      }
      try {
        ws.send(msg, (err) => {
          if (err) noteDropped()
        })
      } catch {
        noteDropped()
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
