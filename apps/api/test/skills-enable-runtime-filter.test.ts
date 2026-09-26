// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回归:用户「停用技能」在服务端必须真实生效(修复第十二批台账登记的 no-op)。
//
// 判据(每条都有对应的历史缺陷形态):
//  ① 停用后取不到 —— 市场名技能不在启用集时,GET /skills / GET /skills/:name /
//     sync pull / sync list 四个运行面一律不发放(断言结果集为空/不含该项,不接受"只 200");
//  ② 启用者本人仍取得到 —— 启用后同四个面全部可见;
//  ③ 跨用户不可见 —— A 的启用集不外溢给 B;B 的 token 带 body.userId=A 也借不到 A 的
//     启用集(身份只认 request.userId);B 的 disable 也动不了 A 的集合;
//  ④ 非市场名的用户自建技能不受启用集约束(enable 端点本就只管市场技能,过滤不得越界);
//  ⑤ install 自动补启用集 —— 否则"安装即可被 Agent 调用"在白名单语义下永不成立。
//
// 全程离线:mock checkAuth + 进程内 Redis(store/hashes/sets),不连 PG、不连 Redis。
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockCheckAuth } = vi.hoisted(() => ({ mockCheckAuth: vi.fn() }))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mockCheckAuth,
  authenticate: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn() },
}))

import { skillsRoutes } from '../src/routes/skills.js'

/** 进程内 Redis mock(KV + Hash + Set + List),与 skills-market.test.ts 同一套形态 */
function createMockRedis() {
  const store = new Map<string, string>()
  const hashes = new Map<string, Map<string, string>>()
  const sets = new Map<string, Set<string>>()
  const lists = new Map<string, string[]>()
  return {
    store,
    hashes,
    sets,
    lists,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    }),
    hset: vi.fn(async (k: string, f: string, v: string) => {
      if (!hashes.has(k)) hashes.set(k, new Map())
      hashes.get(k)!.set(f, v)
      return 1
    }),
    hgetall: vi.fn(async (k: string) => {
      const h = hashes.get(k)
      if (!h) return {} as Record<string, string>
      const o: Record<string, string> = {}
      for (const [f, v] of h) o[f] = v
      return o
    }),
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

const mockRedis = createMockRedis()

const USER_A = 'aaaaaaaa-0000-4000-8000-00000000000a'
const USER_B = 'bbbbbbbb-0000-4000-8000-00000000000b'
/** 市场种子里的真实条目名(MARKET_SEED_RAW 第一条;非市场名用 my-own-skill) */
const MARKET_SKILL = 'content_engine'
const OWN_SKILL = 'my-own-skill'

let currentUser = USER_A

async function putUserStore(userId: string, records: unknown[]): Promise<void> {
  mockRedis.store.set(`skills:${userId}`, JSON.stringify(records))
}

function skillRecord(name: string) {
  return {
    name,
    description: `${name} desc`,
    content: `# ${name}\nbody`,
    version: '1.0.0',
    license: 'MIT',
    source: 'user',
    createdAt: '2026-09-27T00:00:00.000Z',
    updatedAt: '2026-09-27T00:00:00.000Z',
  }
}

