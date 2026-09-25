// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 归属校验回归:legacy-exam 面 `exam_signups`(user_id = uuid)四条同型敞口
// (2026-09-25,与刚收口的 exam.ts composition/signup 域同型,但**解法不同** ——
//  本表 user_id 本身就是 uuid、与 request.userId 同 ID 空间,归属**可证**,
//  所以这里是"按 uuid 归属放行",不是 exam.ts 那 7 处的 fail-close 到管理员档。)
//
// 四条敞口与本文件的对应关系(逐条一个变异对照,见下方 it 标题里的「变异口」):
//   ① GET  /exam/signups       归属缺省时退化成 sql`TRUE` ⇒ 整表可读
//   ② GET  /exam/signups/:id   只 authenticate、无归属校验 ⇒ 按 id 枚举他人详情
//   ③ POST /exam/signups       userId 由请求体自报 ⇒ 可伪造/污染任意用户
//   ④ GET  /exam/signups/check userId 由查询参数自报 ⇒ 存在性预言机(可枚举)
//
// 本文件刻意**不** mock plugins/auth.js:鉴权判据(JWT 验签 + roleId 提取)必须真跑,
// 否则"越权拿不到东西"这句结论就是被 mock 掉的授权判据自己给的 —— 那种绿等于没测。
// 被 mock 的只有数据库层(§5 测试隔离铁律:本仓测试禁止连生产 PG),以及 authenticate
// 内部那次按主键的用户状态查询(属 DB 访问,不是授权判据)。
//
// 关键设计:db mock 会**忠实执行** where —— 渲染 drizzle 条件为「列名 → 绑定值」配对,
// 按所有可识别列逐条过滤。因此:
//   - 修复前 `sql\`TRUE\``(零条件)⇒ 返回全表 ⇒ 用例 ① 必红;
//   - 修复前详情路由只有 `id` 条件 ⇒ 命中他人那行 ⇒ 用例 ② 必红;
//   - 修复前 check 用**自报**的 user_id ⇒ 命中他人那行 ⇒ 用例 ④ 必红。
// 判据认不出来的形态一律**不计入过滤**(宁可退回全表让断言红,也绝不让 mock 静默放行)。
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { signAccessToken } from '@ihui/auth'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 2026-08-06 起 authenticate 会查一次用户状态;1 = 正常。
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

interface SignupRow {
  id: string
  paperId: string
  userId: string
  status: string
  createdAt: Date
  updatedAt: Date
}

