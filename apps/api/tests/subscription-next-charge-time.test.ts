// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DBG-7:下次扣款按 Asia/Shanghai 日历推进,不吃宿主夏令时。

import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: {},
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  deductRecurring: vi.fn(),
  generateOutTradeNo: vi.fn(),
}))

import { __test__ } from '../src/services/subscription-service.js'

const { calculateNextChargeTimeFrom } = __test__

const DAY_MS = 24 * 60 * 60 * 1000

/** 上海墙钟 → 绝对时刻。Date.UTC 会把负小时归一化,与跑机时区无关。 */
function atShanghai(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  millisecond = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second, millisecond))
}

/** 用 IANA Asia/Shanghai 读回墙钟,不复算 +8 偏移。 */
function shanghaiWall(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((part) => part.type === type)?.value ?? ''
    return type === 'hour' && value === '24' ? '00' : value
  }
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}.${ms}`
}

function expectNext(
  period: string | null | undefined,
  base: Date,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  millisecond = 0,
): void {
  const next = calculateNextChargeTimeFrom(period, base)
  const expected = atShanghai(year, month, day, hour, minute, second, millisecond)
  expect(next.getTime()).toBe(expected.getTime())
  expect(shanghaiWall(next)).toBe(
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(millisecond).padStart(3, '0')}`,
  )
  // 上海无夏令时:跨过欧美切换点时,间隔仍是整天,不会少 1 小时或多 1 小时。
  expect((next.getTime() - base.getTime()) % DAY_MS).toBe(0)
}

describe('calculateNextChargeTimeFrom 按 Asia/Shanghai 日历推进', () => {
  it('月:跨欧洲夏令时开始(2026-03-29)仍停在原上海钟点', () => {
    const base = atShanghai(2026, 3, 15, 10, 30, 45, 123)
    expectNext('month', base, 2026, 4, 15, 10, 30, 45, 123)
    expect(calculateNextChargeTimeFrom('month', base).getTime() - base.getTime()).toBe(31 * DAY_MS)
  })

  it('周:跨欧洲春令(2026-03-29)与秋令(2026-10-25)都正好 7 个 24 小时', () => {
    const spring = atShanghai(2026, 3, 25, 10, 30, 0, 0)
    expectNext('week', spring, 2026, 4, 1, 10, 30, 0, 0)
    expect(calculateNextChargeTimeFrom('week', spring).getTime() - spring.getTime()).toBe(
      7 * DAY_MS,
    )

    const autumn = atShanghai(2026, 10, 20, 10, 30, 0, 0)
    expectNext('week', autumn, 2026, 10, 27, 10, 30, 0, 0)
    expect(calculateNextChargeTimeFrom('week', autumn).getTime() - autumn.getTime()).toBe(
      7 * DAY_MS,
    )
  })

  it('年:美国夏令时起算日 2026-03-08 / 2027-03-14 不一致时上海钟点不漂', () => {
    const base = atShanghai(2026, 3, 10, 10, 0, 0, 0)
    expectNext('year', base, 2027, 3, 10, 10, 0, 0, 0)
    expect(calculateNextChargeTimeFrom('year', base).getTime() - base.getTime()).toBe(365 * DAY_MS)
  })

  it('月:上海已是次日、UTC 仍是上月末时,按上海月进位而不是 UTC 月', () => {
    // 2026-05-01 03:00 上海 = 2026-04-30 19:00 UTC。本地若按 UTC,setMonth 会落到 5 月 31 日。
    const base = atShanghai(2026, 5, 1, 3, 0, 0, 0)
    expectNext('month', base, 2026, 6, 1, 3, 0, 0, 0)
  })

  it('年:闰日的 UTC 投影溢出时,上海 3 月 1 日仍落到次年 3 月 1 日', () => {
    // 2024-03-01 02:00 上海 = 2024-02-29 18:00 UTC。本地若按 UTC,setFullYear 会溢到 3 月 2 日。
    const base = atShanghai(2024, 3, 1, 2, 0, 0, 0)
    expectNext('year', base, 2025, 3, 1, 2, 0, 0, 0)
  })

  it('周:上海深夜跨月,毫秒与钟点都保留', () => {
    const base = atShanghai(2026, 1, 28, 23, 45, 12, 7)
    expectNext('week', base, 2026, 2, 4, 23, 45, 12, 7)
  })

  it('月末溢出与闰日加一年保持原日历进位', () => {
    expectNext('month', atShanghai(2026, 1, 31, 15, 30, 0, 0), 2026, 3, 3, 15, 30, 0, 0)
    expectNext('year', atShanghai(2024, 2, 29, 12, 0, 0, 0), 2025, 3, 1, 12, 0, 0, 0)
  })

  it('空周期与未知周期按月', () => {
    const base = atShanghai(2026, 8, 8, 9, 15, 0, 0)
    expectNext(null, base, 2026, 9, 8, 9, 15, 0, 0)
    expectNext(undefined, base, 2026, 9, 8, 9, 15, 0, 0)
    expectNext('quarter', base, 2026, 9, 8, 9, 15, 0, 0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
