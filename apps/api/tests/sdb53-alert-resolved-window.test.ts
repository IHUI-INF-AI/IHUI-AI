// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// SDB-53:`resolved` 只卡上界(createdAt < 24h 前)⇒ 建表以来所有含 error 的审计日志
// 都被算成"已恢复",单调递增且量级等于历史全量,还会被写进日志与告警 metadata。
// 本文件钉住新口径:只统计「昨日有错(24h~48h)、今日已无」这一档。
//
// DB 走可注入的假查询构造器(不连库):drizzle 的 and/gt/lt/ilike 被换成描述符,
// 假 db 拿描述符对内存行求值并回 `[{ count }]` —— 这样"下界有没有真的下推"是可观测的:
// 若实现退回只卡上界,①「48h 之前不计入」立刻红。
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { action: string; createdAt: Date }
type Cond =
  | { op: 'and'; conds: Cond[] }
  | { op: 'gt'; value: Date }
  | { op: 'lt'; value: Date }
  | { op: 'ilike'; pattern: string }

const state = vi.hoisted(() => ({ rows: [] as Array<{ action: string; createdAt: Date }> }))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    and: (...conds: Cond[]): Cond => ({ op: 'and', conds }),
    gt: (_col: unknown, value: Date): Cond => ({ op: 'gt', value }),
    lt: (_col: unknown, value: Date): Cond => ({ op: 'lt', value }),
    ilike: (_col: unknown, pattern: string): Cond => ({ op: 'ilike', pattern }),
  }
})

vi.mock('../src/db/index.js', () => {
  function matches(cond: Cond, row: Row): boolean {
    switch (cond.op) {
      case 'and':
        return cond.conds.every((c) => matches(c, row))
      case 'gt':
        return row.createdAt.getTime() > new Date(cond.value).getTime()
      case 'lt':
        return row.createdAt.getTime() < new Date(cond.value).getTime()
      case 'ilike':
        return row.action.toLowerCase().includes(cond.pattern.replaceAll('%', '').toLowerCase())
    }
  }
  const builder = {
    from: () => builder,
    where: (cond: Cond) => ({
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve([{ count: state.rows.filter((r) => matches(cond, r)).length }]).then(
          resolve,
          reject,
        ),
    }),
  }
  return {
    db: { select: () => builder },
    dbRead: { select: () => builder },
    dbClient: {},
  }
})

import { checkDailyAlerts } from '../src/services/alert-check-service.js'

const HOUR = 60 * 60 * 1000

/** hoursAgo 小时前发生的一条审计日志;默认 action 含 error 关键字 */
function row(hoursAgo: number, action = 'user.login.error'): Row {
  return { action, createdAt: new Date(Date.now() - hoursAgo * HOUR) }
}

describe('SDB-53:resolved 只统计「昨日有错、今日已无」窗口(24h~48h)', () => {
  beforeEach(() => {
    state.rows = []
  })

  it('① 48h 之前的 error 不计入(旧实现把建表以来的全量都算进来)', async () => {
    state.rows = [row(72), row(50)]
    const res = await checkDailyAlerts()
    expect(res.resolved).toBe(0)
  })

  it('② 24h~48h 内的 error 计入(且仍按 error 关键字过滤)', async () => {
    state.rows = [row(36), row(30), row(30, 'user.login')]
    const res = await checkDailyAlerts()
    expect(res.resolved).toBe(2)
  })

  it('③ 24h 内的 error 不计入(它属于 checked,不是已恢复)', async () => {
    state.rows = [row(2), row(1)]
    const res = await checkDailyAlerts()
    expect(res.resolved).toBe(0)
    expect(res.checked).toBe(2)
  })

  it('④ 空集为 0', async () => {
    state.rows = []
    const res = await checkDailyAlerts()
    expect(res.resolved).toBe(0)
    expect(res.checked).toBe(0)
  })

  it('混合三档:只有中间那一档进 resolved,两侧各自归位', async () => {
    state.rows = [row(72), row(36), row(2)]
    const res = await checkDailyAlerts()
    expect(res.resolved).toBe(1)
    expect(res.checked).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
