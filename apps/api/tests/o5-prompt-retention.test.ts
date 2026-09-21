// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

/**
 * O5 第 3 项 — llm_call_logs 原文(prompt/response)留存策略。
 *
 * 断言口径:
 *  - 策略解析(全局默认 / 按 key 关闭 / '*' 全量关闭 / 非法值回落)是纯函数,直接验;
 *  - 行级覆盖优先于全局默认;
 *  - 清除动作**必须**只清原文列、保留归因与计费列,并把 raw_retained / raw_purged_at 置位;
 *  - "关闭原文留存"生效时,被写走的 SQL 里 prompt 被置空、response 被置 NULL(= 不再留原文)。
 *
 * 全程 mock db,不连生产 8810 / 8811。
 */
const { mockExecute, mockTransaction } = vi.hoisted(() => ({
  mockExecute: vi.fn<(q: unknown) => Promise<unknown>>(),
  mockTransaction: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    execute: mockExecute,
    transaction: mockTransaction,
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    AUDIT_LOG_HMAC_SECRET: 'k'.repeat(40),
  },
}))

import {
  DEFAULT_RAW_RETENTION_DAYS,
  buildRawTextColumns,
  effectiveRetentionDays,
  purgeAllExpiredLlmCallLogRawText,
  purgeExpiredLlmCallLogRawText,
  resolveRawRetentionPolicy,
} from '../src/services/audit-log-service.js'

const dialect = new PgDialect()

/**
 * 把最后一次 db.execute 收到的 SQL 对象还原成文本 + 参数,便于断言"到底写了什么"。
 * 文本里的双引号(drizzle 给列名加的标识符引号)统一剥掉,断言只关心结构。
 */
