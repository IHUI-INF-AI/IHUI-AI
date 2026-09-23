// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13b-⑤ 收编契约:`admin/*` 面统一 preHandler 从 routes/admin.ts 挪进
 * plugins/require-permission.ts 的 `requireAdminRouteGuard` 之后,三条对外行为必须逐字不变。
 *
 * 为什么不能直接复用 `requireAdmin`:差一道 `requireActiveUser`(被注销/封禁账号不得进
 * admin 面)。这层差别是安全语义,所以本文件把"差在那儿"也钉成断言(C 组):
 * 活动检查失败时,即使 roleId>=1 也必须是注销文案,不得被 admin 判定抢先放行。
 *
 * E 组是源码结构层:防止将来有人把裸 roleId 比较又写回 admin.ts(门 53 的判据只认
 * 数值字面量比较,`roleId < ADMIN_ROLE_ID` 这种常量形态它看不见,故必须另钉一道)。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate, mockRequireActiveUser } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRequireActiveUser: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: mockRequireActiveUser,
  checkAuth: vi.fn(),
}))

// 固定成"取不到人话文案",让兜底文案成为可断言的常量(收编前后必须同一兜底)
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: () => '',
}))

import { requireAdminRouteGuard } from '../src/plugins/require-permission.js'

type GateRequest = Parameters<typeof requireAdminRouteGuard>[0]

function setAdmin(roleId: number): void {
  mockAuthenticate.mockImplementation(async (request: GateRequest & { jwtPayload?: object }) => {
    request.jwtPayload = { userId: 'u-1', roleId }
  })
}
function setUnauth(statusCode?: number): void {
  const err = new Error('Authentication required') as Error & { statusCode?: number }
  if (statusCode !== undefined) err.statusCode = statusCode
  mockAuthenticate.mockRejectedValue(err)
}
function setActive(ok: boolean): void {
  if (ok) {
    mockRequireActiveUser.mockResolvedValue(undefined)
    return
  }
  const err = new Error('inactive') as Error & { statusCode?: number }
  err.statusCode = 403
  mockRequireActiveUser.mockRejectedValue(err)
}

describe('O13b-⑤ requireAdminRouteGuard 行为契约', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    if (!app) {
      app = Fastify({ logger: false })
      await app.register(async (scope) => {
        scope.addHook('preHandler', requireAdminRouteGuard)
        scope.get('/admin/probe', async () => ({ code: 0, message: 'ok', data: { hit: true } }))
      })
      await app.ready()
    }
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = () => app.inject({ method: 'GET', url: '/admin/probe' })

  it('A 未鉴权 → 401 + 兜底文案「操作失败,请稍后重试」,且不进业务', async () => {
    setUnauth()
    setActive(true)
    const res = await get()
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ code: 401, message: '操作失败,请稍后重试' })
  })

  it('A2 上游带 statusCode 时沿用该码(不得恒 401)', async () => {
    setUnauth(403)
    setActive(true)
    const res = await get()
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('操作失败,请稍后重试')
  })

  it('C 已鉴权且是管理员,但账号非活动 → 仍是注销文案(活动检查先于 admin 放行)', async () => {
    setAdmin(1)
    setActive(false)
    const res = await get()
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ code: 403, message: '账号已注销' })
  })

  it('D 活动 + 非管理员 → 403「需要管理员权限」,body 与收编前逐字一致', async () => {
    setAdmin(0)
    setActive(true)
    const res = await get()
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ code: 403, message: '需要管理员权限' })
  })

  it('E 活动 + 管理员 → 放行进入业务分支', async () => {
    setAdmin(1)
    setActive(true)
    const res = await get()
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ hit: true })
  })

  it('E2 internal 通道不得打开 admin 面(与 requireAdmin 同一条提权不变量)', async () => {
    // 人已登录但是普通用户,internal 链路又注入了管理员 roleId ⇒ 仍必须 403
    mockAuthenticate.mockImplementation(
      async (request: GateRequest & { jwtPayload?: object; internalUserRoleId?: number }) => {
        request.jwtPayload = { userId: 'u-1', roleId: 0 }
        request.internalUserRoleId = 1
      },
    )
    setActive(true)
    const res = await get()
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('需要管理员权限')
  })
})

describe('O13b-⑤ admin.ts 侧源码结构(裸比较不得回潮)', () => {
  it('admin.ts 注册集中守卫,且自身不再出现任何 roleId 数值比较', async () => {
    const src = await import('../src/routes/admin.ts?raw')
    expect(src.default).toMatch(/server\.addHook\(\s*'preHandler',\s*requireAdminRouteGuard\s*\)/)
    expect(src.default).not.toMatch(/roleId\s*(?:[<>]=?|===|!==)\s*\d/)
    expect(src.default).not.toMatch(/roleId\s*(?:[<>]=?|===|!==)\s*ADMIN_ROLE_ID/)
    expect(src.default).not.toMatch(/^const ADMIN_ROLE_ID\b/m)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
