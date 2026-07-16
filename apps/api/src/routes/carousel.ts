import type { FastifyPluginAsync } from 'fastify'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success } from '../utils/response.js'
import { carousels } from '@ihui/database'

export const carouselPublicRoutes: FastifyPluginAsync = async (server) => {
  server.get(
    '/carousels',
    {
      schema: {
        summary: '公开轮播图列表',
        tags: ['carousel'],
        querystring: {
          type: 'object',
          properties: {
            position: { type: 'string', maxLength: 64 },
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
      const raw = (request.query as { position?: unknown }).position
      const position = typeof raw === 'string' && raw.length > 0 ? raw : undefined
      const where = position
        ? and(eq(carousels.status, 1), eq(carousels.position, position))
        : eq(carousels.status, 1)
      const list = await db
        .select({
          id: carousels.id,
          position: carousels.position,
          imageUrl: carousels.imageUrl,
          title: carousels.title,
          linkUrl: carousels.linkUrl,
          description: carousels.description,
          sort: carousels.sort,
        })
        .from(carousels)
        .where(where)
        .orderBy(asc(carousels.sort))
      return reply.send(success({ list }))
    },
  )
}

export default carouselPublicRoutes
