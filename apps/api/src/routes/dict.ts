import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/require-permission.js'
import { success } from '../utils/response.js'
import { findDictDataByType } from '../db/admin-sys-queries.js'

export const dictPublicRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  server.get<{
    Params: { dictType: string }
  }>(
    '/data/type/:dictType',
    {
      schema: {
        summary: '公开字典数据查询(登录用户可用)',
        tags: ['dict'],
        params: {
          type: 'object',
          required: ['dictType'],
          properties: {
            dictType: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { dictType } = z.object({ dictType: z.string().min(1) }).parse(request.params)
      const list = await findDictDataByType(dictType)
      return reply.send(success({ dictType, list }))
    },
  )
}
