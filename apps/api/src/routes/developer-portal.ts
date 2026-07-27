/**
 * 开发者门户公开路由(AGENTS.md §24 P0-4a/b 配套)。
 *
 * 路径前缀:/api
 *
 * 端点:
 * - GET /api/developer/info  公开,返回开发者门户元信息(API host/文档/定价/限流/SDK)
 *
 * 配套前端:apps/web/app/(main)/developers/page.tsx
 */
import type { FastifyPluginAsync } from 'fastify'
import { env } from 'node:process'
import { success } from '../utils/response.js'

export const developerPortalRoutes: FastifyPluginAsync = async (server) => {
  server.get('/developer/info', async (_request, reply) => {
    const corsOrigin = env.CORS_ORIGIN ?? 'http://localhost:8801'
    const apiHost = corsOrigin.split(',')[0]?.trim() || 'http://localhost:8801'
    return reply.send(
      success({
        name: 'IHUI AI Open Platform',
        version: '1.0.0',
        apiBase: `${apiHost}/api`,
        docsUrl: `${apiHost}/docs`,
        pricingUrl: `${apiHost}/pricing`,
        modelsPricingUrl: `${apiHost}/models-pricing`,
        developersUrl: `${apiHost}/developers`,
        // 限流策略(开发者必须知道)
        rateLimits: {
          free: { qps: 5, dailyTokens: 10_000, concurrency: 2 },
          individual: { qps: 20, dailyTokens: 500_000, concurrency: 10 },
          team: { qps: 60, dailyTokens: 2_000_000, concurrency: 50 },
          enterprise: { qps: 200, dailyTokens: 10_000_000, concurrency: 200 },
        },
        // 支持的支付方式
        payments: ['wechat_pay', 'alipay', 'stripe'],
        // 支持的模型厂商(可调用)
        providers: [
          'OpenAI',
          'Anthropic',
          'Google Gemini',
          'DeepSeek',
          'Alibaba Qwen',
          'ByteDance Doubao',
          'Moonshot Kimi',
          'Zhipu GLM',
          'MiniMax',
        ],
        // SDK 计划(后续 P1-1 交付)
        sdks: [
          { language: 'TypeScript', status: 'planned', npm: '@ihui/sdk' },
          { language: 'Python', status: 'planned', pypi: 'ihui-sdk' },
        ],
        // 鉴权方式
        auth: {
          type: 'Bearer',
          header: 'Authorization',
          apiKeyUrl: `${apiHost}/settings/api-keys`,
        },
      }),
    )
  })
}
