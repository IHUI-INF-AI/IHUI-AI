import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'

/**
 * OAuth 私钥管理路由
 * 端点: /generate, /rotate, /revoke, /list, /active
 */
export const oauthKeysRoutes: FastifyPluginAsync = async (server) => {
  // 所有端点需要认证
  server.addHook('preHandler', authenticate)

  // POST /generate - 生成新的 OAuth 私钥对
  server.post('/generate', async (request, reply) => {
    z.object({
      provider: z.string().min(1),
      scopes: z.array(z.string()).optional().default([]),
    }).parse(request.body)

    // 501 Not Implemented - 桩端点,实装需用户确认(AGENTS.md §24)
    return reply.code(501).send({
      code: 501,
      message: '未实装:oauth-keys /generate 尚未实装',
      data: null,
    })
  })

  // POST /rotate - 轮转私钥(生成新密钥,旧密钥标记为非活跃)
  server.post('/rotate', async (request, reply) => {
    z.object({ keyId: z.string().min(1) }).parse(request.body)

    // 501 Not Implemented - 桩端点,实装需用户确认(AGENTS.md §24)
    return reply.code(501).send({
      code: 501,
      message: '未实装:oauth-keys /rotate 尚未实装',
      data: null,
    })
  })

  // POST /revoke - 吊销私钥
  server.post('/revoke', async (request, reply) => {
    z.object({ keyId: z.string().min(1) }).parse(request.body)

    // 501 Not Implemented - 桩端点,实装需用户确认(AGENTS.md §24)
    return reply.code(501).send({
      code: 501,
      message: '未实装:oauth-keys /revoke 尚未实装',
      data: null,
    })
  })

  // GET /list - 列出所有私钥
  server.get('/list', async (_request, reply) => {
    // 501 Not Implemented - 桩端点,实装需用户确认(AGENTS.md §24)
    return reply.code(501).send({
      code: 501,
      message: '未实装:oauth-keys /list 尚未实装',
      data: null,
    })
  })

  // GET /active - 查询当前活跃的私钥
  server.get('/active', async (request, reply) => {
    z.object({
      provider: z.string().optional(),
    }).parse(request.query)

    // 501 Not Implemented - 桩端点,实装需用户确认(AGENTS.md §24)
    return reply.code(501).send({
      code: 501,
      message: '未实装:oauth-keys /active 尚未实装',
      data: null,
    })
  })
}
