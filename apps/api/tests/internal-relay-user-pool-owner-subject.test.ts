// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-24 交回件收口(AGENTS §5「认证不等于授权」)。
 *
 * 病灶(改前 HEAD 现读):/api/internal/relay/user-pool/{upsert,delete} 的归属主体
 * ownerUserId 取自请求体 —— upsert 把它送进 importAccounts 第三参与归属谓词,delete 把它
 * 送进 DELETE 的 WHERE。该键客户端可整写 ⇒ 持机机凭据者能写/删任意用户的个人池行。
 * 正解:主体只能来自承载层(checkInternalServiceToken 验票后注入 request.userId,已把主体
 * 钉在 uuid ∧ 存在 ∧ 活跃);body 那一位降级为兼容窗核对位,不符即 403 具名拒。
 *
 * 四类用例:A 越权(+成对正向对照)/ B 伪造 / C 未鉴权(不得 500)/ D 归属谓词源形锁。
 *
 * 真库腿(如实盲区):本机只有开发库 ihui(5432)在听,而 tests/setup-real-db.ts 的 beforeAll
 * 会 TRUNCATE 全部业务表 = 摧毁在跑的开发数据,故 db 换成「写通道调用台账」的内存替身,
 * 断言的是「一条写语句都没发出」。补真库凭据后的命令见交付报告。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const ROUTE_FILE = 'apps/api/src/routes/internal-relay-user-pool.ts'

const { SECRET, CALLS, PRINCIPAL } = vi.hoisted(() => ({
  SECRET: { AI_CALLBACK_SECRET: '' },
  // 「副作用」的可观测形态:有没有写语句走到 db 边界、服务被喂了哪个主体
  CALLS: {
    mutations: [] as string[],
    importOwner: [] as Array<string | null | undefined>,
  },
  // injectVerifiedUser 查到的那枚用户(承载层主体的存在性/活跃性由此驱动)
  PRINCIPAL: { id: '', status: 1, roleId: 0 },
}))

vi.mock('../src/config/index.js', () => ({ config: SECRET }))

/** 内存替身 db:写通道逐条记名,查询一律回 PRINCIPAL(§5 测试隔离:不连任何真库) */
vi.mock('../src/db/index.js', () => {
  const makeChain = (label: string) => {
    const api: Record<string, unknown> = {
      select: () => api,
      from: () => api,
      where: () => api,
      set: () => api,
      limit: () => Promise.resolve([PRINCIPAL]),
      returning: () => {
        CALLS.mutations.push(`${label}.delete`)
        return Promise.resolve([])
      },
    }
    return new Proxy(api, {
      get: (t, prop: string) => {
        if (prop === 'insert' || prop === 'update')
          return () => {
            CALLS.mutations.push(`${label}.${prop}`)
            return api
          }
        if (prop === 'delete') return () => api
        return t[prop]
      },
    })
  }
  return { db: makeChain('db'), dbRead: makeChain('dbRead') }
})

vi.mock('../src/services/relay-account-pool-service.js', () => ({
  importAccounts: vi.fn(async (_p: unknown, _a: unknown, owner?: string | null) => {
    CALLS.importOwner.push(owner)
    return { items: [{ status: 'imported', uid: 'uid-1' }] }
  }),
}))

import internalRelayUserPoolRoutes from '../src/routes/internal-relay-user-pool.js'

const UPSERT = '/api/internal/relay/user-pool/upsert'
const DELETE = '/api/internal/relay/user-pool/delete'
const USER_A = '00000000-0000-4000-8000-0000000000a1'
const USER_B = '00000000-0000-4000-8000-0000000000b2'

/** 承载层凭据。如实建模「库里存在该主体」:承载层声明谁,替身就回填谁做主体。 */
const carrier = (userId: string) => {
  PRINCIPAL.id = userId
  return {
    'x-internal-secret': SECRET.AI_CALLBACK_SECRET,
    'x-internal-service-token': SECRET.AI_CALLBACK_SECRET,
    'x-user-id': userId,
  }
}

const upsertBody = (ownerUserId?: string) => ({
  ...(ownerUserId === undefined ? {} : { ownerUserId }),
  platform: 'trae',
  checkinAccountId: 7,
  identityKey: 'uid-1',
  token: 'jwt-token-material',
})

let app: FastifyInstance

async function build(): Promise<FastifyInstance> {
  const fresh = Fastify({ logger: false })
  await fresh.register(internalRelayUserPoolRoutes)
  await fresh.ready()
  return fresh
}

const post = (url: string, headers: Record<string, string>, payload: unknown) =>
  app.inject({ method: 'POST', url, headers, payload })

beforeEach(async () => {
  SECRET.AI_CALLBACK_SECRET = 's'.repeat(48)
  CALLS.mutations = []
  CALLS.importOwner = []
  PRINCIPAL.status = 1
  app = await build()
})

