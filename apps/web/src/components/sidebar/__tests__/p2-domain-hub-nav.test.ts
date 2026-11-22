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
  isHrefActive,
} from '@/components/sidebar/nav-data'
import { resolveDomainSlugForPath } from '@/components/layout/domain-registry'

describe('P2 域入口:TDZ 与清单完整性', () => {
  it('三个域清单可 import(声明顺序正确,无 TDZ)', () => {
    expect(Array.isArray(EDU_HUB_ITEMS)).toBe(true)
    expect(Array.isArray(CONTENT_HUB_ITEMS)).toBe(true)
    expect(Array.isArray(TRADE_HUB_ITEMS)).toBe(true)
  })

  it('条目数量与 P2 收敛前的规模相符(清单一条不能丢)', () => {
    // 收敛前实测(2026-10-19 逐条点算,非估算):
    //  edu    = 14 条顶层 + EDU_ITEMS 28 条   = 42(`286ce1da49` 票 B67/B70/B72 补 /edu/attendance)
    //  content= 16 条顶层(其中 /messages 带 6 个 children,children 不计入本数;新增第 16 条来自 2026-11-03 内容域收口)
    //  trade  = 14 条顶层 + MEMBER_ITEMS 12 条 = 26
    // 注:三处数字均为本测试实跑读数;变更域清单时须同步更新本注释。
    expect(EDU_HUB_ITEMS.length).toBe(42)
    expect(CONTENT_HUB_ITEMS.length).toBe(16)
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

// 回归锁(2026-11-11 用户反馈):没在首页时首页箭头仍常驻高亮。
// 根因:'/' 是任意 pathname 的前缀,未登记进 nav 表的真实路由(/plugins 等)找不到
// 更精确 href,于是首页被判为 active。锁死:根路径只在精确 '/' 时激活。
describe('isHrefActive 根路径精确匹配', () => {
  it('只在 pathname 恰为 / 时激活首页', () => {
    expect(isHrefActive('/', '/')).toBe(true)
    expect(isHrefActive('/', '/plugins')).toBe(false)
    expect(isHrefActive('/', '/chat/abc')).toBe(false)
  })

  it('非根 href 仍按前缀匹配(含子路由)', () => {
    const href = '/domains/ai'
    expect(isHrefActive(href, '/domains/ai')).toBe(true)
    expect(isHrefActive(href, '/domains/ai/child')).toBe(true)
    expect(isHrefActive(href, '/domains/edu')).toBe(false)
  })

  // 回归锁(2026-11-16 深度审计):域收敛后页面仍在旧 URL,点击域内旧页面时
  // 对应域入口必须保持高亮,否则整条侧栏没有任何选中态(管理选中态丢失的同型问题)。
  it('域入口在旧 URL 子页面下保持高亮(八个域全覆盖)', () => {
    // 教育:旧前缀 /edu、/edu-ai、/learn、/live、/exam 等
    expect(isHrefActive('/domains/edu', '/edu/attendance')).toBe(true)
    expect(isHrefActive('/domains/edu', '/edu-ai/policy')).toBe(true)
    expect(isHrefActive('/domains/edu', '/learn')).toBe(true)
    // 内容:顶层单页 + /messages 子项
    expect(isHrefActive('/domains/content', '/plaza')).toBe(true)
    expect(isHrefActive('/domains/content', '/messages/notice')).toBe(true)
    // 交易:/member 与大量顶层单页
    expect(isHrefActive('/domains/trade', '/member/dashboard')).toBe(true)
    expect(isHrefActive('/domains/trade', '/wallet')).toBe(true)
    // AI:/models 与子项、/agents
    expect(isHrefActive('/domains/ai', '/models/chats')).toBe(true)
    expect(isHrefActive('/domains/ai', '/agents')).toBe(true)
    // 个人:/user/* 与 /favorites
    expect(isHrefActive('/domains/personal', '/user/profile')).toBe(true)
    expect(isHrefActive('/domains/personal', '/favorites')).toBe(true)
    // 人事(与 ADMIN 域允许重叠)
    expect(isHrefActive('/domains/hr', '/hr/my-attendance')).toBe(true)
    expect(isHrefActive('/domains/hr', '/admin/hr-attendance')).toBe(true)
    // 开发者
    expect(isHrefActive('/domains/developer', '/developer/relay')).toBe(true)
    // 管理:旧后台全部子页 + 侧栏静态 /members
    expect(isHrefActive('/domains/admin', '/domains/admin')).toBe(true)
    expect(isHrefActive('/domains/admin', '/admin')).toBe(true)
    expect(isHrefActive('/domains/admin', '/admin/users')).toBe(true)
    expect(isHrefActive('/domains/admin', '/members')).toBe(true)
    expect(isHrefActive('/domains/admin', '/administrator')).toBe(false)
  })

  it('域别名的路径边界:同前缀不同段不误判', () => {
    expect(isHrefActive('/domains/edu', '/live-extra')).toBe(false)
    expect(isHrefActive('/domains/edu', '/domains/edu-extra')).toBe(false)
    expect(isHrefActive('/domains/ai', '/agents-extra')).toBe(false)
  })

  // 同一口径锁在「子页归属域」的解析器上:裸前缀会把 /administrator 误归管理域
  it('域归属解析同守路径段边界', () => {
    expect(resolveDomainSlugForPath('/administrator')).toBeNull()
    expect(resolveDomainSlugForPath('/live-extra')).toBeNull()
    expect(resolveDomainSlugForPath('/admin/users')).toBe('admin')
    expect(resolveDomainSlugForPath('/edu/attendance')).toBe('edu')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
