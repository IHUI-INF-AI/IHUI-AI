// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-168 / F-169 / F-170 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * F-168 考试 start/submit-exam/status 只判登录,凭他人 recordId 可替人开考/交卷/看明细;
 * F-169 证书详情直出 cert,任意登录用户可读他人姓名/证书编号;
 * F-170 自媒体历史只过滤 category,可拉全站他人稿件,且负 limit 直达 SQL。
 *
 * 判据:F-168/F-169 非属主一律 404(与不存在同档);F-170 查询恒带 author_id,
 * limit 夹到 >= 1。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ME = '00000000-0000-4000-8000-0000000000aa'
const VICTIM = '00000000-0000-4000-8000-0000000000bb'
const CERT_ID = '00000000-0000-4000-8000-0000000000cc'
const RECORD_ID = '00000000-0000-4000-8000-0000000000dd'

const state = vi.hoisted(() => ({
  recordOwner: '00000000-0000-4000-8000-0000000000bb',
  certOwner: '00000000-0000-4000-8000-0000000000bb',
  startAnswering: vi.fn(async () => ({ id: 'rec-1', status: 'in_progress' })),
  submitExam: vi.fn(async () => ({ id: 'rec-1', status: 'submitted' })),
  whereArgs: [] as unknown[],
  limitArgs: [] as unknown[],
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-0000000000aa'
    return true
  }),
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-0000000000aa'
  }),
  requireActiveUser: vi.fn(async () => {}),
}))

vi.mock('../src/db/exam-extended-queries.js', () => ({
  findExamRecordByIdExtended: vi.fn(async (id: string) => ({
    id,
    userId: state.recordOwner,
    status: 'in_progress',
  })),
  getExamRecordStatus: vi.fn(async (id: string) => ({
    id,
    userId: state.recordOwner,
    status: 'in_progress',
  })),
  startAnswering: (id: string) => state.startAnswering(id),
  submitExam: (id: string) => state.submitExam(id),
  completeExam: vi.fn(),
  listRecords: vi.fn(async () => []),
  submitAnswer: vi.fn(),
  countRecords: vi.fn(async () => 0),
}))

vi.mock('../src/db/certificate-queries.js', () => ({
  findCertificateById: vi.fn(async (id: string) => ({
    id,
    userId: state.certOwner,
    holderName: '张三',
    certNo: 'C-001',
  })),
  findCertificates: vi.fn(async () => []),
}))

vi.mock('../src/db/index.js', () => {
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.where = (arg: unknown) => {
    state.whereArgs.push(arg)
    return chain
  }
  chain.orderBy = () => chain
  chain.limit = (arg: unknown) => {
    state.limitArgs.push(arg)
    return Promise.resolve([{ id: 'row-1' }])
  }
  chain.then = (resolve: (v: unknown) => void) => resolve([{ id: 'row-1' }])
  return {
    db: { select: () => chain, insert: vi.fn(), update: vi.fn() },
    dbRead: { select: () => chain },
  }
})

import { examRoutes } from '../src/routes/exam.js'
import { eduFrontendRoutes } from '../src/routes/edu-frontend-routes.js'
import { selfMediaRoutes } from '../src/routes/self-media-routes.js'

type Handler = (request: unknown, reply: unknown) => unknown

function makeServer() {
  const handlers = new Map<string, Handler>()
  const server: Record<string, unknown> = {
    addHook: vi.fn(),
    decorate: vi.fn(),
    get: vi.fn((path: string, a: unknown, b?: unknown) => handlers.set(path, (b ?? a) as Handler)),
    post: vi.fn((path: string, a: unknown, b?: unknown) => handlers.set(path, (b ?? a) as Handler)),
    put: vi.fn((path: string, a: unknown, b?: unknown) => handlers.set(path, (b ?? a) as Handler)),
    delete: vi.fn((path: string, a: unknown, b?: unknown) =>
      handlers.set(path, (b ?? a) as Handler),
    ),
    recordExamStarted: vi.fn(),
    recordExamSubmitted: vi.fn(),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  // exam.ts 用 server.register 挂管理员子插件;子插件共享同一 handlers 表
  server.register = vi.fn(async (fn: (child: unknown) => unknown) => fn(server))
  return { server, handlers }
}

function makeReply() {
  return {
    code: 200,
    body: undefined as unknown,
    status(c: number) {
      this.code = c
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
  }
}

describe('F-168 考试记录必须校验属主', () => {
  beforeEach(() => {
    state.recordOwner = VICTIM
    state.startAnswering.mockClear()
    state.submitExam.mockClear()
  })

  it('替他人开考 → 404 且不触发 startAnswering', async () => {
    const { server, handlers } = makeServer()
    await examRoutes(server as never, {})
    const handler = handlers.get('/exam/records/:recordId/start')!
    const reply = makeReply()
    await handler({ params: { recordId: RECORD_ID }, userId: ME }, reply)
    expect(reply.code).toBe(404)
    expect(state.startAnswering).not.toHaveBeenCalled()
  })

  it('看他人答题状态 → 404', async () => {
    const { server, handlers } = makeServer()
    await examRoutes(server as never, {})
    const handler = handlers.get('/exam/records/:recordId/status')!
    const reply = makeReply()
    await handler({ params: { recordId: RECORD_ID }, userId: ME }, reply)
    expect(reply.code).toBe(404)
  })

  it('属主开考照常通过(不误伤)', async () => {
    state.recordOwner = ME
    const { server, handlers } = makeServer()
    await examRoutes(server as never, {})
    const handler = handlers.get('/exam/records/:recordId/start')!
    const reply = makeReply()
    await handler({ params: { recordId: RECORD_ID }, userId: ME }, reply)
    expect(reply.code).toBe(200)
    expect(state.startAnswering).toHaveBeenCalledTimes(1)
  })
})

describe('F-169 证书详情必须校验属主', () => {
  it('读他人证书 → 404', async () => {
    state.certOwner = VICTIM
    const { server, handlers } = makeServer()
    await eduFrontendRoutes(server as never, {})
    const handler = handlers.get('/edu/certificates/:id')!
    const reply = makeReply()
    await handler({ params: { id: CERT_ID }, userId: ME }, reply)
    expect(reply.code).toBe(404)
  })

  it('读本人证书 → 200(不误伤)', async () => {
    state.certOwner = ME
    const { server, handlers } = makeServer()
    await eduFrontendRoutes(server as never, {})
    const handler = handlers.get('/edu/certificates/:id')!
    const reply = makeReply()
    await handler({ params: { id: CERT_ID }, userId: ME }, reply)
    expect(reply.code).toBe(200)
  })
})

describe('F-170 自媒体历史按 author 收敛且 limit 夹紧', () => {
  beforeEach(() => {
    state.whereArgs.length = 0
    state.limitArgs.length = 0
  })

  it('查询恒带 author_id,负 limit 被夹到 1', async () => {
    const { server, handlers } = makeServer()
    await selfMediaRoutes(server as never, {})
    const handler = handlers.get('/self-media/records')!
    const reply = makeReply()
    await handler({ query: { limit: '-5' }, userId: ME }, reply)
    expect(state.whereArgs[0]).toBeTruthy()
    expect(state.limitArgs[0]).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
