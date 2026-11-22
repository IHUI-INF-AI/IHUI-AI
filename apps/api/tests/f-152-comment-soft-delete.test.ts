// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-152 回归锁(2026-11-13)。
 *
 * 病灶:评论软删除只改 is_deleted,但三个读函数(findComments / findCommentById /
 * findReplies)的 WHERE 未带 is_deleted = false ⇒ 墓碑仍出现在列表与分页总数里;
 * 「回复某评论」「点赞某评论」的前置校验也走 findCommentById ⇒ 已删评论可继续长 UGC、
 * 可被点赞,与 PATCH/DELETE 的 404 语义不一致。
 *
 * 本文件锁:
 *   ① 列表查询条件带 is_deleted = false(墓碑不进列表);
 *   ② 以已删评论为目标的 回复 / 点赞 / 详情 → 404,且不产生任何写入;
 *   ③ 分页总数与列表同口径(同一 WHERE,total 等于可见列表行数)。
 *
 * 只 mock db / authenticate,不连真实 PG、Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    const auth = request.headers.authorization
    if (!auth) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = 'f152-user'
  }),
}))

const state = vi.hoisted(() => ({
  /** 当前用例的 comments 表内容;isDeleted=true 即软删墓碑 */
  commentRows: [] as Array<Record<string, unknown>>,
  /** 每次 .where() 收到的 drizzle 条件,用于断言 SQL 谓词 */
  whereArgs: [] as unknown[],
  insertCalls: 0,
  updateCalls: 0,
  deleteCalls: 0,
}))

vi.mock('../src/db/index.js', () => {
  const visibleRows = (cond: unknown): Array<Record<string, unknown>> => {
    const text = sqlText(cond)
    // 只模拟本工单相关的软删谓词;其余条件(资源过滤等)由夹具数据本身表达
    if (text.includes('is_deleted = true')) {
      return state.commentRows.filter((row) => row.isDeleted === true)
    }
    if (text.includes('is_deleted = false')) {
      return state.commentRows.filter((row) => row.isDeleted !== true)
    }
    return state.commentRows
  }

  const createChain = (fields: Record<string, unknown>) => {
    let cond: unknown
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = (next: unknown) => {
      cond = next
      state.whereArgs.push(next)
      return chain
    }
    chain.orderBy = () => chain
    chain.limit = () => chain
    chain.offset = () => chain
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      const rows = visibleRows(cond)
      const result = 'count' in fields ? [{ count: rows.length }] : rows
      return Promise.resolve(result).then(resolve, reject)
    }
    return chain
  }

  return {
    db: {
      select: vi.fn((fields: Record<string, unknown>) => createChain(fields)),
      insert: vi.fn(() => {
        state.insertCalls += 1
        const chain: Record<string, unknown> = {}
        chain.values = () => chain
        chain.returning = async () => []
        chain.onConflictDoNothing = () => chain
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve)
        return chain
      }),
      update: vi.fn(() => {
        state.updateCalls += 1
        const chain: Record<string, unknown> = {}
        chain.set = () => chain
        chain.where = () => chain
        chain.returning = async () => []
        return chain
      }),
      delete: vi.fn(() => {
        state.deleteCalls += 1
        return { where: async () => undefined }
      }),
    },
    dbRead: { select: vi.fn() },
    dbClient: {},
  }
})

import { commentRoutes } from '../src/routes/comments.js'

/** 把 drizzle SQL / Column / Param / StringChunk 节点拼成可断言的文本(含布尔参数)。 */
function sqlText(node: unknown): string {
  if (node === null || node === undefined) return ''
  if (typeof node !== 'object') return String(node)
  const n = node as Record<string, unknown>
  const parts: string[] = []
  if (Array.isArray(n.queryChunks)) {
    for (const chunk of n.queryChunks) parts.push(sqlText(chunk))
  }
  if (typeof n.name === 'string') parts.push(n.name)
  if (typeof n.value === 'boolean' || typeof n.value === 'number') parts.push(String(n.value))
  else if (typeof n.value === 'string') parts.push(n.value)
  else if (Array.isArray(n.value)) {
    parts.push(n.value.map((v) => (typeof v === 'string' ? v : '')).join(''))
  }
  if (n.sql) parts.push(sqlText(n.sql))
  return parts.join('')
}

