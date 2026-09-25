// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D29 团队知识引擎路由与授权面回归(2026-09-26 立)。
 *
 * 三条判据面,对应本票最容易静默失效的三处:
 * ① **零公开面**:12 条路由全部要登录。§5 记过一次同型事故 —— 用 `[^/]+` 兜底放行
 *    参数路由会连静态段一起放,而下游依赖 request.userId 的 handler 对游客是 500 不是 401。
 *    这条不是"顺手测一下",它是本面唯一的公开化回归锁。
 * ② **认证 ≠ 授权**(守门 117 那一型):已登录但无角色 / 属别的团队,必须被挡在
 *    数据之外,且不得用状态码差异泄露"这个 id 存在"。
 * ③ **写内容必落审计**:create/revise/publish 每条都要留下 actor + before/after 摘要,
 *    否则"过程审计"这项能力只剩名字。
 *
 * 铁律:全程 mock db,**不连**生产 PostgreSQL(8810)/ Redis(8811)(§5 测试隔离)。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// ---------------------------------------------------------------- mock 面

/** 用户身份必须是 uuid —— memberBodySchema 会先按 uuid 校验请求里的目标句柄。
 *  currentUserId 是"当前令牌主体",每条用例改它一个值就换了一个人 ——
 *  刻意不从请求体里塞 userId,那正是本票要防的那类混淆。 */
const USER_ALICE = '00000000-0000-4000-8000-0000000000a1'
const USER_BOB = '00000000-0000-4000-8000-0000000000b1'
const USER_CAROL = '00000000-0000-4000-8000-0000000000c1'
const USER_DAVE = '00000000-0000-4000-8000-0000000000d1'
const USER_STRANGER = '00000000-0000-4000-8000-0000000000e1'
const USER_OUTSIDER = '00000000-0000-4000-8000-0000000000f1'

let currentUserId = USER_ALICE
const insertCalls: Record<string, unknown>[] = []
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
  chain['values'] = (v: Record<string, unknown>) => {
    if (recordOnValues) insertCalls.push(v)
    return chain
  }
  chain['set'] = (v: Record<string, unknown>) => {
    if (recordOnValues) updateSets.push(v)
    return chain
  }
  chain['returning'] = () => chain
  chain['onConflictDoUpdate'] = (v: Record<string, unknown>) => {
    if (recordOnValues) insertCalls.push({ __upsert: v })
    return chain
  }
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
const OTHER_TEAM_ID = '00000000-0000-4000-8000-00000000c002'
const NOT_A_UUID = 'not-a-uuid'


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

function revisionRow(over: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-00000000d001',
    itemId: ITEM_ID,
    spaceId: SPACE_ID,
    revisionNo: 1,
    action: 'create',
    actorUserId: USER_ALICE,
    actorRole: 'owner',
    beforeSummary: null,
    afterSummary: { title: '分页约定', status: 'draft', length: 42, digest: 'aaaaaaaaaaaaaaaa' },
    changeNote: null,
    createdAt: new Date('2026-09-26T00:00:00.000Z'),
    ...over,
  }
}

let server: FastifyInstance

beforeAll(async () => {
  server = Fastify({ logger: false })
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
  insertCalls.length = 0
  updateSets.length = 0
  scripted = []
  currentUserId = USER_ALICE
})

const AUTH = { authorization: 'Bearer mock-access-token' }

// ---------------------------------------------------------------- ① 零公开面

