// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 侧边栏简洁模式回归锁(2026-10-20)
// 立因:这套开关的价值全落在「到底收掉了多少项」上。没有任何东西把这个数字钉住的话,
// 半年后有人往 NAV_GROUPS 里加十个中转站后台入口,简洁模式会静默退化成摆设
// —— 而现在没有任何守门会为此变红。这里把「普通用户可见总数」「四档全开后剩多少」
// 两个数实跑钉死。
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS, flattenNavItems } from '@/components/sidebar/nav-data'
import { filterNavItemsByRole, filterNavItemsByTier } from '@/components/sidebar/use-nav-visibility'
import { ALL_NAV_TIERS } from '@/stores/nav-visibility'
import type { NavItem } from '@/components/sidebar/types'

/** 普通用户视角:非 admin、无任何权限点 —— 与 Sidebar 里 filterNavItemsByRole 的调用一致 */
const itemsForNormalUser = (tree: NavItem[]): NavItem[] => filterNavItemsByRole(tree, false, [])

describe('侧边栏简洁模式:可见项计量', () => {
  it('普通用户可见总数守恒(现今读数 101)', () => {
    // rol 过滤后 adminOnly / permission 项已剔除(管理分组整组不可见)。
    // 变更 NAV_GROUPS 时须同步更新本数字与本注释。
    const all = itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))
    expect(flattenNavItems(all).length).toBe(101)
  })

  it('四档全隐藏后只留 40 项(即收掉 61 项)', () => {
    // 61 = 开发者工具 21 + 中转站后台 16 + 高级 AI 工具 15(14 子项 + 父项 /memory 自身)
    //      + 实验性 9
    // 手算极易漏掉最后那个"+父项":「高级 AI 工具」整组对用户无价值,
    // 故连父项一起隐藏 —— 而 /models 恰恰相反,父项必须保留以承载 overview/usage,
    // 只能逐子项标注。两种标法各有用场,漏其一计数就差一项。
    // 本数为本测试实跑读数(2026-10-20),非估算;变更 NAV_GROUPS 须同步更新。
    const all = itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))
    const full = flattenNavItems(all).length
    const simplified = flattenNavItems(filterNavItemsByTier(all, ALL_NAV_TIERS)).length
    expect(full - simplified).toBe(61)
    expect(simplified).toBe(40)
  })

  it('什么都不藏时一项不减', () => {
    const all = itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))
    expect(flattenNavItems(filterNavItemsByTier(all, [])).length).toBe(
      flattenNavItems(all).length,
    )
  })
})

describe('侧边栏简洁模式:分档归属与继承', () => {
  it('/(models) 父项保留,只看得见 overview 与 usage', () => {
    const models = flattenNavItems(itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))).find(
      (i) => i.href === '/models',
    )
    expect(models).toBeDefined()
    expect(filterNavItemsByTier(models!.children ?? [], ALL_NAV_TIERS).map((i) => i.href)).toEqual([
      '/models/overview',
      '/models/usage',
    ])
  })

  it('「开发者工具」父项标档后,14 个子项由继承规则一并隐藏', () => {
    const tree = itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))
    const tools = flattenNavItems(tree).find((i) => i.href === '/developer/webhooks')
    expect(tools?.advancedOnly).toBe('developer')
    // 子项本身一个都没标 —— 全靠继承
    expect((tools?.children ?? []).some((c) => c.advancedOnly !== undefined)).toBe(false)
    expect(filterNavItemsByTier(tree, ['developer']).flatMap((g) => g.children ?? [])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/developer/webhooks' })]),
    )
  })

  it('「高级 AI 工具」整组跟随父项隐藏', () => {
    const tree = itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))
    const visible = flattenNavItems(filterNavItemsByTier(tree, ['advancedAi']))
    expect(visible.some((i) => i.href === '/memory')).toBe(false)
    expect(visible.some((i) => i.href === '/subagents')).toBe(false)
    expect(visible.some((i) => i.href === '/computer-use')).toBe(false)
  })

  it('知识库父项保留,三个研发向子项被隐藏', () => {
    const tree = itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))
    const visible = flattenNavItems(filterNavItemsByTier(tree, ALL_NAV_TIERS))
    expect(visible.some((i) => i.href === '/knowledge-base')).toBe(true)
    expect(visible.some((i) => i.href === '/knowledge-rag')).toBe(true)
    expect(visible.some((i) => i.href === '/repo-wiki')).toBe(false)
    expect(visible.some((i) => i.href === '/knowledge-cards')).toBe(false)
    expect(visible.some((i) => i.href === '/team-knowledge')).toBe(false)
  })

  it('学习/内容/交易三组不受影响(那是用户真正要用的)', () => {
    const tree = itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))
    const visible = flattenNavItems(filterNavItemsByTier(tree, ALL_NAV_TIERS))
    for (const href of ['/', '/ecosystem', '/domains/edu', '/domains/content', '/domains/trade']) {
      expect(visible.some((i) => i.href === href)).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
