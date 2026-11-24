// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-55(P1) 回归:OAuth 平台签名密钥管理面必须管理员可达,且不得吊销唯一 active 密钥。
 *
 * HEAD 状态(2026-11-11 核对):`oauth-keys.ts` 已把插件级守卫从 `authenticate` 换成
 * `requireAdmin`,但 `/revoke` 对"该 provider 最后一把 active 密钥"没有保护 ——
 * 管理员一次误操作即可让 JWKS 为空。本套件同时钉住两件事:
 *  1. 普通登录用户(roleId=0)调 generate/rotate/revoke ⇒ 403,且 DB 零调用;
 *  2. 管理员放行;但吊销唯一 active 密钥 ⇒ 409 且不落任何写操作(其余吊销行为不变)。
 *
 * 用真实 requireAdmin(仅 authenticate 用桩注入身份)+ 同形 drizzle 链式替身。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

const KEY_ID = '123e4567-e89b-42d3-a456-426614174000'
const OTHER_KEY_ID = '123e4567-e89b-42d3-a456-426614174001'
const USER_ID = '11111111-1111-4111-8111-111111111111'

/** 角色、select 结果队列、写链 RETURNING 命中集均由本状态驱动。 */
const state = vi.hoisted(() => ({
  roleId: 0,
  ops: [] as string[],
  /** 每条 select 链在 await 时按队列顺序取一组行(缺省空集)。 */
  selectQueue: [] as unknown[][],
  writeRows: [] as unknown[],
}))

// ADMIN_TOTP_MODE=off:本套件只钉管理员闸与唯一 active 保护,不引入 TOTP 绑定态查询。
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
  requireActiveUser: vi.fn(async () => {}),
}))

vi.mock('../src/services/totp-service.js', () => ({
  getTotpStatus: vi.fn(async () => null),
}))

/**
 * 与真 drizzle 同形的链式替身:中间态可继续链式调用,也可 await / .returning()。
 * 每条方法调用记进 ops,供"403 / 409 时写库零调用"断言。
 */
function chain(kind: 'select' | 'insert' | 'update' | 'delete'): Record<string, unknown> {
  const target = function () {} as unknown as Record<string, unknown>
  const proxy: Record<string, unknown> = new Proxy(target, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
          const rows = kind === 'select' ? (state.selectQueue.shift() ?? []) : state.writeRows
          return Promise.resolve(rows).then(resolve, reject)
        }
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

function keyRow(id: string, clientId = 'ihui-oidc-as', isActive = 1): KeyRow {
  const at = new Date('2026-11-01T00:00:00.000Z')
  return {
    id,
    clientId,
    privateKey: '-----BEGIN PRIVATE KEY-----secret',
    publicKey: '-----BEGIN PUBLIC KEY-----public',
    keyType: 'RSA',
    isActive,
    createdAt: at,
    updatedAt: at,
  }
}

/** 写库动作(一次都没有 = 闸门/唯一 active 保护在落库前就返回了)。 */
function writeOps(): string[] {
  return state.ops.filter((op) => /^(insert|update|delete):/.test(op))
}

let app: FastifyInstance

beforeEach(async () => {
  state.roleId = 0
  state.ops.length = 0
  state.selectQueue.length = 0
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

describe('F-55 普通登录用户(roleId=0)⇒ 403 且不写库', () => {
  const writeRequests: Array<{ name: string; url: string; payload: Record<string, unknown> }> = [
    { name: 'POST /generate', url: '/api/oauth-keys/generate', payload: { provider: 'github' } },
    { name: 'POST /rotate', url: '/api/oauth-keys/rotate', payload: { keyId: KEY_ID } },
    { name: 'POST /revoke', url: '/api/oauth-keys/revoke', payload: { keyId: KEY_ID } },
  ]

  for (const request of writeRequests) {
    it(`${request.name}:403「需要管理员权限」,DB 零调用`, async () => {
      const res = await app.inject({ method: 'POST', url: request.url, payload: request.payload })
      expect(res.statusCode, `body=${res.body}`).toBe(403)
      expect(res.json()).toEqual({ code: 403, message: '需要管理员权限' })
      expect(state.ops, `实际调用=${state.ops.join(',')}`).toEqual([])
    })
  }
})

describe('F-55 管理员(roleId>=1)⇒ 放行', () => {
  beforeEach(() => {
    state.roleId = 1
  })

  it('POST /generate ⇒ 200 且落库', async () => {
    state.writeRows = [keyRow(KEY_ID)]
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/generate',
      payload: { provider: 'ihui-oidc-as' },
    })
    expect(res.statusCode, `body=${res.body}`).toBe(200)
    expect(res.json().data).toMatchObject({ keyId: KEY_ID, clientId: 'ihui-oidc-as' })
    expect(writeOps()).toContain('insert:values')
  })

  it('POST /rotate ⇒ 200(旧密钥置 inactive + 插入新密钥)', async () => {
    state.selectQueue = [[keyRow(KEY_ID)]]
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

  it('POST /revoke:同 provider 还有第二把 active ⇒ 200 revoked:true', async () => {
    state.selectQueue = [[keyRow(KEY_ID)], [{ value: 2 }]]
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

  it('POST /revoke:目标已 inactive ⇒ 幂等放行,且不发起 active 计数查询', async () => {
    state.selectQueue = [[keyRow(KEY_ID, 'ihui-oidc-as', 0)]]
    state.writeRows = [{ id: KEY_ID }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/revoke',
      payload: { keyId: KEY_ID },
    })
    expect(res.statusCode, `body=${res.body}`).toBe(200)
    expect(res.json().data).toEqual({ keyId: KEY_ID, revoked: true })
    expect(writeOps()).toContain('update:returning')
    expect(state.ops.filter((op) => op === 'select:from')).toHaveLength(1)
  })
})

describe('F-55 /revoke 唯一 active 保护(避免把 JWKS 打空)', () => {
  beforeEach(() => {
    state.roleId = 1
  })

  it('目标是该 provider 唯一 active 密钥 ⇒ 409,且不发起 UPDATE', async () => {
    state.selectQueue = [[keyRow(KEY_ID)], [{ value: 1 }]]
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/revoke',
      payload: { keyId: KEY_ID },
    })
    expect(res.statusCode, `body=${res.body}`).toBe(409)
    expect(res.json()).toMatchObject({ code: 409 })
    expect(res.json().message).toContain('唯一生效')
    expect(writeOps(), `实际写库=${writeOps().join(',')}`).toEqual([])
  })

  it('active 计数不是 1(如 0)⇒ 不误拦,照常吊销', async () => {
    state.selectQueue = [[keyRow(KEY_ID)], [{ value: 0 }]]
    state.writeRows = [{ id: KEY_ID }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/revoke',
      payload: { keyId: KEY_ID },
    })
    expect(res.statusCode, `body=${res.body}`).toBe(200)
    expect(res.json().data).toEqual({ keyId: KEY_ID, revoked: true })
  })
})