function lastSql(): { text: string; params: unknown[] } {
  const calls = mockExecute.mock.calls
  const last = calls[calls.length - 1]
  if (!last) throw new Error('db.execute 未被调用')
  const q = dialect.sqlToQuery(last[0] as SQL)
  return { text: q.sql.replace(/"/g, ''), params: q.params as unknown[] }
}

describe('O5 llm_call_logs 原文留存策略', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExecute.mockResolvedValue([])
  })

  describe('resolveRawRetentionPolicy', () => {
    it('默认 30 天(有期限留存,而非永久)', () => {
      const p = resolveRawRetentionPolicy({})
      expect(p.defaultDays).toBe(DEFAULT_RAW_RETENTION_DAYS)
      expect(p.defaultDays).toBe(30)
      expect(p.all).toBe(false)
      expect(p.disabledApiKeyIds).toEqual([])
    })

    it('可用 env 覆盖全局天数', () => {
      expect(resolveRawRetentionPolicy({ LLM_CALL_LOG_RAW_RETENTION_DAYS: '7' }).defaultDays).toBe(7)
      expect(resolveRawRetentionPolicy({ LLM_CALL_LOG_RAW_RETENTION_DAYS: '0' }).defaultDays).toBe(0)
    })

    it('非法值回落默认(不允许把策略配成 NaN 或负数)', () => {
      expect(resolveRawRetentionPolicy({ LLM_CALL_LOG_RAW_RETENTION_DAYS: 'abc' }).defaultDays).toBe(30)
      expect(resolveRawRetentionPolicy({ LLM_CALL_LOG_RAW_RETENTION_DAYS: '-5' }).defaultDays).toBe(30)
      expect(resolveRawRetentionPolicy({ LLM_CALL_LOG_RAW_RETENTION_DAYS: '' }).defaultDays).toBe(30)
    })

    it('按 key 关闭原文留存:列表命中即该 key 全部行按 0 天处理', () => {
      const p = resolveRawRetentionPolicy({
        LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS: ' k1 , k2 ,, ',
      })
      expect(p.disabledApiKeyIds).toEqual(['k1', 'k2'])
      expect(p.all).toBe(false)
      // 显式列了 key 但未设全局天数 → 全局默认仍是 30(只关这两把)
      expect(p.defaultDays).toBe(30)
    })

    it("'=' 通配 → 全量关闭,默认天数强制归零", () => {
      const p = resolveRawRetentionPolicy({
        LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS: '*',
        LLM_CALL_LOG_RAW_RETENTION_DAYS: '30',
      })
      expect(p.all).toBe(true)
      expect(p.defaultDays).toBe(0)
      expect(p.disabledApiKeyIds).toEqual([])
    })
  })

  describe('effectiveRetentionDays', () => {
    it('行内显式值优先于全局默认', () => {
      const p = resolveRawRetentionPolicy({ LLM_CALL_LOG_RAW_RETENTION_DAYS: '30' })
      expect(effectiveRetentionDays({ rawRetentionDays: 3 }, p)).toBe(3)
      expect(effectiveRetentionDays({ rawRetentionDays: null }, p)).toBe(30)
    })

    it('全量关闭时行内值也不能翻案', () => {
      const p = resolveRawRetentionPolicy({ LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS: '*' })
      expect(effectiveRetentionDays({ rawRetentionDays: 90 }, p)).toBe(0)
    })
  })

  describe('buildRawTextColumns(写入口:关闭留存即不落原文)', () => {
    const RAW = { prompt: 'PROMPT_RAW_TEXT', response: 'RESPONSE_RAW_TEXT' } as const

    it('默认策略(30 天)→ 原文照写,rawRetained=true(旧行为不变)', () => {
      const c = buildRawTextColumns({ ...RAW, apiKeyId: 'k1' }, resolveRawRetentionPolicy({}))
      expect(c.prompt).toBe(RAW.prompt)
      expect(c.response).toBe(RAW.response)
      expect(c.rawRetained).toBe(true)
    })

    it("全局关闭('*')→ prompt 落空串、response 落 NULL,原文不落盘", () => {
      const c = buildRawTextColumns(
        { ...RAW, apiKeyId: 'k1' },
        resolveRawRetentionPolicy({ LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS: '*' }),
      )
      expect(c.prompt).toBe('')
      expect(c.response).toBeNull()
      expect(c.rawRetained).toBe(false)
    })

    it('按 key 关闭 → 命中该 key 不落原文;其它 key 与非 key 流量不受影响', () => {
      const policy = resolveRawRetentionPolicy({
        LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS: 'k-off',
      })
      const off = buildRawTextColumns({ ...RAW, apiKeyId: 'k-off' }, policy)
      const on = buildRawTextColumns({ ...RAW, apiKeyId: 'k-other' }, policy)
      const noKey = buildRawTextColumns({ ...RAW, apiKeyId: null }, policy)
      expect([off.prompt, off.response, off.rawRetained]).toEqual(['', null, false])
      expect([on.prompt, on.response, on.rawRetained]).toEqual([RAW.prompt, RAW.response, true])
      expect([noKey.prompt, noKey.response, noKey.rawRetained]).toEqual([RAW.prompt, RAW.response, true])
    })
  })

  describe('purgeExpiredLlmCallLogRawText', () => {
    it('清除动作只动原文列:prompt 置空串、response 置 NULL,归因/计费列一律保留', async () => {
      mockExecute.mockResolvedValue([{ id: 'row-1' }, { id: 'row-2' }])
      const r = await purgeExpiredLlmCallLogRawText({ batch: 10 })
      expect(r.purged).toBe(2)
      expect(r.hasMore).toBe(false)

      const { text, params } = lastSql()
      expect(text).toContain("prompt = ''")
      expect(text).toContain('response = NULL')
      expect(text).toContain('raw_retained = false')
      expect(text).toContain('raw_purged_at = now()')
      // 关键点:SET 子句里不得出现 api_key_id / cost_cents / *_tokens 等归因与计费列
      const setClause = text.slice(text.indexOf('SET'), text.indexOf('WHERE'))
      expect(setClause).not.toContain('api_key_id')
      expect(setClause).not.toContain('cost_cents')
      expect(setClause).not.toContain('prompt_tokens')
      // 只扫未清除行(raw_retained = true)+ 并发不互斥
      expect(text).toMatch(/raw_retained = \$/)
      expect(params).toContain(true)
      expect(text).toContain('FOR UPDATE SKIP LOCKED')
      // 单批上限走参数绑定,不拼进 SQL 文本
      expect(params).toContain(10)
    })

    it('到期条件用行内 raw_retention_days,NULL 回落全局默认', async () => {
      await purgeExpiredLlmCallLogRawText({ policy: { defaultDays: 15, disabledApiKeyIds: [], all: false } })
      const { text, params } = lastSql()
      expect(text).toContain('COALESCE(llm_call_logs.raw_retention_days, $')
      expect(text).toContain("interval '1 day'")
      expect(params).toContain(15)
    })

    it('按 key 关闭时,SQL 带 api_key_id IN(...) 且这些行不受时间约束', async () => {
      await purgeExpiredLlmCallLogRawText({
        policy: { defaultDays: 30, disabledApiKeyIds: ['key-a', 'key-b'], all: false },
      })
      const { text, params } = lastSql()
      expect(text).toContain('api_key_id in')
      expect(params).toContain('key-a')
      expect(params).toContain('key-b')
    })

    it('全量关闭(所有 key 不留原文)时按 0 天清除:到期条件即 created_at < now()', async () => {
      await purgeExpiredLlmCallLogRawText({ policy: { defaultDays: 0, disabledApiKeyIds: [], all: true } })
      const { text } = lastSql()
      expect(text).toContain('true')
      expect(text).toContain("prompt = ''")
    })

    it('DB 异常时降级返回 0,不抛出打断定时任务(与 recordAuditLog 同口径)', async () => {
      mockExecute.mockRejectedValueOnce(new Error('relation llm_call_logs does not exist'))
      const r = await purgeExpiredLlmCallLogRawText()
      expect(r.purged).toBe(0)
      expect(r.hasMore).toBe(false)
    })

    it('满批时 hasMore=true,聚合入口会续跑下一批', async () => {
      mockExecute.mockResolvedValueOnce(Array.from({ length: 2 }, (_, i) => ({ id: `r${i}` })))
      mockExecute.mockResolvedValueOnce([])
      const r = await purgeAllExpiredLlmCallLogRawText({ batch: 2 })
      expect(r.purged).toBe(2)
      expect(r.hasMore).toBe(false)
      expect(mockExecute).toHaveBeenCalledTimes(2)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