const DELETED_ID = '00000000-0000-4000-8000-000000000152'
const LIVE_ID = '00000000-0000-4000-8000-000000000153'
const USER_TOKEN = 'Bearer f152-user-token'

const TOMBSTONE = { id: DELETED_ID, isDeleted: true, content: '已删除' }
const LIVE = { id: LIVE_ID, isDeleted: false, content: '正常评论' }

describe('F-152 评论软删除:对外读面不得含墓碑', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(commentRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.commentRows = []
    state.whereArgs = []
    state.insertCalls = 0
    state.updateCalls = 0
    state.deleteCalls = 0
  })

  it('① 列表 WHERE 带 is_deleted = false,墓碑不进列表', async () => {
    state.commentRows = [LIVE, TOMBSTONE]

    const res = await app.inject({
      method: 'GET',
      url: '/api/comments?resourceType=post&resourceId=r1',
      headers: { authorization: USER_TOKEN },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { list: Array<{ id: string }>; total: number }
    }
    expect(body.data.list.map((row) => row.id)).toEqual([LIVE_ID])
    expect(state.whereArgs.length).toBeGreaterThan(0)
    for (const cond of state.whereArgs) {
      expect(sqlText(cond)).toContain('is_deleted = false')
    }
  })

  it('③ 分页总数与列表同口径:同一 WHERE,total 等于可见行数', async () => {
    state.commentRows = [LIVE, TOMBSTONE]

    const res = await app.inject({
      method: 'GET',
      url: '/api/comments?resourceType=post&resourceId=r1',
      headers: { authorization: USER_TOKEN },
    })

    expect(res.statusCode).toBe(200)
    // 列表一次 + 计数一次
    expect(state.whereArgs).toHaveLength(2)
    const [listWhere, countWhere] = state.whereArgs
    expect(sqlText(listWhere)).toBe(sqlText(countWhere))
    expect(sqlText(countWhere)).toContain('is_deleted = false')

    const body = res.json() as { data: { list: unknown[]; total: number } }
    expect(body.data.total).toBe(1)
    expect(body.data.list).toHaveLength(1)
  })

  it('② 回复已删评论 → 404,且不落库', async () => {
    state.commentRows = [TOMBSTONE]

    const res = await app.inject({
      method: 'POST',
      url: '/api/comments',
      headers: { authorization: USER_TOKEN },
      payload: {
        resourceType: 'post',
        resourceId: 'r1',
        parentId: DELETED_ID,
        content: '对墓碑的回复',
      },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ code: 404 })
    expect(state.insertCalls).toBe(0)
  })

  it('② 点赞已删评论 → 404,且不落库', async () => {
    state.commentRows = [TOMBSTONE]

    const res = await app.inject({
      method: 'POST',
      url: `/api/comments/${DELETED_ID}/like`,
      headers: { authorization: USER_TOKEN },
    })

    expect(res.statusCode).toBe(404)
    expect(state.insertCalls).toBe(0)
  })

  it('② 已删评论详情 / 回复列表 → 404(按不存在处理)', async () => {
    state.commentRows = [TOMBSTONE]

    const detail = await app.inject({
      method: 'GET',
      url: `/api/comments/${DELETED_ID}`,
      headers: { authorization: USER_TOKEN },
    })
    expect(detail.statusCode).toBe(404)

    const replies = await app.inject({
      method: 'GET',
      url: `/api/comments/${DELETED_ID}/replies`,
      headers: { authorization: USER_TOKEN },
    })
    expect(replies.statusCode).toBe(404)
  })
})
