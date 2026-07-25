import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

/**
 * 历史项目缺失端点补齐 — 企业微信模块(D19)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D19: 企业微信 token(/work-wechat/token,历史 /work-we-chat/token)
 */
export const legacyWorkWechatRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ========== D19: 企业微信 token (历史 /work-we-chat/token) ==========
  fastify.get('/work-wechat/token', async (request) => {
    // 跳过响应脱敏,否则 accessToken 会被 response-sanitizer 误伤为 '***'
    request.skipResponseSanitization = true
    const { corpId, agentId, secret } = z
      .object({
        corpId: z.string(),
        agentId: z.string().optional(),
        secret: z.string(),
      })
      .parse(request.query)
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`
    const res = await fetch(url)
    const data = (await res.json()) as { access_token?: string; errcode?: number; errmsg?: string }
    return {
      accessToken: data.access_token ?? null,
      agentId,
      errcode: data.errcode ?? 0,
      errmsg: data.errmsg ?? null,
    }
  })
}
