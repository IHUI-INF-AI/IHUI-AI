// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /api/skills/market 的写授权回归(2026-09-25 立)。
 *
 * 立因(原缺陷,实测行号 787–789 + 773–775):更新分支的"归属补齐"
 *   if (existing.ownerId === undefined && publisherId !== undefined) {
 *     existing.ownerId = publisherId; existing.source = 'user'
 *   }
 * 上游唯一的闸门是 `existing.author !== body.author → 409`,而它比的是**请求体自报的字符串**;
 * 内置种子的 author 在源码里公开可见(MARKET_SEED_RAW:'IHUI' 实测 3 处 / 'OpenSource' 2 处 …),
 * 且种子刻意没有 ownerId ⇒ 任意登录用户发 {name:'content_engine', author:'IHUI', …} 就能
 *   ① 过 409;② 把平台内置技能认领成自己的(source builtin→user、ownerId=自己);
 *   ③ 原地改写 description/tags/version/license;④ 版本一变即 notifySubscribers,
 *      向**全体订阅者**推送伪"更新"。同文件对"改他人条目"更是完全不校归属。
 *
 * 修法 = 任务书 option-1(requireAdmin)。为什么不选另一案:本仓**不存在**"author 字符串 ↔
 * 用户身份"的服务端可证绑定 —— grep 过 content/knowledge/news 的 authorId,全是别的域;
 * 市场条目只存 redis,author 就是发布时自报的自由文本。没有的绑定不能装作有。
 * ⇒ 条目级写授权只看两样:调用者的**服务端身份**(内部通道 / roleId / userId)与条目上
 * **已存的 ownerId**;builtin / hub / 无主 legacy 一律 requireAdmin。内置识别由服务端按
 * source/ownerId 判,不靠前端隐藏按钮。
 *
 * 每条"拒答"用例都必须同时成立四件事(只断状态码不算数):
 *   A 状态码 · B 目标条目逐字段(ownerId/source/description/version/license)与攻击前全等
 *   C 订阅者通知列表长度与内容不变 · D **整个 redis 状态指纹字节级相等 ∧ 一次 set 都没有**
 *
 * 取径照 apps/api/tests/skills-market-unlist-admin.test.ts 的范式:真实 authenticate + 真实
 * 授权判定全程在跑,只在最外两个出口打断(令牌验签 verifyAccessToken 注入 roleId 档位、
 * 用户状态 getUserStatus)。所以本文件测的是**路由装配本身**,不是自制 mock:把
 * mayWriteMarketEntry 的 owner/admin 判定摘掉,拒答组必红(已由变异取证实测)。
 * 全程 mock redis,不连任何真实 DB / Redis(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// vi.mock 工厂会被提到文件最前,工厂里能引用的变量必须由同一个 hoisted 块产出
// (顶层 const 在这里会 "Cannot access ... before initialization")
const { INTERNAL_SECRET } = vi.hoisted(() => ({
  INTERNAL_SECRET: 'internal-self-evolution-secret',
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  // 缺省非管理员:每个用例显式改写,不靠这里的初值放行
  verifyAccessToken: vi.fn(),
}))
// auth.ts 的 P2-14 加固会查用户状态(status=0 封禁 403 / 3 注销 401),固定回 active
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
vi.mock('../src/db/index.js', () => ({ db: { execute: vi.fn() } }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_CALLBACK_SECRET: INTERNAL_SECRET,
  },
}))

import { skillsRoutes } from '../src/routes/skills.js'
import { verifyAccessToken } from '@ihui/auth'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'

const MARKET_KEY = 'skills-market:global'
const ATTACKER_ID = 101
const OTHER_OWNER_ID = 202
const ADMIN_ID = 900

/** 内置条目上登记的订阅者:攻击若得逞就会向他们 LPUSH 伪更新 —— 判据 C 的观测面 */
const SUBSCRIBERS_OF_BUILTIN = ['11', '12', '13']

interface Envelope {
  code: number
  message?: string
  data?: SkillMarketEntry
}

