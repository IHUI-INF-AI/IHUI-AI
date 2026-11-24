// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接器用户 OAuth 回调代理（2026-11-24 立）。
 *
 * 平台授权服务器把浏览器跳回平台已白名单的 `/callback?platform=feishu` 后，
 * Web 回调页识别出连接器 state（base64url payload + HMAC sig），把 code/state
 * 透传到本端点；本代理只做一件事：把同一组 query 原样转发到 ai-service 的
 * `/api/connectors/oauth/callback`，由那边校验 HMAC state、换 token、加密落库。
 *
 * 为什么不直接把 redirect_uri 指向 ai-service：
 *  生产 Cloudflare 把 /api/* 直送 8802，Next rewrites 对公网流量不生效；
 *  connectors:read/write 又在 NEVER_PUBLIC_SCOPES 里。本端点挂在已免登录的
 *  `/api/callback/` 前缀下，是唯一一条受控回调通道 —— 精确路径，不放大连接器面。
 *
 * 身份：不注入、不伪造。ai-service 侧的身份完全来自 state 的 HMAC 签名，
 * 本代理只透传白名单 query（code/state/error*），不转发任何请求头 —— 尤其
 * 不把浏览器的 Authorization 带过去，避免网关成为鉴权旁路的载体。
 */
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { config } from '../config/index.js'
import { error } from '../utils/response.js'

const PROXY_TIMEOUT_MS = 30_000
const FORWARDED_PARAMS = ['code', 'state', 'error', 'error_description'] as const

export const connectorOAuthCallbackProxyRoutes: FastifyPluginAsync = async (server) => {
  server.route({
    method: 'GET',
    url: '/api/callback/connectors/oauth',
    handler: async (request, reply) => {
      const query = (request.query ?? {}) as Record<string, unknown>
      const params = new URLSearchParams()
      for (const key of FORWARDED_PARAMS) {
        const value = query[key]
        if (typeof value === 'string' && value) params.set(key, value)
      }
      if (!params.has('code') && !params.has('error')) {
        return reply.status(400).send(error(400, '缺少 code 或 error'))
      }
      const base = config.AI_SERVICE_URL.replace(/\/+$/, '')
      const target = `${base}/api/connectors/oauth/callback?${params.toString()}`
      try {
        const resp = await fetch(target, {
          method: 'GET',
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
        })
        const buf = Buffer.from(await resp.arrayBuffer())
        reply.status(resp.status)
        const contentType = resp.headers.get('content-type')
        if (contentType) reply.header('content-type', contentType)
        return reply.send(buf)
      } catch (e) {
        request.log.error(e, '[connector-oauth-callback-proxy] 转发 ai-service 失败')
        return reply.status(502).send(error(502, '授权服务暂不可用'))
      }
    },
  })
}

export default fp(connectorOAuthCallbackProxyRoutes, { name: 'connector-oauth-callback-proxy' })
