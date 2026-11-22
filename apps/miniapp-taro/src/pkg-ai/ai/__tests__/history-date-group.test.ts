// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序会话历史「日历制分桶」—— 与 web 侧栏同一份边界的用例(2026-11-05 对齐)。
// 端内 vitest 是 `environment:'node'`(无 jsdom),故分两层钉住:
//   ① 共享纯函数层(切界/回退链/空桶/顺序)—— 这层就是 web 与小程序共同的实现本体;
//   ② 页面源码结构层(证明 history.tsx **确实**消费共享实现,而不是把「滚动 7 天」留成第二套)。
// 缺第②层则「页面又抄回旧逻辑」测不出红。
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  groupConversationByDate,
  resolveConversationTimestamp,
} from '@ihui/shared/chat/conversation-date-group'

/** 与本页 HistoryItem 的分桶时间锚点同形:timestamp → time → null */
interface ProbeRow {
  id: string
  timestamp?: number
  time?: string
}
const probeTime = (r: ProbeRow): number | null =>
  resolveConversationTimestamp([r.timestamp, r.time])

/** 固定 now 下,单条会话落入的桶 key 序列(空桶规则由实现自身保证)。 */
function bucketAt(now: Date, time: string, timestamp?: number): string[] {
  return groupConversationByDate([{ id: 'probe', time, timestamp }], probeTime, now).map(
    (x) => x.key,
  )
}

describe('小程序 history 日历分桶(与 web sidebar-chat-date-group 同边界)', () => {
  it('周一 00:00 起算本周:周日 23:59 属上一自然周(未跨月 ⇒ thisMonth,跨月 ⇒ earlier)', () => {
    // 2026-11-02 是周一:startOfWeek = 11-02 00:00,startOfMonth = 11-01 00:00
    const now = new Date(2026, 10, 2, 0, 0, 0)
    expect(bucketAt(now, new Date(2026, 10, 1, 23, 59, 59).toString())).toEqual(['thisMonth'])
    expect(bucketAt(now, new Date(2026, 9, 31, 23, 59, 59).toString())).toEqual(['earlier'])
    // 同刻边界:周一 00:00 本身是 today
    expect(bucketAt(now, new Date(2026, 10, 2, 0, 0, 0).toString())).toEqual(['today'])
  })

  it('周日 23:59 是本周末尾而非下周起点:上周一 00:00 仍属本周', () => {
    // 2026-11-01 是周日:startOfWeek = 10-26(周一),startOfMonth = 11-01
    const now = new Date(2026, 10, 1, 23, 59, 0)
    expect(bucketAt(now, new Date(2026, 9, 26, 0, 0, 0).toString())).toEqual(['thisWeek'])
    expect(bucketAt(now, new Date(2026, 9, 25, 23, 59, 59).toString())).toEqual(['earlier'])
  })

  it('月末 23:59 ⇒ earlier;本月 1 号 00:00 ⇒ thisMonth(本月从 1 号起)', () => {
    const now = new Date(2026, 10, 15, 12, 0, 0)
    expect(bucketAt(now, new Date(2026, 9, 31, 23, 59, 59).toString())).toEqual(['earlier'])
    expect(bucketAt(now, new Date(2026, 10, 1, 0, 0, 0).toString())).toEqual(['thisMonth'])
  })

  it('跨年:跨年但同一自然周 ⇒ thisWeek;错开一周后 ⇒ earlier / thisMonth', () => {
    // 2027-01-01 是周五,startOfWeek = 2026-12-28(周一)⇒ 12-31 仍在本周
    expect(
      bucketAt(new Date(2027, 0, 1, 0, 0, 0), new Date(2026, 11, 31, 23, 59, 59).toString()),
    ).toEqual(['thisWeek'])
    const later = new Date(2027, 0, 15, 12, 0, 0)
    expect(bucketAt(later, new Date(2026, 11, 31, 23, 59, 59).toString())).toEqual(['earlier'])
    expect(bucketAt(later, new Date(2027, 0, 1, 0, 0, 0).toString())).toEqual(['thisMonth'])
  })

  it('缺时间戳 ⇒ 依次回退 timestamp → time;都不可用才 earlier(不按 now 冒领今天)', () => {
    const now = new Date(2026, 10, 5, 12, 0, 0)
    const todayNoon = new Date(2026, 10, 5, 12, 0, 0)
    const oldDay = new Date(2025, 10, 5, 12, 0, 0)
    // 只有 timestamp ⇒ 今天
    expect(bucketAt(now, 'not-a-date', todayNoon.getTime())).toEqual(['today'])
    // timestamp 缺失 ⇒ 用 time
    expect(bucketAt(now, todayNoon.toString())).toEqual(['today'])
    // 只有一年前的 time ⇒ earlier
    expect(bucketAt(now, oldDay.toString())).toEqual(['earlier'])
    // 两者都空 / 都非法 ⇒ earlier
    expect(bucketAt(now, '')).toEqual(['earlier'])
    expect(bucketAt(now, 'garbage')).toEqual(['earlier'])
  })

  it('空桶不输出,桶序恒为 today → thisWeek → thisMonth → earlier', () => {
    const now = new Date(2026, 10, 5, 12, 0, 0)
    const rows: ProbeRow[] = [
      { id: 'ancient', time: new Date(2024, 0, 1, 12, 0, 0).toString() },
      { id: 't1', time: new Date(2026, 10, 5, 12, 0, 0).toString() },
    ]
    const groups = groupConversationByDate(rows, probeTime, now)
    expect(groups.map((g) => g.key)).toEqual(['today', 'earlier'])
    expect(groups.every((g) => g.items.length > 0)).toBe(true)
  })
})

describe('页面接线(history.tsx 源码结构层)', () => {
  const pagePath = path.resolve(__dirname, '../history.tsx')
  const source = readFileSync(pagePath, 'utf8')

  it('分桶走共享实现,不再端内自写滚动 7 天', () => {
    expect(source).toContain("from '@ihui/shared/chat/conversation-date-group'")
    expect(source).toContain('groupConversationByDate(visible, itemGroupTime)')
    // 旧实现的专属特征:滚动 7 天常量与「昨天」桶
    expect(source).not.toContain('day * 7')
    expect(source).not.toContain("'yesterday'")
  })

  it('分桶时间锚点用 timestamp → time 回退链(缺失返回 null,不以 Date.now 占位)', () => {
    expect(source).toContain('resolveConversationTimestamp([h.timestamp, h.time])')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
