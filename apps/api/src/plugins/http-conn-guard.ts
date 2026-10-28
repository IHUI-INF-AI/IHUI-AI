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
 * 关键：本插件只**收紧**异常并发，默认值宽（100/IP），远低于正常浏览器并发上限，
 * 不触碰既有速率/配额逻辑，因此不会劣化任何合法请求。
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
    const isUpgrade = Boolean(request.headers.upgrade)
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
    // WebSocket 升级成功后原始 socket 被 hijack,101 之后没有 finish ⇒ onResponse 不会来。
    // 这里照样计入握手时的瞬时并发(升级请求也占 FD),但必须自己挂 close 释放,
    // 否则这些长连接会把该 IP 的并发槽永久占满(计数只泄漏、不回收)。
    if (isUpgrade) {
      reply.raw.once('close', () => releaseSlot(ip, request.id))
    }
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
  reset: () => activeByIp.clear(),
  activeIpCount: () => activeByIp.size,
  MAX_CONN_PER_IP,
  HEALTH_PATHS,
  HEALTH_UA_KEYWORDS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
