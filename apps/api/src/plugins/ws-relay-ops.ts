// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运营面板 WS 实时推送插件(2026-09-18,#58 运营面板 WS 实时化)。
 *
 * 端点: GET /ws/relay/ops?token=<access_token 或 ws_token>
 *
 * 仅系统管理员可连接(roleId >= ADMIN_ROLE_ID;WS token 走 claims.roleId,
 * access token 走 payload.roleId,两者均校验)。
 *
 * 推送协议:
 *   服务端 → 客户端: { event: 'relay-ops-snapshot', data: RelayOpsSnapshot }
 *     - 连接建立后立即推一帧,之后每 PUSH_INTERVAL_MS 推一帧
 *   客户端 → 服务端:
 *     - { type: 'refresh' } → 立即推一帧(替代 REST 手动刷新)
 *     - 'ping'(字符串)→ 回 'pong'(对齐 create-websocket-hook 心跳)
 *
 * 数据形状契约见 services/relay-ops-snapshot.ts(与 REST 响应逐字段一致,
 * 前端收到后直接 setQueryData 热替换 react-query 缓存)。
 */
import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import { verifyAccessToken, verifyWsToken } from '@ihui/auth'
import { wsAuth, WS_CLOSE, WsUserConnectionLimiter } from './ws-helpers.js'
import { buildRelayOpsSnapshot, type RelayOpsSnapshot } from '../services/relay-ops-snapshot.js'

/** 系统管理员角色判定阈值(与 require-permission.ts ADMIN_ROLE_ID 同源语义) */
const ADMIN_ROLE_ID = 1
/** 快照推送间隔:15s(告警评估 5min/渠道轮询 30s 的体验增强,频率低于 DB 压力担忧线) */
const PUSH_INTERVAL_MS = 15_000

/** 管理员校验:ws token 走 claims.roleId,access token 走 payload.roleId */
export async function isAdminToken(token: string): Promise<boolean> {
  const wsPayload = await verifyWsToken(token)
  if (wsPayload) {
    const roleId = (wsPayload.claims as { roleId?: unknown }).roleId
    return typeof roleId === 'number' && roleId >= ADMIN_ROLE_ID
  }
  try {
    const payload = await verifyAccessToken(token)
    const roleId = (payload as unknown as { roleId?: unknown }).roleId
    return typeof roleId === 'number' && roleId >= ADMIN_ROLE_ID
  } catch {
    return false
  }
}

const wsRelayOpsPlugin: FastifyPluginAsync = async (server) => {
  // 单管理员连接数限制 2(防多标签页刷连接;后台页通常 1-2 个)
  const limiter = new WsUserConnectionLimiter(2)
  const sockets = new Set<WebSocket>()

  function pushSnapshot(ws: WebSocket): void {
    void buildRelayOpsSnapshot()
      .then((snapshot: RelayOpsSnapshot) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ event: 'relay-ops-snapshot', data: snapshot }))
        }
      })
      .catch(() => {
        /* 快照组装失败静默跳过本帧,下一周期重试 */
      })
  }

  server.get('/ws/relay/ops', { websocket: true }, async (socket, request) => {
    const token = (request.query as { token?: string }).token
    const userId = await wsAuth(socket, token)
    if (!userId) return

    // 管理员门槛(非 admin 一律拒绝,防越权读取运营数据)
    if (!token || !(await isAdminToken(token))) {
      socket.close(WS_CLOSE.INVALID_TOKEN, '需要管理员权限')
      return
    }

    if (!limiter.acquire(userId)) {
      server.log.warn({ userId }, 'ws-relay-ops 拒绝连接:单用户连接数超限')
      socket.close(WS_CLOSE.TOO_MANY_CONNECTIONS, '单用户连接数超限')
      return
    }
    sockets.add(socket)

    // 连接即推首帧,随后周期推送
    pushSnapshot(socket)
    const timer = setInterval(() => pushSnapshot(socket), PUSH_INTERVAL_MS)

    socket.on('message', (raw: Buffer) => {
      const text = raw.toString()
      if (text === 'ping') {
        try {
          socket.send('pong')
        } catch {
          /* 忽略 */
        }
        return
      }
      try {
        const parsed = JSON.parse(text) as { type?: unknown }
        if (parsed?.type === 'refresh') pushSnapshot(socket)
      } catch {
        /* 非 JSON 消息忽略 */
      }
    })

    socket.on('close', () => {
      clearInterval(timer)
      sockets.delete(socket)
      limiter.release(userId)
    })
    socket.on('error', () => {
      clearInterval(timer)
      sockets.delete(socket)
      limiter.release(userId)
    })
  })

  // 优雅关闭:清空全部连接(对齐 ws-broadcast 的停机语义)
  server.addHook('onClose', async () => {
    for (const ws of sockets) {
      try {
        ws.close()
      } catch {
        /* 忽略 */
      }
    }
    sockets.clear()
  })
}

export const wsRelayOps = fp(wsRelayOpsPlugin, {
  name: 'ws-relay-ops',
  fastify: '5.x',
})