function createMockRedis() {
  const store = new Map<string, string>()
  const sets = new Map<string, Set<string>>()
  const lists = new Map<string, string[]>()
  return {
    store,
    sets,
    lists,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    }),
    hset: vi.fn(async () => 1),
    hget: vi.fn(async () => null),
    hdel: vi.fn(async () => 1),
    sadd: vi.fn(async (k: string, ...members: string[]) => {
      if (!sets.has(k)) sets.set(k, new Set())
      const s = sets.get(k)!
      for (const m of members) s.add(m)
      return members.length
    }),
    srem: vi.fn(async (k: string, ...members: string[]) => {
      const s = sets.get(k)
      if (!s) return 0
      let n = 0
      for (const m of members) if (s.delete(m)) n++
      return n
    }),
    sismember: vi.fn(async (k: string, m: string) => (sets.get(k)?.has(m) ? 1 : 0)),
    smembers: vi.fn(async (k: string) => Array.from(sets.get(k) ?? [])),
    lpush: vi.fn(async (k: string, v: string) => {
      const arr = lists.get(k) ?? []
      arr.unshift(v)
      lists.set(k, arr)
      return arr.length
    }),
    lrange: vi.fn(async (k: string, start: number, end: number) => {
      const arr = lists.get(k) ?? []
      const len = arr.length
      const s = start < 0 ? Math.max(len + start, 0) : start
      const e = end < 0 ? len + end + 1 : end + 1
      return arr.slice(s, e)
    }),
    del: vi.fn(async (k: string) => {
      const had = store.has(k) || lists.has(k) || sets.has(k)
      store.delete(k)
      lists.delete(k)
      sets.delete(k)
      return had ? 1 : 0
    }),
    expire: vi.fn(async () => 1),
    publish: vi.fn(async () => 1),
  }
}

function entry(over: Partial<SkillMarketEntry> & { name: string }): SkillMarketEntry {
  return {
    description: `${over.name} 的描述`,
    tags: ['t'],
    author: 'tester',
    version: '1.0.0',
    license: 'MIT',
    installCount: 7,
    rating: 4,
    ratingCount: 2,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  }
}

/**
 * 种子覆盖四种条目形态 × 归属:
 *  - content_engine / code-reviewer:平台内置(source=builtin,无 ownerId),两个不同作者名
 *  - hub-sync  :内部自进化同步条目(source=hub,无 ownerId)
 *  - legacy    :契约落地前的无主条目(source/ownerId 都缺)—— 原认领分支的靶子
 *  - theirs    :他人已归属条目(ownerId=202)
 *  - mine      :调用者自己的条目(ownerId=101)—— 正向对照
 */
const SEED: SkillMarketEntry[] = [
  entry({
    name: 'content_engine',
    author: 'IHUI',
    source: 'builtin',
    version: '1.2.0',
    installCount: 1280,
    enabled: true,
  }),
  entry({ name: 'code-reviewer', author: 'OpenSource', source: 'builtin', version: '2.0.0' }),
  entry({ name: 'hub-sync', author: 'IHUI', source: 'hub', version: '3.0.0' }),
  entry({ name: 'legacy', author: 'tester', version: '1.0.0' }),
  entry({
    name: 'theirs',
    author: 'someone-else',
    ownerId: OTHER_OWNER_ID,
    source: 'user',
    enabled: true,
  }),
  entry({ name: 'mine', author: 'tester', ownerId: ATTACKER_ID, source: 'user', enabled: true }),
]

let server: FastifyInstance
let redis: ReturnType<typeof createMockRedis>

/** 全部 redis 状态的字节级指纹 —— 判据 D:连"读了又写回同值"都不允许 */
function fingerprint(): string {
  return JSON.stringify({
    kv: [...redis.store.entries()].sort(),
    sets: [...redis.sets.entries()].map(([k, v]) => [k, [...v].sort()] as const).sort(),
    lists: [...redis.lists.entries()].sort(),
  })
}

function market(): SkillMarketEntry[] {
  return JSON.parse(redis.store.get(MARKET_KEY) ?? '[]') as SkillMarketEntry[]
}

function entryByName(entries: SkillMarketEntry[], name: string): SkillMarketEntry {
  const found = entries.find((e) => e.name === name)
  if (!found) throw new Error(`条目 ${name} 不见了 —— 这本身就是副作用`)
  return found
}

function notificationTotal(): number {
  let n = 0
  for (const [, arr] of redis.lists) n += arr.length
  return n
}

interface As {
  /** JWT 里的 userId;null = 不带任何凭据(未登录) */
  userId: string | null
  roleId?: number
  secret?: string
}

