// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自动默认工作区路由（2026-11-27 整合）。
 *
 * 目标：普通用户从会话发起后台任务时，不再先被“选目录”拦住；
 * 但默认目录必须落在服务端已登记的工作区根内，不能静默落到 API 进程 cwd。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockAuthenticate, mockEnsureDefaultWorkspacePermission } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'u1'
  }),
  mockEnsureDefaultWorkspacePermission: vi.fn(async () => ({
    mode: 'accept-edits',
    changed: true,
    addedRules: 26,
  })),
}))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: mockAuthenticate }))
vi.mock('../src/services/workspace-permission-presets.js', () => ({
  ensureDefaultWorkspacePermission: mockEnsureDefaultWorkspacePermission,
}))

import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

const dirs: string[] = []

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-default-workspace-'))
  dirs.push(dir)
  return dir
}

beforeEach(() => {
  mockAuthenticate.mockClear()
  mockEnsureDefaultWorkspacePermission.mockClear()
})

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  delete process.env.IHUI_WORKSPACE_ROOTS
})

describe('POST /api/workspace/agent/default-workspace', () => {
  it('在已登记根内创建用户默认目录并返回真实路径', async () => {
    const root = tempRoot()
    process.env.IHUI_WORKSPACE_ROOTS = root
    const app = Fastify()
    await app.register(workspaceAiRoutes, { prefix: '/api/workspace' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/agent/default-workspace',
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      data?: {
        workspacePath: string
        name: string
        permissionMode?: string
        permissionChanged?: boolean
      }
    }
    expect(body.code).toBe(0)
    const created = body.data?.workspacePath
    expect(created).toContain(root)
    expect(created ? existsSync(created) : false).toBe(true)
    expect(body.data?.name).toBe('AI 默认工作区')
    expect(body.data?.permissionMode).toBe('accept-edits')
    expect(body.data?.permissionChanged).toBe(true)
    expect(mockEnsureDefaultWorkspacePermission).toHaveBeenCalledWith({
      userId: 'u1',
      workspacePath: created,
      name: 'AI 默认工作区',
    })
  })

  it('未登记工作区根时明确拒绝，不创建目录', async () => {
    delete process.env.IHUI_WORKSPACE_ROOTS
    const app = Fastify()
    await app.register(workspaceAiRoutes, { prefix: '/api/workspace' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/agent/default-workspace',
    })
    await app.close()

    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: number }).code).toBe(400)
    expect(mockEnsureDefaultWorkspacePermission).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