describe('鉴权面:本票的 12 条路由一条都不许游客可达', () => {
  const surface: Array<{ method: 'GET' | 'POST' | 'PUT'; url: string }> = [
    { method: 'GET', url: `/api/knowledge-team/spaces?teamId=${TEAM_ID}` },
    { method: 'POST', url: '/api/knowledge-team/spaces' },
    { method: 'GET', url: `/api/knowledge-team/spaces/${SPACE_ID}` },
    { method: 'GET', url: `/api/knowledge-team/spaces/${SPACE_ID}/members` },
    { method: 'PUT', url: `/api/knowledge-team/spaces/${SPACE_ID}/members` },
    { method: 'GET', url: `/api/knowledge-team/spaces/${SPACE_ID}/items` },
    { method: 'POST', url: `/api/knowledge-team/spaces/${SPACE_ID}/items` },
    { method: 'GET', url: `/api/knowledge-team/spaces/${SPACE_ID}/revisions` },
    { method: 'GET', url: `/api/knowledge-team/items/${ITEM_ID}` },
    { method: 'PUT', url: `/api/knowledge-team/items/${ITEM_ID}` },
    { method: 'POST', url: `/api/knowledge-team/items/${ITEM_ID}/status` },
    { method: 'GET', url: `/api/knowledge-team/items/${ITEM_ID}/revisions` },
  ]

  it('路由文件里的路由数必须与上面登记的 surface 条数一致(加面不登记 ⇒ 这条先红)', () => {
    // 结构性锁:本清单是本面"零公开路径"唯一的回归载体。加一条路由而不加进 surface,
    // 就等于悄悄新增一条没被测过的公开面 —— 本仓最高频的失效型(守门 70/76/81 同族)。
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../src/routes/knowledge-team.ts'),
      'utf8',
    )
    const declared = [...src.matchAll(/app\.(?:get|post|put|delete)\(\s*['"][^'"]+['"]/gu)]
    expect(declared.length, `路由文件实有 ${declared.length} 条,surface 登记 ${surface.length} 条`).toBe(
      surface.length,
    )
  })

  for (const route of surface) {
    it(`${route.method} ${route.url} 未登录 ⇒ 401(不是 500、不是 200)`, async () => {
      const res = await server.inject({ method: route.method, url: route.url })
      expect(res.statusCode, `${route.method} ${route.url} 泄漏成 ${res.statusCode}`).toBe(401)
      expect(res.json().code).toBe(401)
    })
  }

  it('静态段不被参数路由吞掉:/spaces/health 这类必须走 uuid 校验而不是当 spaceId', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/knowledge-team/spaces/health',
      headers: AUTH,
    })
    // 参数在业务逻辑之前就被 zod 判掉 ⇒ 400;绝不能是"当成一个 id 去查库"
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------- ② 认证≠授权

describe('授权:已登录不等于可读', () => {
  it('restricted 空间的团队成员查不到任何内容(403)', async () => {
    currentUserId = USER_BOB
    scripted = [
      [spaceRow({ visibility: 'restricted', createdBy: USER_ALICE })], // loadSpace
      [], // 无 space_member 行
      [{ role: 'member' }], // 在团队里,但 restricted 不认团队默认档
    ]
    const res = await server.inject({
      method: 'GET',
      url: `/api/knowledge-team/spaces/${SPACE_ID}`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(403)
  })

  it('visibility=team 的普通成员是 viewer:能读,但不能建条目', async () => {
    currentUserId = USER_BOB
    // getSpace 走通
    scripted = [[spaceRow({ createdBy: USER_ALICE })], [], [{ role: 'member' }]]
    const read = await server.inject({
      method: 'GET',
      url: `/api/knowledge-team/spaces/${SPACE_ID}`,
      headers: AUTH,
    })
    expect(read.statusCode).toBe(200)
    expect(read.json().data.myRole).toBe('viewer')

    // createItem 必须被挡
    scripted = [[spaceRow({ createdBy: USER_ALICE })], [], [{ role: 'member' }]]
    const write = await server.inject({
      method: 'POST',
      url: `/api/knowledge-team/spaces/${SPACE_ID}/items`,
      headers: AUTH,
      payload: { kind: 'memory', title: 'T', content: {} },
    })
    expect(write.statusCode).toBe(403)
    expect(insertCalls).toHaveLength(0)
  })

  it('请求体里自称 owner 不产生任何提权效果', async () => {
    currentUserId = USER_BOB
    scripted = [[spaceRow({ createdBy: USER_ALICE })], [{ role: 'viewer' }], [{ role: 'member' }]]
    const res = await server.inject({
      method: 'POST',
      url: `/api/knowledge-team/spaces/${SPACE_ID}/items`,
      headers: AUTH,
      payload: {
        kind: 'memory',
        title: 'T',
        content: {},
        // 这两行是攻击面:角色/身份只应由令牌与成员表决定
        role: 'owner',
        userId: USER_ALICE,
      },
    })
    expect(res.statusCode).toBe(403)
  })

  it('不在团队里的人列空间:与"团队没有空间"同形(404,不泄露团队是否存在)', async () => {
    currentUserId = USER_STRANGER
    scripted = [[]] // teamMembers 查不到
    const res = await server.inject({
      method: 'GET',
      url: `/api/knowledge-team/spaces?teamId=${TEAM_ID}`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(404)
  })

  it('建空间要求团队 owner/admin:普通成员 403', async () => {
    currentUserId = USER_BOB
    scripted = [[{ id: TEAM_ID }], [{ role: 'member' }]]
    const res = await server.inject({
      method: 'POST',
      url: '/api/knowledge-team/spaces',
      headers: AUTH,
      payload: { teamId: TEAM_ID, name: '新空间' },
    })
    expect(res.statusCode).toBe(403)
    expect(insertCalls).toHaveLength(0)
  })

  it('授权动作要求空间 owner:editor 不能改成员权限', async () => {
    currentUserId = USER_CAROL
    scripted = [
      [spaceRow({ createdBy: USER_ALICE })],
      [{ role: 'editor' }],
      [{ role: 'member' }],
    ]
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/spaces/${SPACE_ID}/members`,
      headers: AUTH,
      payload: { userId: USER_DAVE, role: 'owner' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('被授权人不是同团队成员 ⇒ 400,不把团队资产外授', async () => {
    scripted = [
      [spaceRow({ createdBy: USER_ALICE })],
      [{ role: 'owner' }],
      [{ role: 'owner' }],
      [], // 目标人在 team_members 里没有行
    ]
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/spaces/${SPACE_ID}/members`,
      headers: AUTH,
      payload: { userId: USER_OUTSIDER, role: 'editor' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('空间属于别的团队时,取条目要经过该空间的权限判定(不越权读他人条目)', async () => {
    currentUserId = USER_BOB
    scripted = [
      [itemRow({ spaceId: SPACE_ID })], // getItem → 先取条目
      [spaceRow({ teamId: OTHER_TEAM_ID, visibility: 'team', createdBy: USER_ALICE })],
      [], // 无空间成员行
      [], // 也不在那个团队
    ]
    const res = await server.inject({
      method: 'GET',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------- ③ 审计落库

describe('过程审计:每一次写都留下一条 actor + before/after 摘要', () => {
  it('createItem 落 1 条条目 + 1 条 action=create 的修订,revisionNo=1', async () => {
    scripted = [
      [spaceRow()],
      [{ role: 'editor' }],
      [{ role: 'owner' }],
      [itemRow({ kind: 'card', title: '重试策略', content: { maxAttempts: 3 }, createdBy: USER_ALICE, updatedBy: USER_ALICE })], // insert returning
      [], // 审计 insert 无需返回
    ]
    const res = await server.inject({
      method: 'POST',
      url: `/api/knowledge-team/spaces/${SPACE_ID}/items`,
      headers: AUTH,
      payload: { kind: 'card', title: '重试策略', content: { maxAttempts: 3 }, changeNote: '初版' },
    })
    expect(res.statusCode).toBe(201)

    expect(insertCalls).toHaveLength(2)
    const [itemInsert, revisionInsert] = insertCalls as Array<Record<string, unknown>>
    expect(itemInsert['kind']).toBe('card')
    expect(itemInsert['createdBy']).toBe(USER_ALICE)
    expect(revisionInsert['action']).toBe('create')
    expect(revisionInsert['revisionNo']).toBe(1)
    expect(revisionInsert['actorUserId']).toBe(USER_ALICE)
    expect(revisionInsert['actorRole']).toBe('owner')
    expect(revisionInsert['beforeSummary']).toBeNull()
    const after = revisionInsert['afterSummary'] as { digest: string; length: number; title: string }
    expect(after.title).toBe('重试策略')
    expect(after.length).toBeGreaterThan(0)
    expect(after.digest).toMatch(/^[0-9a-f]{16}$/)
  })

  it('reviseItem 落 action=revise 的修订,before/after 摘要都在,revision 递增', async () => {
    scripted = [
      [itemRow()], // requireItemAccess 取条目
      [spaceRow()],
      [{ role: 'editor' }],
      [{ role: 'member' }],
      [itemRow({ revision: 2, content: { rule: 'offset' } })], // update returning
      [],
    ]
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
      payload: { content: { rule: 'offset' }, expectedRevision: 1, changeNote: '改成 offset' },
    })
    expect(res.statusCode).toBe(200)

    expect(updateSets).toHaveLength(1)
    expect(updateSets[0]['revision']).toBe(2)
    const [revisionInsert] = insertCalls as Array<Record<string, unknown>>
    expect(revisionInsert['action']).toBe('revise')
    expect(revisionInsert['revisionNo']).toBe(2)
    const before = revisionInsert['beforeSummary'] as { digest: string }
    const after = revisionInsert['afterSummary'] as { digest: string }
    expect(before.digest).not.toBe(after.digest)
  })

  it('正文相同但改了标题时摘要必须变(证明摘要真的覆盖标题字段)', async () => {
    scripted = [
      [itemRow()],
      [spaceRow()],
      [{ role: 'editor' }],
      [{ role: 'member' }],
      [itemRow({ title: '改名了' })],
      [],
    ]
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
      payload: { title: '改名了', expectedRevision: 1 },
    })
    expect(res.statusCode).toBe(200)
    const [revisionInsert] = insertCalls as Array<Record<string, unknown>>
    const before = revisionInsert['beforeSummary'] as { title: string }
    const after = revisionInsert['afterSummary'] as { title: string }
    expect(before.title).toBe('分页约定')
    expect(after.title).toBe('改名了')
  })

  it('publish 用 action=publish 而不是 revise(审计动词集必须分得清流转类型)', async () => {
    scripted = [
      [itemRow({ status: 'draft' })],
      [spaceRow()],
      [{ role: 'editor' }],
      [{ role: 'member' }],
      [itemRow({ status: 'published', revision: 2 })],
      [],
    ]
    const res = await server.inject({
      method: 'POST',
      url: `/api/knowledge-team/items/${ITEM_ID}/status`,
      headers: AUTH,
      payload: { status: 'published' },
    })
    expect(res.statusCode).toBe(200)
    const [revisionInsert] = insertCalls as Array<Record<string, unknown>>
    expect(revisionInsert['action']).toBe('publish')
  })

  it('审计面回读:条目流按 revisionNo 升序,空间流按时间倒序,两者都要过权限', async () => {
    scripted = [
      [itemRow()],
      [spaceRow()],
      [{ role: 'viewer' }],
      [{ role: 'member' }],
      [revisionRow({ revisionNo: 2, action: 'revise' })],
    ]
    const itemFlow = await server.inject({
      method: 'GET',
      url: `/api/knowledge-team/items/${ITEM_ID}/revisions`,
      headers: AUTH,
    })
    expect(itemFlow.statusCode).toBe(200)
    expect(itemFlow.json().data).toHaveLength(1)

    scripted = [[spaceRow()], [{ role: 'viewer' }], [{ role: 'member' }], []]
    const spaceFlow = await server.inject({
      method: 'GET',
      url: `/api/knowledge-team/spaces/${SPACE_ID}/revisions?action=revise`,
      headers: AUTH,
    })
    expect(spaceFlow.statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------- 输入校验

describe('入参校验在业务逻辑之前', () => {
  it('非法 uuid ⇒ 400,不进任何查询', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/knowledge-team/spaces/${NOT_A_UUID}`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(400)
  })

  it('修正条目必须带 expectedRevision(缺了就无法检出并发覆盖)', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
      payload: { title: '只改标题' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('成员角色只认 owner/editor/viewer', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/spaces/${SPACE_ID}/members`,
      headers: AUTH,
      payload: { userId: USER_DAVE, role: 'superuser' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('版本冲突 ⇒ 409 并点名两个版本号', async () => {
    scripted = [
      [itemRow({ revision: 5 })],
      [spaceRow()],
      [{ role: 'editor' }],
      [{ role: 'member' }],
    ]
    const res = await server.inject({
      method: 'PUT',
      url: `/api/knowledge-team/items/${ITEM_ID}`,
      headers: AUTH,
      payload: { title: '基于旧版', expectedRevision: 1 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toContain('5')
    expect(insertCalls).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
