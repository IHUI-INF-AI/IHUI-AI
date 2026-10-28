// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { IncomingMessage } from 'node:http'
import type { WebSocket, WebSocketServer } from 'ws'

/**
 * WebSocket 守卫（对应安全审计 P0：WebSocket 此前完全未计量）。
 *
 * 解决三件事：
 *  1. 握手频率限制（wsHandshakeGate）：单 IP 每秒握手次数上限，挡掉握手洪水
 *     （nginx 的 /socket.io 段此前也没挂 limit_req，应用层同样缺失，故两端都受益）。
 *  2. 单 IP 并发连接上限：超阈值的新连接在握手成功后立即 terminate，
 *     防止单个出口 IP 开成千上万条长连接打满文件描述符。
 *  3. 心跳保活：标准 ws ping/pong 健康探测，超时（未回 pong）的连接直接 terminate，
 *     清掉半死连接，回收 FD。
 *
 * 这些计数都是**进程内存级**（单实例视角）。多实例部署时每台各自独立计数，
 * 单实例被单 IP 打满的风险被消除；跨实例的全局上限仍由架构层（如 CF / LB）兜底。
 */

const MAX_CONN_PER_IP = Number(process.env.WS_MAX_CONN_PER_IP ?? 200)
const HANDSHAKE_WINDOW_MS = 1000
const MAX_HANDSHAKE_PER_SEC = Number(process.env.WS_HANDSHAKE_PER_IP_PER_SEC ?? 30)
const HEARTBEAT_MS = 30_000

type WsSocket = WebSocket & { isAlive?: boolean; _ihuiWsIp?: string }

/** 单 IP 当前活跃 WS 连接数（在 connection 事件中维护）。 */
const liveByIp = new Map<string, number>()
/** 单 IP 最近握手时间戳（1s 滚动窗口，用于握手频率限制）。 */
const handshakeTs = new Map<string, number[]>()
/** 握手表的键数上限：超出后先清过期项，仍超出则按插入顺序淘汰最旧。 */
const MAX_TRACKED_IPS = 10_000

/**
 * 清掉握手窗口外的 IP。
 * 只在同 IP 再次握手时过滤数组是不够的 —— 攻击者「每个 IP 只打一发」的话，
 * 数组永不复发、键永久留在 Map 里，换 IP 就能把内存撑爆。
 */
function pruneHandshakeTable(now: number): void {
  for (const [ip, arr] of handshakeTs) {
    const last = arr[arr.length - 1]
    if (last === undefined || now - last >= HANDSHAKE_WINDOW_MS) handshakeTs.delete(ip)
  }
  // 过期项清完仍超限（1s 内真有上万个 IP 在握手）⇒ 淘汰最旧，内存有硬顶。
  if (handshakeTs.size <= MAX_TRACKED_IPS) return
  for (const ip of handshakeTs.keys()) {
    handshakeTs.delete(ip)
    if (handshakeTs.size <= MAX_TRACKED_IPS) break
  }
}

/**
 * 从原始升级请求里尽力提取客户端 IP。
 * 部署上 WS 前置 CF Tunnel / nginx：优先取 CF-Connecting-IP，其次 X-Forwarded-For 最左跳，
 * 都没有才回退到 socket 远端地址。这是防御纵深用的近似 IP，不用于鉴权。
 */
export function wsClientIp(req: IncomingMessage): string {
  const h = req.headers
  const cf = h['cf-connecting-ip']
  if (typeof cf === 'string' && cf) return cf.trim()
  const xff = h['x-forwarded-for']
  if (typeof xff === 'string' && xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.socket.remoteAddress ?? 'unknown'
}

/**
 * 握手闸门：在 verifyClient 阶段调用，拒绝握手洪水或单 IP 已超并发的连接。
 * 返回 ok:false 时给出建议的拒绝码与原因。
 */
export function wsHandshakeGate(ip: string): { ok: boolean; code?: number; reason?: string } {
  const now = Date.now()
  const arr = (handshakeTs.get(ip) ?? []).filter((t) => now - t < HANDSHAKE_WINDOW_MS)
  arr.push(now)
  handshakeTs.set(ip, arr)

  if (arr.length > MAX_HANDSHAKE_PER_SEC) {
    return { ok: false, code: 429, reason: 'WebSocket handshake rate limit exceeded' }
  }
  if ((liveByIp.get(ip) ?? 0) >= MAX_CONN_PER_IP) {
    return { ok: false, code: 429, reason: 'too many WebSocket connections for this IP' }
  }
  if (handshakeTs.size > MAX_TRACKED_IPS) pruneHandshakeTable(now)
  return { ok: true }
}

const wsGuardPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const wss = (server as unknown as { websocketServer?: WebSocketServer }).websocketServer
  if (!wss) {
    server.log.warn('ws-guard: websocketServer 不可用,跳过 WebSocket 防护挂载')
    return
  }

  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    const ip = wsClientIp(req)
    const sock = socket as WsSocket
    const cur = (liveByIp.get(ip) ?? 0) + 1
    if (cur > MAX_CONN_PER_IP) {
      // 硬上限：握手已成功，但单 IP 已超额 → 立即断开，避免连接数被慢慢堆起来。
      try {
        sock.terminate()
      } catch {
        /* 断开失败不影响主流程 */
      }
      return
    }
    liveByIp.set(ip, cur)
    sock._ihuiWsIp = ip
    sock.isAlive = true
    sock.on('pong', () => {
      sock.isAlive = true
    })
    sock.on('close', () => {
      const n = (liveByIp.get(ip) ?? 0) - 1
      if (n <= 0) liveByIp.delete(ip)
      else liveByIp.set(ip, n)
      sock._ihuiWsIp = undefined
    })
  })

  // 心跳：每 30s 对所有连接发 ping；未在窗口内回 pong 的视为半死，直接 terminate。
  const interval = setInterval(() => {
    // 低频兜底清理：没有新握手时，过期的 IP 条目也要能被回收。
    pruneHandshakeTable(Date.now())
    for (const ws of wss.clients) {
      const sock = ws as WsSocket
      if (sock.isAlive === false) {
        try {
          sock.terminate()
        } catch {
          /* ignore */
        }
        continue
      }
      sock.isAlive = false
      try {
        sock.ping()
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_MS)

  server.addHook('onClose', () => {
    clearInterval(interval)
  })
}

export const wsGuard = fp(wsGuardPlugin, {
  name: 'ws-guard',
  fastify: '5.x',
})

export const __test__ = {
  wsClientIp,
  wsHandshakeGate,
  pruneHandshakeTable,
  resetGuardState: () => {
    liveByIp.clear()
    handshakeTs.clear()
  },
  handshakeTableSize: () => handshakeTs.size,
  /** 直接注入单 IP 活跃连接数，供测试验证并发上限（生产路径只由 connection/close 维护）。 */
  setLiveConnections: (ip: string, n: number) => {
    if (n <= 0) liveByIp.delete(ip)
    else liveByIp.set(ip, n)
  },
  MAX_CONN_PER_IP,
  MAX_HANDSHAKE_PER_SEC,
  MAX_TRACKED_IPS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
