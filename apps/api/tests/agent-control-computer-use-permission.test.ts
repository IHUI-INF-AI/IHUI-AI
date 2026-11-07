// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { AgentActionResponse } from '@ihui/types'

/**
 * computer-use 应用白名单 + 授权记忆的消费方测试(2026-11-04 立)。
 *
 * 验证的是**真实路由接线**:`POST /execute` 在 category='computer' 且声明了 appName 时
 * 必须走 `evaluateComputerUse`;判定侧(而非存储侧)负责 scope / expiresAt 校验。
 * 授权记忆的持久化层用内存替身,避免测试触达 PG;engine 本身是真实实现。
 */
const { mockAuthenticate, mockCheckAuth, mockCheckAuthOrInternal, state } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn<(request: unknown) => Promise<unknown>>(),
  mockCheckAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'user-a'
    return true
  }),
  mockCheckAuthOrInternal: vi.fn<(request: unknown, reply: unknown) => Promise<boolean>>(),
  state: {
    grants: [] as Array<Record<string, unknown>>,
    created: 0,
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
  checkAuthOrInternalService: mockCheckAuthOrInternal,
}))

vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (err: unknown) => String(err),
}))

vi.mock('../src/services/permission-grants.js', () => ({
  loadPermissionGrants: async () => state.grants,
  createPermissionGrant: async (
    _userId: string,
    body: {
      tool: string
      matchPattern: string
      scope: string
      workspaceId?: string
      agentId?: string
      ttlSeconds?: number
    },
  ) => {
    const now = Date.now()
    state.created += 1
    const grant = {
      id: `grant-${state.created}`,
      tool: body.tool,
      matchPattern: body.matchPattern,
      scope: body.scope,
      ...(body.workspaceId ? { workspaceId: body.workspaceId } : {}),
      ...(body.agentId ? { agentId: body.agentId } : {}),
      expiresAt: now + (body.ttlSeconds ?? 86_400) * 1000,
      createdAt: now,
      grantedBy: 'user-a',
    }
    state.grants.push(grant)
    return grant
  },
  revokePermissionGrant: async (_userId: string, id: string) => {
    const index = state.grants.findIndex((g) => g.id === id)
    if (index < 0) return false
    state.grants.splice(index, 1)
    return true
  },
  recordApprovalHistory: async () => undefined,
  listApprovalHistory: () => [],
  clearApprovalHistory: () => undefined,
}))

import { agentControlRoutes } from '../src/routes/agent-control.js'

const PREFIX = '/api/agent-control'
const SECRET = 'agent-control-computer-use-test-secret'
const USER_A = '00000000-0000-4000-8000-00000000000a'

let app: FastifyInstance
const pushNotification = vi.fn<(userId: string, payload: unknown) => void>()

/** 构造一条 computer-use 执行请求(端未连接 ⇒ 闸门放行后必然 TARGET_NOT_CONNECTED) */
async function executeComputerUse(
  params: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return app.inject({
    method: 'POST',
    url: `${PREFIX}/execute`,
    headers: { authorization: `Bearer ${SECRET}` },
    payload: {
      requestId: `req-${Math.random().toString(36).slice(2, 10)}`,
      category: 'computer',
      action: 'mouse_click',
      params,
      timeout: 1000,
      userId: USER_A,
      ...extra,
    },
  })
}

function grant(over: Record<string, unknown> = {}) {
  const now = Date.now()
  return {
    id: `g-${now}-${Math.random().toString(36).slice(2, 7)}`,
    tool: 'computer_use',
    matchPattern: 'chrome',
    scope: 'global',
    expiresAt: now + 3_600_000,
    createdAt: now,
    grantedBy: 'user-a',
    ...over,
  }
}