async function publishAs(
  who: As,
  payload: Record<string, unknown>,
): Promise<{ statusCode: number; body: Envelope }> {
  const headers: Record<string, string> = {}
  if (who.userId !== null) {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      userId: who.userId,
      phone: '13800000000',
      familyId: `f-${who.userId}`,
      roleId: who.roleId ?? 0,
    })
    headers.authorization = 'Bearer mock-access-token'
  }
  if (who.secret !== undefined) headers['x-internal-secret'] = who.secret

  const res = await server.inject({ method: 'POST', url: '/api/skills/market', headers, payload })
  return { statusCode: res.statusCode, body: res.json() as unknown as Envelope }
}

function publishBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'content_engine',
    description: '攻击者改写的内容',
    tags: ['hijacked'],
    author: 'IHUI',
    version: '9.9.9',
    license: 'MIT',
    content: '# body',
    ...over,
  }
}

/**
 * 拒答的统一核验(A+B+C+D 四条同时成立)。
 * beforeSnapshot / beforeTarget 由调用方在发请求**前**取,避免与本函数内的读取混序。
 */
function assertRejected(input: {
  statusCode: number
  code: number
  expectedStatus: number
  before: string
  after: string
  beforeTarget: SkillMarketEntry
  afterTarget: SkillMarketEntry
}): void {
  expect(input.statusCode).toBe(input.expectedStatus)
  expect(input.code).toBe(input.expectedStatus)
  // D 全指纹字节相等
  expect(input.after).toBe(input.before)
  // 连 set 都没被调用过(市场键在 beforeEach 已落好 ⇒ 读侧的初始化写也不可能发生)
  expect(redis.set).not.toHaveBeenCalled()
  // B 逐字段:认领(ownerId/source)与改写(description/version/license/enabled)都没发生
  expect(input.afterTarget).toEqual(input.beforeTarget)
  expect(input.afterTarget.ownerId).toBe(input.beforeTarget.ownerId)
  expect(input.afterTarget.source).toBe(input.beforeTarget.source)
  expect(input.afterTarget.description).toBe(input.beforeTarget.description)
  expect(input.afterTarget.version).toBe(input.beforeTarget.version)
  expect(input.afterTarget.license).toBe(input.beforeTarget.license)
  expect(input.afterTarget.enabled).toBe(input.beforeTarget.enabled)
  // C 订阅者通知:一条都没多(D 的指纹相等已覆盖,这里单独钉一句是因为它是本票的第四条后果)
  expect(notificationTotal()).toBe(0)
}

/** 一步到位:以某身份发起攻击请求并核验零副作用 */
async function attackAndAssertRejected(
  who: As,
  payload: Record<string, unknown>,
  targetName: string,
  expectedStatus: number,
): Promise<void> {
  const before = fingerprint()
  const beforeTarget = entryByName(market(), targetName)

  const res = await publishAs(who, payload)

  assertRejected({
    statusCode: res.statusCode,
    code: res.body.code,
    expectedStatus,
    before,
    after: fingerprint(),
    beforeTarget,
    afterTarget: entryByName(market(), targetName),
  })
}

beforeAll(async () => {
  redis = createMockRedis()
  server = Fastify({ logger: false })
  server.decorate('redis', redis as never)
  await server.register(skillsRoutes, { prefix: '/api' })
  await server.ready()
})

beforeEach(() => {
  redis.store.clear()
  redis.sets.clear()
  redis.lists.clear()
  redis.store.set(MARKET_KEY, JSON.stringify(SEED))
  // 内置条目有 3 个订阅者 ⇒ "版本一变就推伪更新"这条副作用链可达,因而也可观测
  redis.sets.set('skill-subscribers:content_engine', new Set(SUBSCRIBERS_OF_BUILTIN))
  // 清掉调用记录但保留实现(clearAllMocks 只清 calls/results,不动 mockResolvedValue)
  vi.clearAllMocks()
})

