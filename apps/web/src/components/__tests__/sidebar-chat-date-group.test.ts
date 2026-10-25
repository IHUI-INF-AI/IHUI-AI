// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 侧栏会话日期分桶 — 纯函数单测(2026-10-25 判桶改批)。
// 钉住的语义:① 标签与算法同源(本周=周一起,本月=1 号起,不再"其余全部");
// ② lastMessageAt 缺失 ⇒ 归「更早」,不再 t=0 冒领「本月」;③ 空桶不渲染。
import { describe, expect, it } from 'vitest'

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

  it('三天前 ⇒ 只允许落在 thisWeek 或更早,绝不进 thisMonth 以外的错位桶', () => {
    const g = groupByDate([item('a', localDate(3))])
    expect(['thisWeek', 'earlier']).toContain(g[0]?.key)
    // (周初三天前可能跨月/跨周 ⇒ 两态皆合规,但绝不是"本月")
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
