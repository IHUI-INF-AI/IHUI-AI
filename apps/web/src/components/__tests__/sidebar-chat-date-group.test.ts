// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 侧栏会话日期分桶 — 纯函数单测(2026-10-25 判桶改批)。
// 钉住的语义:① 标签与算法同源(本周=周一起,本月=1 号起,不再"其余全部");
// ② lastMessageAt 缺失 ⇒ 归「更早」,不再 t=0 冒领「本月」;③ 空桶不渲染。
import { describe, expect, it, vi } from 'vitest'

import { groupByDate, type ConversationItem } from '@/components/sidebar-chat-history'

function item(id: string, lastMessageAt?: string): ConversationItem {
  return {
    id,
    title: id,
    model: 'test',
    lastMessageAt: lastMessageAt ?? '',
    messageCount: 1,
  }
}

/** 以运行时刻反推各桶内的安全样本(今天中午/上周同日/年初/更早),避免测试自身对时区脆弱。 */
function localDate(daysAgo: number, hour = 12): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 0, 0, 0)
  return d.toString() // Date.toString 仍是合法 Date.parse 输入
}

describe('sidebar groupByDate(日历分桶)', () => {
  it('今天中午 ⇒ today', () => {
    const g = groupByDate([item('a', localDate(0))])
    expect(g.map((x) => x.key)).toEqual(['today'])
  })

  it('三天前 ⇒ 绝不落「今天」;具体桶随日历位置走(周一起算的本周内 ⇒ thisWeek)', () => {
    // 本例此前按运行时刻相对推算 ⇒ 按星期抖:周一~周三时"三天前"落在上周(属 thisMonth),
    // 周四~周日才落 thisWeek —— 一年里 128 天翻红(不是月初月末,是每周翻红 3 天)。
    // 改为冻结系统时间,分别钉住两种真实日历位置(仓内既有惯例:vi.setSystemTime)。
    vi.useFakeTimers()
    try {
      // 2026-10-26 是周一:三天前 = 10-23(上周五)⇒ 跨周未跨月 ⇒ thisMonth
      vi.setSystemTime(new Date(2026, 9, 26, 12, 0, 0))
      const wed = groupByDate([item('a', localDate(3))])
      expect(wed.map((x) => x.key)).toEqual(['thisMonth'])

      // 2026-11-02 是周一:三天前 = 10-30(上月最后一天)⇒ 跨月 ⇒ earlier
      vi.setSystemTime(new Date(2026, 10, 2, 12, 0, 0))
      const nov = groupByDate([item('a', localDate(3))])
      expect(nov.map((x) => x.key)).toEqual(['earlier'])

      // 2026-10-29 是周四:三天前 = 10-26(本周一)⇒ 本周内 ⇒ thisWeek
      vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0))
      const thu = groupByDate([item('a', localDate(3))])
      expect(thu.map((x) => x.key)).toEqual(['thisWeek'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('一年前 ⇒ earlier(旧实现会把它标成「本月」)', () => {
    const g = groupByDate([item('ancient', localDate(365))])
    expect(g).toEqual([
      {
        key: 'earlier',
        items: [expect.objectContaining({ id: 'ancient' })],
      },
    ])
  })

  it('缺 lastMessageAt ⇒ earlier,不冒领任何近期桶', () => {
    const missing = { id: 'no-ts', title: 'x', model: 'm', messageCount: 1 } as ConversationItem
    const g = groupByDate([missing])
    expect(g.map((x) => x.key)).toEqual(['earlier'])
  })

  it('空桶不输出(无"本月(空)"占位)', () => {
    const g = groupByDate([item('a', localDate(0)), item('b', localDate(0))])
    expect(g.every((bucket) => bucket.items.length > 0)).toBe(true)
  })

  it('成对正向:多桶共存顺序稳定(today 最前)', () => {
    const g = groupByDate([item('e1', localDate(400)), item('t1', localDate(0))])
    expect(g.map((x) => x.key)).toEqual(['today', 'earlier'])
  })
})

// 2026-11-05 补:日历切界(周日/周一、月末/次月、跨年)与时间锚点回退。
// 既有断言的期望值一律不动,仅新增用例。
describe('sidebar groupByDate(日历边界与时间回退)', () => {
  /** 冻结在 now,返回单个会话落入的桶 key 序列(空桶规则由 groupByDate 自身保证)。 */
  function bucketAt(now: Date, lastMessageAt: string, extra: Partial<ConversationItem> = {}) {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(now)
      return groupByDate([{ ...item('probe'), lastMessageAt, ...extra }]).map((x) => x.key)
    } finally {
      vi.useRealTimers()
    }
  }

  it('周一 00:00 起算本周:周日 23:59 属上一自然周(未跨月 ⇒ thisMonth,跨月 ⇒ earlier)', () => {
    // 2026-11-02 是周一,此刻 startOfWeek = 11-02 00:00、startOfMonth = 11-01 00:00
    const now = new Date(2026, 10, 2, 0, 0, 0)
    expect(bucketAt(now, new Date(2026, 10, 1, 23, 59, 59).toString())).toEqual(['thisMonth'])
    expect(bucketAt(now, new Date(2026, 9, 31, 23, 59, 59).toString())).toEqual(['earlier'])
    // 同刻边界:周一 00:00 本身是 today,不是本周
    expect(bucketAt(now, new Date(2026, 10, 2, 0, 0, 0).toString())).toEqual(['today'])
  })

  it('周日 23:59 是本周末尾而非下周起点:周一 00:00 仍属本周', () => {
    // 2026-11-01 是周日,此刻 startOfWeek = 10-26(周一)00:00、startOfMonth = 11-01 00:00
    const now = new Date(2026, 10, 1, 23, 59, 0)
    expect(bucketAt(now, new Date(2026, 9, 26, 0, 0, 0).toString())).toEqual(['thisWeek'])
    // 10-25(上周日)既跨周又跨月 ⇒ earlier
    expect(bucketAt(now, new Date(2026, 9, 25, 23, 59, 59).toString())).toEqual(['earlier'])
  })

  it('月末 23:59 ⇒ earlier;本月 1 号 00:00 ⇒ thisMonth(本月从 1 号起)', () => {
    // 取月中作 now,避免「跨月但同一自然周」被 thisWeek 优先命中
    const now = new Date(2026, 10, 15, 12, 0, 0)
    expect(bucketAt(now, new Date(2026, 9, 31, 23, 59, 59).toString())).toEqual(['earlier'])
    expect(bucketAt(now, new Date(2026, 10, 1, 0, 0, 0).toString())).toEqual(['thisMonth'])
  })

  it('跨年:跨年但同一自然周 ⇒ thisWeek;错开一周后 ⇒ earlier / thisMonth', () => {
    // 2027-01-01 是周五,startOfWeek = 2026-12-28(周一)⇒ 12-31 仍在本周内
    expect(
      bucketAt(new Date(2027, 0, 1, 0, 0, 0), new Date(2026, 11, 31, 23, 59, 59).toString()),
    ).toEqual(['thisWeek'])
    const later = new Date(2027, 0, 15, 12, 0, 0)
    expect(bucketAt(later, new Date(2026, 11, 31, 23, 59, 59).toString())).toEqual(['earlier'])
    expect(bucketAt(later, new Date(2027, 0, 1, 0, 0, 0).toString())).toEqual(['thisMonth'])
  })

  it('缺 lastMessageAt ⇒ 依次回退 updatedAt → createdAt;都不可用才 earlier', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 10, 5, 12, 0, 0))
      const todayNoon = new Date(2026, 10, 5, 12, 0, 0).toString()
      const oldDay = new Date(2025, 10, 5, 12, 0, 0).toString()

      // lastMessageAt 空串 ⇒ 用 updatedAt
      expect(
        groupByDate([{ ...item('a'), lastMessageAt: '', updatedAt: todayNoon }]).map((x) => x.key),
      ).toEqual(['today'])
      // lastMessageAt 与 updatedAt 都空 ⇒ 用 createdAt
      expect(
        groupByDate([{ ...item('b'), lastMessageAt: '', updatedAt: '', createdAt: todayNoon }]).map(
          (x) => x.key,
        ),
      ).toEqual(['today'])
      // 只有一年前的 createdAt ⇒ earlier(不回退到"现在")
      expect(
        groupByDate([{ ...item('c'), lastMessageAt: '', createdAt: oldDay }]).map((x) => x.key),
      ).toEqual(['earlier'])
      // 三者都没有 ⇒ earlier
      expect(
        groupByDate([{ ...item('d'), lastMessageAt: '', updatedAt: '', createdAt: '' }]).map(
          (x) => x.key,
        ),
      ).toEqual(['earlier'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('非法时间字符串 ⇒ 跳过该字段继续回退;全部非法 ⇒ earlier(不按 1970 冒领本月)', () => {
    const now = new Date(2026, 10, 5, 12, 0, 0)
    const todayNoon = new Date(2026, 10, 5, 12, 0, 0).toString()
    expect(bucketAt(now, 'not-a-date', { updatedAt: todayNoon })).toEqual(['today'])
    expect(bucketAt(now, 'not-a-date', { createdAt: 'garbage' })).toEqual(['earlier'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
