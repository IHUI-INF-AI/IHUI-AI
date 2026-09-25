// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 归属校验回归:GET / POST /exam/composition/signup*(2026-09-25 数据泄露级 P0 修复的取证)
//
// 本文件刻意**不** mock @ihui/auth,也**不** mock plugins/auth.js:鉴权判据(JWT 验签 +
// roleId 提取 + isSystemAdmin 管理员档位)必须真跑,否则"越权拿不到东西"这句结论就是被
// mock 掉的授权判据自己给的 —— 那种绿等于没测。被 mock 的只有数据库层(本仓测试禁止连
// 生产 PG),以及 authenticate 内部那次按主键的用户状态查询(属 DB 访问,不是授权判据)。
//
// 关键设计:db mock 会**忠实执行** where 条件 —— 条件里不含 member_id 约束(即修复前的
// sql`TRUE`)就返回全表。因此把 exam.ts 的兜底改回原样,用例 1/2/3 必然变红。
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { signAccessToken } from '@ihui/auth'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 2026-08-06 起 authenticate 会查一次用户状态;1 = 正常。
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

interface SqlFragment {
  sql: string
  params: unknown[]
}
interface SignupRow {
  id: number
  memberId: number
  examId: number
  status: string
  completedTime: Date | null
  createdAt: Date
  updatedAt: Date
}

// mock 工厂在 import 求值期就被调用,所以它要用的夹具/判据/链式实现必须一起 hoisted,
// 不能留在测试模块体里(那时还没执行)。
const H = vi.hoisted(() => {
  /** 两个不同 edu 会员各自的报名记录:member 7 两条 / member 9 两条。 */
  const ROWS: SignupRow[] = [
    {
      id: 1,
      memberId: 7,
      examId: 101,
      status: 'signed',
      completedTime: null,
      createdAt: new Date('2026-09-01'),
      updatedAt: new Date('2026-09-01'),
    },
    {
      id: 2,
      memberId: 7,
      examId: 102,
      status: 'signed',
      completedTime: null,
      createdAt: new Date('2026-09-02'),
      updatedAt: new Date('2026-09-02'),
    },
    {
      id: 3,
      memberId: 9,
      examId: 101,
      status: 'signed',
      completedTime: null,
      createdAt: new Date('2026-09-03'),
      updatedAt: new Date('2026-09-03'),
    },
    {
      id: 4,
      memberId: 9,
      examId: 103,
      status: 'pending',
      completedTime: null,
      createdAt: new Date('2026-09-04'),
      updatedAt: new Date('2026-09-04'),
    },
  ]

  const state = {
    /** 本轮请求里路由向 db 发出的带 where 的查询次数(0 = 没走到查询,授权在其之前) */
    whereSeen: 0,
    /** insert().values() 收到的行,用于断言写归属 */
    inserted: [] as Record<string, unknown>[],
    /** 取证:每次解析时收到的 where 条件渲染结果(定位 mock 与真实 SQL 的错位) */
    frags: [] as string[],
    cond: undefined as unknown,
  }

  /**
   * 把 drizzle 0.38 的 SQL 条件渲染成 { sql, params }。
   * ⚠️ 0.38 的 `SQL` **没有** `toSQL()`,且 `queryChunks` 的元素不是裸字符串/列,而是
   * `StringChunk{value:<obj>}` / `PgInteger{name:'member_id',table:<obj>}` /
   * `Param{brand,value:<number>,encoder:<obj>}`(实测 5 段:chunk,列,chunk,参数,chunk)。
   * 注意 `StringChunk.value` 在本构建里不是字符串、`encoder` 不是函数 ——
   * 找 toSQL 或按字符串比对都会得到空渲染,
   * 于是 mock 静默返回全表 —— 判据看似在过滤其实一直没滤(本文件前两版都这么错,
   * 由用例 4 的 total=4 抓到)。认不出来的形态一律**不计入过滤**,宁可退回全表让断言红。
   */
  function renderChunk(ch: unknown, acc: { text: string; params: unknown[] }): void {
    if (typeof ch === 'string') {
      acc.text += ch
      return
    }
    if (ch === null || typeof ch !== 'object') return
    const o = ch as Record<string, unknown>
    if (Array.isArray(o.queryChunks)) {
      renderChunks(o.queryChunks, acc)
      return
    }
    if ('value' in o && typeof o.encoder === 'object') {
      acc.params.push(o.value) // Param{brand,value,encoder}:绑定值(memberId = 7)
      acc.text += '?'
      return
    }
    if (typeof o.value === 'string') {
      acc.text += o.value
      return
    }
    if (typeof o.name === 'string' && typeof o.table === 'object') {
      acc.text += o.name // 列引用 → 物理列名(member_id / exam_id / …)
    }
  }

  function renderChunks(chunks: unknown, acc: { text: string; params: unknown[] }): void {
    if (!Array.isArray(chunks)) return
    for (const ch of chunks) renderChunk(ch, acc)
  }

  function toSqlFragment(cond: unknown): SqlFragment | null {
    if (cond === null || typeof cond !== 'object') return null
    const chunks = (cond as Record<string, unknown>).queryChunks
    if (!Array.isArray(chunks)) return null
    const acc = { text: '', params: [] as unknown[] }
    renderChunks(chunks, acc)
    return { sql: acc.text, params: acc.params }
  }

  /**
   * 忠实执行 where:含 member_id 等值约束则按该值过滤,否则**返回全表**。
   * 后者正是修复前 sql`TRUE` 的行为,使越权用例能真的拿到他人数据。
   */
  function applyWhere(): SignupRow[] {
    const frag = toSqlFragment(state.cond)
    state.frags.push(frag ? `${frag.sql} :: ${JSON.stringify(frag.params)}` : String(state.cond))
    if (!frag || !/member_id/.test(frag.sql)) return ROWS
    const wanted = frag.params.find((p): p is number => typeof p === 'number')
    if (wanted === undefined) return ROWS
    return ROWS.filter((r) => r.memberId === wanted)
  }

  interface Chain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => Chain
    where: (cond: unknown) => Chain
    orderBy: () => Chain
    limit: () => Chain
    offset: () => Chain
    values: (v: Record<string, unknown>) => Chain
    returning: () => Chain
  }

  function makeChain(resolve: () => unknown[]): Chain {
    const self: Chain = {
      then: (r) => Promise.resolve(resolve()).then(r),
      from: () => self,
      where: (c) => {
        state.cond = c
        state.whereSeen += 1
        return self
      },
      orderBy: () => self,
      limit: () => self,
      offset: () => self,
      values: (v) => {
        state.inserted.push(v)
        return self
      },
      returning: () => self,
    }
    return self
  }

  return { ROWS, state, applyWhere, makeChain }
})

