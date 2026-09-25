// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0 归属失效回归:ownerId 必须是 **request.userId 原文(uuid),不是 Number(...)**。
 *
 * 立因(逐行实测):`packages/database/src/schema/users.ts` 的 users.id 是
 * `uuid('id').defaultRandom()`,而 apps/api/src/routes/skills.ts 曾把归属写成
 * `Number(request.userId!)` ⇒ 生产环境恒 NaN,`JSON.stringify(NaN)` 又落成 `null`;
 * 于是 `existing.ownerId === callerId` 这一类比较是 `NaN === NaN` / `null === uuid`,
 * **永远为假** —— 同日入库的 P0 修复「归属者本人可更新/下架自己条目」在真机上永远 403,
 * 只有测试里塞数字 id(`'101'`)才看得见它工作:数字串正是把这个缺陷藏起来的东西。
 *
 * 本文件因此**只用 uuid 形状的身份**走完整闭环,并用真实 authenticate + 真实授权判定
 * (取径照同目录 skills-market-publish-ownership.test.ts:只 mock 令牌验签与用户状态两个
 * 最外出口,路由装配与 mayWriteMarketEntry / listing 归属闸全程真跑)。
 * 全程 mock redis,不连任何真实 DB / Redis(AGENTS §5 测试隔离铁律)。
 *
 * 五条判据:
 *  1 新建落库的 ownerId 就是 uuid 原文 —— 且**直接看 redis 里的裸 JSON 串**,不看解构后
 *    的对象:`Number()` 强转在这一层必然露出 `null`(`JSON.stringify(NaN)`)。
 *  2 同一个人更新自己的条目 ⇒ 200(旧的 NaN 实现这里 403)。
 *  3 同一个人下架 / 再上架自己的条目 ⇒ 200 + enabled 真翻转(旧的 NaN 实现 403)。
 *  4 ownership 端点 isOwner=true 且 ownerId 回显 uuid(不是 number、不是 null)。
 *  5 已下架条目对本人仍在列表里可见(否则他没有入口再上架回去),对他人隐身。
 * 反向对照 6:他人拿不到归属者身份 ⇒ 更新/下架一律 403(收紧不等于放开)。
 * 脏数据实测 7:ownerId 已是 `null`(NaN 落盘的既有条目)⇒ 修后判"无人认领",
 *    普通用户与"他人"一律 403,只有 admin 档还能治理 —— 断言的是既有事实,不是新行为。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { INTERNAL_SECRET } = vi.hoisted(() => ({
  INTERNAL_SECRET: 'internal-self-evolution-secret',
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn() }))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
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

/** 真机形状的身份:users.id 就是这种 uuid 串,绝不可能是数字 */
const OWNER_UUID = '3f2b7c1a-9d4e-4a5b-8c6f-1e2d3a4b5c01'
const STRANGER_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02'
const ADMIN_UUID = 'cccccccc-1111-4222-8333-444444444444'

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
    sadd: vi.fn(async (k: string, ...m: string[]) => {
      if (!sets.has(k)) sets.set(k, new Set())
      const s = sets.get(k)!
      for (const x of m) s.add(x)
      return m.length
    }),
    srem: vi.fn(async (k: string, ...m: string[]) => {
      const s = sets.get(k)
      if (!s) return 0
      let n = 0
      for (const x of m) if (s.delete(x)) n++
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
    lrange: vi.fn(async (k: string, s: number, e: number) => {
      const arr = lists.get(k) ?? []
      return arr.slice(s < 0 ? Math.max(arr.length + s, 0) : s, e < 0 ? arr.length + e + 1 : e + 1)
    }),
    del: vi.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
    expire: vi.fn(async () => 1),
    publish: vi.fn(async () => 1),
  }
}

let server: FastifyInstance
let redis: ReturnType<typeof createMockRedis>

interface As {
  userId: string | null
  roleId?: number
}

/** 以某个 uuid 身份发请求:真实 checkAuth → authenticate → 注入 request.userId */
async function call(
  who: As,
  method: 'GET' | 'POST',
  url: string,
  payload?: unknown,
): Promise<{ statusCode: number; json: Record<string, unknown> }> {
  if (who.userId !== null) {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      userId: who.userId,
      phone: '13800000000',
      familyId: `f-${who.userId}`,
      roleId: who.roleId ?? 0,
    })
  }
  const res = await server.inject({
    method,
    url,
    headers: who.userId === null ? {} : { authorization: 'Bearer mock-access-token' },
    payload: payload as never,
  })
  return { statusCode: res.statusCode, json: res.json() as Record<string, unknown> }
}

