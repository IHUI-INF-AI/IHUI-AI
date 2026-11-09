// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * workspace-ai Persona 写操作的管理员闸(F-364,P1)。
 *
 * 缺陷:Persona 是全局共享资产(内置名单 + 单文件落盘),无 ownerId;`PATCH /personas/:id`
 * 此前只过 `requireAuth` 且 body 是 `z.record(...)`,任意登录用户可覆盖
 * systemPrompt/tools/modelId/enabled(含 BUILTIN_PERSONAS)并持久化,影响所有用户。
 *
 * 本文件钉住三件事:
 *  ① 普通登录用户 → PATCH/POST/DELETE 一律 403,且 registry 写方法/落盘零调用;
 *  ② 管理员 → PATCH 自建人格 200 且恰好落盘一次;
 *  ③ 内置人格的 systemPrompt 等字段对所有人不可变(管理员也拒绝,服务层再兜底)。
 *
 * 旧代码(未加闸/未拒内置)下本文件应为红:普通用户 PATCH 会拿到 200,update/persist 被调用。
 *
 * 隔离:auth 桩只替换 authenticate(按请求头给 userId/roleId);personaRegistry 的
 * persist 被 spy 成纯内存 no-op(绝不写 ~/.ihui/personas.json),不连 PG/Redis、零网络。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: unknown) => request),
}))

vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return { ...actual, authenticate: mockAuthenticate }
})

import { personaRegistry } from '../src/services/workspace-ai-service.js'
import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

const PREFIX = '/api/workspace'
const REGULAR_USER = 'user-regular'
const ADMIN_USER = 'user-admin'
const BUILTIN_ID = 'code-reviewer'

type RegistrySpies = {
  update: ReturnType<typeof vi.spyOn>
  create: ReturnType<typeof vi.spyOn>
  delete: ReturnType<typeof vi.spyOn>
  persist: ReturnType<typeof vi.spyOn>
}

let app: FastifyInstance
let spies: RegistrySpies
let customId: string
let seedSeq = 0

function totalRegistryWrites(): number {
  return spies.update.mock.calls.length + spies.create.mock.calls.length + spies.delete.mock.calls.length
}

/** 按请求头构造调用者;x-probe-user 缺省即未登录 */
function actorHeaders(userId?: string, roleId = 0): Record<string, string> {
  if (!userId) return {}
  return { 'x-probe-user': userId, 'x-probe-role': String(roleId) }
}

async function injectPersona(
  method: 'POST' | 'PATCH' | 'DELETE',
  id: string | null,
  headers: Record<string, string>,
  payload?: Record<string, unknown>,
) {
  const url = id === null ? `${PREFIX}/personas` : `${PREFIX}/personas/${id}`
  return app.inject({
    method,
    url,
    headers,
    ...(payload ? { payload } : {}),
  })
}

function customPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: customId,
    name: 'F-364 自建人格',
    category: 'test',
    description: '仅用于管理员闸回归',
    systemPrompt: 'base prompt',
    ...overrides,
  }
}

