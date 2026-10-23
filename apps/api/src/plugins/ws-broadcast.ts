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
import IORedis, { type Redis } from 'ioredis'
import { wsAuth, WS_CLOSE, WsUserConnectionLimiter } from './ws-helpers.js'
import { getWsAutoRecoveryManager } from './ws-auto-recovery.js'
import { config } from '../config/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    broadcastToUser(
      userId: string,
      event: string,
      data: unknown,
      // L9242(G-998164)→G-201:调用方声明的帧事件类别已降级为「可选收窄」——
      // 帧类别由服务端按事件名前缀('conversation:*' / 'mcp:*')推导优先;
      // 仅当推导不出时声明值作收窄提示生效,与推导矛盾 ⇒ 以推导为准 + warn。
      opts?: { eventClass?: BroadcastEventClass },
    ): BroadcastResult
  }
}

/**
 * L9242(G-998164)事件类别轴:与真实发射口一一对应
 *   - 'conversation' ← routes/chat.ts 的 D153 会话元数据事件(conversation:updated)
 *   - 'mcp'          ← routes/internal-user-broadcast.ts 的 D154 MCP 状态事件(mcp:status)
 * D125(2026-10-23)追加 'collab' ← routes/chat-collab.ts 的协作事件(collab:invitation /
 * collab:comment);判定出口(resolveBroadcastRole / resolveBroadcastFrameClass / ceiling 表)
 * 零改动,新类别对既有连接零行为差(两通道 ceiling 皆 'all',门控仍是收窄)。
 */
export type BroadcastEventClass = 'conversation' | 'mcp' | 'collab'

/**
 * 连接角色 = 订阅档位:'all' 收全部(缺省,维持既有语义),其余只收同类事件。
 * 门控是**收窄**:声明了角色的连接只是把自己能收的类收窄,不发起新的授权语义
 * (收信人仍由 token 钉死的 userId 决定)。
 */
export type BroadcastConnectionRole = 'all' | BroadcastEventClass

const CONNECTION_ROLES: readonly BroadcastConnectionRole[] = [
  'all',
  'conversation',
  'mcp',
  'collab',
]

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
  // D125 协作事件族前缀约定(与上面两发射口同一口径)
  if (event.startsWith('collab:')) return 'collab'
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

// =============================================================================
// G-201 身份判定出口(2026-10-23 代裁落码):档位由服务端按连接身份推导,
// 调用方/连接侧自报字段统一降级为「可选收窄」。
//
// 身份模型裁决:连接身份 = (认证主体, 连接通道) 二维 ——
//   - principal 'user-session'  ← /ws/broadcast 的 wsAuth(用户 access token / ws-ticket)钉死
//   - principal 'admin-session' ← public-socket HTTP 面(admin JWT + isSystemAdminUser)钉死
//   - 匿名在鉴权层已被拒(根本进不到订阅),API key(openCapability)不落这两条通道。
// 推导表(ceiling)取今日实测:两组合实际都收 conversation:* 与 mcp:* 帧
// (/ws/broadcast 两个真实发射口并存;public-socket 运维镜像不限类)⇒ ceiling 皆 'all'。
// =============================================================================

export type BroadcastChannel = 'ws-broadcast' | 'public-socket'
export type BroadcastPrincipal = 'user-session' | 'admin-session'

/**
 * 服务端推导表:连接身份组合 → 订阅上限(ceiling)。
 * 未知组合显式抛错 —— 新增通道/主体时必须先在此登记,不默认放行。
 */
export function deriveConnectionRole(
  channel: BroadcastChannel,
  principal: BroadcastPrincipal,
): BroadcastConnectionRole {
  if (channel === 'ws-broadcast' && principal === 'user-session') return 'all'
  if (channel === 'public-socket' && principal === 'admin-session') return 'all'
  throw new Error(`deriveConnectionRole: 未登记的连接身份组合 ${principal}/${channel}`)
}

/** declared 是否 ⊆ ceiling:'all' 上限接受任何合法档(只收窄不放宽);具体类上限只收同类。 */
function isRoleWithinCeiling(
  declared: BroadcastConnectionRole,
  ceiling: BroadcastConnectionRole,
): boolean {
  return ceiling === 'all' || declared === ceiling
}

/**
 * 单一判定出口(连接角色轴):ceiling 由服务端推导;自报 declared 合法(封闭集内)
 * 且 ⊆ ceiling 才生效,否则(非法值/想放宽)回落 ceiling 并置 rejected 供调用方 warn。
 */