describe('A 越权:主体只能来自承载层', () => {
  it('B 的主体 + body 自报 A ⇒ 403 具名拒 ∧ 零写语句 ∧ importAccounts 未被问', async () => {
    const res = await post(UPSERT, carrier(USER_B), upsertBody(USER_A))
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toMatch(/ownerUserId 不得由客户端自报/)
    expect(CALLS.mutations).toEqual([])
    expect(CALLS.importOwner).toEqual([])
  })

  it('成对正向对照:同主体 ⇒ 200,服务拿到的主体逐字等于承载层主体', async () => {
    const res = await post(UPSERT, carrier(USER_B), upsertBody(USER_B))
    expect(res.statusCode).toBe(200)
    expect(CALLS.importOwner).toEqual([USER_B])
  })

  it('body 不带 ownerUserId(新口径)⇒ 200,主体仍只来自承载层', async () => {
    const res = await post(UPSERT, carrier(USER_A), upsertBody())
    expect(res.statusCode).toBe(200)
    expect(CALLS.importOwner).toEqual([USER_A])
  })

  it('delete 同型:B 的主体 + body 自报 A ⇒ 403 且 DELETE 一条都没发出', async () => {
    const res = await post(DELETE, carrier(USER_B), {
      ownerUserId: USER_A,
      poolAccountId: 'pool-row-1',
    })
    expect(res.statusCode).toBe(403)
    expect(CALLS.mutations).toEqual([])
  })

  it('delete 正向对照:同主体 ⇒ 200 且写通道确有调用(否则上一条是假绿)', async () => {
    const res = await post(DELETE, carrier(USER_A), {
      ownerUserId: USER_A,
      poolAccountId: 'pool-row-1',
    })
    expect(res.statusCode).toBe(200)
    expect(CALLS.mutations).toEqual(['db.delete'])
  })
})

describe('B 伪造:客户端可整写的身份位不得生效', () => {
  it('body 塞运营池哨兵 ⇒ 400 具名,零副作用', async () => {
    const res = await post(UPSERT, carrier(USER_B), upsertBody('system:relay-pool'))
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toMatch(/运营池账号不走反向同步端点/)
    expect(CALLS.mutations).toEqual([])
    expect(CALLS.importOwner).toEqual([])
  })

  it('body 塞非 uuid 主体 ⇒ 403,零副作用', async () => {
    const res = await post(UPSERT, carrier(USER_B), upsertBody('attacker-controlled'))
    expect(res.statusCode).toBe(403)
    expect(CALLS.importOwner).toEqual([])
  })

  it('identityKey 只是业务键:伪造它也只能落在自己的命名空间(第三参恒为主体)', async () => {
    const res = await post(UPSERT, carrier(USER_B), {
      ...upsertBody(),
      identityKey: 'someone-elses-uid',
    })
    expect(res.statusCode).toBe(200)
    expect(CALLS.importOwner).toEqual([USER_B])
  })
})

describe('C 未鉴权:401/403/503,不是 500', () => {
  it('凭据头都不带 ⇒ 401(机机凭据闸先拒)', async () => {
    const res = await app.inject({ method: 'POST', url: UPSERT, payload: upsertBody() })
    expect(res.statusCode).toBe(401)
    expect(CALLS.mutations).toEqual([])
  })

  it('主体不活跃(status≠1)⇒ 403,不是 500', async () => {
    PRINCIPAL.status = 0
    const res = await post(UPSERT, carrier(USER_A), upsertBody())
    expect(res.statusCode).toBe(403)
    expect(CALLS.importOwner).toEqual([])
  })

  it('主体非 uuid 形态 ⇒ 401(零查询归位,不得外溢成 DB 错)', async () => {
    const res = await post(UPSERT, carrier('system-relay-pool'), upsertBody())
    expect(res.statusCode).toBe(401)
    expect(CALLS.mutations).toEqual([])
  })

  it('AI_CALLBACK_SECRET 未配置 ⇒ 503 fail-closed', async () => {
    SECRET.AI_CALLBACK_SECRET = ''
    const fresh = await build()
    const res = await fresh.inject({ method: 'POST', url: DELETE, payload: { poolAccountId: 'x' } })
    expect(res.statusCode).toBe(503)
    await fresh.close()
  })
})

describe('D 归属谓词源形锁(照 Z47 第③例:只量源码面)', () => {
  const src = readFileSync(join(ROOT, ROUTE_FILE), 'utf8')
  const codeLines = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))

  it('主体只从 request.userId 进来,并作为唯一 owner 实参进入归属谓词与服务调用', () => {
    expect(src).toMatch(/const subject = request\.userId/)
    expect(src).toMatch(/checkInternalServiceToken\(request, reply, \{ scope: 'ai-callback' \}\)/)
    expect(src).toMatch(/eq\(aiRelayAccountPool\.ownerUserId, ownerUserId\)/)
    expect(src).not.toMatch(/eq\(aiRelayAccountPool\.ownerUserId, body\.ownerUserId\)/)
    // 代码行里 body.ownerUserId 只许出现在 resolveOwnerSubject 的核对位实参上(那才是兼容窗)
    const reads = codeLines.filter((l) => l.includes('body.ownerUserId'))
    expect(reads.length).toBe(1)
    expect(reads[0]).toMatch(/resolveOwnerSubject\(request, reply, body\.ownerUserId\)/)
    // 变异自证:把旧写法加回来,同一把尺子必须量出来
    const mutated = src.replace(
      'eq(aiRelayAccountPool.ownerUserId, ownerUserId),',
      'eq(aiRelayAccountPool.ownerUserId, body.ownerUserId),',
    )
    expect(mutated).not.toBe(src)
    expect(/eq\(aiRelayAccountPool\.ownerUserId, body\.ownerUserId\)/.test(mutated)).toBe(true)
  })

  it('delete 的 WHERE 同形:owner 位取主体,不取 body', () => {
    const block = src.slice(src.indexOf("'/api/internal/relay/user-pool/delete'"))
    expect(block.length).toBeGreaterThan(0)
    expect(block).toMatch(/eq\(aiRelayAccountPool\.ownerUserId, ownerUserId\)/)
    expect(block).toMatch(/resolveOwnerSubject\(request, reply, declared\)/)
    expect(block).not.toMatch(/data\.ownerUserId\b\s*===?/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