vi.mock('../../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    // select() 无参 = 取行;select({ count }) = 取计数(aggregate 形态)
    select: vi.fn((sel?: unknown) =>
      H.makeChain(() => (sel === undefined ? H.applyWhere() : [{ count: H.applyWhere().length }])),
    ),
    insert: vi.fn(() =>
      H.makeChain(() => {
        const last = H.state.inserted[H.state.inserted.length - 1] ?? {}
        return [
          {
            id: 1,
            examId: 0,
            memberId: 0,
            status: 'pending',
            completedTime: null,
            createdAt: new Date('2026-09-05'),
            updatedAt: new Date('2026-09-05'),
            ...last,
          },
        ]
      }),
    ),
    update: vi.fn(() => H.makeChain(() => [])),
    delete: vi.fn(() => H.makeChain(() => [])),
  },
}))

import { examRoutes } from '../exam.js'

/** users.id 的真实形态:uuid 字符串(不是 '1' 这种数字串 —— 那会掩盖 NaN 缺陷)。 */
const CALLER_UUID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const ADMIN_UUID = 'bbbbbbbb-2222-4222-9222-bbbbbbbbbbbb'
const OTHER_MEMBER_ID = 9

async function bearer(userId: string, roleId: number): Promise<Record<string, string>> {
  const token = await signAccessToken({ userId, phone: '13800000000', familyId: 'f-1', roleId })
  return { authorization: `Bearer ${token}` }
}

/** 从响应体里取出报名记录数组(没有 / 形状不对 ⇒ 空,即"什么都没拿到")。 */
function recordsIn(body: unknown): SignupRow[] {
  const list = (body as { data?: { list?: unknown } } | null)?.data?.list
  return Array.isArray(list) ? (list as SignupRow[]) : []
}