describe('workspace-ai Persona 写操作管理员闸(F-364)', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(workspaceAiRoutes, { prefix: PREFIX })
    await app.ready()
  }, 180_000)

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    const persistTarget = personaRegistry as unknown as { persist: () => void }
    spies = {
      update: vi.spyOn(personaRegistry, 'update'),
      create: vi.spyOn(personaRegistry, 'create'),
      delete: vi.spyOn(personaRegistry, 'delete'),
      persist: vi.spyOn(persistTarget, 'persist').mockImplementation(() => {}),
    }

    // 夹具:直接种一个自建人格(不经路由),随后清空计数 —— 只统计被测请求的写行为。
    customId = `f364-custom-${Date.now()}-${seedSeq++}`
    personaRegistry.create({
      id: customId,
      name: 'F-364 自建人格',
      category: 'test',
      description: '仅用于管理员闸回归',
      systemPrompt: 'base prompt',
    })
    spies.update.mockClear()
    spies.create.mockClear()
    spies.delete.mockClear()
    spies.persist.mockClear()

    mockAuthenticate.mockImplementation(async (request: unknown) => {
      const req = request as {
        headers: Record<string, unknown>
        userId?: string
        jwtPayload?: { userId?: string; roleId?: number }
      }
      const raw = req.headers['x-probe-user']
      if (typeof raw !== 'string' || raw.length === 0) {
        const err = new Error('Authentication required') as Error & { statusCode: number }
        err.statusCode = 401
        throw err
      }
      const roleId = Number(req.headers['x-probe-role'] ?? 0)
      req.userId = raw
      req.jwtPayload = { userId: raw, roleId }
      return req
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockAuthenticate.mockReset()
  })

  it('普通用户 PATCH 内置人格 → 403,registry 写入/落盘零调用,提示词不变', async () => {
    const original = personaRegistry.get(BUILTIN_ID)?.systemPrompt

    const res = await injectPersona('PATCH', BUILTIN_ID, actorHeaders(REGULAR_USER, 0), {
      systemPrompt: 'pwned',
    })

    expect(res.statusCode).toBe(403)
    expect(totalRegistryWrites()).toBe(0)
    expect(spies.persist).not.toHaveBeenCalled()
    expect(personaRegistry.get(BUILTIN_ID)?.systemPrompt).toBe(original)
  })

  it('普通用户 PATCH 自建人格 → 403,registry 写入/落盘零调用', async () => {
    const res = await injectPersona('PATCH', customId, actorHeaders(REGULAR_USER, 0), {
      systemPrompt: 'pwned',
    })

    expect(res.statusCode).toBe(403)
    expect(totalRegistryWrites()).toBe(0)
    expect(spies.persist).not.toHaveBeenCalled()
    expect(personaRegistry.get(customId)?.systemPrompt).toBe('base prompt')
  })

  it('普通用户 POST 人格 → 403,registry 写入/落盘零调用', async () => {
    const res = await injectPersona('POST', null, actorHeaders(REGULAR_USER, 0), {
      id: `f364-created-by-user-${Date.now()}`,
      name: '普通用户创建',
      category: 'test',
      description: '不应落库',
      systemPrompt: 'pwned',
    })

    expect(res.statusCode).toBe(403)
    expect(totalRegistryWrites()).toBe(0)
    expect(spies.persist).not.toHaveBeenCalled()
  })

  it('普通用户 DELETE 自建人格 → 403,registry 写入/落盘零调用', async () => {
    const res = await injectPersona('DELETE', customId, actorHeaders(REGULAR_USER, 0))

    expect(res.statusCode).toBe(403)
    expect(spies.delete).not.toHaveBeenCalled()
    expect(spies.persist).not.toHaveBeenCalled()
    expect(personaRegistry.get(customId)).not.toBeNull()
  })

  it('管理员 PATCH 自建人格 → 200,update/persist 各一次且内容生效', async () => {
    const res = await injectPersona('PATCH', customId, actorHeaders(ADMIN_USER, 1), {
      systemPrompt: 'patched-by-admin',
    })

    expect(res.statusCode).toBe(200)
    expect(spies.update).toHaveBeenCalledTimes(1)
    expect(spies.persist).toHaveBeenCalledTimes(1)
    expect((res.json() as { data: { systemPrompt: string } }).data.systemPrompt).toBe(
      'patched-by-admin',
    )
    expect(personaRegistry.get(customId)?.systemPrompt).toBe('patched-by-admin')
  })

  it('管理员 PATCH 内置人格 → 403,零写入,身份字段与提示词均不变', async () => {
    const original = { ...personaRegistry.get(BUILTIN_ID)! }

    const res = await injectPersona('PATCH', BUILTIN_ID, actorHeaders(ADMIN_USER, 1), {
      systemPrompt: 'pwned-by-admin',
      id: 'hijacked',
      builtin: false,
    })

    expect(res.statusCode).toBe(403)
    expect(totalRegistryWrites()).toBe(0)
    expect(spies.persist).not.toHaveBeenCalled()
    expect(personaRegistry.get(BUILTIN_ID)).toEqual(original)
  })

  it('管理员 DELETE 内置人格 → 404(服务层拒绝内置),零落盘', async () => {
    const res = await injectPersona('DELETE', BUILTIN_ID, actorHeaders(ADMIN_USER, 1))

    expect(res.statusCode).toBe(404)
    expect(spies.persist).not.toHaveBeenCalled()
    expect(personaRegistry.get(BUILTIN_ID)).not.toBeNull()
  })

  it('未登录 PATCH 内置人格 → 401,registry 写入零调用', async () => {
    const res = await injectPersona('PATCH', BUILTIN_ID, actorHeaders(), {
      systemPrompt: 'pwned',
    })

    expect(res.statusCode).toBe(401)
    expect(totalRegistryWrites()).toBe(0)
    expect(spies.persist).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