// mock 工厂在 import 求值期就被调用,它要用的夹具/判据/链式实现必须一起 hoisted。
const H = vi.hoisted(() => {
  /** users.id 的真实形态:uuid(不是 '1' 这种数字串 —— 那会掩盖 NaN 型缺陷)。 */
  const CALLER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  const OTHER = 'bbbbbbbb-2222-4222-9222-bbbbbbbbbbbb'
  const ADMIN = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee'
  const PAPER_A = 'cccccccc-3333-4333-8333-cccccccccccc'
  const PAPER_B = 'dddddddd-4444-4444-8444-dddddddddddd'
  const PAPER_NOBODY = 'ffffffff-6666-4666-8666-ffffffffffff'
  const MINE_1 = '11111111-1111-4111-8111-111111111111'
  const MINE_2 = '22222222-2222-4222-8222-222222222222'
  const THEIRS_1 = '33333333-3333-4333-8333-333333333333'
  const THEIRS_2 = '44444444-4444-4444-8444-444444444444'
  const NEVER_EXISTS = '99999999-9999-4999-8999-999999999999'

  const ROWS: SignupRow[] = [
    {
      id: MINE_1,
      paperId: PAPER_A,
      userId: CALLER,
      status: 'pending',
      createdAt: new Date('2026-09-01'),
      updatedAt: new Date('2026-09-01'),
    },
    {
      id: MINE_2,
      paperId: PAPER_B,
      userId: CALLER,
      status: 'confirmed',
      createdAt: new Date('2026-09-02'),
      updatedAt: new Date('2026-09-02'),
    },
    {
      id: THEIRS_1,
      paperId: PAPER_A,
      userId: OTHER,
      status: 'pending',
      createdAt: new Date('2026-09-03'),
      updatedAt: new Date('2026-09-03'),
    },
    {
      id: THEIRS_2,
      paperId: PAPER_B,
      userId: OTHER,
      status: 'confirmed',
      createdAt: new Date('2026-09-04'),
      updatedAt: new Date('2026-09-04'),
    },
  ]
  /** 表中出现过的全部归属 user_id(用于把绑定值认成"这是 user_id 的值")。 */
  const OWNER_IDS = new Set(ROWS.map((r) => r.userId))
  const PAPER_IDS = new Set([...ROWS.map((r) => r.paperId), PAPER_NOBODY])
  const SIGNUP_IDS = new Set(ROWS.map((r) => r.id))

  const state = {
    /** 本轮请求里路由向 db 发出的带 where 的查询次数(0 = 没走到查询 ⇒ 授权在查库之前) */
    whereSeen: 0,
    /** insert().values() 收到的行,用于断言写归属 */
    inserted: [] as Record<string, unknown>[],
    /** 取证:每次解析时收到的 where 渲染结果(定位 mock 与真实 SQL 的错位) */
    frags: [] as string[],
    cond: undefined as unknown,
  }

  interface Acc {
    tokens: Array<
      { kind: 'col'; name: string } | { kind: 'param'; value: unknown } | { kind: 'text' }
    >
  }

  /**
   * 把 drizzle 0.38 的 SQL 条件走成一串 token。
   * ⚠️ 0.38 的 `SQL` **没有** `toSQL()`,且 `queryChunks` 的元素不是裸字符串/列,而是
   * `StringChunk{value:<obj>}` / `PgColumn{name:'user_id',table:<obj>}` /
   * `Param{brand,value:<string>,encoder:<obj>}`(实测 5 段:chunk,列,chunk,参数,chunk)。
   * 注意 `StringChunk.value` 在本构建里不是字符串、`encoder` 不是函数 —— 找 toSQL 或按字符串
   * 比对都会得到空渲染,于是 mock 静默返回全表(判据看似在过滤其实一直没滤)。
   * 所以这里**只认结构**:列引用取 `name`+`table`,绑定值取 `value`+`encoder:object`。
   */
  function walk(ch: unknown, acc: Acc): void {
    if (ch === null || typeof ch !== 'object') return
    const o = ch as Record<string, unknown>
    if (Array.isArray(o.queryChunks)) {
      for (const inner of o.queryChunks) walk(inner, acc)
      return
    }
    if ('value' in o && typeof o.encoder === 'object') {
      acc.tokens.push({ kind: 'param', value: o.value }) // Param{brand,value,encoder}
      return
    }
    if (typeof o.name === 'string' && typeof o.table === 'object') {
      acc.tokens.push({ kind: 'col', name: o.name }) // 列引用 → 物理列名(user_id/paper_id/id)
    }
  }

  /** 列名 → 绑定值(按出现顺序配对;drizzle 渲染恒为 `"col" = ?`)。 */
  function pairsOf(cond: unknown): { pairs: Array<[string, unknown]>; text: string } | null {
    if (cond === null || typeof cond !== 'object') return null
    const o = cond as Record<string, unknown>
    if (!Array.isArray(o.queryChunks)) return null
    const acc: Acc = { tokens: [] }
    for (const ch of o.queryChunks) walk(ch, acc)
    const pairs: Array<[string, unknown]> = []
    let pendingCol: string | null = null
    for (const t of acc.tokens) {
      if (t.kind === 'col') {
        pendingCol = t.name
        continue
      }
      if (t.kind === 'param' && pendingCol !== null) {
        pairs.push([pendingCol, t.value])
        pendingCol = null
      }
    }
    return {
      pairs,
      text: JSON.stringify(acc.tokens.map((t) => t.kind + (t.kind === 'col' ? `:${t.name}` : ''))),
    }
  }

  /**
   * 忠实执行 where:对**每一个**可识别列(user_id / paper_id / id)按其绑定值过滤;
   * 零条件(修复前的 sql`TRUE`)⇒ 返回全表 —— 这正是让越权用例能真的拿到他人数据的机制。
   */
  function applyWhere(): SignupRow[] {
    const parsed = pairsOf(state.cond)
    state.frags.push(parsed ? parsed.text : String(state.cond))
    if (!parsed) return ROWS
    let rows = ROWS
    let applied = 0
    for (const [col, value] of parsed.pairs) {
      const v = typeof value === 'string' ? value : undefined
      if (col === 'user_id' && v !== undefined && OWNER_IDS.has(v)) {
        rows = rows.filter((r) => r.userId === v)
        applied += 1
      } else if (col === 'paper_id' && v !== undefined && PAPER_IDS.has(v)) {
        rows = rows.filter((r) => r.paperId === v)
        applied += 1
      } else if (col === 'id' && v !== undefined && SIGNUP_IDS.has(v)) {
        rows = rows.filter((r) => r.id === v)
        applied += 1
      } else if (col === 'id' || col === 'paper_id' || col === 'user_id') {
        // 条件在,但值不在夹具里 ⇒ 真库会返回空行,这里也必须给空
        rows = []
        applied += 1
      }
    }
    // 一个都没认出来 ⇒ 判据失效,绝不冒"过滤过了"的绿(退回全表让断言当场红)
    if (applied === 0 && parsed.pairs.length > 0) state.frags.push('!!unrecognized-condition-shape')
    return rows
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

  return {
    CALLER,
    OTHER,
    ADMIN,
    PAPER_A,
    PAPER_B,
    PAPER_NOBODY,
    MINE_1,
    THEIRS_1,
    NEVER_EXISTS,
    ROWS,
    state,
    applyWhere,
    makeChain,
  }
})

vi.mock('../../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => H.makeChain(() => H.applyWhere())),
    insert: vi.fn(() =>
      H.makeChain(() => {
        const last = H.state.inserted[H.state.inserted.length - 1] ?? {}
        return [
          {
            id: 'new-signup-id',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...last,
          },
        ]
      }),
    ),
    update: vi.fn(() => H.makeChain(() => [])),
    delete: vi.fn(() => H.makeChain(() => [])),
  },
}))