describe('/exam/composition/signup 归属校验(P0 数据泄露回归)', () => {
  let app: FastifyInstance
  let memberHeaders: Record<string, string> = {}
  let adminHeaders: Record<string, string> = {}

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(examRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    H.state.whereSeen = 0
    H.state.inserted.length = 0
    H.state.cond = undefined
    memberHeaders = await bearer(CALLER_UUID, 0)
    adminHeaders = await bearer(ADMIN_UUID, 1)
  })

  it('0) 探针:无凭据 ⇒ 401(证明真实 checkAuth 在链上,没被 mock 掉)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/exam/composition/signup/my' })
    expect(res.statusCode).toBe(401)
  })

  it('0b) 探针:uuid 形态 token 能过鉴权 ⇒ 后续 403 是授权判定而非鉴权失败', async () => {
    // 管理员带 memberId 能拿到 200(见用例 4),而这里确认普通用户的 uuid token 不会被误判成 401
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/my?memberId=7',
      headers: memberHeaders,
    })
    expect(res.statusCode).not.toBe(401)
  })

  it('1) 普通用户 + uuid 身份 + 不带 memberId ⇒ 一条记录都拿不到', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/my',
      headers: memberHeaders,
    })
    // 比"返回 403"更强:响应体里不含任何报名记录(修复前此处是全表 4 条,含 member 9 的)
    expect(recordsIn(res.json())).toEqual([])
    expect(res.statusCode).toBe(403)
    expect(H.state.whereSeen).toBe(0) // 授权在查库之前拦下,根本没发出无约束查询
  })

  it('2) 普通用户显式请求他人 memberId=9 ⇒ 同样拿不到他人记录', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/exam/composition/signup/my?memberId=${OTHER_MEMBER_ID}`,
      headers: memberHeaders,
    })
    expect(recordsIn(res.json())).toEqual([])
    expect(res.statusCode).toBe(403)
    expect(H.state.whereSeen).toBe(0)
  })

  it('3) 管理员不带 memberId ⇒ 400,绝不退化成全表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/my',
      headers: adminHeaders,
    })
    expect(res.statusCode).toBe(400)
    expect(recordsIn(res.json())).toEqual([])
    expect(H.state.whereSeen).toBe(0)
  })

  it('4) 正向对照:管理员带 memberId=7 ⇒ 只回 7 的两条,不含 9 的任何一条', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/my?memberId=7',
      headers: adminHeaders,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { list: { userId: string }[]; total: number } }
    expect(body.data.total, `where 取证: ${JSON.stringify(H.state.frags)}`).toBe(2)
    expect(body.data.list).toHaveLength(2)
    expect(body.data.list.every((r) => r.userId === '7')).toBe(true)
    expect(body.data.list.some((r) => r.userId === String(OTHER_MEMBER_ID))).toBe(false)
    expect(H.state.whereSeen).toBe(2) // 列表查询 + count 查询都带了 member_id 约束
  })

  it('5) POST:普通用户不得代他人写 member_id(一行都不落库)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: memberHeaders,
      payload: { eid: 101, memberId: OTHER_MEMBER_ID },
    })
    expect(res.statusCode).toBe(403)
    expect(H.state.inserted).toHaveLength(0)
  })

  it('6) POST 自助报名(saveSignUp 的 { eid } 载荷形态)⇒ 403,不再静默写到 member_id=0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: memberHeaders,
      payload: { eid: 101 },
    })
    expect(res.statusCode).toBe(403)
    expect(H.state.inserted).toHaveLength(0)
  })

  it('7) 管理员显式 memberId ⇒ 201,且写入归属就是该值', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: adminHeaders,
      payload: { eid: 101, memberId: 7 },
    })
    expect(res.statusCode).toBe(201)
    expect(H.state.inserted[0]).toMatchObject({ memberId: 7, examId: 101 })
    expect((res.json() as { data: { userId: string } }).data.userId).toBe('7')
  })

  it('8) 管理员不带 memberId ⇒ 400(而不是把 0 当归属写进表)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: adminHeaders,
      payload: { eid: 101 },
    })
    expect(res.statusCode).toBe(400)
    expect(H.state.inserted).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
