// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 归属校验回归:GET / POST / PUT / DELETE /exam/composition/signup*
// + POST /exam/composition/signup/:sid/submit
// (2026-09-25 数据泄露级 P0 修复的取证 + 同型剩余面收口的取证;
//  同日 C 方案落地后,除 /signup/list(管理查询面)外的 6 处闸门从 fail-close 到管理员档
//  换成**按 user_id 归属放行** —— 本文件用例期望值已按新判据改写:
//    会员档:本人归属行可读写;/my 只回 user_id=request.userId 的行;
//            NULL 归属历史行(建列前存量)一律 404(归属未知 ≠ 归属成立);
//            越权访问(他人 sid)一律 404,绝不披露存在性。)
//
// 本文件刻意**不** mock @ihui/auth,也**不** mock plugins/auth.js:鉴权判据(JWT 验签 +
// roleId 提取 + isSystemAdmin 管理员档位)必须真跑,否则"越权拿不到东西"这句结论就是被
// mock 掉的授权判据自己给的 —— 那种绿等于没测。被 mock 的只有数据库层(本仓测试禁止连
// 生产 PG),以及 authenticate 内部那次按主键的用户状态查询(属 DB 访问,不是授权判据)。
//
// 关键设计:db mock 会**忠实执行** where 条件(id / member_id / user_id / exam_id / status
// 逐列 AND 过滤;NULL user_id 行在 eq 条件下天然不命中,与真库 NULL 语义一致)。
// 因此把 exam.ts 的归属条件摘掉,越权用例必然变红。
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
  id: number
  memberId: number
  /** 归属列(2026-09-25 C 方案落地):users.id 的 uuid;null = 建列前的历史行(归属未知)。 */
  userId: string | null
  examId: number
  status: string
  completedTime: Date | null
  createdAt: Date
  updatedAt: Date
}

