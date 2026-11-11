// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// SDB-49:ai-feed 分类批(processLlmBatch)与摘要批(summarizeFeedItems)在
// drainLlmBacklog 的 Promise.all 里并发跑,旧实现两路都无条件写同一行同一列
// llm_summary:摘要批写入 LLM 摘要后,分类批用 `item.summary ?? null` 覆盖
// (甚至写回 NULL),下一轮又以 llm_summary IS NULL 取数重新摘要 ⇒ 重复付费。
//
// 本文件用内存假 DB 复刻 PostgreSQL 的单行 UPDATE 语义(WHERE 用 PgDialect 渲染,
// 命中 `llm_summary IS NULL` 时才落库),钉住三条判据:
// ① 摘要已写入时分类批不再覆盖(且分类结果照常落库);
// ② 原文缺失时分类批不得把 NULL 回写到已生成的摘要上;
// ③ 摘要批只在 llm_summary 仍为空时落库,不覆盖并发批次已写入的摘要。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

type Row = Record<string, unknown>

const state = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  process.env.AI_SERVICE_URL = 'http://ai-service.test'
  process.env.LLM_BATCH_ENABLED = 'true'
  process.env.LLM_CONCURRENCY = '1'
  return {
    /** 库里的真实行(按 id) */
    store: new Map<string, Record<string, unknown>>(),
    /** 本轮 SELECT 的返回快照(模拟"读取时刻"的行,可与 store 不同) */
    selectRows: [] as Array<Record<string, unknown>>,
    /** 每次 UPDATE 的 SET 与 WHERE,供断言"到底写了什么" */
    updates: [] as Array<{ set: Record<string, unknown>; where: unknown }>,
  }
})

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  /** 复刻 WHERE 语义:本用例只出现 eq(id) 与 and(eq(id), llm_summary is null)。 */
  const matchesWhere = (where: unknown, row: Record<string, unknown>): boolean => {
    if (where === undefined || where === null) return true
    const q = dialect.sqlToQuery(where as never)
    const sql = q.sql.toLowerCase()
    const params = q.params as unknown[]
    if (params.length > 0 && String(row.id) !== String(params[0])) return false
    if (sql.includes('llm_summary') && sql.includes('is null')) {
      return row.llmSummary === null || row.llmSummary === undefined
    }
    return true
  }

  const chainSelect = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) {
      step[m] = () => step
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(state.selectRows.map((r) => ({ ...r }))).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) =>
      Promise.resolve(state.selectRows.map((r) => ({ ...r }))).catch(reject)
    return step
  }

  const chainWrite = () => {
    let payload: Record<string, unknown> = {}
    const step: Record<string, unknown> = {}
    step.set = (arg: Record<string, unknown>) => {
      payload = arg
      return step
    }
    step.where = (cond: unknown) => {
      state.updates.push({ set: payload, where: cond })
      // 单行 UPDATE:只有 WHERE 命中才落库
      for (const row of state.store.values()) {
        if (matchesWhere(cond, row)) Object.assign(row, payload)
      }
      return step
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(undefined).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(undefined).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve(undefined).finally(fn)
    return step
  }

  return {
    db: { select: chainSelect, update: chainWrite, insert: chainWrite, delete: chainWrite },
    dbRead: { select: chainSelect },
    dbClient: {},
  }
})

vi.mock('../src/utils/system-access-token.js', () => ({
  getSystemAccessToken: async () => 'test-system-token',
}))

// 只区分分类/摘要两类 prompt,返回确定性内容;不触网。
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(
    async (_token: unknown, _path: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { messages: Array<{ content: string }> }
      const system = body.messages[0]?.content ?? ''
      const content = system.includes('分类器')
        ? 'ai-models'
        : system.includes('摘要助手')
          ? 'LLM 生成的摘要'
          : 'translated'
      return { ok: true, json: async () => ({ content }) }
    },
  ),
}))

import { processLlmBatch, summarizeFeedItems } from '../src/services/ai-feed-service.js'

function seedRow(overrides: Row = {}): Row {
  const row: Row = {
    id: 'item-sdb49',
    sourceCode: 'hackernews',
    title: 'OpenAI 发布 GPT-5',
    summary: null,
    llmCategory: null,
    llmSummary: null,
    llmProcessedAt: null,
    ...overrides,
  }
  state.store.set(String(row.id), row)
  return row
}

beforeEach(() => {
  state.store.clear()
  state.selectRows = []
  state.updates = []
})

describe('SDB-49 ai-feed 分类批/摘要批不再抢写 llm_summary', () => {
  it('① 摘要已写入时分类批不覆盖,分类结果照常落库', async () => {
    const row = seedRow({ summary: 'RSS 原文摘要', llmSummary: '已生成的 LLM 摘要' })
    // 分类批按 llm_processed_at IS NULL 取数,读到的是未处理快照
    state.selectRows = [{ ...row }]

    await processLlmBatch(10)

    expect(row.llmSummary).toBe('已生成的 LLM 摘要')
    expect(row.llmCategory).toBe('ai-models')
    expect(row.llmProcessedAt).toBeInstanceOf(Date)
    // 分类批的 SET 里根本不应出现 llmSummary
    expect(state.updates.length).toBeGreaterThan(0)
    for (const u of state.updates) {
      expect(Object.prototype.hasOwnProperty.call(u.set, 'llmSummary')).toBe(false)
    }
  })

  it('② 原文缺失时不得把 NULL 回写到已生成的摘要上', async () => {
    const row = seedRow({ summary: null, llmSummary: '已生成的 LLM 摘要' })
    state.selectRows = [{ ...row }]

    await processLlmBatch(10)

    expect(row.llmSummary).toBe('已生成的 LLM 摘要')
    expect(row.llmCategory).toBe('ai-models')
  })

  it('③ 摘要批不覆盖已存在(并发写入)的摘要', async () => {
    // SELECT 时 llm_summary 为空 ⇒ 摘要批取到该行;LLM 返回前另一路已写入摘要
    const row = seedRow({ llmSummary: '并发写入的摘要' })
    state.selectRows = [{ ...row, llmSummary: null }]

    await summarizeFeedItems(10)

    expect(row.llmSummary).toBe('并发写入的摘要')
    // 写入语句必须带 llm_summary IS NULL 条件(幂等护栏)
    const dialect = new PgDialect()
    const summaryWrites = state.updates.filter((u) =>
      Object.prototype.hasOwnProperty.call(u.set, 'llmSummary'),
    )
    expect(summaryWrites.length).toBeGreaterThan(0)
    for (const u of summaryWrites) {
      const sql = dialect.sqlToQuery(u.where as never).sql.toLowerCase()
      expect(sql).toContain('llm_summary')
      expect(sql).toContain('is null')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