describe('POST /api/skills/market —— 归属与改写授权不得由自报 author 背书', () => {
  it('攻击复现:普通用户以 author="IHUI" 认领内置条目 ⇒ 403 且零副作用', async () => {
    await attackAndAssertRejected(
      { userId: String(ATTACKER_ID) },
      publishBody(),
      'content_engine',
      403,
    )
  })

  it('换作者名不构成绕过:code-reviewer(内置,author=OpenSource)同样 403', async () => {
    await attackAndAssertRejected(
      { userId: String(ATTACKER_ID) },
      publishBody({ name: 'code-reviewer', author: 'OpenSource' }),
      'code-reviewer',
      403,
    )
  })

  it('hub 条目(内部同步,无 ownerId)普通用户不可改 ⇒ 403', async () => {
    await attackAndAssertRejected(
      { userId: String(ATTACKER_ID) },
      publishBody({ name: 'hub-sync', version: '4.0.0' }),
      'hub-sync',
      403,
    )
  })

  it('无主 legacy 的"认领"通道已关闭 ⇒ 403,ownerId/source 仍为空', async () => {
    const before = fingerprint()
    const beforeTarget = entryByName(market(), 'legacy')
    expect(beforeTarget.ownerId).toBeUndefined()
    expect(beforeTarget.source).toBeUndefined()

    const res = await publishAs(
      { userId: String(ATTACKER_ID) },
      publishBody({ name: 'legacy', author: 'tester' }),
    )

    assertRejected({
      statusCode: res.statusCode,
      code: res.body.code,
      expectedStatus: 403,
      before,
      after: fingerprint(),
      beforeTarget,
      afterTarget: entryByName(market(), 'legacy'),
    })
    const legacy = entryByName(market(), 'legacy')
    expect(legacy.ownerId).toBeUndefined()
    expect(legacy.source).toBeUndefined()
  })

  it('他人已归属条目:普通用户改它 ⇒ 403(原实现完全不校归属)', async () => {
    await attackAndAssertRejected(
      { userId: String(ATTACKER_ID) },
      publishBody({ name: 'theirs', author: 'someone-else', version: '2.0.0' }),
      'theirs',
      403,
    )
  })

  it('未登录 ⇒ 401 且零副作用(鉴权仍是第一道)', async () => {
    await attackAndAssertRejected({ userId: null }, publishBody(), 'content_engine', 401)
  })

  it('顺序:非归属者 + 会让 Zod 判 400 的坏 description ⇒ 必须 403,证明先授权再校参数', async () => {
    const before = fingerprint()
    const badPayload = publishBody({ description: '' })

    const forbidden = await publishAs({ userId: String(ATTACKER_ID) }, badPayload)
    expect(forbidden.statusCode).toBe(403)

    // 反向对照:同一个 body 换成 admin 必须是 400 —— 少了这句,本用例可能因为
    // "参数本来就错得离谱"而恒真,测的就不是顺序而是别的东西。
    const badParam = await publishAs({ userId: String(ADMIN_ID), roleId: 1 }, badPayload)
    expect(badParam.statusCode).toBe(400)
    expect(fingerprint()).toBe(before)
    expect(redis.set).not.toHaveBeenCalled()
  })

  it('授权先于作者冲突探针:非归属者 + 错误 author 打内置条目 ⇒ 403 而不是 409', async () => {
    // 旧顺序把 409 当探针:任何人(哪怕毫无归属)都能靠"409/200 之分"枚举某条目的作者名。
    await attackAndAssertRejected(
      { userId: String(ATTACKER_ID) },
      publishBody({ author: 'wrong-author' }),
      'content_engine',
      403,
    )
  })

  it('正向仍在位:归属者本人 + 错误 author ⇒ 409(校验收住了,没被顺手删掉)', async () => {
    const res = await publishAs(
      { userId: String(ATTACKER_ID) },
      publishBody({ name: 'mine', author: 'not-me' }),
    )
    expect(res.statusCode).toBe(409)
  })
})

