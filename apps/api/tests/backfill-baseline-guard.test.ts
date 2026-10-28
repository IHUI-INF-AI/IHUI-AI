// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { isNull } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { idMapping } from '@ihui/database'
import { backfillWhere, assertBaselineTime } from '../src/utils/backfill-baseline.js'

/**
 * G-815953 正反成对:回填 UPDATE 的 where 必须带时间上界谓词。
 *  - 无界 where(只有 isNull(x))⇒ 出口拒绝(throw),拿不到可用的谓词 ⇒ 红;
 *  - 带 lte(updatedAt, baseline) ⇒ 绿,渲染出的 SQL 里真的有 "<=" 与绑定参数。
 */
const dialect = new PgDialect()
const sqlText = (where: unknown): string => dialect.sqlToQuery(where as never).sql

describe('G-815953 回填基线上界(唯一出口 backfill-baseline.ts)', () => {
  it('绿:给基线 ⇒ 谓词含业务过滤 + 时间上界,渲染 SQL 有 <=', () => {
    const where = backfillWhere({
      column: idMapping.createdAt,
      baselineTime: new Date('2026-09-01T00:00:00Z'),
      conditions: [isNull(idMapping.migrationBatch) as never],
    })
    const text = sqlText(where)
    expect(text).toContain('<=')
    expect(text).toContain('created_at')
  })

  it('红:基线缺失 ⇒ throw(fail-closed,绝不回落无上界回填)', () => {
    expect(() =>
      backfillWhere({ column: idMapping.createdAt, baselineTime: undefined as unknown as Date }),
    ).toThrow(/上界|基线/)
  })

  it('红:基线非法(乱串 / null / undefined)⇒ 同样 throw', () => {
    expect(() => assertBaselineTime('not-a-date')).toThrow(/基线/)
    expect(() => assertBaselineTime(null)).toThrow(/基线/)
    expect(() => assertBaselineTime(undefined)).toThrow(/基线/)
  })

  it('绿:ISO 字符串基线也可用(迁移表 time_applied 常是字符串)', () => {
    const where = backfillWhere({ column: idMapping.createdAt, baselineTime: '2026-09-01T00:00:00Z' })
    expect(sqlText(where)).toContain('<=')
  })

  it('边界:没有业务过滤时只给上界(不造出恒真 where)', () => {
    const where = backfillWhere({ column: idMapping.createdAt, baselineTime: '2026-09-01T00:00:00Z' })
    const text = sqlText(where)
    expect(text).toContain('<=')
    expect(text).not.toContain('isNull')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