function marketRaw(): string {
  return redis.store.get(MARKET_KEY) ?? '<市场键缺失>'
}
function market(): SkillMarketEntry[] {
  return JSON.parse(marketRaw()) as SkillMarketEntry[]
}
function entryByName(name: string): SkillMarketEntry {
  const found = market().find((e) => e.name === name)
  if (!found) throw new Error(`条目 ${name} 不见了`)
  return found
}
function dataOf(json: Record<string, unknown>): Record<string, unknown> {
  return (json.data ?? {}) as Record<string, unknown>
}

const NEW_BODY = {
  name: 'uuid-shaped-skill',
  description: '归属闭环用的条目',
  tags: ['t'],
  author: 'tester',
  version: '1.0.0',
  license: 'MIT',
  content: '# body',
}

beforeAll(async () => {
  redis = createMockRedis()
  server = Fastify()
  server.decorate('redis', redis as never)
  await server.register(skillsRoutes, { prefix: '/api' })
  await server.ready()
})

beforeEach(() => {
  vi.clearAllMocks()
  redis.store.clear()
  redis.sets.clear()
  redis.lists.clear()
})

describe('真机形状(uuid):自己上架 ⇒ 自己能更新 / 能下架', () => {
  it('1 新建落库的 ownerId 就是 uuid 原文 —— 直接看 redis 裸串,NaN 强转在这一层必露 null', async () => {
    const res = await call({ userId: OWNER_UUID }, 'POST', '/api/skills/market', NEW_BODY)
    expect(res.statusCode).toBe(201)

    // 关键一层:判裸串而不是判解构后的对象。
    // 旧实现 `"ownerId":${JSON.stringify(Number(OWNER_UUID))}` → 裸串里是 "ownerId":null。
    expect(marketRaw()).toContain(`"ownerId":"${OWNER_UUID}"`)
    expect(marketRaw()).not.toContain('"ownerId":null')
    expect(marketRaw()).not.toContain('NaN')

    const created = entryByName(NEW_BODY.name)
    expect(created.ownerId).toBe(OWNER_UUID)
    expect(typeof created.ownerId).toBe('string')
    expect(created.source).toBe('user')
  })

  it('2 同一个人再发一次(版本更新)⇒ 200,不是 403', async () => {
    const first = await call({ userId: OWNER_UUID }, 'POST', '/api/skills/market', NEW_BODY)
    expect(first.statusCode).toBe(201)

    const update = await call({ userId: OWNER_UUID }, 'POST', '/api/skills/market', {
      ...NEW_BODY,
      version: '1.1.0',
      description: '自己的更新',
    })
    expect(update.statusCode).toBe(200)
    expect(entryByName(NEW_BODY.name).version).toBe('1.1.0')
    // 归属不因更新而漂移
    expect(entryByName(NEW_BODY.name).ownerId).toBe(OWNER_UUID)
  })

  it('3 同一个人下架 ⇒ 200 + enabled=false,再上架 ⇒ 200 + enabled=true', async () => {
    await call({ userId: OWNER_UUID }, 'POST', '/api/skills/market', NEW_BODY)

    const off = await call({ userId: OWNER_UUID }, 'POST', `/api/skills/${NEW_BODY.name}/listing`, {
      enabled: false,
    })
    expect(off.statusCode).toBe(200)
    expect(dataOf(off.json)).toMatchObject({ name: NEW_BODY.name, enabled: false })
    expect(entryByName(NEW_BODY.name).enabled).toBe(false)

    const on = await call({ userId: OWNER_UUID }, 'POST', `/api/skills/${NEW_BODY.name}/listing`, {
      enabled: true,
    })
    expect(on.statusCode).toBe(200)
    expect(entryByName(NEW_BODY.name).enabled).toBe(true)
  })

  it('4 ownership 端点:isOwner=true 且 ownerId 回显 uuid 原文(不是数字、不是 null)', async () => {
    await call({ userId: OWNER_UUID }, 'POST', '/api/skills/market', NEW_BODY)

    const res = await call({ userId: OWNER_UUID }, 'GET', `/api/skills/${NEW_BODY.name}/ownership`)
    expect(res.statusCode).toBe(200)
    expect(dataOf(res.json)).toEqual({
      name: NEW_BODY.name,
      isOwner: true,
      ownerId: OWNER_UUID,
      enabled: true,
      source: 'user',
    })
  })

  it('5 自己已下架的条目对自己可见(否则没有入口上架回去),对他人隐身', async () => {
    await call({ userId: OWNER_UUID }, 'POST', '/api/skills/market', NEW_BODY)
    await call({ userId: OWNER_UUID }, 'POST', `/api/skills/${NEW_BODY.name}/listing`, {
      enabled: false,
    })

    const mine = await call({ userId: OWNER_UUID }, 'GET', '/api/skills/market?q=uuid-shaped')
    expect((dataOf(mine.json)['items'] as SkillMarketEntry[]).map((e) => e.name)).toContain(
      NEW_BODY.name,
    )

    const stranger = await call(
      { userId: STRANGER_UUID },
      'GET',
      '/api/skills/market?q=uuid-shaped',
    )
    expect((dataOf(stranger.json)['items'] as SkillMarketEntry[]).map((e) => e.name)).not.toContain(
      NEW_BODY.name,
    )
  })

  it('6 反向对照:他人既更新不掉也下架不掉(收紧不等于放开)', async () => {
    await call({ userId: OWNER_UUID }, 'POST', '/api/skills/market', NEW_BODY)
    const before = marketRaw()

    const hijack = await call({ userId: STRANGER_UUID }, 'POST', '/api/skills/market', {
      ...NEW_BODY,
      description: '他人改写',
    })
    expect(hijack.statusCode).toBe(403)

    const off = await call(
      { userId: STRANGER_UUID },
      'POST',
      `/api/skills/${NEW_BODY.name}/listing`,
      { enabled: false },
    )
    expect(off.statusCode).toBe(403)
    expect(marketRaw()).toBe(before)
  })
})

