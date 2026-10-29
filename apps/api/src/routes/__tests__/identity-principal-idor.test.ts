// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 身份主体回归锁(守门 242 立因那一族的运行时证据)。
 *
 * 缺陷形状(2026-10-25 实测于 HEAD 162d7693):
 *  · crew.ts 的 requireAuthUser 读 req.user?.userId、knowledge-rag.ts 八处读
 *    (req.user as { userId? })?.userId;而 @fastify/jwt 把 request.user 装饰为 null,
 *    本仓 authenticate() 走 jose 只写 request.userId ⇒ 读数恒 undefined;
 *  · 两族注册时又都没有鉴权 preHandler ⇒ 主体退化为客户端自报的 userId / ownerUuid,
 *    GET /api/crew/sessions 因 listSessions('') 不拼 where 直接返回全员会话。
 *
 * 本文件按 §5「越权用例必须断言副作用没发生,并成对留正向对照」写:
 * 每个越权档都配一条"同一入口、合法主体"的正向对照,防止把门修成只会被动的死板闸门。
 * 夹具只填**生产真会填的字段**(request.userId / request.jwtPayload)——
 * 给 request.user 赋值等于把测试接上一条生产走不到的路径(§22c 判据单源的镜像面,守门 242 W3)。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 令牌表:Bearer <token> → 主体。生产由 authenticate() 从 JWT 解出,这里同形。
const { TOKENS, calls, principalOf } = vi.hoisted(() => {
  const tokens = new Map<string, { userId: string; roleId: number }>([
    ['tok-a', { userId: 'user-a', roleId: 0 }],
    ['tok-b', { userId: 'user-b', roleId: 0 }],
    ['tok-admin', { userId: 'user-admin', roleId: 1 }],
  ])
  return {
    TOKENS: tokens,
    calls: [] as Array<{ fn: string; args: unknown[] }>,
    principalOf: (request: any): { userId: string; roleId: number } | undefined => {
      const header = request.headers?.authorization ?? ''
      const token =
        typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
      return tokens.get(token)
    },
  }
})

vi.mock('../../plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (request: any, reply: any) => {
    const header = request.headers?.authorization ?? ''
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
    const principal = TOKENS.get(token)
    if (!principal) {
      return reply.status(401).send({ code: 401, message: 'Authentication required' })
    }
    request.userId = principal.userId
    request.jwtPayload = principal
  }),
  isSystemAdmin: (request: any, policy: { includeInternalChannel: boolean }) => {
    // 与生产同档:admin 特权只认人用 JWT 的 roleId
    if (policy.includeInternalChannel) return true
    return (request.jwtPayload?.roleId ?? 0) >= 1
  },
  requireAdmin: vi.fn(),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: any) => {
    const principal = principalOf(request)
    if (!principal) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    request.userId = principal.userId
    request.jwtPayload = principal
    return { userId: principal.userId, roleId: principal.roleId }
  }),
  // 生产 checkAuth = authenticate + reply 401;替身保持同一语义
  checkAuth: vi.fn(async (request: any, reply: any) => {
    const principal = principalOf(request)
    if (!principal) {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    }
    request.userId = principal.userId
    request.jwtPayload = principal
    return true
  }),
  requireActiveUser: vi.fn(),
}))

