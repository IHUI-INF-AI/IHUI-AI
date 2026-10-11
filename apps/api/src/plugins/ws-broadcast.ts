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
    broadcastToUser(
      userId: string,
      event: string,
      data: unknown,
      // L9242(G-998164):调用方可选声明帧的事件类别(投递档位)。缺省时按事件名前缀
      // 推导('conversation:*' / 'mcp:*'),两者都取不到 = 不门控(既有语义不变)。
      opts?: { eventClass?: BroadcastEventClass },
    ): BroadcastResult
  }
}

/**
 * L9242(G-998164)事件类别轴:与两个真实发射口一一对应
 *   - 'conversation' ← routes/chat.ts 的 D153 会话元数据事件(conversation:updated)
 *   - 'mcp'          ← routes/internal-user-broadcast.ts 的 D154 MCP 状态事件(mcp:status)
 */
export type BroadcastEventClass = 'conversation' | 'mcp'

/**
 * 连接角色 = 订阅档位:'all' 收全部(缺省,维持既有语义),其余只收同类事件。
 * 门控是**收窄**:声明了角色的连接只是把自己能收的类收窄,不发起新的授权语义
 * (收信人仍由 token 钉死的 userId 决定)。
 */
export type BroadcastConnectionRole = 'all' | BroadcastEventClass

const CONNECTION_ROLES: readonly BroadcastConnectionRole[] = ['all', 'conversation', 'mcp']

/** 广播结果(L9242):no-op 是可断言的返回值,不是异常。 */
export interface BroadcastResult {
  /** 该 userId 名下参与本轮的连接数 */
  matched: number
  /** 通过门控并已交给 socket 的帧数 */
  delivered: number
  /** 因连接角色与帧类别不合而被跳过(no-op)的连接数 */
  gated: number
}

/**
 * 由事件名推导类别(前缀约定来自两个真实发射口)。
 * 推导不出(无前缀命中)返回 null = 不门控,发给所有连接 —— 既有消费方语义不变。
 */
export function broadcastEventClassOf(event: string): BroadcastEventClass | null {
  if (event.startsWith('conversation:')) return 'conversation'
  if (event.startsWith('mcp:')) return 'mcp'
  return null
}

/**
 * 解析连接声明角色(/ws/broadcast?role=)。非法值回落 'all':角色是订阅收窄提示,
 * 不是安全门,回落维持现状比断开连接更符合"门控必须是收窄"的票面约束。
 */
export function parseBroadcastConnectionRole(raw: string | undefined): BroadcastConnectionRole {
  return CONNECTION_ROLES.includes(raw as BroadcastConnectionRole)
    ? (raw as BroadcastConnectionRole)
    : 'all'
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
  // L9242:连接角色旁表。不动 connections 本体(auto-recovery 依赖 Set<WebSocket> 形状),
  // 键是 socket 引用,close 路径同步摘除;真实 socket 被整表摘除时 close 事件仍会触发清理。
  const connRoles = new Map<WebSocket, BroadcastConnectionRole>()
  // 2026-08-02 P1 安全审计:单用户并发连接数限制(防资源耗尽)
  const userConnectionLimiter = new WsUserConnectionLimiter(8)
  const sendFailures = createSendFailureLedger(Date.now)

  server.decorate(
    'broadcastToUser',
    (userId: string, event: string, data: unknown, opts?: { eventClass?: BroadcastEventClass }) => {
      const conns = connections.get(userId)
      if (!conns || conns.size === 0) return { matched: 0, delivered: 0, gated: 0 }
      // L9242:帧类别 = 调用方显式声明,缺省按事件名前缀推导;取不到 = 不门控(既有语义)。
      const cls = opts?.eventClass ?? broadcastEventClassOf(event)
      const msg = JSON.stringify({ event, data })
      let delivered = 0
      let gated = 0
      for (const ws of conns) {
        // ── L9242 门控跳(变异验证的目标):连接角色收窄订阅面 ──
        // 未声明角色的连接(旁表无记录)= 'all',一帧不落,既有语义不变。
        // 不合面 ⇒ 对该连接 no-op:计数、continue,不抛错、不断开、不影响其余连接。
        const connRole = connRoles.get(ws) ?? 'all'
        if (cls !== null && connRole !== 'all' && connRole !== cls) {
          gated += 1
          continue
        }
          delivered += 1
        // 2026-09-26 修「丢帧且无人知」。现读实测:原写法是同步 `try { ws.send(msg) } catch { conns.delete(ws) }`
        // —— 与票面写的 `.catch(吞)` 形态不同,但结果一致:既不计数也不出声。
        // 更要紧的是 ws 在连接已关闭时把 send 的错误交给 **callback** 而非抛出,
        // 所以旧写法在"连接已断"这一主场景下连 catch 都不会命中,摘线与计数全落空。
        // 故两条路径都要接上:callback 收异步错误,catch 收同步抛出。
        const noteDropped = (): void => {
          conns.delete(ws)
          // ① 计数一律走既有观测出口 server.metrics(/metrics 与 /health/metrics 都读它),
          //   不新建第二套 metrics 体系。**两个计数器成对递增,各自问的是不同的一件事**:
          //   - wsDisconnectsTotal = "这条连接从注册表里少了一次"。客户端正常关连接
          //     (ws-chat / ws-notifications 的 close 路径)也给它 +1,所以它是断开总数的
          //     上界,运维从它问不出"有没有帧没送到人"。
          //   - wsBroadcastDroppedFramesTotal = "有一帧没能送出去、并且摘掉了一条挂在
          //     注册表里的陈旧连接"。这一格才是运维要的那颗信号,故必须单独可查询 ——
          //     warn 是进程日志、不可查询且被 60s 节流,不能当观测出口用。
          //   一次丢帧确实同时是"一次断开"与"一次丢帧",两件事都真发生了,所以两条各 +1。
          if (server.metrics) {
            server.metrics.wsDisconnectsTotal += 1
            server.metrics.wsBroadcastDroppedFramesTotal += 1
          }
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
      return { matched: conns.size, delivered, gated }
    },
  )

  server.get('/ws/broadcast', { websocket: true }, async (socket, request) => {
    const query = request.query as { token?: string; role?: string }
    const token = query.token
    const userId = await wsAuth(socket, token)
    if (!userId) return
    // L9242:连接角色(订阅档位)。缺省/非法 = 'all',维持既有语义;收信人仍由 token 钉死。
    const role = parseBroadcastConnectionRole(query.role)
    if (query.role !== undefined && query.role !== role) {
      server.log.warn({ userId, requested: query.role }, 'ws-broadcast 未知的订阅角色,回落 all')
    }
    // 2026-08-02 P1 安全审计:单用户并发连接数限制
    if (!userConnectionLimiter.acquire(userId)) {
      server.log.warn({ userId }, 'ws-broadcast 拒绝连接:单用户连接数超限')
      socket.close(WS_CLOSE.TOO_MANY_CONNECTIONS, '单用户连接数超限')
      return
    }

    if (!connections.has(userId)) connections.set(userId, new Set())
    connections.get(userId)!.add(socket)
    connRoles.set(socket, role)

    socket.on('message', (data: Buffer) => {
      if (data.toString() === 'ping') socket.send('pong')
    })

    socket.on('close', () => {
      const conns = connections.get(userId)
      if (conns) {
        conns.delete(socket)
        if (conns.size === 0) connections.delete(userId)
      }
      connRoles.delete(socket)
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
