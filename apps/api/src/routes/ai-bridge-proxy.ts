// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { authenticate } from '../plugins/auth.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { mapNonSessionUpstreamStatus, upstreamAuthFailedBody } from '../utils/upstream-auth.js'
import { error } from '../utils/response.js'

/**
 * ai-service 桥接代理(2026-11-23 立,移动两端接线审计的根治件)
 *
 * 病根:这三个前缀的真实实现只住在 ai-service(8803):
 *   - `/api/prompts*`   ← app/routers/prompts.py(挂在 prefix="/api")
 *   - `/api/connectors*` ← app/routers/connectors.py(prefix="/connectors")
 *   - `/api/research*`   ← app/routers/research.py(prefix="/research")
 * Web 端靠 `apps/web/next.config.ts` 的 rewrites 直连 8803 所以一直没响;而移动端
 * (`fetchApi` 只认主 API 基址)在开发态打 8802 就是 Fastify 404。当次实测读数:
 *   GET /api/prompts、GET /api/connectors、GET /api/research/{id} 在 8802 一律
 *   `Route GET:... not found`;同一组路径在 8803 一律 401(= 在册,只是要票)。
 * 受影响屏:RN ModelsPrompts / Connectors / DeepResearch(均已在 RootNavigator 注册)。
 *
 * 这不是新造机制,是同型缺口的补齐:checkin-proxy(2026-10-23,L7066 拍板)与
 * ai-skills-proxy(2026-08-26,M3)当年各修了自己那条前缀,本文把剩下的补齐。
 *
 * 三条纪律(全部复用既有单源出口,本文件零新机制):
 * 1. **鉴权前置** `plugins/auth.js::authenticate`(AGENTS §5:不在本端自拼 JWT)。
 *    ⇒ 本层没有游客通道:射程是显式列举的三条前缀 × 五个方法,不写兜底正则
 *    (AGENTS §5「鉴权面公开化必须显式列举」——新增前缀必须改本文件,不许加通配域)。
 * 2. **出站经 `utils/ai-service-fetch.js`** —— 用户 Authorization 透传、开发者 key
 *    换系统票、traceparent 注入、60s deadline 都住在那一侧,本层不再手拼 fetch。
 *    本层也不注入任何身份,网关不成鉴权旁路。
 * 3. **上游 401 ≠ 用户登录失效**(L7066 / utils/upstream-auth.js):会话已在本层证实,
 *    下游再回 401 只可能是服务侧凭据被拒 ⇒ 映射 502 + UPSTREAM_AUTH_FAILED。若原样
 *    透传 401,`packages/api-client` 的 401→refresh→notifyUnauthorized 链会把用户
 *    误判成"登录过期"踢回登录页(小程序那条闸口踩过同样的坑)。
 */

/** 转发射程见文件末尾六条字面量注册;新增前缀必须在那里逐条登记(不写兜底通配域) */
const BRIDGE_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

/** 上游路径与原请求逐字相同(三个 router 都挂在 `/api` 前缀下,无需改写) */
function labelOf(url: string): string {
  if (url.startsWith('/api/prompts')) return 'Prompt'
  if (url.startsWith('/api/connectors')) return '连接器'
  return '深度研究'
}

async function bridge(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const hasBody = request.body !== undefined && request.body !== null
  try {
    const resp = await aiServiceFetch(request, request.url, {
      method: request.method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(request.body) : undefined,
    })
    const outStatus = mapNonSessionUpstreamStatus(resp.status)
    if (outStatus !== resp.status) {
      request.log.warn(
        { upstream: resp.status, path: request.url },
        'ai-bridge: 本层已验过会话,上游仍回 401 ⇒ 映射 502 不回传登出信号',
      )
      return reply.status(502).send(upstreamAuthFailedBody())
    }
    const text = await resp.text()
    return reply
      .status(outStatus)
      .header('content-type', resp.headers.get('content-type') ?? 'application/json; charset=utf-8')
      .send(text)
  } catch (err) {
    const timeout =
      (err as Error & { code?: string }).code === 'AI_SERVICE_TIMEOUT' ||
      (err instanceof Error && err.name === 'AiServiceTimeoutError')
    request.log.warn(
      { path: request.url, timeout, err: (err as Error)?.message },
      'ai-bridge 转发失败',
    )
    return reply.status(502).send(error(502, `${labelOf(request.url)}服务暂不可用`))
  }
}

export const aiBridgeProxyRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
    }
  })

  // **url 一律逐字写死**:scan-api-routes 靠静态读字面量建挂载图,写成 `${prefix}/*`
  // 循环拼接会被它记成脏条目 `/:prefix/*`(2026-11-23 实测),于是这批腿在 check-api-routes /
  // openapi-check 那两把尺子面前等于不存在 —— 修复装了但判据读不到(AGENTS §0.9)。
  server.route({ method: [...BRIDGE_METHODS], url: '/api/prompts', handler: bridge })
  server.route({ method: [...BRIDGE_METHODS], url: '/api/prompts/*', handler: bridge })
  server.route({ method: [...BRIDGE_METHODS], url: '/api/connectors', handler: bridge })
  server.route({ method: [...BRIDGE_METHODS], url: '/api/connectors/*', handler: bridge })
  server.route({ method: [...BRIDGE_METHODS], url: '/api/research', handler: bridge })
  server.route({ method: [...BRIDGE_METHODS], url: '/api/research/*', handler: bridge })
}

export default fp(aiBridgeProxyRoutes, { name: 'ai-bridge-proxy' })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
