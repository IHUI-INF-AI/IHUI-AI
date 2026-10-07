// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815957:失败账表的"可重试"必须落成列并由 DB 封闭值域(2026-10-07 立)。
 *
 * 票面判据(正反成对):
 *  - 新列写 boolean 无 CHECK ⇒ 红;smallint + CHECK in (0,1) ⇒ 绿(本文件钉绿侧);
 *  - 默认档必须是保守档(default 0),不是 `retryable boolean default true`
 *    那种"把默认值当结论"的反例形态;
 *  - 迁移走既有 journal 记账:tag 与 .sql 一一对应(记账守门 B1 的本侧镜像)。
 *
 * 全部断言走 drizzle 表配置与迁移/journal 文件原文,不依赖真实数据库。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { llmCallLogs } from '@ihui/database'

const MIGRATION_PATH = fileURLToPath(
  new URL('../../../packages/database/drizzle/20261007100000_llm_call_logs_retryable.sql', import.meta.url),
)
const JOURNAL_PATH = fileURLToPath(
  new URL('../../../packages/database/drizzle/meta/_journal.json', import.meta.url),
)
const MIGRATION_TAG = '20261007100000_llm_call_logs_retryable'

describe('G-815957 llm_call_logs.retryable 列 + DB 封闭值域', () => {
  const config = getTableConfig(llmCallLogs)

  it('列存在:smallint、NOT NULL、默认 0(保守档,不是 default true)', () => {
    const col = config.columns.find((c) => c.name === 'retryable')
    expect(col, 'retryable 列必须先落进 schema').toBeDefined()
    expect(col!.columnType).toBe('PgSmallInt')
    expect(col!.notNull).toBe(true)
    expect(col!.hasDefault).toBe(true)
    expect(col!.default).toBe(0)
  })

  it('CHECK 约束在位:retryable in (0, 1) —— 无 CHECK 即票面判红形态', () => {
    const chk = config.checks.find((c) => c.name === 'llm_call_logs_retryable_check')
    expect(chk, '缺 CHECK ⇒ 值域不封闭').toBeDefined()
  })

  it('迁移 SQL 与 journal 成对:列 + CHECK 在 SQL 原文里,tag 在 journal 里', () => {
    const sqlText = readFileSync(MIGRATION_PATH, 'utf8')
    expect(sqlText).toContain('ADD COLUMN "retryable" smallint DEFAULT 0 NOT NULL')
    expect(sqlText).toMatch(/CHECK \("retryable" IN \(0, 1\)\)/)
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as {
      entries: Array<{ idx: number; tag: string; when: number }>
    }
    const entry = journal.entries.find((e) => e.tag === MIGRATION_TAG)
    expect(entry, '迁移文件必须走既有 journal 记账(B1 一一对应)').toBeDefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
