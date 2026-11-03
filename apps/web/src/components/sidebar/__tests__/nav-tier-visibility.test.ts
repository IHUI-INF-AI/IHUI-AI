// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 侧边栏简洁模式回归锁(2026-10-20)
// 立因:这套开关的价值全落在「到底收掉了多少项」上。没有任何东西把这个数字钉住的话,
// 半年后有人往 NAV_GROUPS 里加十个中转站后台入口,简洁模式会静默退化成摆设
// —— 而现在没有任何守门会为此变红。这里把「普通用户可见总数」「四档全开后剩多少」
// 两个数实跑钉死。
//
// 2026-10-23 P2 收敛第二批后的取材面:AI 域与个人域的条目已从 NAV_GROUPS 搬进
// AI_HUB_ITEMS / PERSONAL_HUB_ITEMS,由域入口页(/domains/ai、/domains/personal)经
// DomainHub → useNavVisibilityFilter 消费,档位判据照旧生效(两层过滤一处出口)。
// 于是本锁分两面计量:① 侧边栏树(还留在 NAV_GROUPS 的项)/ ② AI 域清单。
// 只量①的话,41 项档位归属搬到域页后这把尺子就会瞎掉 —— 那正是本锁立时要防的失效型。
import { describe, it, expect } from 'vitest'
import {
  AI_HUB_ITEMS,
  NAV_GROUPS,
  PERSONAL_HUB_ITEMS,
  flattenNavItems,
} from '@/components/sidebar/nav-data'
import { filterNavItemsByRole, filterNavItemsByTier } from '@/components/sidebar/use-nav-visibility'
import { ALL_NAV_TIERS } from '@/stores/nav-visibility'
import type { NavItem } from '@/components/sidebar/types'

/** 普通用户视角:非 admin、无任何权限点 —— 与 Sidebar 里 filterNavItemsByRole 的调用一致 */
const itemsForNormalUser = (tree: NavItem[]): NavItem[] => filterNavItemsByRole(tree, false, [])

/** 侧边栏树(普通用户 role 过滤后) */
const sidebarTree = (): NavItem[] => itemsForNormalUser(NAV_GROUPS.flatMap((g) => g.items))

describe('侧边栏简洁模式:可见项计量', () => {
  it('侧边栏树普通用户可见总数守恒(现今读数 28)', () => {
    // role 过滤后 adminOnly / permission 项已剔除(管理分组整组不可见)。
    // 28 = 首页 1 + 热门 1 + AI 域入口 1 + 教育/内容/交易域入口 3 + 个人域入口 1
    //      + 开发者域(入口父项 + 20 子项,普通用户可见)21
    // —— AI 域那 54 项 2026-10-23 起在域入口页面上,不在本面(见下面那一条)。
    // 变更 NAV_GROUPS 时须同步更新本数字与本注释。
    expect(flattenNavItems(sidebarTree()).length).toBe(28)
  })

  it('侧边栏树四档全隐藏后只留 7 项(即收掉 21 项)', () => {
    // 21 = 开发者域整域(父项标 developer,20 个子项由继承规则带档)。
    // 本数为本测试实跑读数(2026-10-23 收敛第二批后),非估算;变更 NAV_GROUPS 须同步更新。
    const all = sidebarTree()
    const full = flattenNavItems(all).length
    const simplified = flattenNavItems(filterNavItemsByTier(all, ALL_NAV_TIERS)).length
    expect(full - simplified).toBe(21)
    expect(simplified).toBe(7)
  })

  it('AI 域清单四档全隐藏后收掉 41 项(收敛没让档位判据失效)', () => {
    // 41 = 中转站后台 16(/models 的 relayOps 子项)+ 高级 AI 工具 15(14 子项 + 父项 /memory)
    //      + 实验性 10(agent-workbench/agent-canvas/web-tools/figma-import/voices/checkin
    //        + 知识库里的 repo-wiki/knowledge-cards/team-knowledge
    //        + 个人号池 /account-pool,2026-10-23 随 b23f01cf21 入本域并标 experimental)
    // 手算极易漏掉那个"+父项":「高级 AI 工具」整组对用户无价值,故连父项一起隐藏;
    // 而 /models 恰恰相反,父项必须保留以承载 overview/usage,只能逐子项标注。
    // 54 = AI_HUB_ITEMS flatten 全量(普通用户 role 过滤不掉任何一项,本域无权限点)。
    const all = itemsForNormalUser(AI_HUB_ITEMS)
    const full = flattenNavItems(all).length
    const simplified = flattenNavItems(filterNavItemsByTier(all, ALL_NAV_TIERS)).length
    expect(full).toBe(54)
    expect(full - simplified).toBe(41)
    expect(simplified).toBe(13)
  })

  it('个人域清单不受档位影响(全是用户自己的东西,一个都没标档)', () => {
    // 正向对照:本域若被顺手补上 advancedOnly,收敛后的域入口对普通用户就是空页。
    const all = itemsForNormalUser(PERSONAL_HUB_ITEMS)
    expect(flattenNavItems(all).length).toBe(22)
    expect(flattenNavItems(filterNavItemsByTier(all, ALL_NAV_TIERS)).length).toBe(22)
    expect(flattenNavItems(all).some((i) => i.advancedOnly !== undefined)).toBe(false)
  })

  it('什么都不藏时一项不减', () => {
    const all = sidebarTree()
    expect(flattenNavItems(filterNavItemsByTier(all, [])).length).toBe(flattenNavItems(all).length)
  })
})

