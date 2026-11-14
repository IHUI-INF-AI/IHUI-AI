// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-681 回归锁(2026-11-13)。
 *
 * 病灶:错题入库(insert + onConflictDoUpdate)从不写 `due_date`,而该列无默认值;
 * "今日待复习"用 `due_date <= now` 命中,`least`/`<=` 对 NULL 恒不成立 ⇒ 所有用户
 * 的待复习列表恒空、stats.totalDue 恒 0。历史上唯一会写 dueDate=now 的
 * initSRSForWrongQuestion 全仓零调用(只有定义),属于第二条互斥初始化路径。
 *
 * 修复口径:upsert 内一次写完 —— 首插 `dueDate: now`;冲突时未掌握重置为
 * `least(现有 due_date, now)`(现有为 NULL 时 PG 的 least 取 now),已掌握不重置。
 * 本文件直接断言纯函数的插入值 + drizzle 生成的 SQL,不需要真库。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PgDialect } from 'drizzle-orm/pg-core'

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
}))

// 指标桥接模块与本次断言无关,整体 mock 掉以缩短 import 链
vi.mock('../src/plugins/business-metrics.js', () => ({
  adjustExamScore: vi.fn(),
  recordExamScore: vi.fn(),
}))

import {
  buildDueDateReset,
  buildWrongQuestionInsertValues,
} from '../src/db/exam-extended-queries.js'

const NOW = new Date('2026-11-13T02:00:00.000Z')

const INPUT = {
  userId: '00000000-0000-4000-8000-000000000001',
  questionId: '00000000-0000-4000-8000-000000000002',
  paperId: '00000000-0000-4000-8000-000000000003',
  paperTitle: '期中数学',
  userAnswer: 'A',
  rightAnswer: 'B',
}

const dialect = new PgDialect()

const sourceOf = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

describe('F-681 错题入库必须写 SRS 到期日', () => {
  it('首次插入:dueDate 显式写 now(列无默认值,NULL 永不被 due_date <= now 命中)', () => {
    const values = buildWrongQuestionInsertValues(INPUT, NOW)

    expect(values.dueDate).toBe(NOW)
    expect(values.isMastered).toBe(false)
    expect(values.wrongCount).toBe(1)
    expect(values.lastWrongTime).toBe(NOW)
    expect(values.userId).toBe(INPUT.userId)
    expect(values.questionId).toBe(INPUT.questionId)
  })

  it('未掌握冲突:重置为 least(现有 due_date, now)', () => {
    const { sql, params } = dialect.sqlToQuery(buildDueDateReset(NOW, false))

    expect(sql).toContain('due_date')
    expect(sql).toMatch(/least\(/i)
    expect(params.length).toBeGreaterThan(0)
  })

  it('已掌握:不重置到期日', () => {
    const { sql } = dialect.sqlToQuery(buildDueDateReset(NOW, true))

    expect(sql).toContain('due_date')
    expect(sql).not.toMatch(/least\(/i)
  })

  it('源锁:upsert 首插与冲突分支都接上 due_date,且不留第二条初始化路径', () => {
    const queries = sourceOf('../src/db/exam-extended-queries.ts')
    expect(queries).toContain('.values(buildWrongQuestionInsertValues(data, now))')
    expect(queries).toContain('dueDate: buildDueDateReset(now, false)')
    expect(queries).not.toContain('initSRSForWrongQuestion')

    const srs = sourceOf('../src/services/srs-review-service.ts')
    expect(srs).not.toContain('initSRSForWrongQuestion')
  })
})
