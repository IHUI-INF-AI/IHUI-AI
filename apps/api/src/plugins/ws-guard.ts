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
 * 从原始升级请求里提取客户端 IP。
 *
 * 这里返回的是**限流键**，不是"仅供参考的近似值"：它直接决定 wsHandshakeGate 的
 * 握手频率桶与 liveByIp 的并发计数，也就是安全边界本身。键一旦能被客户端自由指定，
 * 单 IP 的 30 次/秒握手上限与 200 条并发上限就等于不存在（攻击者每个请求换一个假 IP，
 * 每个假 IP 只记 1 条）。
 *
 * 因此这里只信边缘层验证过的结论，绝不信客户端自带的头：
 *  1. cf-connecting-ip —— 本项目生产边缘是腾讯云 EdgeOne，不是 Cloudflare，EdgeOne 永远
 *     不会写这个头，所以链路上出现的该值 100% 来自客户端伪造，直接不看。
 *  2. x-forwarded-for 最左跳 —— 最左值就是客户端自己整段写进去的，逐跳追加只是理论约定；
 *     攻击者每次换一个假 IP 即可把并发与握手两个上限同时打穿。
 *
 * 可信来源是 router（deploy/win/ihui-api-router.mjs）：回源鉴权通过时注入
 * x-ihui-edge-verified: 1 + x-ihui-client-ip: <真实客户端 IP>，未通过时用 TCP 对端地址
 * 重写 x-ihui-client-ip。因为 API 只监听 127.0.0.1、外部客户端无法直连，只有本机 router
 * 能建立连接，所以这两个头不会被绕过 router 的第三方伪造。
 *
 * 没有边缘层结论（例如本机直连、测试环境）⇒ 回落到不可伪造的 TCP 对端地址。
 */
export function wsClientIp(req: IncomingMessage): string {
  const h = req.headers
  // 只认边缘层（router）验证后注入的结论。
  // 为什么不再看 cf-connecting-ip / x-forwarded-for：见函数上方注释。
  const verified = h['x-ihui-edge-verified']
  const edgeIp = h['x-ihui-client-ip']
  if (verified === '1' && typeof edgeIp === 'string' && edgeIp.trim()) {
    return edgeIp.trim()
  }
  // 没有边缘层结论 ⇒ 用不可伪造的 TCP 对端。
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
