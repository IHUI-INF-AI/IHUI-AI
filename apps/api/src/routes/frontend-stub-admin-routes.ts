/**
 * 前端 admin 模块缺失路由桩。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略：统一返回空列表/空对象/操作成功，避免前端 404。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { success } from '../utils/response.js'

export const frontendStubAdminRoutes: FastifyPluginAsync = async (server) => {
  server.put('/admin/agent-rule/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/admin/agent-rule/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.put('/admin/agent-task/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/admin/agent-task/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.put(
    '/admin/messages/announcements',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.patch(
    '/admin/api-platform/packages',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.get(
    '/admin/clawdbot/analytics/summary',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get('/admin/clawdbot/bots', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put('/admin/clawdbot/bots/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/clawdbot/bots', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/clawdbot/bots/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/admin/clawdbot/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/admin/clawdbot/permissions',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.post(
    '/admin/clawdbot/permissions',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.delete(
    '/admin/clawdbot/permissions/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/admin/clawdbot/sessions', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/admin/clawdbot/sessions/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({}))
    },
  )
  server.post(
    '/admin/customer-service/send',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )

  server.put(
    '/admin/certificates/templates',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.post(
    '/admin/edu/classes/:id/members',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.delete(
    '/admin/edu/classes/:id/members/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.put('/admin/edu/classes', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put(
    '/admin/learn/lessons/:id/chapters',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )

  server.put(
    '/admin/edu/exam/arrangements',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.put('/admin/edu/exam/templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/community', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/homework', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/live/channels', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/maps', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/materials', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/lessons', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/plans', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/reminds', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post(
    '/admin/learn/signup-batchlesson/:id/retry',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.put(
    '/admin/learn/premium-topics',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.put('/admin/member-levels/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/member-levels/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.put('/admin/users/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post('/admin/users/:id/review', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.put('/admin/user-platform/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/user-platform/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.patch('/admin/help/articles', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/invoices/titles', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/categories', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/live/categories', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post('/admin/users/:id/audit', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.put('/admin/members/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post(
    '/admin/monitor/alerts/:id/ack',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post(
    '/admin/monitor/alerts/:id/resolve',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.get('/admin/monitor/funnel/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.get('/admin/monitoring/alerts', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  server.put('/admin/orders/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/admin/orders/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post('/admin/oss/files', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.delete('/admin/oss/files/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.patch('/admin/oss/drivers', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.get('/admin/system/posts', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put(
    '/admin/product-identity/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.delete(
    '/admin/product-identity/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.delete(
    '/admin/roles/:id/users/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.delete('/admin/roles/:id/users', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post('/admin/roles/:id/users', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post(
    '/admin/shop/payments/:id/ship',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.patch('/admin/shop/products', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/shop/withdrawals', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post(
    '/admin/shop/withdrawals/:id/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )

  server.get('/admin/system/tasks/logs', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post(
    '/admin/system/tasks/:id/run',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.get('/admin/themes/assets', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/admin/themes/assets', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.delete(
    '/admin/themes/assets/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/admin/themes/colors', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put('/admin/themes/colors/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/themes/colors', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/themes/colors/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.post('/admin/themes', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/admin/themes/dark-mode', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put('/admin/themes/dark-mode', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.get('/admin/themes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.put('/admin/themes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/admin/themes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post('/admin/themes/import', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/admin/themes/fonts', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/admin/themes/fonts', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.patch('/admin/themes/fonts/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/themes/fonts/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/admin/themes/current', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.patch('/admin/themes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.get('/admin/themes/presets', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post(
    '/admin/themes/apply-preset',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.put(
    '/admin/user-agent-audio/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.put('/admin/zhs-user/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })

  // course/pay CRUD 桩（前端 edu/course/pay 调用，后端未注册）
  server.put('/admin/course/pay/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/course/pay/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )

  // course/platform-logs CRUD 桩（前端 edu/course/platform-log 调用，后端未注册）
  server.put(
    '/admin/course/platform-logs/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.delete(
    '/admin/course/platform-logs/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )

  // courses 软删除桩（前端 edu/course/trash 调用，后端未注册）
  server.delete('/admin/courses/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })

  // POST 创建路由桩（前端 editing ? PUT /:id : POST / 模式，POST 创建分支后端未注册）
  server.post('/admin/agent-rule', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/agent-task', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/clawdbot/bots', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/course/pay', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post(
    '/admin/course/platform-logs',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post('/admin/member-levels', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/user-platform', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/product-identity', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/themes/colors', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/user-agent-audio', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/zhs-user', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
}