describe('computer-use 应用白名单 — /execute 闸门 + 授权记忆路由', () => {
  beforeAll(async () => {
    process.env.AGENT_CONTROL_INTERNAL_SECRET = SECRET
    app = Fastify({ logger: false })
    app.decorate('pushNotification', pushNotification)
    await app.register(agentControlRoutes, { prefix: PREFIX })
    await app.ready()
  }, 180_000)

  afterAll(async () => {
    delete process.env.AGENT_CONTROL_INTERNAL_SECRET
    await app.close()
  })

  beforeEach(() => {
    state.grants.length = 0
    state.created = 0
    pushNotification.mockReset()
  })

  it('① 未授权的应用一律 PERMISSION_DENIED,不默认全放', async () => {
    const res = await executeComputerUse({ appName: 'chrome' })
    const body = res.json<{ data: AgentActionResponse }>().data
    expect(body.success).toBe(false)
    expect(body.errorCode).toBe('PERMISSION_DENIED')
    expect(body.error).toContain('ask.app-not-whitelisted')
    expect(pushNotification).not.toHaveBeenCalled()
  })

  it('② 命中授权记忆后闸门放行(端未连接 ⇒ TARGET_NOT_CONNECTED)', async () => {
    state.grants.push(grant())
    const res = await executeComputerUse({ appName: 'chrome' })
    const body = res.json<{ data: AgentActionResponse }>().data
    expect(body.success).toBe(false)
    expect(body.errorCode).toBe('TARGET_NOT_CONNECTED')
  })

  it('③ 授权过期(expiresAt 在过去)必须重新 ask', async () => {
    state.grants.push(grant({ expiresAt: Date.now() - 60_000 }))
    const res = await executeComputerUse({ appName: 'chrome' })
    const body = res.json<{ data: AgentActionResponse }>().data
    expect(body.errorCode).toBe('PERMISSION_DENIED')
    expect(body.error).toContain('ask.app-not-whitelisted')
  })

  it('④ scope 不匹配(别个 agent 的授权)必须重新 ask', async () => {
    state.grants.push(grant({ scope: 'agent', agentId: 'agent-other' }))
    const res = await executeComputerUse({ appName: 'chrome' }, { sessionId: 'agent-me' })
    const body = res.json<{ data: AgentActionResponse }>().data
    expect(body.errorCode).toBe('PERMISSION_DENIED')
  })

  it('⑤ 凭据/密码类应用即便有授权也 deny', async () => {
    state.grants.push(grant({ matchPattern: '1Password' }))
    const res = await executeComputerUse({ appName: '1Password' })
    const body = res.json<{ data: AgentActionResponse }>().data
    expect(body.errorCode).toBe('PERMISSION_DENIED')
    expect(body.error).toContain('deny.app-blocked')
  })

  it('⑥ 白名单应用名不匹配时不放行(非通配即字面量)', async () => {
    state.grants.push(grant({ matchPattern: 'firefox' }))
    const res = await executeComputerUse({ appName: 'chrome' })
    const body = res.json<{ data: AgentActionResponse }>().data
    expect(body.errorCode).toBe('PERMISSION_DENIED')
  })

  it('⑦ 授权路由:创建 → 列举 → 撤销,撤销后再撤 404', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `${PREFIX}/permission/grants`,
      payload: { tool: 'computer_use', matchPattern: 'notepad', scope: 'global', ttlSeconds: 3600 },
    })
    expect(created.statusCode).toBe(200)
    const createdBody = created.json<{ data: { grant: Record<string, unknown> } }>().data
    expect(createdBody.grant.matchPattern).toBe('notepad')
    expect(createdBody.grant.grantedBy).toBe('user-a')
    expect(typeof createdBody.grant.expiresAt).toBe('number')

    const listed = await app.inject({ method: 'GET', url: `${PREFIX}/permission/grants` })
    expect(listed.statusCode).toBe(200)
    expect(listed.json<{ data: { grants: unknown[] } }>().data.grants).toHaveLength(1)

    const grantId = String(createdBody.grant.id)
    const revoked = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/permission/grants/${grantId}`,
    })
    expect(revoked.statusCode).toBe(200)

    const again = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/permission/grants/${grantId}`,
    })
    expect(again.statusCode).toBe(404)
  })

  it('⑧ 授权路由:非法 body 400(scope 必填且只能是三值之一)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/permission/grants`,
      payload: { tool: 'computer_use', matchPattern: 'chrome', scope: 'everyone' },
    })
    expect(res.statusCode).toBe(400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
