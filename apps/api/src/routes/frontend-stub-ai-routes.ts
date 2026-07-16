/**
 * 前端 ai 模块缺失路由桩。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略：统一返回空列表/空对象/操作成功，避免前端 404。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { success } from '../utils/response.js'

export const frontendStubAiRoutes: FastifyPluginAsync = async (server) => {
  server.get('/ai/dashscope/chat', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/ai/dashscope/image', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/ai/doubao/image', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/ai/jimeng4/image', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/ai/kling/video/generate', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/ai/dashscope/video', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/ai/audio/speech', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/ai/suno/generate', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/ai/tencent/hunyuan3d/submit',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.post('/ai/mcp/servers', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/mcp/servers/:id/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.delete('/ai/mcp/servers/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.get('/ai/mcp/servers/:id/tools', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/ai/mcp/tools/call', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/keling/audio/end', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/sora/request/end', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/cosyvoice', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/keling/audio/start', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/sora/request', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/llm/chat', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post(
    '/ai/dashscope/image/generate',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post('/ai/hunyuan/3d/submit', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/gemini/nano-banana', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/ai/google/veo3', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post(
    '/ai/dashscope/video/generate',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post('/ai/qwen/omni', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
}