describe('侧边栏简洁模式:分档归属与继承', () => {
  it('/(models) 父项保留,只看得见 overview 与 usage', () => {
    // 2026-10-23:AI 域收敛后本项在域清单(AI_HUB_ITEMS)里,判据不变 ——
    // 域入口页经 useNavVisibilityFilter 走的仍是同一把尺子。
    const models = flattenNavItems(itemsForNormalUser(AI_HUB_ITEMS)).find(
      (i) => i.href === '/models',
    )
    expect(models).toBeDefined()
    expect(filterNavItemsByTier(models!.children ?? [], ALL_NAV_TIERS).map((i) => i.href)).toEqual([
      '/models/overview',
      '/models/usage',
    ])
  })

  it('开发者域(P2 收敛第一批)父项标档,域入口 + 20 个子项由继承规则一并隐藏', () => {
    // 2026-10-23 结构变更:原「开发者工具」折叠父项(/developer/webhooks)已摊平进
    // 开发者域入口(/developer),本用例随新结构改写 —— 档位总数不变(21 项),
    // 上面的 21/7 两枚读数因此无需改动,这正是"收敛不丢项"的旁证。
    const tree = sidebarTree()
    const hub = tree.find((i) => i.href === '/developer')
    expect(hub?.advancedOnly).toBe('developer')
    expect(hub?.labelKey).toBe('developerTools')
    expect(hub?.children?.length).toBe(20)
    // 子项本身一个都没标 —— 全靠继承
    expect((hub?.children ?? []).some((c) => c.advancedOnly !== undefined)).toBe(false)
    const visible = flattenNavItems(filterNavItemsByTier(tree, ['developer']))
    expect(visible.some((i) => i.href === '/developer/webhooks')).toBe(false)
    expect(visible.some((i) => i.href === '/playground')).toBe(false)
    expect(visible.some((i) => i.href === '/developer')).toBe(false)
  })

  it('「高级 AI 工具」整组跟随父项隐藏', () => {
    const tree = itemsForNormalUser(AI_HUB_ITEMS)
    // 正向对照:不藏时三项全在 —— 否则下面三条 false 断言会因为"项根本不在树上"而空过
    const shown = flattenNavItems(tree)
    for (const href of ['/memory', '/subagents', '/computer-use']) {
      expect(shown.some((i) => i.href === href)).toBe(true)
    }
    const visible = flattenNavItems(filterNavItemsByTier(tree, ['advancedAi']))
    expect(visible.some((i) => i.href === '/memory')).toBe(false)
    expect(visible.some((i) => i.href === '/subagents')).toBe(false)
    expect(visible.some((i) => i.href === '/computer-use')).toBe(false)
  })

  it('知识库父项保留,三个研发向子项被隐藏', () => {
    const tree = itemsForNormalUser(AI_HUB_ITEMS)
    const visible = flattenNavItems(filterNavItemsByTier(tree, ALL_NAV_TIERS))
    expect(visible.some((i) => i.href === '/knowledge-base')).toBe(true)
    expect(visible.some((i) => i.href === '/knowledge-rag')).toBe(true)
    expect(visible.some((i) => i.href === '/repo-wiki')).toBe(false)
    expect(visible.some((i) => i.href === '/knowledge-cards')).toBe(false)
    expect(visible.some((i) => i.href === '/team-knowledge')).toBe(false)
  })

  it('六个用户域入口不受档位影响(那是用户真正要用的)', () => {
    const tree = sidebarTree()
    const visible = flattenNavItems(filterNavItemsByTier(tree, ALL_NAV_TIERS))
    for (const href of [
      '/',
      '/ecosystem',
      '/domains/edu',
      '/domains/content',
      '/domains/trade',
      '/domains/ai',
      '/domains/personal',
    ]) {
      expect(visible.some((i) => i.href === href)).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
