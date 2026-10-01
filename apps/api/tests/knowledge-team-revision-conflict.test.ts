// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-09b 票1 回归:CAS 拒绝必须把"裁决时事实"作为结构化字段回报。
 *
 * 判据:PUT /items/:itemId 撞 409 REVISION_CONFLICT 时,响应体必须带
 * `data.currentRevision`(服务端裁决那一刻的真值),调用方**读字段**收敛重试,
 * 不解析 message 文案。反向对照:把 service 文案里的数字删掉,本套件必须仍绿
 * —— 证明断言读的是字段而不是散文。
 *
 * 与 knowledge-team.test.ts 的 mock 搭法一致;本文件的错误 handler 刻意只产出
 * `{ code, message }`(不含 errorCode/data),因此 409 体里的结构化字段只可能
 * 来自路由自身的 catch 分支 —— 测的就是生产路径上真正发出去的那份响应体。
 *
 * 铁律:全程 mock db,不连生产 PostgreSQL(8810)/ Redis(8811)。
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// ---------------------------------------------------------------- mock 面

const USER_ALICE = '00000000-0000-4000-8000-0000000000a1'

let currentUserId = USER_ALICE
const updateSets: Record<string, unknown>[] = []
/** 按调用顺序出牌的结果队列;空队列 ⇒ 返回空数组(即"查不到") */
let scripted: unknown[][] = []

function nextResult(): unknown[] {
  return scripted.shift() ?? []
}

function makeChain(recordOnValues?: boolean): Record<string, unknown> {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(nextResult()).then(resolve),
  }
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'groupBy']) {
    chain[m] = () => chain
  }
  chain['values'] = () => chain
  chain['set'] = (v: Record<string, unknown>) => {
    if (recordOnValues) updateSets.push(v)
    return chain
  }
  chain['returning'] = () => chain
  chain['onConflictDoUpdate'] = () => chain
  return chain
}

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(async () => ({ userId: currentUserId, roleId: 0 })),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn(async () => 1),
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain(true)),
    update: vi.fn(() => makeChain(true)),
    delete: vi.fn(() => makeChain()),
    execute: vi.fn(async () => []),
  },
  dbRead: { select: vi.fn(() => makeChain()) },
}))

import { knowledgeTeamRoutes } from '../src/routes/knowledge-team.js'

// ---------------------------------------------------------------- 夹具

const SPACE_ID = '00000000-0000-4000-8000-00000000a001'
const ITEM_ID = '00000000-0000-4000-8000-00000000b001'
const TEAM_ID = '00000000-0000-4000-8000-00000000c001'

function spaceRow(over: Record<string, unknown> = {}) {
  return {
    id: SPACE_ID,
    teamId: TEAM_ID,
    name: '后端规范',
    settings: {},
    visibility: 'team',
    status: 'active',
    createdBy: USER_ALICE,
    updatedBy: USER_ALICE,
    createdAt: new Date('2026-09-26T00:00:00.000Z'),
    updatedAt: new Date('2026-09-26T00:00:00.000Z'),
    ...over,
  }
}

function itemRow(over: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    spaceId: SPACE_ID,
    kind: 'memory',
    title: '分页约定',
    content: { rule: 'cursor' },
    plainText: '列表接口一律用 cursor',
    tags: ['api'],
    status: 'draft',
    revision: 1,
    sourceRef: null,
    createdBy: USER_ALICE,
    updatedBy: USER_ALICE,
    createdAt: new Date('2026-09-26T00:00:00.000Z'),
    updatedAt: new Date('2026-09-26T00:00:00.000Z'),
    ...over,
  }
}

let server: FastifyInstance

beforeAll(async () => {
  server = Fastify({ logger: false })
  // 刻意不含 errorCode / data:409 体里的结构化字段只能来自路由自身的 catch
  server.setErrorHandler((err, _request, reply) => {
    const statusCode =
      typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500
    reply.status(statusCode).send({
      code: statusCode,
      message: statusCode >= 500 ? '服务器错误' : err.message,
    })
  })
  await server.register(knowledgeTeamRoutes, { prefix: '/api/knowledge-team' })
  await server.ready()
})

afterEach(() => {
  updateSets.length = 0
  scripted = []
  currentUserId = USER_ALICE
})

const AUTH = { authorization: 'Bearer mock-access-token' }

/** requireItemAccess 的四次取数:条目 → 空间 → 我的角色 → 成员面 */
function scriptAccess(item: Record<string, unknown>) {
  scripted = [[item], [spaceRow()], [{ role: 'editor' }], [{ role: 'member' }]]
}

// ---------------------------------------------------------------- 判据

describe('CAS 拒绝把裁决时事实作为结构化字段回报(b76-09b 票1)', () => {
  it('expectedRevision=1 撞 revision=3 ⇒ 409 ∧ errorCode=REVISION_CONFLICT ∧ data.currentRevision===3', async () => {
    scriptAccess(itemRow({ revision: 3 }))
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
      payload: { content: { rule: 'offset' }, expectedRevision: 1 },
    })
    expect(res.statusCode).toBe(409)
    const body = res.json() as {
      code: number
      errorCode?: string
      data?: { currentRevision?: number; expectedRevision?: number }
    }
    expect(body.code).toBe(409)
    expect(body.errorCode).toBe('REVISION_CONFLICT')
    // 断言读字段,不读 message 文案(反向对照:删掉 service 文案里的数字本套件仍绿)
    expect(body.data?.currentRevision).toBe(3)
    expect(body.data?.expectedRevision).toBe(1)
    // 被拒的请求不得写库:冲突裁决发生在任何 update 之前
    expect(updateSets).toHaveLength(0)
  })

  it('拿 data.currentRevision 直接当下一次 expectedRevision 重试 ⇒ 200 且 revision 递增', async () => {
    // 第一撞:拿到 currentRevision=3
    scriptAccess(itemRow({ revision: 3 }))
    const rejected = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
      payload: { content: { rule: 'offset' }, expectedRevision: 1 },
    })
    expect(rejected.statusCode).toBe(409)
    const body = rejected.json() as { data?: { currentRevision?: number } }
    const currentRevision = body.data?.currentRevision
    expect(typeof currentRevision).toBe('number')

    // 第二次:调用方用读到的字段收敛重试,不重新 GET、不解析文案
    scripted = [
      [itemRow({ revision: 3 })],
      [spaceRow()],
      [{ role: 'editor' }],
      [{ role: 'member' }],
      [itemRow({ revision: 4, content: { rule: 'offset' } })],
      [],
    ]
    const ok = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
      payload: { content: { rule: 'offset' }, expectedRevision: currentRevision },
    })
    expect(ok.statusCode).toBe(200)
    expect(updateSets).toHaveLength(1)
    expect(updateSets[0]?.['revision']).toBe(4)
  })

  it('响应体 data 形状与跨端契约 RevisionConflictPayload 一致(共享层单一来源)', async () => {
    // 结构性锁:data 只允许 currentRevision/expectedRevision 两个字段,
    // 多出或少字段都说明路由与服务层的"裁决时事实"契约漂移了。
    scriptAccess(itemRow({ revision: 2 }))
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
      payload: { title: '再改一次', expectedRevision: 1 },
    })
    expect(res.statusCode).toBe(409)
    const body = res.json() as { data?: Record<string, unknown> }
    expect(Object.keys(body.data ?? {}).sort()).toEqual(['currentRevision', 'expectedRevision'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
