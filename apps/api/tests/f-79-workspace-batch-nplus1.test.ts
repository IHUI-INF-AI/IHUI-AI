// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-79 回归(P2):工作区批量删除/恢复逐文件串行校验(N+1)
 *
 * 票面:`POST /files/batch-delete` / `batch-restore` 在 for 循环里对每个 id 依次
 * `findFileById` + `findProjectById`,单请求(上限 100 个文件)最多 200 次 DB 往返。
 *
 * 修法:一次 `WHERE id IN (...)`(left join projects 取 owner)取回全部目标行,再按请求
 * 顺序逐项判定(存在性 → 归属);写侧仍走 batchSoftDelete/batchRestore 的 RETURNING 命中集。
 *
 * 本文件不连库:整体替身 `src/db/index.js` 是计数型 fake —— 每次 select/update 记账,
 * 用例断言 100 个文件只发生 2 次查询(≤4),且 IN 列表一次带全 100 个 id。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

interface QueryCall {
  op: 'select' | 'update'
  whereArg?: unknown
}

const { state } = vi.hoisted(() => ({
  state: {
    /** 每次 db.select / db.update 记账一条,长度即单请求的 DB 往返数 */
    queries: [] as QueryCall[],
    /** select 的库回执:文件 id + 所属项目 owner id;update 的 RETURNING 回执单独放 */
    selectRows: [] as Array<{ id: string; projectUserId: string | null }>,
    updateRows: [] as Array<{ id: string }>,
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  // 工厂在模块图初始化期执行,测试主体 id 必须是字面量(引用后声明常量会踩 TDZ)。
  authenticate: async (request: FastifyRequest) => {
    request.userId = '00000000-0000-4000-8000-000000000079'
    return { userId: '00000000-0000-4000-8000-000000000079' }
  },
  checkAuth: async () => true,
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (op: 'select' | 'update'): Record<string, unknown> => {
    const call: QueryCall = { op }
    state.queries.push(call)
    const chain: Record<string, unknown> = {}
    for (const m of [
      'from',
      'leftJoin',
      'innerJoin',
      'on',
      'set',
      'where',
      'returning',
      'orderBy',
      'limit',
      'offset',
    ]) {
      chain[m] = (...args: unknown[]) => {
        if (m === 'where') call.whereArg = args[0]
        return chain
      }
    }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const rows = op === 'select' ? state.selectRows : state.updateRows
      return Promise.resolve(rows).then(resolve, reject)
    }
    return chain
  }

  const db = {
    select: () => makeChain('select'),
    update: () => makeChain('update'),
    insert: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(async () => []),
  }
  return { db, dbRead: db }
})

import { workspaceRoutes } from '../src/routes/workspace.js'
import { findFileOwnershipBatch } from '../src/db/workspace-queries.js'

const USER_ID = '00000000-0000-4000-8000-000000000079'
const OTHER_USER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const MAX_FILES = 100

/** 合法 v4 形状 uuid(i 填充末 12 位十六进制),便于生成 100/200 个互不相同的 id */
function fileId(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
}

function buildFileIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => fileId(i))
}

const dialect = new PgDialect()

function selectCalls(): QueryCall[] {
  return state.queries.filter((c) => c.op === 'select')
}

function updateCalls(): QueryCall[] {
  return state.queries.filter((c) => c.op === 'update')
}

function inListParams(call: QueryCall): unknown[] {
  expect(call.whereArg).toBeTruthy()
  return dialect.sqlToQuery(call.whereArg as SQL).params
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // schema 校验失败的错误体经此归一(与 user-batch-write-confirmed 同形)
  app.setErrorHandler((err: FastifyError, _request, reply) => {
    const statusCode =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
    reply.status(statusCode).send({
      code: statusCode,
      message: statusCode >= 500 ? '服务器错误' : err.message,
    })
  })
  await app.register(workspaceRoutes, { prefix: '/api/workspace' })
  await app.ready()
  return app
}