describe('POST /api/skills/market —— 合法路径没被修死(正向对照)', () => {
  it('归属者本人更新自己的条目 ⇒ 200,字段刷新且 installCount/rating 保留', async () => {
    const res = await publishAs(
      { userId: String(ATTACKER_ID) },
      publishBody({
        name: 'mine',
        author: 'tester',
        version: '1.1.0',
        description: '我自己的更新',
      }),
    )
    expect(res.statusCode).toBe(200)

    const mine = entryByName(market(), 'mine')
    expect(mine.version).toBe('1.1.0')
    expect(mine.description).toBe('我自己的更新')
    expect(mine.ownerId).toBe(ATTACKER_ID)
    expect(mine.source).toBe('user')
    expect(mine.installCount).toBe(7)
    expect(mine.rating).toBe(4)
    // 合法写入确实发生了(否则上面几条可能只是"什么都没做"的假绿)
    expect(redis.set).toHaveBeenCalled()
    // 'mine' 没有订阅者 ⇒ 通知为 0;内置条目的 3 名订阅者也不该被牵连
    expect(notificationTotal()).toBe(0)
  })

  it('订阅者的通知链没有被摘线:版本一变,3 名订阅者各得一条', async () => {
    // content_engine 是内置条目 ⇒ 普通用户发不动;用 admin 治理面验证通知链在位
    const res = await publishAs(
      { userId: String(ADMIN_ID), roleId: 1 },
      publishBody({ name: 'content_engine', author: 'IHUI', version: '1.3.0' }),
    )
    expect(res.statusCode).toBe(200)
    expect(notificationTotal()).toBe(SUBSCRIBERS_OF_BUILTIN.length)
    for (const u of SUBSCRIBERS_OF_BUILTIN) {
      expect(redis.lists.get(`skill-notifications:${u}`)?.[0]).toContain('1.3.0')
    }
  })

  it('普通用户以自己 author 新建条目 ⇒ 201 + ownerId=自己 + source=user（内置名冒充由 create 闸拦下，另有用例；此处必须用非内置名才不构成正向对照与攻击载荷互斥）', async () => {
    const res = await publishAs(
      { userId: String(ATTACKER_ID) },
      publishBody({ name: 'brand-new', author: 'tester-owned' }),
    )
    expect(res.statusCode).toBe(201)
    const created = entryByName(market(), 'brand-new')
    expect(created.ownerId).toBe(ATTACKER_ID)
    expect(created.source).toBe('user')
    expect(created.enabled).toBe(true)
  })

  it('系统管理员(roleId=1)是认领无主语义目的唯一出口', async () => {
    const res = await publishAs(
      { userId: String(ADMIN_ID), roleId: 1 },
      publishBody({ name: 'legacy', author: 'tester', version: '1.0.1' }),
    )
    expect(res.statusCode).toBe(200)
    const legacy = entryByName(market(), 'legacy')
    expect(legacy.ownerId).toBe(ADMIN_ID)
    expect(legacy.source).toBe('user')
    expect(legacy.version).toBe('1.0.1')
  })

  it('内部通道可同步 hub 条目 ⇒ 200,但不认领归属(ownerId 仍空、source 仍 hub)', async () => {
    const res = await publishAs(
      { userId: null, secret: INTERNAL_SECRET },
      publishBody({ name: 'hub-sync', version: '3.1.0', description: '同步' }),
    )
    expect(res.statusCode).toBe(200)
    const hub = entryByName(market(), 'hub-sync')
    expect(hub.version).toBe('3.1.0')
    expect(hub.description).toBe('同步')
    expect(hub.ownerId).toBeUndefined()
    expect(hub.source).toBe('hub')
  })

  it('内部通道仍可新建 hub 条目(source=hub 且无归属)⇒ 201', async () => {
    const res = await publishAs(
      { userId: null, secret: INTERNAL_SECRET },
      publishBody({ name: 'hub-new' }),
    )
    expect(res.statusCode).toBe(201)
    const created = entryByName(market(), 'hub-new')
    expect(created.source).toBe('hub')
    expect(created.ownerId).toBeUndefined()
  })

  it('错的内部密钥不构成内部通道:回落为普通用户 ⇒ 内置条目 403', async () => {
    await attackAndAssertRejected(
      { userId: String(ATTACKER_ID), secret: 'not-the-secret' },
      publishBody(),
      'content_engine',
      403,
    )
  })

  it('userId 写着管理员的号但 roleId=0 ⇒ 不是 admin ⇒ 内置条目仍 403(档位不等于 id)', async () => {
    // admin 依据只有 jwtPayload.roleId >= 1 这一条;把 userId 填成某个管理员的号不构成提权。
    const res = await publishAs(
      { userId: String(ADMIN_ID) },
      publishBody({ name: 'content_engine', author: 'IHUI' }),
    )
    expect(res.statusCode).toBe(403)
  })
})