describe('skills 用户启用集 ⇒ 运行面过滤(停用必须真实生效)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', mockRedis as never)
    await app.register(skillsRoutes, { prefix: '/api' })
    await app.ready()
    mockCheckAuth.mockImplementation((req: { userId?: string; jwtPayload?: unknown }) => {
      req.userId = currentUser
      req.jwtPayload = { roleId: 0 }
      return Promise.resolve(true)
    })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    // 清用户库与启用集,保留市场种子(readMarket 首访自动落种)
    mockRedis.store.delete(`skills:${USER_A}`)
    mockRedis.store.delete(`skills:${USER_B}`)
    mockRedis.sets.delete(`skill-enabled:${USER_A}`)
    mockRedis.sets.delete(`skill-enabled:${USER_B}`)
    mockRedis.hashes.delete(`skills:${USER_A}`)
    mockRedis.hashes.delete(`skills:${USER_B}`)
    currentUser = USER_A
  })

  async function listVisible(userId: string): Promise<string[]> {
    currentUser = userId
    const res = await app.inject({ method: 'GET', url: '/api/skills' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    return (body.data.skills as Array<{ name: string }>).map((s) => s.name)
  }

  async function syncAction(userId: string, action: 'pull' | 'list', extra?: unknown) {
    currentUser = userId
    const res = await app.inject({
      method: 'POST',
      url: '/api/skills/sync',
      payload: { userId, action, ...(extra ? { skillNames: extra } : {}) },
    })
    expect(res.statusCode).toBe(200)
    return res.json().data as { skills: Array<{ name: string }>; count: number }
  }

  it('① 未启用/已停用 ⇒ 四个运行面全部取不到(不是只断 200)', async () => {
    await putUserStore(USER_A, [skillRecord(MARKET_SKILL), skillRecord(OWN_SKILL)])

    expect(await listVisible(USER_A)).toEqual([OWN_SKILL])

    currentUser = USER_A
    const detail = await app.inject({ method: 'GET', url: `/api/skills/${MARKET_SKILL}` })
    expect(detail.statusCode).toBe(404)
    const detailOwn = await app.inject({ method: 'GET', url: `/api/skills/${OWN_SKILL}` })
    expect(detailOwn.statusCode).toBe(200)

    const pull = await syncAction(USER_A, 'pull')
    expect(pull.skills.map((s) => s.name)).toEqual([OWN_SKILL])
    expect(pull.count).toBe(1)
    const list = await syncAction(USER_A, 'list')
    expect(list.skills.map((s) => s.name)).toEqual([OWN_SKILL])

    // 显式点名要拉被停用项也不发(fail-closed:不因"客户端明说我要它"就放行)
    const pullNamed = await syncAction(USER_A, 'pull', [MARKET_SKILL])
    expect(pullNamed.skills).toHaveLength(0)
  })

  it('①b disable 之后同样取不到(先启用→可见→停用→不可见,证明开关真有方向)', async () => {
    await putUserStore(USER_A, [skillRecord(MARKET_SKILL)])
    currentUser = USER_A
    const en = await app.inject({ method: 'POST', url: `/api/skills/${MARKET_SKILL}/enable` })
    expect(en.statusCode).toBe(200)
    expect(await listVisible(USER_A)).toEqual([MARKET_SKILL])

    currentUser = USER_A
    const dis = await app.inject({ method: 'POST', url: `/api/skills/${MARKET_SKILL}/disable` })
    expect(dis.statusCode).toBe(200)
    expect(await listVisible(USER_A)).toEqual([])
    const pull = await syncAction(USER_A, 'pull')
    expect(pull.skills).toHaveLength(0)
  })

  it('② 启用者本人仍取得到(列表/详情/pull/list 四面同形)', async () => {
    await putUserStore(USER_A, [skillRecord(MARKET_SKILL)])
    currentUser = USER_A
    const en = await app.inject({ method: 'POST', url: `/api/skills/${MARKET_SKILL}/enable` })
    expect(en.statusCode).toBe(200)

    expect(await listVisible(USER_A)).toEqual([MARKET_SKILL])
    currentUser = USER_A
    const detail = await app.inject({ method: 'GET', url: `/api/skills/${MARKET_SKILL}` })
    expect(detail.statusCode).toBe(200)
    expect((detail.json().data as { name: string }).name).toBe(MARKET_SKILL)
    expect((await syncAction(USER_A, 'pull')).skills.map((s) => s.name)).toEqual([MARKET_SKILL])
    expect((await syncAction(USER_A, 'list')).skills.map((s) => s.name)).toEqual([MARKET_SKILL])
  })

  it('③ 跨用户不可见:A 的启用集不外溢;body.userId 冒充也借不到;B 停用不动 A 的集合', async () => {
    await putUserStore(USER_A, [skillRecord(MARKET_SKILL)])
    await putUserStore(USER_B, [skillRecord(MARKET_SKILL)])
    currentUser = USER_A
    const en = await app.inject({ method: 'POST', url: `/api/skills/${MARKET_SKILL}/enable` })
    expect(en.statusCode).toBe(200)

    // B 自己没启用 ⇒ B 取不到
    expect(await listVisible(USER_B)).toEqual([])

    // B 的 token + body.userId=A ⇒ 仍按 B 的启用集判(sync 路由只认 request.userId)
    const pullAsB = await syncAction(USER_B, 'pull')
    expect(pullAsB.skills).toHaveLength(0)
    // B 的 GET /skills/enabled 也不得看到 A 的集合
    currentUser = USER_B
    const enabledB = await app.inject({ method: 'GET', url: '/api/skills/enabled' })
    expect((enabledB.json().data as { enabled: string[] }).enabled).toEqual([])
    currentUser = USER_A
    const enabledA = await app.inject({ method: 'GET', url: '/api/skills/enabled' })
    expect((enabledA.json().data as { enabled: string[] }).enabled).toEqual([MARKET_SKILL])

    // B 对同名技能发 disable ⇒ 只动 B 自己的集合,A 不受影响
    currentUser = USER_B
    const disB = await app.inject({ method: 'POST', url: `/api/skills/${MARKET_SKILL}/disable` })
    expect(disB.statusCode).toBe(200)
    expect(await listVisible(USER_A)).toEqual([MARKET_SKILL])
  })

  it('④ 非市场名的用户自建技能不受启用集影响(过滤不越界)', async () => {
    await putUserStore(USER_A, [skillRecord(OWN_SKILL)])
    expect(await listVisible(USER_A)).toEqual([OWN_SKILL])
    expect((await syncAction(USER_A, 'pull')).skills).toHaveLength(1)
  })

  it('⑤ install 自动写入启用集(装完即可用,与白名单语义互洽)', async () => {
    currentUser = USER_A
    const res = await app.inject({ method: 'POST', url: `/api/skills/${MARKET_SKILL}/install` })
    expect(res.statusCode).toBe(200)
    const enabled = await app.inject({ method: 'GET', url: '/api/skills/enabled' })
    expect((enabled.json().data as { enabled: string[] }).enabled).toContain(MARKET_SKILL)
  })

  it('⑥ push 一个停用中的市场名技能:入库但不因 push 复活启用集(写面不被过滤,读面照旧收紧)', async () => {
    currentUser = USER_A
    const push = await app.inject({
      method: 'POST',
      url: '/api/skills/sync',
      payload: {
        userId: USER_A,
        action: 'push',
        skills: [{ name: MARKET_SKILL, content: `# ${MARKET_SKILL}\nbody` }],
      },
    })
    expect(push.statusCode).toBe(200)
    expect(await listVisible(USER_A)).toEqual([])
    const dis = await app.inject({ method: 'POST', url: `/api/skills/${MARKET_SKILL}/enable` })
    expect(dis.statusCode).toBe(200)
    expect(await listVisible(USER_A)).toEqual([MARKET_SKILL])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
