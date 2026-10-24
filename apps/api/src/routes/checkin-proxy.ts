// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到助手网关代理(2026-10-23 立)。
 *
 * `/api/checkin/*` 的真实实现在 ai-service(8803);Web 由 next rewrite 直连,
 * 但移动端(RN / 小程序)与桌面端只认主 API 基址 —— 此前这些端的签到请求会打到
 * 8802 得到 Fastify 404(见 packages/api-client client.ts 的 aiServiceBaseOverride 注释)。
 * 本代理把同一组路径透传到 AI_SERVICE_URL,让所有端共用一套账号数据(互通)。
 *
 * 只代理这一个前缀;Authorization 原样透传(ai-service 的 JWTAuthMiddleware 验签),
 * 不注入任何身份 —— 网关不成为鉴权旁路。
 *
 * L7066(G-396 拍板,2026-10-23):转发前先在本层验用户会话(checkAuth)。会话在本层
 * 已证实有效,下游仍回 401 ⇒ 那是"服务侧凭据被 ai-service 拒收",不是用户登录态失效,
 * 映射为 502 + UPSTREAM_AUTH_FAILED 出栈,不再伪装 401 触发端内强制登出。
 * 真会话过期的 401 由本层 checkAuth 直接发出(在转发之前),refresh→登出链语义不变。
 */
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { config } from '../config/index.js'
import { error } from '../utils/response.js'
import { checkAuth } from '../plugins/auth.js'
import { mapNonSessionUpstreamStatus, upstreamAuthFailedBody } from '../utils/upstream-auth.js'

const PROXY_TIMEOUT_MS = 60_000
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

const checkinProxyRoutes: FastifyPluginAsync = async (server) => {
  server.route({
    method: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    url: '/api/checkin/*',
    handler: async (request, reply) => {
      // L7066:会话在本层先证实;此后下游 401 一律属"服务侧凭据"问题(见文件头)。
      if (!(await checkAuth(request, reply))) return
      const base = config.AI_SERVICE_URL.replace(/\/+$/, '')
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(request.headers)) {
        if (HOP_BY_HOP.has(k.toLowerCase())) continue
        if (typeof v === 'string') headers[k] = v
        else if (Array.isArray(v)) headers[k] = v.join(', ')
      }
      const hasBody = request.body !== undefined && request.body !== null
      headers['content-type'] = 'application/json'
      try {
        const resp = await fetch(`${base}${request.url}`, {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
          signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
        })
        const buf = Buffer.from(await resp.arrayBuffer())
        const outbound = mapNonSessionUpstreamStatus(resp.status)
        if (outbound !== resp.status) {
          // 下游 401 被映射(会话已在本层验过)⇒ 不透传下游体,换独立 errorCode 的 502。
          request.log.warn(
            { upstreamStatus: resp.status, url: request.url },
            '[checkin-proxy] 非会话场景下游 401,已映射 502/UPSTREAM_AUTH_FAILED',
          )
          return reply.status(outbound).send(upstreamAuthFailedBody())
        }
        reply.status(resp.status)
        const contentType = resp.headers.get('content-type')
        if (contentType) reply.header('content-type', contentType)
        return reply.send(buf)
      } catch (e) {
        request.log.error(e, '[checkin-proxy] 转发 ai-service 失败')
        return reply.status(502).send(error(502, '签到服务暂不可用'))
      }
    },
  })
}

export default fp(checkinProxyRoutes, { name: 'checkin-proxy' })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
