// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-264 回归锁(2026-11-13)。
 *
 * 病灶:reindexAll 先 indices.delete 再 create,bulk 失败无回滚 ⇒ 线上留下空/半量索引;
 * 且分页用 orderBy(createdAt).limit().offset(),createdAt 无唯一 tie-break ⇒ 漏/重。
 *
 * 本文件锁:
 *   ① 成功路径:先 create 新物理索引 → bulk 灌数据 → refresh → updateAliases 原子切换 →
 *      才 delete 旧索引(断言 indices.delete(旧线上名) 一定在别名切换之后);
 *   ② bulk 返回 errors:抛原始错误、不切别名、不删旧索引、清理临时索引;
 *   ③ 分页是 keyset:查询条件含 (createdAt, id) 复合比较,且完全不出现 offset;
 *   ④ create 失败:不触碰旧索引(无 delete / updateAliases);
 *   ⑤ 源锁:reindexAll 源码内不再出现 `.offset(`。
 *
 * 只 mock @elastic/elasticsearch / src/db / @ihui/database / drizzle-orm,
 * 不连真实 ES、PG。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchEsService } from '../src/services/search-es-service.js'

const ES_INDEX = process.env.ELASTICSEARCH_INDEX ?? 'ihui-search-contents'
/** 与 service 内 REINDEX_BATCH_SIZE 对齐(既有量级 500) */
const BATCH_SIZE = 500

type RecordedCall = {
  op: string
  index?: string
  count?: number
  actions?: Array<Record<string, unknown>>
}

const h = vi.hoisted(() => {
  const calls: RecordedCall[] = []
  const state = {
    bulkErrors: false,
    createError: false,
    aliasExists: true,
    aliasIndices: ['ihui-search-contents'],
    legacyExists: false,
  }

  const indices = {
    create: vi.fn(async (params: { index: string }) => {
      calls.push({ op: 'create', index: params.index })
      if (state.createError) throw new Error('create failed')
    }),
    delete: vi.fn(async (params: { index: string; ignore_unavailable?: boolean }) => {
      calls.push({ op: 'delete', index: params.index })
    }),
    refresh: vi.fn(async (params: { index: string }) => {
      calls.push({ op: 'refresh', index: params.index })
    }),
    exists: vi.fn(async () => {
      calls.push({ op: 'exists' })
      return state.legacyExists
    }),
    existsAlias: vi.fn(async () => {
      calls.push({ op: 'existsAlias' })
      return state.aliasExists
    }),
    getAlias: vi.fn(async () => {
      calls.push({ op: 'getAlias' })
      const body: Record<string, unknown> = {}
      for (const index of state.aliasIndices) body[index] = { aliases: { [ES_INDEX]: {} } }
      return body
    }),
    updateAliases: vi.fn(async (params: { body: { actions: Array<Record<string, unknown>> } }) => {
      calls.push({ op: 'updateAliases', actions: params.body.actions })
    }),
  }

  const client = {
    ping: vi.fn(async () => true),
    search: vi.fn(async () => ({ hits: { total: { value: 0 }, hits: [] } })),
    index: vi.fn(async () => ({})),
    bulk: vi.fn(async (params: { body: unknown[] }) => {
      calls.push({ op: 'bulk', count: params.body.length })
      return state.bulkErrors ? { errors: true } : { errors: false }
    }),
    count: vi.fn(async () => ({ count: 0 })),
    indices,
  }

  return { calls, state, indices, client }
})

const schema = vi.hoisted(() => ({
  searchContents: {
    id: { name: 'searchContents.id' },
    topicId: { name: 'searchContents.topicId' },
    topicType: { name: 'searchContents.topicType' },
    topicTitle: { name: 'searchContents.topicTitle' },
    topicSummary: { name: 'searchContents.topicSummary' },
    searchText: { name: 'searchContents.searchText' },
    authorId: { name: 'searchContents.authorId' },
    viewCount: { name: 'searchContents.viewCount' },
    likeCount: { name: 'searchContents.likeCount' },
    commentCount: { name: 'searchContents.commentCount' },
    createdAt: { name: 'searchContents.createdAt' },
    updatedAt: { name: 'searchContents.updatedAt' },
  },
}))

