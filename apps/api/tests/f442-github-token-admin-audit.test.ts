// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-442:GitHub 令牌此前是全站单文件(`~/.ihui/github_token`),任意登录用户可覆盖/删除,
 * 一个用户的 PAT 会被所有人的 PR/Issue 调用复用。
 *
 * 本文件钉住修复后的四条契约:
 *  ① 普通登录用户写/删令牌 → 403,且不落库、不写审计;
 *  ② 管理员写/删 → 成功,令牌按 userId 加密落库(不落明文),成功审计恰好一条;
 *  ③ 响应体绝不回显令牌明文;
 *  ④ 设备码换令牌同样只写当前用户,且仅限管理员。
 *
 * 隔离:auth 桩只替换 authenticate(按请求头给 userId/roleId);user_preferences 查询/审计
 * 全部替身为内存 spy;fetch 替身只回固定响应 —— 不连 PG/Redis、零网络。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate, mockUpsert, mockDelete, mockFind, mockRecordAudit } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: unknown) => request),
  mockUpsert: vi.fn(async () => undefined),
  mockDelete: vi.fn(async () => true),
  mockFind: vi.fn(async () => ({ list: [], total: 0 })),
  mockRecordAudit: vi.fn(async () => 'audit-1'),
}))

vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return { ...actual, authenticate: mockAuthenticate }
})

vi.mock('../src/db/user-preferences-queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '../src/db/user-preferences-queries.js',
  )
  return {
    ...actual,
    findUserPreferences: mockFind,
    upsertUserPreference: mockUpsert,
    deleteUserPreference: mockDelete,
  }
})

vi.mock('../src/services/audit-log-service.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '../src/services/audit-log-service.js',
  )
  return { ...actual, recordAuditLog: mockRecordAudit }
})

import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'
import { decryptField } from '../src/utils/crypto.js'

const PREFIX = '/api/workspace'
const REGULAR_USER = 'user-regular'
const ADMIN_USER = 'user-admin'
const SECRET_TOKEN = 'ghp_f442_secret_token_value'

let app: FastifyInstance

function actorHeaders(userId?: string, roleId = 0): Record<string, string> {
  if (!userId) return {}
  return { 'x-probe-user': userId, 'x-probe-role': String(roleId) }
}

function setTokenHeaders(userId?: string, roleId = 0) {
  return actorHeaders(userId, roleId)
}

describe('F-442 GitHub 令牌读写:管理员闸 + 按用户加密落库 + 审计', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(workspaceAiRoutes, { prefix: PREFIX })
    await app.ready()
  }, 180_000)

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ login: 'probe', access_token: SECRET_TOKEN }),
        text: async () => '',
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete process.env.GITHUB_OAUTH_CLIENT_ID
    delete process.env.GITHUB_OAUTH_CLIENT_SECRET
  })

  it('普通登录用户 POST /github/token → 403,不落库、不写审计', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/github/token`,
      headers: setTokenHeaders(REGULAR_USER, 0),
      payload: { workspacePath: '/data/ws', token: SECRET_TOKEN },
    })

    expect(res.statusCode).toBe(403)
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockRecordAudit).not.toHaveBeenCalled()
    expect(res.body).not.toContain(SECRET_TOKEN)
  })

  it('普通登录用户 DELETE /github/token → 403,不删库、不写审计', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/github/token`,
      headers: setTokenHeaders(REGULAR_USER, 0),
    })

    expect(res.statusCode).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockRecordAudit).not.toHaveBeenCalled()
  })

  it('未登录 POST/DELETE → 401,零落库零审计', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `${PREFIX}/github/token`,
      headers: {},
      payload: { workspacePath: '/data/ws', token: SECRET_TOKEN },
    })
    const del = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/github/token`,
      headers: {},
    })

    expect(post.statusCode).toBe(401)
    expect(del.statusCode).toBe(401)
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockRecordAudit).not.toHaveBeenCalled()
  })

  it('管理员 POST /github/token → 200,令牌按 userId 加密落库且审计恰一条(无明文)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/github/token`,
      headers: setTokenHeaders(ADMIN_USER, 1),
      payload: { workspacePath: '/data/ws', token: SECRET_TOKEN },
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain(SECRET_TOKEN)

    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const [userId, group, key, stored] = mockUpsert.mock.calls[0] as unknown as string[]
    expect(userId).toBe(ADMIN_USER)
    expect(group).toBe('workspace_github')
    expect(key).toBe('token')
    expect(stored).not.toContain(SECRET_TOKEN)
    expect(decryptField(stored)).toBe(SECRET_TOKEN)

    expect(mockRecordAudit).toHaveBeenCalledTimes(1)
    const audit = mockRecordAudit.mock.calls[0]?.[0] as unknown as {
      userId: string
      action: string
      result: string
      metadata: Record<string, unknown>
    }
    expect(audit.userId).toBe(ADMIN_USER)
    expect(audit.action).toBe('workspace.github_token.set')
    expect(audit.result).toBe('success')
    expect(audit.metadata.workspacePath).toBe('/data/ws')
    expect(JSON.stringify(audit)).not.toContain(SECRET_TOKEN)
  })

  it('管理员 DELETE /github/token → 200,只删自己的行且审计恰一条', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/github/token`,
      headers: setTokenHeaders(ADMIN_USER, 1),
    })

    expect(res.statusCode).toBe(200)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith(ADMIN_USER, 'workspace_github', 'token')

    expect(mockRecordAudit).toHaveBeenCalledTimes(1)
    const audit = mockRecordAudit.mock.calls[0]?.[0] as unknown as { action: string }
    expect(audit.action).toBe('workspace.github_token.clear')
  })

  it('设备码换令牌:普通用户 403 不落库;管理员成功且审计恰一条', async () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = 'probe-client'
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'probe-secret'

    const denied = await app.inject({
      method: 'POST',
      url: `${PREFIX}/github/device-token`,
      headers: setTokenHeaders(REGULAR_USER, 0),
      payload: { deviceCode: 'device-code-1' },
    })
    expect(denied.statusCode).toBe(403)
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockRecordAudit).not.toHaveBeenCalled()

    const ok = await app.inject({
      method: 'POST',
      url: `${PREFIX}/github/device-token`,
      headers: setTokenHeaders(ADMIN_USER, 1),
      payload: { deviceCode: 'device-code-1' },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.body).not.toContain(SECRET_TOKEN)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const [userId, , , stored] = mockUpsert.mock.calls[0] as unknown as string[]
    expect(userId).toBe(ADMIN_USER)
    expect(stored).not.toContain(SECRET_TOKEN)
    expect(mockRecordAudit).toHaveBeenCalledTimes(1)
    const audit = mockRecordAudit.mock.calls[0]?.[0] as unknown as {
      metadata: Record<string, unknown>
    }
    expect(audit.metadata.source).toBe('device_oauth')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
