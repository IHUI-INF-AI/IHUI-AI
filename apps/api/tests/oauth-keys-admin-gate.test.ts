// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-55(P1) 回归:OAuth 平台签名密钥管理面必须挂 requireAdmin。
 *
 * 旧实现(oauth-keys.ts)只挂 `authenticate`:任意已登录用户都能 POST /generate、
 * /rotate、/revoke 轮转或吊销平台密钥。本套件用真实 requireAdmin + mock 鉴权/DB:
 *  - 普通登录用户(roleId=0)访问全部 5 个端点 → 403,且写库方法零调用;
 *  - 管理员(roleId>=1)→ 正常走业务链(200)。
 * 撤回 `server.addHook('preHandler', requireAdmin)`(或改回 authenticate)时,
 * 第一组 403 用例立即翻红。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

const KEY_ID = '123e4567-e89b-42d3-a456-426614174000'
const OTHER_KEY_ID = '123e4567-e89b-42d3-a456-426614174001'
const USER_ID = '11111111-1111-4111-8111-111111111111'

/** 鉴权角色与 DB 行为均由本状态驱动(vi.hoisted 保证 mock 工厂可读)。 */
const state = vi.hoisted(() => ({
  roleId: 0,
  ops: [] as string[],
  selectRows: [] as unknown[],
  writeRows: [] as unknown[],
}))

// ADMIN_TOTP_MODE=off:本套件只钉管理员闸,不让 TOTP 档位引入额外查询。
vi.mock('../src/config/index.js', () => ({
  config: { ADMIN_TOTP_MODE: 'off', NODE_ENV: 'test' },
  isProductionGuard: false,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
    ;(request as { jwtPayload?: { userId: string; roleId: number } }).jwtPayload = {
      userId: USER_ID,
      roleId: state.roleId,
    }
    return { userId: USER_ID, roleId: state.roleId, type: 'access' as const }
  }),
}))

/**
 * 与真 drizzle 同形的链式替身:任一中间态既可继续链式调用,也可 await/.returning()。
 * 每条方法调用都记进 ops,供"403 时写库零调用"断言。
 */
function chain(kind: 'select' | 'insert' | 'update' | 'delete'): Record<string, unknown> {
  const target = function () {} as unknown as Record<string, unknown>
  const proxy: Record<string, unknown> = new Proxy(target, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(kind === 'select' ? state.selectRows : state.writeRows).then(
            resolve,
            reject,
          )
      }
      if (prop === 'returning') {
        return () => {
          state.ops.push(`${kind}:returning`)
          return Promise.resolve(state.writeRows)
        }
      }
      return () => {
        state.ops.push(`${kind}:${prop}`)
        return proxy
      }
    },
    apply() {
      return proxy
    },
  })
  return proxy
}

vi.mock('../src/db/index.js', () => {
  const makeDb = (): Record<string, unknown> => ({
    select: () => chain('select'),
    insert: () => chain('insert'),
    update: () => chain('update'),
    delete: () => chain('delete'),
    execute: async () => [],
  })
  return { db: makeDb(), dbRead: makeDb(), dbClient: {} }
})

import { oauthKeysRoutes } from '../src/routes/oauth-keys.js'

interface KeyRow {
  id: string
  clientId: string
  privateKey: string
  publicKey: string | null
  keyType: string
  isActive: number
  createdAt: Date
  updatedAt: Date
}

function keyRow(id: string, clientId = 'github'): KeyRow {
  const at = new Date('2026-11-01T00:00:00.000Z')
  return {
    id,
    clientId,
    privateKey: '-----BEGIN PRIVATE KEY-----secret',
    publicKey: '-----BEGIN PUBLIC KEY-----public',
    keyType: 'RSA',
    isActive: 1,
    createdAt: at,
    updatedAt: at,
  }
}

/** 写库动作(不含 select)是否发生。 */
function writeOps(): string[] {
  return state.ops.filter((op) => /^(insert|update|delete):/.test(op))
}

