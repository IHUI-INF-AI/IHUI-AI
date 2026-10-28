// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

/**
 * HTTP 单 IP 并发连接守卫（对应安全审计 P1：应用层此前缺连接/FD 上限）。
 *
 * 解决「慢速连接耗尽」类 DDoS：攻击者可开大量**慢速**连接（每个请求 < 1/min，
 * 因此基于时间窗口的速率限制根本触发不了），慢慢把文件描述符/事件循环占满。
 * 本插件在 preHandler 阶段统计单 IP 的**活跃并发请求数**，超过阈值即 429 拒绝，
 * 与 requestTimeout（慢速请求体接收）形成互补的两道闸。
 *
 * 计数口径含**长连接存续期**：SSE 与 WebSocket 升级都走 reply.hijack()，槽一直占到该
 * 连接关闭为止（归还见 attachSlotReleaseOnClose）。默认值仍按"单 IP 活跃连接数"取宽
 * （100/IP）：正常浏览器同域并发 HTTP/1.1 只有 6、HTTP/2 复用单连接，聊天页的 SSE 也远少于此，
 * 因此不会劣化合法用户；被收紧的是"一个 IP 开成千上万条慢连接"这一型。
 * 阈值是上界保护值、不是从生产流量分布量出来的（本机无该维度历史序列）——
 * 真要按分位数收口，得先有连接数直方图，别把拍的数当量出来的数。
 *
 * 监控探活（kube-probe/prometheus 等）与健康路径豁免，避免误伤自身监控。
 * 部署无关：无论 Linux/docker 还是 Windows+CF Tunnel，应用层都统一生效，
 * 拉平两端在连接耗尽防护上的厚度。
 */

const MAX_CONN_PER_IP = Number(process.env.IHUI_HTTP_CONN_PER_IP ?? 100)
const HEALTH_PATHS = ['/health', '/metrics', '/ready', '/api/health', '/api/metrics']
const HEALTH_UA_KEYWORDS = [
  'kube-probe',
  'elb-healthchecker',
  'prometheus',
  'uptime',
  'health-check',
  'gthealthcheck',
]

/**
 * 全局活跃连接硬顶的取值 —— 抽成纯函数是为了让「0 = 关闭」这一档能被测试钉住：
 * 写成 `Number(env) || DEFAULT` 的话，运维明确设 0 想关掉这道闸，会被静默换成默认值，
 * 而这正是本仓记过最多次的失效型(配置读不出真实意图)。
 *
 * 默认值算式(本机现读物理内存 31.8GB)：Node 每条连接约 10–50KB socket 缓冲，
 * 20000 条 ≈ 1GB，给同机的 web / ai-service / PG / Redis 留足余量；而单实例正常并发
 * 远低于此(Cloudflare Tunnel 前置，单浏览器同域 HTTP/1.1 并发只有 6、HTTP/2 复用单连接)。
 * 它是「FD/内存耗尽的最后兜底」而不是限流：超出时 Node 直接拒收新 TCP 连接，
 * 用户看到的是连接失败而不是 429，所以宁可取宽，不能拧成误伤真实用户。
 *
 * env IHUI_HTTP_MAX_CONNECTIONS：0 = 明确关闭(交上层 LB/CF 兜)；非数字/负数 = 回落默认。
 */
export function resolveMaxConnections(raw: string | undefined, fallback = 20000): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

/** 单 IP → 当前活跃请求 id 集合（用 Set 精确增删，避免漏减）。 */
const activeByIp = new Map<string, Set<string>>()

/** 占用一个并发槽；已达上限返回 false（调用方回 429）。 */
export function tryAcquireSlot(
  ip: string,
  requestId: string,
  max: number = MAX_CONN_PER_IP,
): boolean {
  let set = activeByIp.get(ip)
  if (!set) {
    set = new Set<string>()
    activeByIp.set(ip, set)
  }
  if (set.size >= max) return false
  set.add(requestId)
  return true
}

/**
 * 把并发槽的归还**额外**绑到这条响应的 socket 关闭上。
 *
 * 为什么必须有它:onResponse 覆盖不到 hijack 的流式出口(SSE / WS 升级 —— 全仓 14 处
 * reply.hijack()),而 onRequestAbort 由 req.aborted 门控、SSE 的请求体在进 handler 之前
 * 就已被 Fastify 收完 ⇒ aborted 恒 false,那条钩子也不来。两个归还通道同时失效，
 * 槽就永久占着：同一 IP 攒够 100 条流式连接后会被自己的守卫打成 429(守卫变成自我 DoS)。
 *
 * 信号源刻意用 reply.raw 而不是 request.raw：与本仓 O64(2026-10-22)同一结论 ——
 * Node≥16 下 IncomingMessage 的 'close' 在请求体收全即触发、真断连不再二次触发，
 * 挂在 req 侧等于没挂。reply.raw 的 'close' 才是"响应结束或连接提前关闭"。
 * 与 onResponse 双通道并存无碍：releaseSlot 按请求 id 从集合摘除，天然幂等。
 */
export function attachSlotReleaseOnClose(
  reply: { raw: { once(event: 'close', listener: () => void): unknown } },
  ip: string,
  requestId: string,
): void {
  reply.raw.once('close', () => {
    releaseSlot(ip, requestId)
  })
}
/** 释放并发槽；集合空时删键，避免 Map 随 IP 数无限增长。 */
export function releaseSlot(ip: string, requestId: string): void {
  const set = activeByIp.get(ip)
  if (!set) return
  set.delete(requestId)
  if (set.size === 0) activeByIp.delete(ip)
}

const httpConnGuardPlugin: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip
    if (!ip) return

    const url = (request.url.split('?')[0] ?? '').toLowerCase()
    const ua = (request.headers['user-agent'] ?? '').toLowerCase()
    if (HEALTH_PATHS.some((p) => url.startsWith(p))) return
    if (HEALTH_UA_KEYWORDS.some((k) => ua.includes(k))) return

    if (!tryAcquireSlot(ip, request.id)) {
      reply
        .code(429)
        .header('Retry-After', '1')
        .send({ code: 429, message: '单 IP 并发连接数超限' })
      return
    }
    // 每一个占槽的请求都绑 close，不按头/路由分叉：hijack 的流式出口(SSE、WS 升级)
    // 既不走 onResponse，也不走 onRequestAbort，只有这条能兜住(见函数头注)。
    attachSlotReleaseOnClose(reply, ip, request.id)
  })

  const release = (request: FastifyRequest) => {
    const ip = request.ip
    if (!ip) return
    releaseSlot(ip, request.id)
  }

  // 正常响应、客户端中止、超时都要释放计数，避免漏减导致阈值被永久占满。
  server.addHook('onResponse', release)
  server.addHook('onRequestAbort', release)
  server.addHook('onClose', () => {
    activeByIp.clear()
  })
}

export const httpConnGuard = fp(httpConnGuardPlugin, {
  name: 'http-conn-guard',
  fastify: '5.x',
})

export const __test__ = {
  tryAcquireSlot,
  releaseSlot,
  attachSlotReleaseOnClose,
  resolveMaxConnections,
  reset: () => activeByIp.clear(),
  activeIpCount: () => activeByIp.size,
  MAX_CONN_PER_IP,
  HEALTH_PATHS,
  HEALTH_UA_KEYWORDS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
