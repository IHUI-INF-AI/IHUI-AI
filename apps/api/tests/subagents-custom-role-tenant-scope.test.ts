// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat P0-3 2026-11-02

/**
 * P0-3 回归锁:自定义角色(全局 Map)的租户归属(2026-11-02)。
 *
 * 背景:`customRoles` 是进程内全局 Map、记录上没有 owner ⇒ list/get/put/delete 四个端点
 * 只有登录(写面还有管理员)闸,任何能登录的调用方拿到 id 就能读/改/删别人的角色定义;
 * role 唯一性还是**全租户**判重,既让租户间命名互相干扰,也通过 409 泄漏"别的租户已有同名"。
 *
 * 本文件钉住:
 *  ① list 不含他人的 id / systemPrompt;
 *  ② GET / PUT / DELETE 跨租户一律 404(不是 403),且 PUT 后逐字段 snapshot 不变;
 *  ③ DELETE 跨租户 404 且底层 Map 仍保留该记录(不是"先删后补");
 *  ④ 两个租户用同名各自创建成功(唯一性改为租户内);
 *  ⑤ 同租户内重名仍 409;
 *  ⑥ 正例:本人 get/put/delete 全通。
 *
 * 反向例(实测见交付报告):删掉任一归属闸 ⇒ 对应用例立刻变红。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  checkAuth: async () => true,
}))

// 管理员闸由 subagent-roles-admin-gate.test.ts 单独覆盖;本票只验归属,放行并注入身份。
// isSystemAdmin 必须一并给:dispatch-ownership 的 isAdminViewer 走这个唯一口径(本文件无管理面用例)。
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdminRouteGuard: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  isSystemAdmin: () => false,
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    findById: () => null,
    getMessages: () => [],
    getDispatchStats: () => null,
  },
}))

import { subagentsExtendedRoutes, __test__ } from '../src/routes/subagents-extended-routes.js'

const asA = { 'x-probe-user': 'tenant-a' }
const asB = { 'x-probe-user': 'tenant-b' }

function rolePayload(role: string, systemPrompt: string) {
  return {
    role,
    displayName: `${role}-display`,
    systemPrompt,
    skills: ['s1'],
    recommendedTasks: ['t1'],
  }
}

interface RoleBody {
  code: number
  data: { role: { id: string; ownerUserId: string; role: string; systemPrompt: string } }
}

let app: FastifyInstance

async function create(
  headers: Record<string, string>,
  role: string,
  systemPrompt: string,
): Promise<{ status: number; body: RoleBody; id?: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/subagents/roles/custom',
    headers,
    payload: rolePayload(role, systemPrompt),
  })
  const body = res.json() as RoleBody
  return { status: res.statusCode, body, id: body.data?.role?.id }
}

async function getRole(headers: Record<string, string>, id: string) {
  return app.inject({ method: 'GET', url: `/api/subagents/roles/custom/${id}`, headers })
}

beforeEach(async () => {
  __test__.customRoles.clear()
  __test__.evolutionHistories.clear()
  app = Fastify()
  await app.register(subagentsExtendedRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('P0-3 ① list 只含本人', () => {
  it('B 的 list 不含 A 的 id 与 systemPrompt', async () => {
    const a = await create(asA, 'a-only-role', 'A-SECRET-PROMPT')
    expect(a.status).toBe(200)

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/roles/custom',
      headers: asB,
    })
    expect(res.statusCode).toBe(200)
    const roles = (res.json() as { data: { roles: Array<{ id: string; systemPrompt: string }> } })
      .data.roles
    expect(roles).toEqual([])
    expect(res.body).not.toContain(a.id!)
    expect(res.body).not.toContain('A-SECRET-PROMPT')

    // 正例:A 自己的 list 看得到
    const own = await app.inject({
      method: 'GET',
      url: '/api/subagents/roles/custom',
      headers: asA,
    })
    expect((own.json() as { data: { roles: Array<{ id: string }> } }).data.roles).toHaveLength(1)
  })
})

describe('P0-3 ② GET / PUT 跨租户 404', () => {
  it('B 读 A 的角色 ⇒ 404,响应体不含 A 的 systemPrompt', async () => {
    const a = await create(asA, 'a-get-role', 'A-GET-SECRET')
    const res = await getRole(asB, a.id!)
    expect(res.statusCode).toBe(404)
    expect(res.statusCode).not.toBe(403)
    expect(res.body).not.toContain('A-GET-SECRET')
  })

  it('B PUT A 的角色 ⇒ 404,且 A 的记录逐字段 snapshot 不变', async () => {
    const a = await create(asA, 'a-put-role', 'A-PUT-ORIGINAL')
    const before = (await getRole(asA, a.id!)).json() as RoleBody
    const beforeRecord = { ...__test__.customRoles.get(a.id!)! }

    const res = await app.inject({
      method: 'PUT',
      url: `/api/subagents/roles/custom/${a.id}`,
      headers: asB,
      payload: rolePayload('hijacked-role', 'B-HIJACK-PROMPT'),
    })
    expect(res.statusCode).toBe(404)

    const after = (await getRole(asA, a.id!)).json() as RoleBody
    expect(after).toEqual(before)
    expect(__test__.customRoles.get(a.id!)).toEqual(beforeRecord)
    expect(__test__.customRoles.get(a.id!)!.systemPrompt).toBe('A-PUT-ORIGINAL')
    expect(__test__.customRoles.get(a.id!)!.role).toBe('a-put-role')
  })
})

describe('P0-3 ③ DELETE 跨租户 404 且记录仍在', () => {
  it('B 删 A 的角色 ⇒ 404,底层 Map 仍存在该记录,A 仍能读到', async () => {
    const a = await create(asA, 'a-del-role', 'A-DEL-ORIGINAL')

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/subagents/roles/custom/${a.id}`,
      headers: asB,
    })
    expect(res.statusCode).toBe(404)
    expect(__test__.customRoles.has(a.id!)).toBe(true)
    expect(__test__.customRoles.get(a.id!)!.systemPrompt).toBe('A-DEL-ORIGINAL')

    const still = await getRole(asA, a.id!)
    expect(still.statusCode).toBe(200)
  })
})

describe('P0-3 ④ role 唯一性改为租户内', () => {
  it('两个租户用同一个技术名各自创建成功', async () => {
    const a = await create(asA, 'shared-role', 'A-SHARED')
    const b = await create(asB, 'shared-role', 'B-SHARED')

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(a.id).not.toBe(b.id)
    expect(__test__.customRoles.get(a.id!)!.ownerUserId).toBe('tenant-a')
    expect(__test__.customRoles.get(b.id!)!.ownerUserId).toBe('tenant-b')
  })

  it('同租户内重名仍 409,文案只回显请求里的名字(不泄漏跨租户存在性)', async () => {
    await create(asA, 'dup-role', 'A-DUP')
    const again = await create(asA, 'dup-role', 'A-DUP-2')
    expect(again.status).toBe(409)
    expect((again.body as unknown as { message: string }).message).toContain('dup-role')

    // 反向:跨租户同名不是冲突 —— 若是全租户判重,这里会是 409
    const cross = await create(asB, 'dup-role', 'B-DUP')
    expect(cross.status).toBe(200)
  })
})

describe('P0-3 ⑥ 正例:本人 get / put / delete 全通', () => {
  it('本人读改删都成功(闸只挡跨租户,不挡属主)', async () => {
    const a = await create(asA, 'a-own-role', 'A-OWN-ORIGINAL')

    const got = await getRole(asA, a.id!)
    expect(got.statusCode).toBe(200)

    const put = await app.inject({
      method: 'PUT',
      url: `/api/subagents/roles/custom/${a.id}`,
      headers: asA,
      payload: rolePayload('a-own-role-v2', 'A-OWN-UPDATED'),
    })
    expect(put.statusCode).toBe(200)
    expect(__test__.customRoles.get(a.id!)!.systemPrompt).toBe('A-OWN-UPDATED')
    // owner 不因 PUT 丢失
    expect(__test__.customRoles.get(a.id!)!.ownerUserId).toBe('tenant-a')

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/subagents/roles/custom/${a.id}`,
      headers: asA,
    })
    expect(del.statusCode).toBe(200)
    expect(__test__.customRoles.has(a.id!)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
