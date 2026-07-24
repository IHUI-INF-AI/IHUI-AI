/**
 * 小程序兼容路由(2026-07-24 立)
 *
 * 背景:小程序端调用了大量后端缺失的端点,导致 Taro.request fail 弹"网络异常"toast。
 * 本文件补建这 49 个端点,返回合理的空数据(空列表/空对象/成功响应),避免 404。
 *
 * 设计原则:
 *  - 大部分端点无需鉴权(公开空桩),/agents/* /distribution/* /agent/* /chat/* /token/* /messages/* 需 checkAuth
 *  - 响应格式统一 { code, message, data }
 *  - 每个端点 3-5 行,简洁空桩,不写真实业务逻辑
 *  - 后续如需真实数据,可在对应业务路由文件实现并覆盖此处空桩
 */
import type { FastifyPluginAsync } from 'fastify'
import { success } from '../utils/response.js'
import { checkAuth } from '../plugins/auth.js'

export const miniappCompatRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // /learn/* (12 个,课程管理功能,后端有 /learn/lessons 但小程序调用 /learn/course)
  // ==========================================================================
  server.get('/learn/group/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ group: { id, name: '', courses: [] } }))
  })

  server.post('/learn/group', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString() }))
  })

  server.put('/learn/course/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id }))
  })

  server.delete('/learn/course/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id }))
  })

  server.post('/learn/course/:id/issue', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id, status: 'published' }))
  })

  server.post('/learn/course/:id/delist', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id, status: 'draft' }))
  })

  server.post('/learn/video', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString() }))
  })

  server.put('/learn/video/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id }))
  })

  server.delete('/learn/video/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id }))
  })

  server.get('/learn/video/comments', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  server.post('/learn/video/comment', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString() }))
  })

  server.post('/learn/video/log', async (_request, reply) => {
    return reply.send(success({}))
  })

  // ==========================================================================
  // /study/* (4 个,学习功能,后端有 /study/info 但小程序调用其他)
  // ==========================================================================
  server.get('/study/groups', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/study/groups/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id, name: '', videos: [] }))
  })

  server.get('/study/videos/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id, title: '', url: '', duration: 0 }))
  })

  server.get('/study/ranking', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  // ==========================================================================
  // /workflows/* (2 个,n8n 工作流)
  // ==========================================================================
  server.get('/workflows/n8n', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  server.post('/workflows/n8n/create', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString(), status: 'created' }))
  })

  // ==========================================================================
  // /agents/* (6 个,智能体互动,后端 agents.ts 无这些路径,需鉴权)
  // ==========================================================================
  server.get('/agents/categories', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.post('/agents/:id/collect', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    return reply.send(success({ id, collected: true }))
  })

  server.post('/agents/:id/like', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    return reply.send(success({ id, liked: true }))
  })

  server.post('/agents/:id/use', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    return reply.send(success({ id, used: true }))
  })

  server.get('/agents/use-history', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [] }))
  })

  server.get('/agents/collections', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [] }))
  })

  // ==========================================================================
  // /distribution/* (6 个,分销,后端有部分但路径不同,需鉴权)
  // ==========================================================================
  server.get('/distribution/subordinates', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/distribution/invitee-orders', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/distribution/wx-code', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ code: '', url: '' }))
  })

  server.get('/distribution/flow', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/distribution/flow/orders', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/distribution/withdrawal/:id/status', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    return reply.send(success({ id, status: 'pending' }))
  })

  // ==========================================================================
  // /knowledge-planet/* (2 个,知识星球)
  // ==========================================================================
  server.get('/knowledge-planet/info', async (_request, reply) => {
    return reply.send(success({ name: '', memberCount: 0, description: '' }))
  })

  server.get('/knowledge-planet/news', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /course-planet (1 个)
  // ==========================================================================
  server.get('/course-planet', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /agent/* (5 个,注意是 /agent 不是 /agents,需鉴权)
  // ==========================================================================
  server.get('/agent/tokens', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.post('/agent/context', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ id: Date.now().toString() }))
  })

  server.get('/agent/context', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [] }))
  })

  server.get('/agent/context/query', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({}))
  })

  server.post('/agent/creation/share', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ url: '', id: Date.now().toString() }))
  })

  // ==========================================================================
  // /chat/* (2 个,需鉴权)
  // ==========================================================================
  server.post('/chat/history', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ id: Date.now().toString() }))
  })

  server.delete('/chat/history/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    return reply.send(success({ id }))
  })

  // ==========================================================================
  // /model/* (2 个)
  // ==========================================================================
  server.post('/model/chat', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString() }))
  })

  server.delete('/model/chat/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id }))
  })

  // ==========================================================================
  // /aigc/* (1 个)
  // ==========================================================================
  server.post('/aigc/publish', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString(), status: 'published' }))
  })

  // ==========================================================================
  // /models/* (1 个)
  // ==========================================================================
  server.get('/models/plaza', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /ranking (1 个,后端有 /ranking/users 等但无 /ranking 根路径)
  // ==========================================================================
  server.get('/ranking', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /token/* (2 个,后端有 /token/balance/:userUuid 但无无参数版本,需鉴权)
  // ==========================================================================
  server.get('/token/balance', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ balance: 0, locked: 0 }))
  })

  server.get('/token/records', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /messages/* (2 个,需鉴权)
  // ==========================================================================
  server.get('/messages/rooms/:roomId/history', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.post('/messages/rooms/:roomId/read', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { roomId } = request.params as { roomId: string }
    return reply.send(success({ roomId, read: true }))
  })
}
