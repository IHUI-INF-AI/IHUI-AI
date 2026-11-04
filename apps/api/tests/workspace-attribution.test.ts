// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `/api/workspace/attribution` 路由判据:
 *   - 未登录 401;
 *   - 工作区权限门拒绝 403;
 *   - 跨 workspace / `..` 逃逸 403(判据来自 @ihui/shared/attribution,不在路由重写);
 *   - 本工作区内无记录 404;
 *   - 正常写入 + 读取按行区间压缩。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const state = vi.hoisted(() => ({
  authed: true,
  allowed: true,
  rows: [] as Array<{ key: string; value: string | null }>,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    if (!state.authed) throw Object.assign(new Error('未登录'), { statusCode: 401 })
    request.userId = 'u-1'
  }),
  checkAuth: vi.fn().mockResolvedValue(true),
}))

vi.mock('../src/services/workspace-ai-service.js', () => ({
  permissionManager: {
    checkWorkspace: vi.fn(async () =>
      state.allowed ? { allowed: true } : { allowed: false, configured: true, reason: '无权限' },
    ),
  },
}))

vi.mock('../src/db/user-preferences-queries.js', () => ({
  findUserPreferences: vi.fn(async () => ({ list: state.rows, total: state.rows.length })),
  upsertUserPreference: vi.fn(async (_u: string, _g: string, key: string, value: string) => {
    const existing = state.rows.find((row) => row.key === key)
    if (existing) existing.value = value
    else state.rows.push({ key, value })
    return undefined
  }),
}))

import { workspaceAttributionRoutes } from '../src/routes/workspace-attribution.js'

const WORKSPACE = 'G:/WS/main'

function record(filePath: string, startLine: number, endLine: number, source = 'ai') {
  return {
    filePath,
    startLine,
    endLine,
    source,
    origin: { at: '2026-11-04T00:00:00.000Z', sessionId: 's-1', toolCallId: 'tc-1' },
    revision: 1,
  }
}

describe('workspace attribution 路由', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    state.authed = true
    state.allowed = true
    state.rows = []
    app = Fastify()
    await app.register(workspaceAttributionRoutes, { prefix: '/api/workspace' })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('未登录 → 401', async () => {
    state.authed = false
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/attribution?workspacePath=${encodeURIComponent(WORKSPACE)}&file=a.ts`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('工作区权限门拒绝 → 403', async () => {
    state.allowed = false
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/attribution?workspacePath=${encodeURIComponent(WORKSPACE)}&file=a.ts`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('PUT 后再 GET → 返回压缩区间', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/workspace/attribution',
      payload: {
        workspacePath: WORKSPACE,
        filePath: 'a.ts',
        records: [record('a.ts', 2, 3), record('a.ts', 4, 4)],
      },
    })
    expect(put.statusCode).toBe(200)
    const get = await app.inject({
      method: 'GET',
      url: `/api/workspace/attribution?workspacePath=${encodeURIComponent(WORKSPACE)}&file=a.ts`,
    })
    expect(get.statusCode).toBe(200)
    const body = get.json() as { data: { file: string; ranges: Array<Record<string, unknown>> } }
    expect(body.data.file).toBe('a.ts')
    const ai = body.data.ranges.filter((r) => r.source === 'ai')
    expect(ai).toHaveLength(1)
    expect(ai[0]).toMatchObject({ startLine: 2, endLine: 4 })
  })

  it('反向例③:查询另一个 workspace 的绝对路径 → 403', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/workspace/attribution',
      payload: { workspacePath: WORKSPACE, filePath: 'a.ts', records: [record('a.ts', 1, 1)] },
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/attribution?workspacePath=${encodeURIComponent(WORKSPACE)}&file=${encodeURIComponent('G:/WS/other/a.ts')}`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('反向例③:相对路径 ../other/a.ts 逃逸 → 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/attribution?workspacePath=${encodeURIComponent(WORKSPACE)}&file=${encodeURIComponent('../other/a.ts')}`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('工作区内但无记录 → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/attribution?workspacePath=${encodeURIComponent(WORKSPACE)}&file=b.ts`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('PUT 目标文件越界 → 403,不落库', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/workspace/attribution',
      payload: {
        workspacePath: WORKSPACE,
        filePath: 'G:/WS/other/a.ts',
        records: [record('a.ts', 1, 1)],
      },
    })
    expect(res.statusCode).toBe(403)
    expect(state.rows).toHaveLength(0)
  })

  it('缺参数 → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/workspace/attribution' })
    expect(res.statusCode).toBe(400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
