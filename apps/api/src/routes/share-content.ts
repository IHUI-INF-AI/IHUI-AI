import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { success, error } from '../utils/response.js'
import { dbRead } from '../db/index.js'
import { aiGcContent } from '@ihui/database'

/**
 * 分享内容路由：/api/share/content/:code
 * 通过分享 code（aiGcContent 的 UUID）获取 AI 生成内容。
 */
export const shareContentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/content/:code', async (request, reply) => {
    const { code } = request.params as { code: string }

    const invalidCodes = ['', 'dist', 'index.html', 'index', 'share', 'error']
    if (!code || invalidCodes.includes(code)) {
      return reply.code(400).send(error(400, '分享链接无效'))
    }

    const rows = await dbRead.select().from(aiGcContent).where(eq(aiGcContent.id, code)).limit(1)

    const content = rows[0]
    if (!content || content.status !== 1) {
      return reply.code(404).send(error(404, '分享内容不存在或已下线'))
    }

    return reply.send(
      success({
        code,
        gcType: content.gcType,
        content: content.content,
        agentId: content.agentId,
        userUuid: content.userUuid,
        createdAt: content.createdAt.toISOString(),
      }),
    )
  })
}