describe('NaN 脏数据的既有事实(修后不写迁移,只把结论钉成断言)', () => {
  /** 旧实现写进 redis 的真实形态:JSON.stringify(NaN) → null */
  const NAJ_DIRTY: SkillMarketEntry[] = [
    {
      name: 'legacy-nan',
      description: 'NaN 时代上架的条目',
      tags: ['t'],
      author: 'tester',
      version: '1.0.0',
      license: 'MIT',
      installCount: 3,
      rating: 0,
      ratingCount: 0,
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
      enabled: true,
      source: 'user',
      // 契约上是 string|undefined,而脏数据里是 null —— 按真实落盘形态注入
      ownerId: null as unknown as string,
    },
  ]

  it('7 ownerId=null 的条目 ⇒ 无人认领:普通用户(含当初的上架者)403,admin 仍可治理', async () => {
    redis.store.set(MARKET_KEY, JSON.stringify(NAJ_DIRTY))

    const off = await call({ userId: OWNER_UUID }, 'POST', '/api/skills/legacy-nan/listing', {
      enabled: false,
    })
    expect(off.statusCode).toBe(403)

    const ownership = await call({ userId: OWNER_UUID }, 'GET', '/api/skills/legacy-nan/ownership')
    expect(dataOf(ownership.json)).toMatchObject({ isOwner: false, ownerId: null })

    // admin 档是这批条目的唯一出口(requireAdmin 的 /unlist 与 POST 的补认领)
    const adminUpdate = await call(
      { userId: ADMIN_UUID, roleId: 1 },
      'POST',
      '/api/skills/market',
      {
        name: 'legacy-nan',
        description: '管理员补齐归属',
        tags: ['t'],
        author: 'tester',
        version: '1.0.1',
        license: 'MIT',
        content: '# body',
      },
    )
    expect(adminUpdate.statusCode).toBe(200)
    // 补认领成立:归一化把 null 读成"无主",于是管理员的补齐分支真能落 uuid 原文。
    // (实测:没有读侧归一化时这一步是 200 但 ownerId 仍是 null —— 连管理员都修不动,
    //  因为补齐分支判的是 `ownerId === undefined`,而 NaN 落盘的形态是 null。)
    expect(marketRaw()).toContain(`"ownerId":"${ADMIN_UUID}"`)
    expect(marketRaw()).not.toContain('"ownerId":null')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