vi.mock('../../services/crew-orchestrator.js', () => ({
  crewOrchestrator: {
    createSession: vi.fn(async (opts: any) => {
      calls.push({ fn: 'createSession', args: [opts] })
      return `sid-${opts.userId}`
    }),
    listSessions: vi.fn(async (userId: string) => {
      calls.push({ fn: 'listSessions', args: [userId] })
      return userId
        ? [{ id: 's1', userId }]
        : [
            { id: 's1', userId: 'user-a' },
            { id: 's2', userId: 'user-b' },
          ]
    }),
    getSession: vi.fn(async (id: string) => {
      calls.push({ fn: 'getSession', args: [id] })
      return id === 'victim-session'
        ? { id, userId: 'user-b', status: 'done' }
        : { id, userId: 'user-a', status: 'done' }
    }),
    listTasks: vi.fn(async (id: string) => {
      calls.push({ fn: 'listTasks', args: [id] })
      return []
    }),
    listMessages: vi.fn(async (id: string) => {
      calls.push({ fn: 'listMessages', args: [id] })
      return []
    }),
    executeSession: vi.fn(async (id: string) => {
      calls.push({ fn: 'executeSession', args: [id] })
      return { success: true, result: 'ok', userId: 'user-a', usage: { totalTokens: 0 } }
    }),
    listArtifacts: vi.fn(async (id: string) => {
      calls.push({ fn: 'listArtifacts', args: [id] })
      return []
    }),
    saveArtifact: vi.fn(async () => undefined),
    cancel: vi.fn(),
  },
}))

vi.mock('../../services/crew-agent-registry.js', () => ({
  agentRegistry: { listRoles: () => [] },
}))

vi.mock('../../services/clawdbot/index.js', () => ({
  getModelManager: () => ({ list: () => [] }),
}))

vi.mock('../../services/knowledge-rag-service.js', () => ({
  knowledgeRagService: {
    listDocs: vi.fn(async (owner: string) => {
      calls.push({ fn: 'listDocs', args: [owner] })
      return []
    }),
    getDocDetail: vi.fn(async (id: number, owner: string) => {
      calls.push({ fn: 'getDocDetail', args: [id, owner] })
      return { id, ownerUuid: owner }
    }),
    deleteDoc: vi.fn(async (id: number, owner: string) => {
      calls.push({ fn: 'deleteDoc', args: [id, owner] })
      return true
    }),
    batchDeleteDocs: vi.fn(async (ids: number[], owner: string) => {
      calls.push({ fn: 'batchDeleteDocs', args: [ids, owner] })
      return { deleted: ids.length }
    }),
    ingestText: vi.fn(async (opts: any) => {
      calls.push({ fn: 'ingestText', args: [opts] })
      return { chunkCount: 1 }
    }),
    search: vi.fn(async (opts: any) => {
      calls.push({ fn: 'search', args: [opts] })
      return []
    }),
    getRagContext: vi.fn(async (opts: any) => {
      calls.push({ fn: 'getRagContext', args: [opts] })
      return ''
    }),
  },
}))

vi.mock('../../services/document-parser.js', () => ({
  UnsupportedFormatError: class extends Error {},
  FileTooLargeError: class extends Error {},
}))

import { crewRoutes } from '../crew.js'
import { knowledgeRagRoutes } from '../knowledge-rag.js'

const auth = (tok: string) => ({ authorization: `Bearer ${tok}` })
const reset = () => {
  calls.length = 0
}