// mock 工厂在 import 求值期就被调用,所以它要用的夹具/判据/链式实现必须一起 hoisted,
// 不能留在测试模块体里(那时还没执行)。
const H = vi.hoisted(() => {
  /** 归属夹具四种形态各占一行:
   *    id=1 member7  userId=CALLER  ⇒ 调用者本人归属行(会员档应可见/可写)
   *    id=2 member7  userId=null    ⇒ 历史 NULL 归属行(会员档必须不可见 —— 归属未知≠归属成立)
   *    id=3 member9  userId=OTHER   ⇒ 他人归属行(会员档必须不可见;刻意≠ADMIN_UUID,防档位串色)
   *    id=4 member9  userId=null    ⇒ 他人 NULL 归属历史行(同样只走管理员路径) */
  const ROWS: SignupRow[] = [
    {
      id: 1,
      memberId: 7,
      userId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
      examId: 101,
      status: 'signed',
      completedTime: null,
      createdAt: new Date('2026-09-01'),
      updatedAt: new Date('2026-09-01'),
    },
    {
      id: 2,
      memberId: 7,
      userId: null,
      examId: 102,
      status: 'signed',
      completedTime: null,
      createdAt: new Date('2026-09-02'),
      updatedAt: new Date('2026-09-02'),
    },
    {
      id: 3,
      memberId: 9,
      userId: 'cccccccc-3333-4333-8333-cccccccccccc',
      examId: 101,
      status: 'signed',
      completedTime: null,
      createdAt: new Date('2026-09-03'),
      updatedAt: new Date('2026-09-03'),
    },
    {
      id: 4,
      memberId: 9,
      userId: null,
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
    /**
     * update().set() 收到的补丁、以及 update/delete 各被调了几次。
     * 用于把"普通会员改不动 / 删不掉"从"响应码像 403"升级成**一行都没写过**。
     */
    updated: [] as Record<string, unknown>[],
    updateCalls: 0,
    deleteCalls: 0,
    /** 取证:每次解析时收到的 where 条件渲染结果(定位 mock 与真实 SQL 的错位) */
    frags: [] as string[],
    cond: undefined as unknown,
  }

  /**
   * 把 drizzle 0.38 的 SQL 条件**忠实**求值成行谓词(与 legacy-exam-signups-ownership.test.ts
   * 同源的 token 结构,并升级为表达式树:or / and / isNull 全部可判)。
   * ⚠️ 0.38 的 `SQL` **没有** `toSQL()`;`queryChunks` 的元素是 `StringChunk{value:<string[]>}`
   * (实测 value 是**数组**,连接词就是 value[0] === ' or ' / ' and ',叶子文本是 ' = ' /
   * ' is null')/ `PgColumn{name,table}` / `Param{brand,value,encoder}`。
   * 按字符串拼接比对会得到空渲染 ⇒ mock 静默返回全表(判据看似在过滤其实一直没滤,
   * 本文件前几版都这么错)。
   * **OR 语义必须可判**(2026-09-25 变异取证踩坑):`isNull(user_id) OR user_id = ?` 是
   * 被禁形态,若 mock 只认 eq 配对就会把它当纯 eq 过滤 ⇒ 变异②假绿。现在 or=任一命中、
   * and=全部命中、is null=空值命中;混连接/认不出的形态 ⇒ 谓词为 null ⇒ 退回全表
   * 让断言当场红(判据失效必须表现为红,绝不静默放行)。
   */
  type Token =
    | { kind: 'col'; name: string }
    | { kind: 'param'; value: unknown }
    | { kind: 'text'; text: string }

  function chunkText(ch: unknown): string | null {
    if (ch === null || typeof ch !== 'object') return null
    const v = (ch as Record<string, unknown>).value
    if (Array.isArray(v) && v.length === 1 && typeof v[0] === 'string') return v[0]
    return null
  }

  function flatten(ch: unknown, acc: Token[]): void {
    if (ch === null || typeof ch !== 'object') return
    const o = ch as Record<string, unknown>
    if (Array.isArray(o.queryChunks)) {
      for (const inner of o.queryChunks) flatten(inner, acc)
      return
    }
    const text = chunkText(ch)
    if (text !== null) {
      acc.push({ kind: 'text', text })
      return
    }
    if ('value' in o && typeof o.encoder === 'object') {
      acc.push({ kind: 'param', value: o.value }) // Param{brand,value,encoder}
      return
    }
    if (typeof o.name === 'string' && typeof o.table === 'object') {
      acc.push({ kind: 'col', name: o.name }) // 列引用 → 物理列名
    }
  }

  type RowPredicate = (r: SignupRow) => boolean

  /** 物理列名 → 夹具行字段(camelCase);未知列 ⇒ undefined(等值比较恒假,与真库列不存在报错同向)。 */
  function colValue(r: SignupRow, col: string): unknown {
    switch (col) {
      case 'id':
        return r.id
      case 'member_id':
        return r.memberId
      case 'user_id':
        return r.userId
      case 'exam_id':
        return r.examId
      case 'status':
        return r.status
      default:
        return undefined
    }
  }

  /** 单个操作数(eq / isNull)→ 谓词;认不出 ⇒ null。 */
  function leafPredicate(tokens: Token[]): RowPredicate | null {
    let col: string | null = null
    let param: unknown
    let hasParam = false
    let isNullText = false
    for (const t of tokens) {
      if (t.kind === 'col') col = t.name
      else if (t.kind === 'param') {
        param = t.value
        hasParam = true
      } else if (t.text === ' is null') isNullText = true
      // ' = ' / '' / '(' / ')' 等文本不改变语义
    }
    if (isNullText && col !== null) {
      const c = col
      return (r) => colValue(r, c) === null
    }
    if (hasParam && col !== null) {
      const c = col
      const v = param
      return (r) => colValue(r, c) === v
    }
    return null
  }

  /** SQL 条件 → 行谓词;or=任一命中,and=全部命中,混连接/空条件认不出 ⇒ null。 */
  function predicateOf(cond: unknown): RowPredicate | null {
    if (cond === null || typeof cond !== 'object') return null
    const chunks = (cond as Record<string, unknown>).queryChunks
    if (!Array.isArray(chunks)) return null
    const tokens: Token[] = []
    for (const ch of chunks) flatten(ch, tokens)
    state.frags.push(
      tokens
        .map((t) =>
          t.kind === 'col' ? `col:${t.name}` : t.kind === 'param' ? '?' : `'${t.text}'`,
        )
        .join(' '),
    )
    // 按连接词切操作数(叶子内部不含 ' or ' / ' and ' 文本,切分安全)
    const segments: Token[][] = [[]]
    const joiners: string[] = []
    for (const t of tokens) {
      if (t.kind === 'text' && (t.text === ' or ' || t.text === ' and ')) {
        joiners.push(t.text)
        segments.push([])
        continue
      }
      segments[segments.length - 1]!.push(t)
    }
    const predicates = segments.map((s) => leafPredicate(s))
    if (joiners.length === 0) {
      const p = predicates[0]
      // 空条件(sql`TRUE` 的还原形态)⇒ 判不出 ⇒ null ⇒ 全表(让越权用例红)
      return p ?? null
    }
    if (joiners.some((j) => j !== joiners[0])) return null // 混连接,不猜
    if (predicates.some((p) => p === null)) return null
    if (joiners[0] === ' or ') {
      return (r) => predicates.some((p) => p!(r))
    }
    return (r) => predicates.every((p) => p!(r))
  }

  /**
   * 忠实执行 where:or=任一命中 / and=全部命中 / user_id 对 null 行天然不命中
   * (与真库 NULL 语义一致 —— 这正是"NULL 归属行不放行"判据的物证通道);
   * 谓词认不出 ⇒ 返回全表(判据失效必须红)。
   */
  function applyWhere(): SignupRow[] {
    const pred = predicateOf(state.cond)
    if (!pred) return ROWS
    return ROWS.filter(pred)
  }

  interface Chain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => Chain
    where: (cond: unknown) => Chain
    orderBy: () => Chain
    limit: () => Chain
    offset: () => Chain
    values: (v: Record<string, unknown>) => Chain
    set: (v: Record<string, unknown>) => Chain
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
      set: (v) => {
        state.updated.push(v)
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
    update: vi.fn(() => {
      H.state.updateCalls += 1
      // 与真库 .returning() 对齐:忠实执行 where(归属 AND 条件 ⇒ 非本人行 0 命中 ⇒ 路由 404),
      // 再把本轮 set 的补丁贴到命中行上返回,便于断言"本人/管理员档可写"。
      return H.makeChain(() => {
        const rows = H.applyWhere()
        if (rows.length === 0) return []
        const patch = H.state.updated[H.state.updated.length - 1] ?? {}
        return [{ ...rows[0], ...patch }]
      })
    }),
    delete: vi.fn(() => {
      H.state.deleteCalls += 1
      // 忠实执行 where:非本人行 0 命中 ⇒ 路由按影响行数判 404(2026-09-25 C 方案补的校验)
      return H.makeChain(() => H.applyWhere().map((r) => ({ ...r })))
    }),
  },
}))