export function resolveBroadcastRole(input: {
  channel: BroadcastChannel
  principal: BroadcastPrincipal
  declared?: string
}): { role: BroadcastConnectionRole; rejected?: string } {
  const ceiling = deriveConnectionRole(input.channel, input.principal)
  if (input.declared === undefined) return { role: ceiling }
  const parsed = parseBroadcastConnectionRole(input.declared)
  // parsed !== declared ⇒ 必是封闭集外非法值;再查是否想放宽(⊆ ceiling 才许)
  if (parsed !== input.declared || !isRoleWithinCeiling(parsed, ceiling)) {
    return { role: ceiling, rejected: input.declared }
  }
  return { role: parsed }
}

/**
 * 单一判定出口(发射帧类别轴):帧类别是事件的属性,服务端按事件名推导优先;
 * 调用方声明 declared 只在推导不出(无前缀)时作收窄提示生效,
 * 与推导矛盾 ⇒ 以推导值为准并置 rejected 供调用方 warn。
 * public-socket send-message 复用本出口 —— 同一口径不抄第二份判定。
 */
export function resolveBroadcastFrameClass(
  event: string,
  declared?: BroadcastEventClass,
): { cls: BroadcastEventClass | null; rejected?: BroadcastEventClass } {
  const derived = broadcastEventClassOf(event)
  if (derived !== null) {
    if (declared !== undefined && declared !== derived) {
      return { cls: derived, rejected: declared }
    }
    return { cls: derived }
  }
  return { cls: declared ?? null }
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

/**
 * 跨实例桥接频道前缀(D125 另批收口,设计稿 §4.3)。
 * 与 ws-notifications 的 `notify:` 前缀不同命名空间,两条通道互不串台。
 */
const BROADCAST_CHANNEL_PREFIX = 'broadcast:'

const wsBroadcastPlugin: FastifyPluginAsync = async (server) => {
  const connections = new Map<string, Set<WebSocket>>()
  // 跨实例订阅连接(独立于 publisher;订阅连接不能再发普通命令,与 ws-notifications 同一理由)
  let subscriber: Redis | null = null
  // L9242:连接角色旁表。不动 connections 本体(auto-recovery 依赖 Set<WebSocket> 形状),
  // 键是 socket 引用,close 路径同步摘除;真实 socket 被整表摘除时 close 事件仍会触发清理。
  const connRoles = new Map<WebSocket, BroadcastConnectionRole>()
  // 2026-08-02 P1 安全审计:单用户并发连接数限制(防资源耗尽)
  const userConnectionLimiter = new WsUserConnectionLimiter(8)
  const sendFailures = createSendFailureLedger(Date.now)

  /**
   * 本机直投:把一帧交给本进程注册表里该 userId 的连接(逐连接按角色门控,收窄语义不变)。
   * 抽成函数是跨实例桥接的前置:pmessage 路径与本机 publish 降级路径复用**同一**投递体,
   * 不抄第二份门控/metrics/丢帧台账逻辑(§0.6)。
   */
  const deliverLocal = (
    userId: string,
    event: string,
    data: unknown,
    cls: BroadcastEventClass | null,
  ): BroadcastResult => {
    const conns = connections.get(userId)
    if (!conns || conns.size === 0) return { matched: 0, delivered: 0, gated: 0 }
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
  }

  // ── D125 另批收口(2026-10-23):跨实例桥接(设计稿 §4.3"另票"结清)──────────────
  // 形态逐字取自 ws-notifications:独立 subscriber 连接 + psubscribe + publisher 复用
  // server.redis(plugins/redis.ts 装饰,注册序在 490 < 本插件 574)+ 初始化失败降级单实例。
  // 频道 = `broadcast:<userId>`,载荷 = { event, data, eventClass }(eventClass 是发射侧
  // 服务端推导结果;接收侧把它喂回**同一个** resolveBroadcastFrameClass 作"可选收窄"输入,
  // 不抄第二份判据)。
  // 只在 server.redis 存在时建订阅:role-gate 假 server harness(无 redis)零行为差。
  if ((server as unknown as { redis?: Redis }).redis) {
    try {
      subscriber = new IORedis(config.REDIS_URL, {
        retryStrategy: (times) => Math.min(times * 200, 1000),
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: false,
      })
      subscriber.on('error', (err) => {
        server.log.warn({ err }, 'ws-broadcast pubsub subscriber error (degraded mode)')
      })
      subscriber.on('pmessage', (_pattern, channel, message) => {
        const targetUserId = channel.startsWith(BROADCAST_CHANNEL_PREFIX)
          ? channel.slice(BROADCAST_CHANNEL_PREFIX.length)
          : null
        if (!targetUserId) return
        let parsed: { event?: unknown; data?: unknown; eventClass?: unknown }
        try {
          parsed = JSON.parse(message) as { event?: unknown }
        } catch {
          return
        }
        if (typeof parsed.event !== 'string') return
        const frame = resolveBroadcastFrameClass(
          parsed.event,
          parsed.eventClass as BroadcastEventClass | undefined,
        )
        if (frame.rejected !== undefined) {
          server.log.warn(
            {
              userId: targetUserId,
              event: parsed.event,
              declared: frame.rejected,
              applied: frame.cls,
            },
            'ws-broadcast 桥接帧类别自报与事件名推导矛盾,以服务端推导为准(自报只许收窄)',
          )
        }
        deliverLocal(targetUserId, parsed.event, parsed.data, frame.cls)
      })
      await subscriber.psubscribe(`${BROADCAST_CHANNEL_PREFIX}*`)
      server.log.info('ws-broadcast pubsub subscriber ready (multi-instance mode)')
      server.addHook('onClose', async () => {
        if (subscriber) {
          try {
            await subscriber.quit()
          } catch {
            /* ignore */
          }
        }
      })
    } catch (e) {
      server.log.warn(
        { err: e },
        'ws-broadcast pubsub subscriber init failed, fallback to single-instance mode',
      )
      subscriber = null
    }
  }

  server.decorate(
    'broadcastToUser',
    (userId: string, event: string, data: unknown, opts?: { eventClass?: BroadcastEventClass }) => {
      // G-201:帧类别 = 服务端按事件名推导优先;调用方声明的 eventClass 降级为
      // 「可选收窄」(仅推导不出时生效),矛盾 ⇒ 以推导为准 + warn(不静默覆盖)。
      // 这一步挪到"本机无连接"早退**之前**:跨实例桥接必须即使本机没有该 userId 的连接
      // 也 publish(否则别的实例上在线的那个人永远收不到 —— 这正是本票要结清的缺口)。
      const frame = resolveBroadcastFrameClass(event, opts?.eventClass)
      if (frame.rejected !== undefined) {
        server.log.warn(
          { userId, event, declared: frame.rejected, applied: frame.cls },
          'ws-broadcast 帧类别自报与事件名推导矛盾,以服务端推导为准(自报只许收窄)',
        )
      }
      const cls = frame.cls
      if (subscriber) {
        const publisher = (server as unknown as { redis?: Redis }).redis
        if (publisher) {
          try {
            publisher
              .publish(
                `${BROADCAST_CHANNEL_PREFIX}${userId}`,
                JSON.stringify({ event, data, eventClass: cls }),
              )
              .catch((err) => {
                server.log.warn(
                  { err, userId },
                  'ws-broadcast 跨实例 publish 失败(本帧丢失,另一端退回下次打开时同步)',
                )
              })
            // 跨实例送达对本机注册表不可见:如实返回全零计数(matched/delivered/gated 是
            // 本机账,桥接路径没有本机直投)。本机连接不双发:publish 会回环进本实例
            // subscriber,由 pmessage 恰好投一次(与 ws-notifications 同一调和)。
            return { matched: 0, delivered: 0, gated: 0 }
          } catch {
            /* publish 同步抛 ⇒ 降级本机直投(既有语义) */
          }
        }
      }
      return deliverLocal(userId, event, data, cls)
    },
  )

  server.get('/ws/broadcast', { websocket: true }, async (socket, request) => {
    const query = request.query as { token?: string; role?: string }
    const token = query.token
    const userId = await wsAuth(socket, token)
    if (!userId) return
    // G-201:订阅档位由服务端按连接身份推导 —— 本通道的服务端事实是
    // (user-session, ws-broadcast),?role= 自报降级为「可选收窄」:
    // 封闭集内且 ⊆ ceiling 才生效;非法值/想放宽 ⇒ 回落 ceiling + warn(不断连)。
    const resolvedRole = resolveBroadcastRole({
      channel: 'ws-broadcast',
      principal: 'user-session',
      declared: query.role,
    })
    if (resolvedRole.rejected !== undefined) {
      server.log.warn(
        { userId, requested: resolvedRole.rejected, applied: resolvedRole.role },
        'ws-broadcast 自报订阅角色未生效(非法或与服务端上限矛盾),以服务端推导为准',
      )
    }
    const role = resolvedRole.role
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
