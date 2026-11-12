// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-20:积分任务「今日/本周」区间必须按上海日界(Asia/Shanghai),不是 UTC 午夜。
 *
 * 原缺陷:`dayBounds` 用 `new Date(today + 'T00:00:00Z')` 把 `todayString()` 给的
 * **上海日键**当 UTC 日界用 ⇒ 上海 00:00–07:59 的动作落不进「今日」窗口(进度恒 0),
 * 次日同一时段又会被算进前一天。本文件钉住「上海 00:30 属于今日」「上海 23:30 仍属今日」
 * 「UTC 边界不串日」,并锁住日界只走 utils/biz-day 的唯一出口。
 *
 * 不连 DB:dayBounds 是纯函数,其余依赖全部 mock。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))
vi.mock('../src/plugins/auth.js', () => ({ authenticate: vi.fn() }))
vi.mock('../src/db/gamification-queries.js', () => ({
  findTodaySignIn: vi.fn(),
  findRecentSignInRecords: vi.fn(),
  ensureUserPoints: vi.fn(),
}))
vi.mock('../src/db/point-queries.js', () => ({ hasClaimedFirstShare: vi.fn() }))
vi.mock('../src/services/points-service.js', () => ({ earnPoints: vi.fn() }))

import { dayBounds } from '../src/routes/points-tasks.js'

/** 上海 2026-11-13 00:00 == 2026-11-12T16:00Z;上海 2026-11-14 00:00 == 2026-11-13T16:00Z */
const DAY = '2026-11-13'
const ms = (iso: string): number => new Date(iso).getTime()

describe('F-20 积分任务今日区间按上海日界', () => {
  it('上海 00:30 属于今日(旧 UTC 午夜口径会把它漏在窗口外)', () => {
    const { from, to } = dayBounds(DAY)
    const at = ms('2026-11-12T16:30:00.000Z') // 上海 11-13 00:30
    expect(at).toBeGreaterThanOrEqual(from.getTime())
    expect(at).toBeLessThan(to.getTime())
    // 旧实现 [11-13T00:00Z, 11-14T00:00Z) ⇒ 这一笔小于下界,进度恒 0
    expect(at).toBeLessThan(ms('2026-11-13T00:00:00.000Z'))
  })

  it('上海 23:30 仍属今日(日界在 24:00,不在 UTC 零点)', () => {
    const { from, to } = dayBounds(DAY)
    const at = ms('2026-11-13T15:30:00.000Z') // 上海 11-13 23:30
    expect(at).toBeGreaterThanOrEqual(from.getTime())
    expect(at).toBeLessThan(to.getTime())
    // 距下一个上海 00:00 还有 30 分钟,右界必须给足
    expect(to.getTime() - at).toBe(30 * 60 * 1000)
  })

  it('UTC 边界不串日:区间 = [前一日 16:00Z, 当日 16:00Z),UTC 零点不是日界', () => {
    const { from, to } = dayBounds(DAY)
    expect(from.toISOString()).toBe('2026-11-12T16:00:00.000Z')
    expect(to.toISOString()).toBe('2026-11-13T16:00:00.000Z')
    // UTC 零点(= 上海 08:00)在今日窗口内,不换日
    expect(ms('2026-11-13T00:00:00.000Z')).toBeGreaterThan(from.getTime())
    expect(ms('2026-11-13T00:00:00.000Z')).toBeLessThan(to.getTime())
    // 上海次日 00:00 整点在右界上(左闭右开)⇒ 属于下一天,不重复计入今日
    expect(ms('2026-11-13T16:00:00.000Z')).toBe(to.getTime())
    // 上海 07:59:59.999(UTC 前一日 23:59:59.999)属今日,不被切到前一天
    expect(ms('2026-11-12T23:59:59.999Z')).toBeGreaterThan(from.getTime())
    expect(ms('2026-11-12T23:59:59.999Z')).toBeLessThan(to.getTime())
    // 上海前一日 23:59:59.999 不在今日窗口内
    expect(ms('2026-11-12T15:59:59.999Z')).toBeLessThan(from.getTime())
  })
})

describe('F-20 源码:日界只走 utils/biz-day 唯一出口', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/routes/points-tasks.ts', import.meta.url)),
    'utf8',
  )
  // 注释里引用旧口径做对照是允许的,断言只看代码
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('复用 bizDayStartUtc,文件内没有第二份时区算术', () => {
    expect(code).toMatch(/import \{ bizDayStartUtc \} from '\.\.\/utils\/biz-day\.js'/)
    expect(code).toMatch(/bizDayStartUtc\(/)
    expect(code).not.toMatch(/8 \* 3600/)
    expect(code).not.toMatch(/Date\.UTC\(/)
  })

  it('今日与本周区间都不再把日键拼成 UTC 日界', () => {
    expect(code).not.toMatch(/today \+ 'T00:00:00Z'/)
    expect(code).not.toMatch(/weekStart \+ 'T00:00:00Z'/)
    expect(code).toMatch(/dayStartUtc\(weekStart\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