describe('身份主体:crew / knowledge 不得采信客户端自报', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 与生产同前缀注册,注册项本身不带 preHandler —— 鉴权必须在路由自己身上(本仓 server.register 形态)
    await app.register(crewRoutes, { prefix: '/api/crew' })
    await app.register(knowledgeRagRoutes, { prefix: '/api/knowledge' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('匿名 GET /api/crew/sessions 返回 401,且一次都没查库(副作用没发生)', async () => {
    reset()
    const res = await app.inject({ method: 'GET', url: '/api/crew/sessions' })
    expect(res.statusCode).toBe(401)
    expect(calls.filter((c) => c.fn === 'listSessions')).toHaveLength(0)
  })

  it('普通用户带 ?userId=他人 时,listSessions 收到的主体只能是令牌主体', async () => {
    reset()
    const res = await app.inject({
      method: 'GET',
      url: '/api/crew/sessions?userId=user-b',
      headers: auth('tok-a'),
    })
    expect(res.statusCode).toBe(200)
    const arg = calls.find((c) => c.fn === 'listSessions')?.args[0]
    expect(arg).toBe('user-a')
  })

  it('正向对照:管理员可按 userId 审查他人会话(特权走具名判定,不是 ?? 链)', async () => {
    reset()
    const res = await app.inject({
      method: 'GET',
      url: '/api/crew/sessions?userId=user-b',
      headers: auth('tok-admin'),
    })
    expect(res.statusCode).toBe(200)
    expect(calls.find((c) => c.fn === 'listSessions')?.args[0]).toBe('user-b')
  })

  it('普通用户读他人会话 ⇒ 404,且不取任务列表', async () => {
    reset()
    const res = await app.inject({
      method: 'GET',
      url: '/api/crew/sessions/victim-session/tasks',
      headers: auth('tok-a'),
    })
    expect(res.statusCode).toBe(404)
    expect(calls.filter((c) => c.fn === 'listTasks')).toHaveLength(0)
  })

  it('正向对照:属主读自己会话的任务列表 ⇒ 200', async () => {
    reset()
    const res = await app.inject({
      method: 'GET',
      url: '/api/crew/sessions/my-session/tasks',
      headers: auth('tok-a'),
    })
    expect(res.statusCode).toBe(200)
    expect(calls.filter((c) => c.fn === 'listTasks')).toHaveLength(1)
  })

  it('匿名 POST /api/crew/sessions 不再将客户端自报的 userId 当主体', async () => {
    reset()
    const res = await app.inject({
      method: 'POST',
      url: '/api/crew/sessions',
      payload: { userId: 'user-b', inputMessage: 'hi' },
    })
    expect(res.statusCode).toBe(401)
    expect(calls.filter((c) => c.fn === 'createSession')).toHaveLength(0)
  })

  it('正向对照:带令牌建会话时,会话属主 = 令牌主体(即便 body 自报了别人)', async () => {
    reset()
    const res = await app.inject({
      method: 'POST',
      url: '/api/crew/sessions',
      headers: auth('tok-a'),
      payload: { userId: 'user-b', inputMessage: 'hi' },
    })
    expect(res.statusCode).toBe(200)
    expect(calls.find((c) => c.fn === 'createSession')?.args[0]).toMatchObject({ userId: 'user-a' })
  })

  it('匿名 GET /api/knowledge/docs?ownerUuid=victim ⇒ 401 且不查库', async () => {
    reset()
    const res = await app.inject({ method: 'GET', url: '/api/knowledge/docs?ownerUuid=victim' })
    expect(res.statusCode).toBe(401)
    expect(calls.filter((c) => c.fn === 'listDocs')).toHaveLength(0)
  })

  it('普通用户自报 ownerUuid=victim 时,listDocs 收到的是令牌主体', async () => {
    reset()
    const res = await app.inject({
      method: 'GET',
      url: '/api/knowledge/docs?ownerUuid=victim',
      headers: auth('tok-a'),
    })
    expect(res.statusCode).toBe(200)
    expect(calls.find((c) => c.fn === 'listDocs')?.args[0]).toBe('user-a')
  })

  it('删除他人文档 ⇒ 归属参数取自令牌,客户端 ownerUuid 不参与(副作用按属主边界发生)', async () => {
    reset()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/knowledge/docs/7?ownerUuid=victim',
      headers: auth('tok-a'),
    })
    expect(res.statusCode).toBe(200)
    const c = calls.find((x) => x.fn === 'deleteDoc')
    expect(c?.args).toEqual([7, 'user-a'])
  })

  it('正向对照:健康检查仍匿名可达(数据面收紧不牵连探活)', async () => {
    reset()
    const res = await app.inject({ method: 'GET', url: '/api/knowledge/health' })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/knowledge/ingest 入库属主 = 令牌主体,不是 body.ownerUuid', async () => {
    reset()
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/ingest',
      headers: auth('tok-a'),
      payload: { ownerUuid: 'victim', title: 't', text: 'x' },
    })
    expect(res.statusCode).toBe(200)
    expect(calls.find((c) => c.fn === 'ingestText')?.args[0]).toMatchObject({ ownerUuid: 'user-a' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