describe('F-79 工作区批量删除/恢复:归属校验一次 IN 查询(O(1) 往返)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.queries.length = 0
    state.selectRows = []
    state.updateRows = []
  })

  it('batch-delete:100 个文件全部归属本人 ⇒ 2 次查询,IN 一次带全 100 个 id,deleted=100', async () => {
    const ids = buildFileIds(MAX_FILES)
    state.selectRows = ids.map((id) => ({ id, projectUserId: USER_ID }))
    state.updateRows = ids.map((id) => ({ id }))

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-delete',
      payload: { fileIds: ids },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { deleted: 100, missedIds: [] },
    })
    // 常数级往返:1 次归属校验 + 1 次批量 UPDATE,不随文件数增长
    expect(state.queries).toHaveLength(2)
    expect(selectCalls()).toHaveLength(1)
    expect(updateCalls()).toHaveLength(1)
    expect(inListParams(selectCalls()[0]!)).toHaveLength(MAX_FILES)
    expect(inListParams(updateCalls()[0]!)).toHaveLength(MAX_FILES)
  })

  it('batch-restore:100 个文件全部归属本人 ⇒ 2 次查询,restored=100', async () => {
    const ids = buildFileIds(MAX_FILES)
    state.selectRows = ids.map((id) => ({ id, projectUserId: USER_ID }))
    state.updateRows = ids.map((id) => ({ id }))

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-restore',
      payload: { fileIds: ids },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { restored: 100, missedIds: [] },
    })
    expect(state.queries).toHaveLength(2)
    expect(inListParams(selectCalls()[0]!)).toHaveLength(MAX_FILES)
  })

  it('batch-delete:100 个里 1 个属他人项目 ⇒ 403 且零写入(仅 1 次查询)', async () => {
    const ids = buildFileIds(MAX_FILES)
    state.selectRows = ids.map((id, i) => ({
      id,
      projectUserId: i === 42 ? OTHER_USER_ID : USER_ID,
    }))
    state.updateRows = ids.map((id) => ({ id }))

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-delete',
      payload: { fileIds: ids },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ code: 403, message: '无权操作部分文件' })
    expect(state.queries).toHaveLength(1)
    expect(updateCalls()).toHaveLength(0)
  })

  it('batch-restore:100 个里 1 个属他人项目 ⇒ 403 且零写入(仅 1 次查询)', async () => {
    const ids = buildFileIds(MAX_FILES)
    state.selectRows = ids.map((id, i) => ({
      id,
      projectUserId: i === 0 ? OTHER_USER_ID : USER_ID,
    }))

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-restore',
      payload: { fileIds: ids },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ code: 403, message: '无权操作部分文件' })
    expect(state.queries).toHaveLength(1)
    expect(updateCalls()).toHaveLength(0)
  })

  it('batch-delete:100 个里 1 个不存在 ⇒ 404 点名该 id 且零写入(仅 1 次查询)', async () => {
    const ids = buildFileIds(MAX_FILES)
    const missing = ids[7]!
    state.selectRows = ids
      .filter((id) => id !== missing)
      .map((id) => ({ id, projectUserId: USER_ID }))

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-delete',
      payload: { fileIds: ids },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 404, message: `文件 ${missing} 不存在或已删除` })
    expect(state.queries).toHaveLength(1)
    expect(updateCalls()).toHaveLength(0)
  })

  it('空列表 ⇒ 400「至少选择一个文件」,零 DB 查询', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-delete',
      payload: { fileIds: [] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ code: 400, message: '至少选择一个文件' })
    expect(state.queries).toHaveLength(0)
  })

  it('200 个 id 直调归属查询仍是 1 次 IN 查询(不随规模线性增长)', async () => {
    const ids = buildFileIds(200)
    state.selectRows = ids.map((id) => ({ id, projectUserId: USER_ID }))

    const rows = await findFileOwnershipBatch(ids, true)

    expect(rows).toHaveLength(200)
    expect(state.queries).toHaveLength(1)
    expect(inListParams(selectCalls()[0]!)).toHaveLength(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