const dbMock = vi.hoisted(() => {
  type DbCall = {
    where?: unknown
    orderBy?: unknown[]
    limit?: number
    usedOffset: boolean
  }
  const calls: DbCall[] = []
  const state = { batches: [] as Array<Array<Record<string, unknown>>> }

  const db = {
    select: () => ({
      from: () => {
        const record: DbCall = { usedOffset: false }
        calls.push(record)
        const builder = {
          where: (condition: unknown) => {
            record.where = condition
            return builder
          },
          orderBy: (...args: unknown[]) => {
            record.orderBy = args
            return builder
          },
          limit: (n: number) => {
            record.limit = n
            return Promise.resolve(state.batches.shift() ?? [])
          },
          offset: () => {
            record.usedOffset = true
            return builder
          },
        }
        return builder
      },
    }),
  }

  return { calls, state, db }
})

vi.mock('@elastic/elasticsearch', () => ({
  Client: class {
    constructor() {
      return h.client
    }
  },
}))

vi.mock('../src/db/index.js', () => ({ db: dbMock.db }))

vi.mock('@ihui/database', () => ({ searchContents: schema.searchContents }))

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ op: 'and', conditions }),
  or: (...conditions: unknown[]) => ({ op: 'or', conditions }),
  eq: (column: unknown, value: unknown) => ({ op: 'eq', column, value }),
  gt: (column: unknown, value: unknown) => ({ op: 'gt', column, value }),
  asc: (column: unknown) => ({ op: 'asc', column }),
  desc: (column: unknown) => ({ op: 'desc', column }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    strings: Array.from(strings),
    values,
  }),
}))

function makeRow(i: number): Record<string, unknown> {
  const createdAt = new Date(Date.UTC(2026, 0, 1) + i * 1000)
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    topicId: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    topicType: 'article',
    topicTitle: `标题 ${i}`,
    topicSummary: `摘要 ${i}`,
    searchText: `正文 ${i}`,
    authorId: null,
    viewCount: i,
    likeCount: 0,
    commentCount: 0,
    createdAt,
    updatedAt: createdAt,
  }
}

function makeService(): SearchEsService {
  return new SearchEsService()
}

function resetState(): void {
  h.calls.length = 0
  h.state.bulkErrors = false
  h.state.createError = false
  h.state.aliasExists = true
  h.state.aliasIndices = [ES_INDEX]
  h.state.legacyExists = false
  for (const fn of Object.values(h.indices)) fn.mockClear()
  h.client.bulk.mockClear()
  dbMock.calls.length = 0
  dbMock.state.batches = []
}

const originalEsUrl = process.env.ELASTICSEARCH_URL

beforeEach(() => {
  resetState()
  process.env.ELASTICSEARCH_URL = 'http://es.invalid:9200'
})

afterEach(() => {
  if (originalEsUrl === undefined) delete process.env.ELASTICSEARCH_URL
  else process.env.ELASTICSEARCH_URL = originalEsUrl
})

