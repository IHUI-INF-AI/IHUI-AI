/**
 * 前端 edu 模块缺失路由桩。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略：统一返回空列表/空对象/操作成功，避免前端 404。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { success } from '../utils/response.js'

export const frontendStubEduRoutes: FastifyPluginAsync = async (server) => {
  server.get('/edu/certificates', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/edu/certificates/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.post(
    '/edu/certificates/:id/download',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.get('/edu/courses/:id/sections', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/edu/courses/:id/qa', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/edu/courses/:id/notes', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/edu/courses/:id/qa', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/edu/courses/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.get('/edu/dashboard', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/edu/exam', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/edu/exam/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.post('/edu/exam/:id/submit', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/edu/progress', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/edu/qa', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/edu/schedule', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/learn/map', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/learn/topics/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.get('/learn/topics/:id/lessons', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/learn/topics', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/learn/:id/homework', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post(
    '/learn/:id/homework/:id/submit',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post('/learn/lessons/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/learn/:id/rates', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/learn/:id/rates', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/edu/nav', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/edu/courses', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/edu/courses/:id/progress', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
}
