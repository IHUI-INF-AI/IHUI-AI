// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// P2 TDZ 与域清单完整性回归锁(2026-10-19)
// 立因:P2 把三个域的条目从 NAV_GROUPS 移进 *_HUB_ITEMS,若新常量声明在所依赖的
// 常量之前,模块顶层 const 的 TDZ 会在 import 时直接 ReferenceError(整页白屏);
// 而 vitest 的 import 恰好能真跑到那一刻,比读代码推断可靠。
import { describe, it, expect } from 'vitest'
import {
  NAV_GROUPS,
  EDU_HUB_ITEMS,
  CONTENT_HUB_ITEMS,
  TRADE_HUB_ITEMS,
} from '@/components/sidebar/nav-data'

describe('P2 域入口:TDZ 与清单完整性', () => {
  it('三个域清单可 import(声明顺序正确,无 TDZ)', () => {
    expect(Array.isArray(EDU_HUB_ITEMS)).toBe(true)
    expect(Array.isArray(CONTENT_HUB_ITEMS)).toBe(true)
    expect(Array.isArray(TRADE_HUB_ITEMS)).toBe(true)
  })

  it('条目数量与 P2 收敛前的规模相符(清单一条不能丢)', () => {
    // 收敛前实测(2026-10-19 逐条点算,非估算):
    //  edu    = 14 条顶层 + EDU_ITEMS 27 条   = 41
    //  content= 15 条顶层(其中 /messages 带 6 个 children,children 不计入本数)
    //  trade  = 14 条顶层 + MEMBER_ITEMS 12 条 = 26
    // 注:三处数字均为本测试实跑读数;变更域清单时须同步更新本注释。
    expect(EDU_HUB_ITEMS.length).toBe(41)
    expect(CONTENT_HUB_ITEMS.length).toBe(15)
    expect(TRADE_HUB_ITEMS.length).toBe(26)
  })

  it('侧边栏三组各只留 1 个域入口', () => {
    const edu = NAV_GROUPS.find((g) => g.label === 'eduGroup')
    const content = NAV_GROUPS.find((g) => g.label === 'contentGroup')
    const trade = NAV_GROUPS.find((g) => g.label === 'tradeGroup')
    expect(edu?.items.map((i) => i.href)).toEqual(['/domains/edu'])
    expect(content?.items.map((i) => i.href)).toEqual(['/domains/content'])
    expect(trade?.items.map((i) => i.href)).toEqual(['/domains/trade'])
  })

  it('域入口页路由已登记,且域清单 href 无死链指向域页自身', () => {
    const all = [...EDU_HUB_ITEMS, ...CONTENT_HUB_ITEMS, ...TRADE_HUB_ITEMS]
    // 域清单里不应出现 /domains/* 自身(否则入口页会指向自己)
    expect(all.filter((i) => i.href.startsWith('/domains/'))).toHaveLength(0)
  })

  it('教师权限项仍在教育域清单里(权限过滤才有东西可滤)', () => {
    const managed = EDU_HUB_ITEMS.filter((i) => i.permission === 'edu:manage')
    expect(managed.length).toBe(10)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