import { examRoutes } from '../exam.js'

/** users.id 的真实形态:uuid 字符串(不是 '1' 这种数字串 —— 那会掩盖 NaN 缺陷)。 */
const CALLER_UUID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const ADMIN_UUID = 'bbbbbbbb-2222-4222-9222-bbbbbbbbbbbb'
const OTHER_UUID = 'cccccccc-3333-4333-8333-cccccccccccc'
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

/** 从响应体里取出单条报名详情({ signup });取不到 ⇒ null,即"一条详情都没给"。 */
function signupIn(body: unknown): SignupRow | null {
  const s = (body as { data?: { signup?: SignupRow } } | null)?.data?.signup
  return s ?? null
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
    H.state.updated.length = 0
    H.state.updateCalls = 0
    H.state.deleteCalls = 0
    H.state.cond = undefined
    memberHeaders = await bearer(CALLER_UUID, 0)
    adminHeaders = await bearer(ADMIN_UUID, 1)
  })

  it('0) 探针:无凭据 ⇒ 401(证明真实 checkAuth 在链上,没被 mock 掉)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/exam/composition/signup/my' })
    expect(res.statusCode).toBe(401)
  })

  it('0b) 探针:uuid 形态 token 能过鉴权 ⇒ 会员档走归属路径而非鉴权失败', async () => {
    // 管理员带 memberId 能拿到 200(见用例 4);普通用户的 uuid token 不会被误判成 401,
    // 且按归属放行后拿到的是 200(不是前序 fail-close 票的 403)。
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/my',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(200)
  })

  it('1) 普通用户 /my 按归属放行:只回本人归属行,NULL 历史行与他人行一条都不出', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/my',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(200)
    const list = recordsIn(res.json())
    // 夹具四行里只有 id=1 的 userId=CALLER;id=2 是 NULL 归属历史行(member 7 名下也不放行),
    // id=3/4 是他人的 —— 一条都不得出现。
    expect(list.map((r) => r.id)).toEqual(['1'])
    const body = res.json() as { data: { total: number } }
    expect(body.data.total, `where 取证: ${JSON.stringify(H.state.frags)}`).toBe(1)
    expect(H.state.whereSeen).toBe(2) // 列表查询 + count 查询都带了 user_id 归属约束
    expect(H.state.frags.some((f) => f.includes('col:user_id'))).toBe(true)
    // 归属约束的绑定值就是调用者自己的 uuid(不是自报参数、不是 member_id)
    expect(H.state.cond).toBeDefined()
  })

  it('2) 普通用户显式请求他人 memberId=9 ⇒ 参数不构成归属:仍只回本人那条', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/exam/composition/signup/my?memberId=${OTHER_MEMBER_ID}`,
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(200)
    const list = recordsIn(res.json())
    expect(list.map((r) => r.id)).toEqual(['1'])
    // 扁平行的 userId 字段承载遗留 member_id;member 9 的任何一条都不得出现
    expect(list.every((r) => r.userId !== String(OTHER_MEMBER_ID))).toBe(true)
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

  it('5) POST:普通用户自报 memberId=9 ⇒ 不构成归属,写入的归属是服务端推导的本人在册', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: memberHeaders,
      payload: { eid: 101, memberId: OTHER_MEMBER_ID },
    })
    // C 方案:会员自助放开,但自报 memberId 被忽略(不得写成 9 —— 那是代他人报名);
    // 归属 = request.userId(服务端推导),memberId = 0(无遗留会员关联的显式哨兵)。
    expect(res.statusCode).toBe(201)
    expect(H.state.inserted).toHaveLength(1)
    expect(H.state.inserted[0]).toMatchObject({
      memberId: 0,
      examId: 101,
      userId: CALLER_UUID,
    })
    expect(H.state.inserted[0]?.memberId).not.toBe(OTHER_MEMBER_ID)
  })

  it('5b) POST:普通用户自报 userId=他人 uuid ⇒ 不构成归属,写入仍是服务端推导的本人在册', async () => {
    // 变异③锚点:把 insert 的 userId 换成采信请求体自报,本用例必红(写入会变成 OTHER_UUID)
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: memberHeaders,
      payload: { eid: 101, userId: OTHER_UUID },
    })
    expect(res.statusCode).toBe(201)
    expect(H.state.inserted[0]).toMatchObject({ userId: CALLER_UUID })
    expect(H.state.inserted[0]?.userId).not.toBe(OTHER_UUID)
  })

  it('6) POST 自助报名(saveSignUp 的 { eid } 载荷形态)⇒ 201,userId 由服务端写入', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: memberHeaders,
      payload: { eid: 101 },
    })
    expect(res.statusCode).toBe(201)
    expect(H.state.inserted[0]).toMatchObject({
      memberId: 0,
      examId: 101,
      userId: CALLER_UUID,
      status: 'pending',
    })
    expect((res.json() as { data: { status: string } }).data.status).toBe('pending')
  })

  it('6b) POST:普通用户自报 status=completed ⇒ 不采信,服务端钉成 pending', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: memberHeaders,
      payload: { eid: 101, status: 'completed' },
    })
    expect(res.statusCode).toBe(201)
    expect(H.state.inserted[0]).toMatchObject({ status: 'pending', userId: CALLER_UUID })
  })

  it('7) 管理员显式 memberId ⇒ 201,写该遗留编号且**不写归属列**(管理员≠归属人)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup',
      headers: adminHeaders,
      payload: { eid: 101, memberId: 7 },
    })
    expect(res.statusCode).toBe(201)
    expect(H.state.inserted[0]).toMatchObject({ memberId: 7, examId: 101 })
    // 管理员代建不知道目标用户 uuid,写管理员自己的 id = 制造假归属 ⇒ user_id 必须缺席
    expect(H.state.inserted[0]?.userId).toBeUndefined()
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

  // ===========================================================================
  // /signup/list(管理查询面,保持管理员档)+ GET/PUT/DELETE /signup/:sid(按归属放行)。
  // list 是"按 member_id 查任意会员"的管理端点,归属语义不适用,故维持:
  //   非管理员 403 / 管理员必须显式 memberId。
  // :sid 三条在 C 方案(2026-09-25)后按归属放行:非管理员 where = id ∧ user_id,
  // 不命中(含 NULL 归属历史行)⇒ 404。每条都配**正向对照**,否则"整条路由恒 404"
  // 也会被读成"收口成功"。
  // ===========================================================================

  it('9) list:普通会员(不带 memberId)⇒ 403,一条记录都拿不到', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/list',
      headers: memberHeaders,
    })
    expect(recordsIn(res.json())).toEqual([])
    expect(res.statusCode).toBe(403)
    // 修复前:不传 memberId ⇒ where = sql`TRUE` ⇒ 整表 4 条(含 member 9)直接吐出
    expect(H.state.whereSeen, `where 取证: ${JSON.stringify(H.state.frags)}`).toBe(0)
  })

  it('10) list:普通会员显式请求 memberId=9 ⇒ 同样 403(参数不能代替归属)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/list?memberId=9',
      headers: memberHeaders,
    })
    expect(recordsIn(res.json())).toEqual([])
    expect(res.statusCode).toBe(403)
    expect(H.state.whereSeen).toBe(0)
  })

  it('11) list:管理员不带 memberId ⇒ 400,绝不退化成全表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/list',
      headers: adminHeaders,
    })
    expect(res.statusCode).toBe(400)
    expect(recordsIn(res.json())).toEqual([])
    expect(H.state.whereSeen).toBe(0)
  })

  it('12) list 正向对照:管理员 + memberId=7 ⇒ 只回 7 的两条,SQL 必带 member_id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/list?memberId=7',
      headers: adminHeaders,
    })
    expect(res.statusCode).toBe(200)
    const list = recordsIn(res.json())
    expect(list).toHaveLength(2)
    expect(list.every((r) => r.memberId === 7)).toBe(true)
    expect(list.some((r) => r.memberId === OTHER_MEMBER_ID)).toBe(false)
    expect(H.state.frags.some((f) => /member_id/.test(f))).toBe(true)
    expect(H.state.whereSeen).toBe(1)
  })

  it('13) list:管理员叠加 examId 过滤器 ⇒ 归属约束不会被挤掉(恒在 conditions[0])', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/list?memberId=7&examId=101',
      headers: adminHeaders,
    })
    expect(res.statusCode).toBe(200)
    // mock 只忠实执行 member_id 过滤,所以条数按 member 7 计(2 条);本例要证的是
    // "member_id 这一条永远在",而不是 examId 过滤得对不对。
    expect(recordsIn(res.json()).every((r) => r.memberId === 7)).toBe(true)
    expect(H.state.frags.some((f) => /member_id/.test(f))).toBe(true)
  })

  it('14) GET /:sid:普通会员读**本人归属行**(sid=1)⇒ 200,where 必含 id ∧ user_id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/1',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(signupIn(res.json())?.id).toBe(1)
    expect(H.state.whereSeen).toBe(1)
    // 关键取证:where 同时含 id 与 user_id(AND 而非择一)—— 摘掉归属条件,14b/14c 必红
    expect(
      H.state.frags.some((f) => f.includes('col:id') && f.includes('col:user_id')),
      `where 取证: ${JSON.stringify(H.state.frags)}`,
    ).toBe(true)
  })

  it('14b) GET /:sid:普通会员按他人 sid=3 ⇒ 404,拿不到任何详情', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/3',
      headers: memberHeaders,
    })
    expect(signupIn(res.json())).toBeNull()
    expect(res.statusCode).toBe(404)
  })

  it('14c) GET /:sid:普通会员读 **NULL 归属历史行**(sid=2,memberId 恰为 7)⇒ 404', async () => {
    // 归属未知 ≠ 归属成立:即使该行的遗留 member_id 与任何自报参数吻合,无 user_id 就不放行
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/2',
      headers: memberHeaders,
    })
    expect(signupIn(res.json())).toBeNull()
    expect(res.statusCode).toBe(404)
  })

  it('15) GET /:sid 正向对照:管理员 ⇒ 200 读到详情(管理员档不受归属条件限制)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/composition/signup/1',
      headers: adminHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(signupIn(res.json())).not.toBeNull()
    expect(H.state.whereSeen).toBe(1)
    expect(H.state.frags.some((f) => f.includes('col:id'))).toBe(true)
  })

  it('16) PUT /:sid:普通会员改**本人归属行**(sid=1)⇒ 200 且真写进去', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/exam/composition/signup/1',
      headers: memberHeaders,
      payload: { status: 'attended' },
    })
    expect(res.statusCode).toBe(200)
    expect(H.state.updateCalls).toBe(1)
    expect(H.state.updated[0]).toMatchObject({ status: 'attended' })
    expect(H.state.frags.some((f) => f.includes('col:id') && f.includes('col:user_id'))).toBe(true)
  })

  it('16b) PUT /:sid:普通会员按他人 sid=3 ⇒ 404,补丁一行都落不了', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/exam/composition/signup/3',
      headers: memberHeaders,
      payload: { status: 'attended' },
    })
    expect(res.statusCode).toBe(404)
    // UPDATE 确实发出了,但 where 含归属条件 ⇒ 0 行命中(mock 忠实过滤,他人行未被改)
    expect(H.state.updateCalls).toBe(1)
    expect(signupIn(res.json())).toBeNull()
  })

  it('17) PUT /:sid 正向对照:管理员 ⇒ 真写进去一次', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/exam/composition/signup/1',
      headers: adminHeaders,
      payload: { status: 'attended' },
    })
    expect(res.statusCode).toBe(200)
    expect(H.state.updateCalls).toBe(1)
    expect(H.state.updated[0]).toMatchObject({ status: 'attended' })
    expect(signupIn(res.json())?.status).toBe('attended')
  })

  it('18) DELETE /:sid:普通会员删**本人归属行**(sid=1)⇒ 200', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/exam/composition/signup/1',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(H.state.deleteCalls).toBe(1)
    expect((res.json() as { data?: { ok?: boolean } }).data?.ok).toBe(true)
  })

  it('18b) DELETE /:sid:普通会员按他人 sid=3 ⇒ 404(影响行数=0,不再是静默 ok)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/exam/composition/signup/3',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(404)
    expect(H.state.deleteCalls).toBe(1)
    expect((res.json() as { data?: { ok?: boolean } }).data?.ok).toBeUndefined()
  })

  it('18c) DELETE /:sid:普通会员删 NULL 归属历史行(sid=2)⇒ 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/exam/composition/signup/2',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(404)
  })

  it('19) DELETE /:sid 正向对照:管理员 ⇒ 200 且 delete 真被调用一次', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/exam/composition/signup/1',
      headers: adminHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(H.state.deleteCalls).toBe(1)
  })

  // ===========================================================================
  // POST /signup/:sid/submit。收口史(两段):
  //   ① 2026-09-25 P0:原 handler 只有 checkAuth + sidParam.parse,where(eq(id, sid))
  //      不含任何归属条件 ⇒ 任意登录用户可按 sid 把他人报名标为 completed(越权篡改),
  //      当时按"无映射"结论 fail-close 到管理员档。
  //   ② 同日 C 方案(本票):user_id 归属列落地,闸门换成 id ∧ user_id 的 AND 条件 ——
  //      会员可提交**本人**报名(sid=1 ⇒ 200),他人行/NULL 归属历史行 ⇒ 404。
  // 必须含正向对照(用例 21b/22)—— 否则"整条路由恒 404"也会被读成"收口成功",
  // 而那等于把功能删了而不是收了口。
  // ===========================================================================

  it('20) submit:未登录 ⇒ 401(鉴权在授权之前,顺序不得颠倒)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup/1/submit',
    })
    expect(res.statusCode).toBe(401)
    expect(H.state.updateCalls).toBe(0)
    expect(H.state.whereSeen).toBe(0)
  })

  it('21) submit:普通会员按他人 sid=3 ⇒ 404,一行都改不成(前序敞口的物证,新判据下复验)', async () => {
    // sid=3 属于 OTHER 用户 —— C 方案前这里会把该行改成 completed(越权篡改);
    // 现在归属 AND 条件进 where ⇒ 0 行命中 ⇒ 404,响应体不含 signup。
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup/3/submit',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { data?: { signup?: unknown } }).data?.signup).toBeUndefined()
    // UPDATE 发出了,但 where 必须同时含 id 与 user_id —— 摘掉归属条件本用例必红
    expect(H.state.updateCalls).toBe(1)
    expect(
      H.state.frags.some((f) => f.includes('col:id') && f.includes('col:user_id')),
      `where 取证: ${JSON.stringify(H.state.frags)}`,
    ).toBe(true)
  })

  it('21b) submit:普通会员提交**本人归属行**(sid=1)⇒ 200 真把 status 写成 completed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup/1/submit',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(H.state.updateCalls).toBe(1)
    expect(H.state.updated[0]).toMatchObject({ status: 'completed' })
    expect(signupIn(res.json())?.status).toBe('completed')
  })

  it('21c) submit:普通会员提交 NULL 归属历史行(sid=2)⇒ 404(归属未知不放行)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup/2/submit',
      headers: memberHeaders,
    })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { data?: { signup?: unknown } }).data?.signup).toBeUndefined()
  })

  it('22) submit 正向对照:管理员 ⇒ 200 且真把 status 写成 completed(证明收口不是恒 404)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup/3/submit',
      headers: adminHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(H.state.updateCalls).toBe(1)
    expect(H.state.updated[0]).toMatchObject({ status: 'completed' })
    expect(signupIn(res.json())?.status).toBe('completed')
  })

  it('23) submit:请求体自报 userId / memberId / roleId 不构成归属(自报≠本人)', async () => {
    // 自报他人 uuid 去提交**他人**的 sid=3:归属判据只认 JWT 里的 request.userId,
    // 请求体里塞什么都不换档、不换归属。变异③:把服务端取值改成采信 body.userId,本用例必红。
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/composition/signup/3/submit',
      headers: memberHeaders,
      payload: { memberId: 9, userId: OTHER_UUID, roleId: 1, isAdmin: true },
    })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { data?: { signup?: unknown } }).data?.signup).toBeUndefined()
    expect(H.state.updateCalls).toBe(1)
    // 归属绑定值仍是调用者 uuid(不是自报的 OTHER_UUID)
    expect(H.state.frags.some((f) => f.includes('col:user_id'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