import { legacyExamRoutes } from '../legacy-exam.js'

async function bearer(userId: string, roleId: number): Promise<Record<string, string>> {
  const token = await signAccessToken({ userId, phone: '13800000000', familyId: 'f-1', roleId })
  return { authorization: `Bearer ${token}` }
}

/** 列表响应里的 user_id 集合(取不到 ⇒ 空数组,即"一条都没给")。 */
function ownerIdsIn(body: unknown): string[] {
  const list = (body as { list?: unknown } | null)?.list
  if (!Array.isArray(list)) return []
  return list.map((r) => String((r as { userId?: unknown }).userId))
}

describe('legacy-exam /exam/signups* 归属校验(四条同型敞口收口回归)', () => {
  let app: FastifyInstance
  let memberHeaders: Record<string, string> = {}
  let adminHeaders: Record<string, string> = {}

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 前缀与生产注册点逐字同形(apps/api/src/routes/index.ts 的
    // `server.register(legacyExamRoutes, { prefix: '/api/legacy' })`)
    await app.register(legacyExamRoutes, { prefix: '/api/legacy' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    H.state.whereSeen = 0
    H.state.inserted.length = 0
    H.state.frags.length = 0
    H.state.cond = undefined
    memberHeaders = await bearer(H.CALLER, 0)
    adminHeaders = await bearer(H.ADMIN, 1)
  })

  it('0) 探针:无凭据 ⇒ 401(证明真实 authenticate 在链上,没被 mock 掉)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/legacy/exam/signups' })
    expect(res.statusCode).toBe(401)
    expect(H.state.whereSeen).toBe(0)
  })

  // ---------- ① 整表可读(sql`TRUE` 兜底) ----------
  it('① 不带任何参数的列表 ⇒ 只有本人两行,他人两行一条都不给', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/legacy/exam/signups',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(200)
    // 变异口:把 conditions[0] 的 user_id 约束摘掉(修复前即 `sql\`TRUE\``)⇒ 此处 total=4 必红
    expect(ownerIdsIn(res.json())).toEqual([H.CALLER, H.CALLER])
    expect((res.json() as { total: number }).total).toBe(2)
  })

  it('①b 显式请求他人 userId ⇒ 403 + 零记录,且**未发出任何查询**(授权先于动作)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups?userId=${H.OTHER}`,
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(403)
    expect(ownerIdsIn(res.json())).toEqual([])
    expect(H.state.whereSeen).toBe(0)
  })

  it('①c 管理员也不得无界读数:不带 userId ⇒ 只有管理员自己(0 行),带他人 userId ⇒ 403', async () => {
    const anon = await app.inject({
      method: 'GET',
      url: '/api/legacy/exam/signups',
      headers: adminHeaders,
    })
    // 本面零调用方,故**不新增**"管理员读整表"这条能力(见路由文件注释)
    expect(ownerIdsIn(anon.json())).toEqual([])
    const cross = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups?userId=${H.OTHER}`,
      headers: adminHeaders,
    })
    expect(cross.statusCode).toBe(403)
    expect(ownerIdsIn(cross.json())).toEqual([])
  })

  // ---------- ② 详情无归属校验 ----------
  it('② 按他人报名的 id 读详情 ⇒ 404,且与"根本不存在的 id"**逐字节同形**(不再是预言机)', async () => {
    const theirs = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups/${H.THEIRS_1}`,
      headers: memberHeaders,
    })
    const missing = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups/${H.NEVER_EXISTS}`,
      headers: memberHeaders,
    })
    expect(theirs.statusCode).toBe(404)
    // 变异口:摘掉 and(...) 里的 user_id 约束 ⇒ theirs 返回 200 + 他人整行 ⇒ 两条断言同时红
    expect(missing.statusCode).toBe(404)
    expect(theirs.json()).toEqual(missing.json())
    expect(JSON.stringify(theirs.body)).toBe(JSON.stringify(missing.body))
    // 响应体里不得出现他人那行的任何字段
    expect(JSON.stringify(theirs.json())).not.toContain(H.OTHER)
  })

  // ---------- ③ 请求体自报 userId ----------
  it('③ POST 自报他人 userId ⇒ 写库的 user_id 仍是 JWT 身份(可伪造面关掉)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/legacy/exam/signups',
      headers: memberHeaders,
      payload: { examId: H.PAPER_A, userId: H.OTHER },
    })
    expect(res.statusCode).toBe(201)
    // 变异口:把 body 里的 userId 恢复成归属来源(`userId: body.userId`)⇒ 这里写入 OTHER ⇒ 红
    expect(H.state.inserted).toHaveLength(1)
    expect(H.state.inserted[0]?.userId).toBe(H.CALLER)
    expect((res.json() as { userId: string }).userId).toBe(H.CALLER)
  })

  it('③b 缺 userId 的正常自助报名仍然可用(反向对照:不是恒 403 式收口)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/legacy/exam/signups',
      headers: memberHeaders,
      payload: { examId: H.PAPER_A },
    })
    expect(res.statusCode).toBe(201)
    expect(H.state.inserted[0]?.userId).toBe(H.CALLER)
    expect(H.state.inserted[0]?.paperId).toBe(H.PAPER_A)
  })

  // ---------- ④ check 存在性预言机 ----------
  it('④ 用他人 userId 探测 ⇒ 403;传一个不存在的 uuid 也是同一 403(证明与存在性无关)', async () => {
    const probe = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups/check?examId=${H.PAPER_A}&userId=${H.OTHER}`,
      headers: memberHeaders,
    })
    const ghost = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups/check?examId=${H.PAPER_A}&userId=${H.NEVER_EXISTS}`,
      headers: memberHeaders,
    })
    // 变异口:恢复"自报 userId 即归属"的实现 ⇒ probe 返回 200 { signed:true, signup:他人整行 } ⇒ 红
    expect(probe.statusCode).toBe(403)
    expect(ghost.statusCode).toBe(403)
    expect(probe.json()).toEqual(ghost.json())
    expect(H.state.whereSeen).toBe(0)
    expect(JSON.stringify(probe.json())).not.toContain('signed') // 零数据形态,不泄露任何报名事实
  })

  it('④b 本人的探测语义完整可用:报了 ⇒ signed:true;没人报的试卷 ⇒ 同一形态 signed:false', async () => {
    const mine = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups/check?examId=${H.PAPER_A}`,
      headers: memberHeaders,
    })
    const nobody = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups/check?examId=${H.PAPER_NOBODY}`,
      headers: memberHeaders,
    })
    expect(mine.statusCode).toBe(200)
    expect((mine.json() as { signed: boolean }).signed).toBe(true)
    expect(nobody.statusCode).toBe(200)
    expect(nobody.json()).toEqual({ signed: false, signup: null })
  })

  // ---------- 反向对照:合法本人访问必须仍 200 ----------
  it('⑤ 反向对照:本人读自己的列表/详情/check 全部 200 且拿到自己的数据', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/legacy/exam/signups',
      headers: memberHeaders,
    })
    const detail = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups/${H.MINE_1}`,
      headers: memberHeaders,
    })
    const check = await app.inject({
      method: 'GET',
      url: `/api/legacy/exam/signups/check?examId=${H.PAPER_B}&userId=${H.CALLER}`,
      headers: memberHeaders,
    })
    expect(list.statusCode).toBe(200)
    expect(detail.statusCode).toBe(200)
    expect((detail.json() as { id: string; userId: string }).id).toBe(H.MINE_1)
    expect((detail.json() as { userId: string }).userId).toBe(H.CALLER)
    expect(check.statusCode).toBe(200)
    expect((check.json() as { signed: boolean }).signed).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
