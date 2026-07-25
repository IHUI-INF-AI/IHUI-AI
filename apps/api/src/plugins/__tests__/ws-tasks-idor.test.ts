import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(32)
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
  process.env.NODE_ENV = 'test'
})

// Mock ioredis:阻止 wsTasks 插件 register 时创建真实 Redis subscriber 连接
vi.mock('ioredis', () => {
  const RedisStub = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    psubscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  }))
  return { default: RedisStub }
})

vi.mock('../../plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'user-test-id'),
}))

// Mock db:避免真实 PostgreSQL 连接(ws-tasks IDOR 校验在 WebSocket handler 内,注册时不触发)
vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
  },
}))

// Mock @ihui/database schema:提供 4 张表的字段引用对象供 ws-tasks IDOR 校验链式调用
vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks.id', createdBy: 'agent_tasks.createdBy' },
  contentGenerationTasks: { id: 'cgt.id', userId: 'cgt.userId' },
  exportTasks: { id: 'et.id', userId: 'et.userId' },
  workspaceAiTasks: { id: 'wat.id', userId: 'wat.userId' },
}))

import fastifyWebsocket from '@fastify/websocket'
import { wsTasks } from '../ws-tasks.js'

describe('ws-tasks IDOR 防护 - 插件注册', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(fastifyWebsocket)
    await app.register(wsTasks)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should register ws-tasks plugin without throwing', () => {
    expect(app).toBeDefined()
  })

  it('onClose 钩子注册并执行成功(app.close 不抛错)', async () => {
    const app2 = Fastify({ logger: false })
    await app2.register(fastifyWebsocket)
    await app2.register(wsTasks)
    await app2.ready()
    await expect(app2.close()).resolves.toBeUndefined()
  })
})
