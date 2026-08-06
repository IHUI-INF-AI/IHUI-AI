/**
 * mobile-stats-queries getCrashRate 测试(2026-08-06 新增功能)。
 *
 * 覆盖(DB 层用 mock,不连真实库):
 *  - 崩溃数/会话数均正常 → 百分比(2 位小数)
 *  - 无会话(sessions=0)→ null(避免 0/0 造假)
 *  - 兼容 execute 结果 { rows: [...] } 形态与字符串 count
 *  - 窗口内无崩溃但会话>0 → 0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  dbRead: { execute: mockExecute },
  db: {},
}))

import { getCrashRate } from '../src/db/mobile-stats-queries'

describe('getCrashRate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('崩溃 5 / 会话 100 → 5', async () => {
    mockExecute
      .mockResolvedValueOnce([{ count: 5 }])
      .mockResolvedValueOnce([{ count: 100 }])
    const rate = await getCrashRate(new Date('2026-08-06T00:00:00Z'))
    expect(rate).toBe(5)
    // 两次 execute:一次崩溃数、一次会话数
    expect(mockExecute).toHaveBeenCalledTimes(2)
  })

  it('崩溃 1 / 会话 3 → 33.33(四舍五入 2 位小数)', async () => {
    mockExecute
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 3 }])
    expect(await getCrashRate(new Date())).toBe(33.33)
  })

  it('崩溃 1 / 会话 6 → 16.67', async () => {
    mockExecute
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 6 }])
    expect(await getCrashRate(new Date())).toBe(16.67)
  })

  it('无会话(0)→ null', async () => {
    mockExecute
      .mockResolvedValueOnce([{ count: 10 }])
      .mockResolvedValueOnce([{ count: 0 }])
    expect(await getCrashRate(new Date())).toBeNull()
  })

  it('会话无数据(空数组)→ null', async () => {
    mockExecute.mockResolvedValueOnce([{ count: 3 }]).mockResolvedValueOnce([])
    expect(await getCrashRate(new Date())).toBeNull()
  })

  it('有会话但无崩溃 → 0', async () => {
    mockExecute
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 50 }])
    expect(await getCrashRate(new Date())).toBe(0)
  })

  it('兼容 { rows: [...] } 形态与字符串 count', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '8' }] })
    expect(await getCrashRate(new Date())).toBe(25)
  })

  it('SQL 查询命中 crash_reports 与 visit_logs 两张表', async () => {
    mockExecute
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 10 }])
    await getCrashRate(new Date('2026-08-06T08:00:00Z'))
    // drizzle sql 对象:表名文本在 queryChunks 中,JSON 序列化可见
    const sqlTexts = mockExecute.mock.calls.map((c) => JSON.stringify(c[0]))
    expect(sqlTexts.some((s) => s.includes('crash_reports'))).toBe(true)
    expect(sqlTexts.some((s) => s.includes('visit_logs'))).toBe(true)
  })
})
