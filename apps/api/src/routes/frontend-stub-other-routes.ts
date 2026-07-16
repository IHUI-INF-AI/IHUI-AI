/**
 * 前端 other 模块缺失路由桩。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略：统一返回空列表/空对象/操作成功，避免前端 404。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { success } from '../utils/response.js'

export const frontendStubOtherRoutes: FastifyPluginAsync = async (server) => {
  server.post('/activities/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get(
    '/agents/oauth-apps/audit-logs',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.post('/ai-world/create', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.put('/ai-world/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post('/llm/complete/stream', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/business-card/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.get('/business-card/favorites', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.delete(
    '/business-card/favorites/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.delete(
    '/business-card/favorites',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.delete('/business-card/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post('/business-card/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post(
    '/business-card/:id/favorite',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post('/developer/keys', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.delete('/developer/keys/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post(
    '/developer/keys/:id/reset',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post('/developer/subscription', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post(
    '/developer/subscription/renew',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post(
    '/developer/subscription/upgrade',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post('/developer/team/invite', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.put('/developer/team/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/developer/team/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.get(
    '/drama/scripts/:id/enhance',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/drama/scripts/:id/scenes/:id/lines/:id/enhance',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get('/image-gen/favorites', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/image-gen/gallery', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/image-gen/history', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/image-gen/generate', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/image-gen/templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/knowledge-base/categories',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.post('/knowledge-base', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/knowledge-base/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.put('/knowledge-base/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/addresses/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/addresses/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post('/addresses/:id/default', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/member/benefits', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/points/redeem', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/member/settings', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put('/member/settings', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post('/subscriptions/cancel', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/subscriptions/renew', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/oss/resource/file', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/circles/:id/leave', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.put('/notes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/teams/:id/invitations/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/tools/pdf/convert', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/tools/pdf/merge', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/tools/pdf/split', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/tools/pdf/watermark', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/messages/conversations', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/customer-service/send', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/v1/ai/capabilities/list', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/v1/ai/capabilities/categories',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/v1/ai/capabilities/invoke',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/v1/ai/capabilities/auto-match',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get('/service-appointment/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.get(
    '/service-appointment/:id/cancel',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/service-appointment/:id/confirm',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/service-appointment/:id/complete',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get('/notification/send', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/v1/customer_service/messages',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/v1/customer_service/messages/read',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/v1/customer_service/ticket',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/v1/customer_service/ticket/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({}))
    },
  )
  server.get(
    '/v1/customer_service/ticket/:id/replies',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/v1/customer_service/ticket/:id/rate',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get(
    '/v1/customer_service/ticket/:id/close',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get('/v1/customer_service/faqs', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/v1/tools/list', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/v1/tools/categories', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/v1/tools/upload', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/v1/content/create', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/v1/content/list', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/v1/ai/capabilities/ws/stream',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.post('/notifications/:id/read', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post(
    '/notifications/badge/read-all',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post('/pdf-service/merge', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/pdf-service/split', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/pdf-service/print', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/pdf-service/sign', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/pdf-service/watermark', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/security/audit', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/students/:id/profile', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put('/students/:id/profile', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.get('/tour/permissions', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/tour/spots', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
}