describe('F-264 reindexAll 临时索引 + 别名原子切换', () => {
  it('① 成功路径:create → bulk → refresh → updateAliases → 最后 delete 旧索引', async () => {
    dbMock.state.batches = [Array.from({ length: BATCH_SIZE }, (_, i) => makeRow(i)), [makeRow(BATCH_SIZE)]]

    const result = await makeService().reindexAll()

    expect(result).toEqual({ indexed: BATCH_SIZE + 1, table: ES_INDEX })

    const createIndex = h.calls.find((c) => c.op === 'create')?.index ?? ''
    expect(createIndex).toMatch(new RegExp(`^${ES_INDEX}_v\\d+$`))
    expect(createIndex).not.toBe(ES_INDEX)

    const indexOf = (predicate: (c: RecordedCall) => boolean) => h.calls.findIndex(predicate)
    const createAt = indexOf((c) => c.op === 'create' && c.index === createIndex)
    const bulkAt = indexOf((c) => c.op === 'bulk')
    const refreshAt = indexOf((c) => c.op === 'refresh' && c.index === createIndex)
    const aliasAt = indexOf((c) => c.op === 'updateAliases')
    const deleteOldAt = indexOf((c) => c.op === 'delete' && c.index === ES_INDEX)

    expect(createAt).toBeGreaterThanOrEqual(0)
    expect(bulkAt).toBeGreaterThan(createAt)
    expect(refreshAt).toBeGreaterThan(bulkAt)
    expect(aliasAt).toBeGreaterThan(refreshAt)
    expect(deleteOldAt).toBeGreaterThan(aliasAt)

    const update = h.calls[aliasAt]!
    expect(update.actions).toEqual([
      { remove: { index: ES_INDEX, alias: ES_INDEX } },
      { add: { index: createIndex, alias: ES_INDEX } },
    ])
  })

  it('② bulk 返回 errors:抛错、不切别名、不删旧索引、清理临时索引', async () => {
    h.state.bulkErrors = true
    dbMock.state.batches = [Array.from({ length: BATCH_SIZE }, (_, i) => makeRow(i))]

    await expect(makeService().reindexAll()).rejects.toThrow(/bulk index partial failure/)

    expect(h.indices.updateAliases).not.toHaveBeenCalled()
    expect(h.calls.some((c) => c.op === 'delete' && c.index === ES_INDEX)).toBe(false)

    const tempDeletes = h.calls.filter((c) => c.op === 'delete' && c.index !== ES_INDEX)
    expect(tempDeletes).toHaveLength(1)
    expect(tempDeletes[0]?.index).toMatch(new RegExp(`^${ES_INDEX}_v\\d+$`))
  })

  it('③ 分页为 keyset:(createdAt, id) 复合比较,无 offset', async () => {
    dbMock.state.batches = [Array.from({ length: BATCH_SIZE }, (_, i) => makeRow(i)), [makeRow(BATCH_SIZE)]]

    await makeService().reindexAll()

    expect(dbMock.calls).toHaveLength(2)
    expect(dbMock.calls[0]?.where).toBeUndefined()
    expect(dbMock.calls[0]?.orderBy).toEqual([
      { op: 'asc', column: schema.searchContents.createdAt },
      { op: 'asc', column: schema.searchContents.id },
    ])
    expect(dbMock.calls[0]?.limit).toBe(BATCH_SIZE)
    expect(dbMock.calls.every((c) => c.usedOffset === false)).toBe(true)

    const cursor = dbMock.calls[1]?.where as {
      op: string
      conditions: Array<{ op: string; column?: unknown; value?: unknown; conditions?: unknown[] }>
    }
    expect(cursor.op).toBe('or')
    expect(cursor.conditions[0]).toMatchObject({
      op: 'gt',
      column: schema.searchContents.createdAt,
    })
    expect(cursor.conditions[1]?.op).toBe('and')
    expect(cursor.conditions[1]?.conditions?.[0]).toMatchObject({
      op: 'eq',
      column: schema.searchContents.createdAt,
    })
    expect(cursor.conditions[1]?.conditions?.[1]).toMatchObject({
      op: 'gt',
      column: schema.searchContents.id,
    })
  })

  it('④ create 失败:不触碰旧索引', async () => {
    h.state.createError = true
    dbMock.state.batches = [[makeRow(0)]]

    await expect(makeService().reindexAll()).rejects.toThrow('create failed')

    expect(h.indices.delete).not.toHaveBeenCalled()
    expect(h.indices.updateAliases).not.toHaveBeenCalled()
  })

  it('⑤ 源锁:reindexAll 内不再出现 .offset(', async () => {
    const sourcePath = fileURLToPath(
      new URL('../src/services/search-es-service.ts', import.meta.url),
    )
    const source = readFileSync(sourcePath, 'utf8')
    const start = source.indexOf('async reindexAll')
    const end = source.indexOf('统计 ES 索引文档数')
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)

    const body = source.slice(start, end)
    expect(body).not.toContain('.offset(')
    expect(body).toContain('gt(searchContents.createdAt')
    expect(body).toContain('switchAliasTo')

    const aliasBody = source.slice(source.indexOf('async switchAliasTo'), start)
    expect(aliasBody).toContain('updateAliases')
    expect(aliasBody).toContain('remove: { index')
  })
})