let app: FastifyInstance

beforeEach(async () => {
  state.roleId = 0
  state.ops.length = 0
  state.selectRows = []
  state.writeRows = []
  if (!app) {
    app = Fastify({ logger: false })
    await app.register(oauthKeysRoutes, { prefix: '/api/oauth-keys' })
    await app.ready()
  }
})

afterAll(async () => {
  await app?.close()
})

describe('F-55 普通登录用户 → 403 且不写库', () => {
  const writeRequests: Array<{ name: string; url: string; payload: Record<string, unknown> }> = [
    { name: 'POST /generate', url: '/api/oauth-keys/generate', payload: { provider: 'github' } },
    { name: 'POST /rotate', url: '/api/oauth-keys/rotate', payload: { keyId: KEY_ID } },
    { name: 'POST /revoke', url: '/api/oauth-keys/revoke', payload: { keyId: KEY_ID } },
  ]

  for (const request of writeRequests) {
    it(`${request.name}: roleId=0 ⇒ 403「需要管理员权限」,写库零调用`, async () => {
      const res = await app.inject({ method: 'POST', url: request.url, payload: request.payload })
      expect(res.statusCode, `body=${res.body}`).toBe(403)
      expect(res.json()).toMatchObject({ code: 403, message: '需要管理员权限' })
      expect(writeOps(), `实际写库动作=${state.ops.join(',')}`).toEqual([])
    })
  }

  for (const url of ['/api/oauth-keys/list', '/api/oauth-keys/active']) {
    it(`GET ${url}: roleId=0 ⇒ 403,且不发起查询`, async () => {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, `body=${res.body}`).toBe(403)
      expect(res.json()).toMatchObject({ code: 403, message: '需要管理员权限' })
      expect(state.ops).toEqual([])
    })
  }
})

describe('F-55 管理员 → 正常走业务链(200)', () => {
  beforeEach(() => {
    state.roleId = 1
  })

  it('POST /generate ⇒ 200 且落库', async () => {
    state.writeRows = [keyRow(KEY_ID)]
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/generate',
      payload: { provider: 'github' },
    })
    expect(res.statusCode, `body=${res.body}`).toBe(200)
    expect(res.json().data).toMatchObject({ keyId: KEY_ID, clientId: 'github', keyType: 'RSA' })
    expect(writeOps()).toContain('insert:values')
    // 响应白名单不得泄露私钥
    expect(res.json().data).not.toHaveProperty('privateKey')
  })

  it('POST /rotate ⇒ 200(先禁用旧密钥再插入新密钥)', async () => {
    state.selectRows = [keyRow(KEY_ID)]
    state.writeRows = [keyRow(OTHER_KEY_ID)]
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/rotate',
      payload: { keyId: KEY_ID },
    })
    expect(res.statusCode, `body=${res.body}`).toBe(200)
    expect(res.json().data.keyId).toBe(OTHER_KEY_ID)
    expect(writeOps()).toContain('update:set')
    expect(writeOps()).toContain('insert:values')
  })

  it('POST /revoke ⇒ 200 且 revoked 由本次 RETURNING 派生', async () => {
    state.selectRows = [keyRow(KEY_ID)]
    state.writeRows = [{ id: KEY_ID }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/revoke',
      payload: { keyId: KEY_ID },
    })
    expect(res.statusCode, `body=${res.body}`).toBe(200)
    expect(res.json().data).toEqual({ keyId: KEY_ID, revoked: true })
    expect(writeOps()).toContain('update:returning')
  })

  it('GET /list 与 /active ⇒ 200(管理员可读元数据)', async () => {
    state.selectRows = [keyRow(KEY_ID)]
    for (const url of ['/api/oauth-keys/list', '/api/oauth-keys/active']) {
      state.ops.length = 0
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, `body=${res.body}`).toBe(200)
      expect(res.json().data).toBeTruthy()
      expect(state.ops.length).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
