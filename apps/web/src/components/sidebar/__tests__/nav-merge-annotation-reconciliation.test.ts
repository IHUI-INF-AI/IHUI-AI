// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P2 六大域收敛三方合并的档位逐条对账锁(2026-10-23,票 L7241 合并批)
 *
 * 立因:nav-data.ts 做过一次三方合并(HEAD 的 2026-10-20 简洁模式批 × 未入库的
 * P2 六大域收敛批,共同祖先 = 2026-10-19 三域收敛后)。合并最高风险格 =
 * 「某一侧的 advancedOnly/adminOnly/permission 标注在摊平/搬家中丢失」——
 * 丢 developer 档等于把 21 个开发者/运维入口摆到普通用户面前,丢 adminOnly/permission
 * 等于越权入口裸奔。AGENTS §4 允许的合法形态只有两种:
 *  ① 该条目在结果里仍带同档标注;
 *  ② 其祖先带同档标注,且继承被**现读判据**证明有效。
 * ② 的证明不许靠推理也不许复制判据(§22c)——本锁的"有效"一律以生产实现
 * `filterNavItemsByTier`/`filterNavItemsByRole` 的实跑移除集为裁决。
 *
 * HEAD 面(= 合并时 HEAD commit 的 nd-ours 快照)标注普查(脚本现读,非手抄):
 *  advancedOnly 直标 32 枚 = developer 5 + relayOps 16 + experimental 10 + advancedAi 1(2026-10-24 b23f01cf219 个人号池 experimental 入册)
 *  adminOnly 静态 18 行(17 个唯一 href,/admin/theme 父+子各一行)
 *  permission 'edu:manage' 10 枚
 * 结果面直标 27 枚 developer→1:被剥掉自标的 4 枚(/developer/api-docs、/developer/relay、
 * /developer/relay/subscriptions、/developer/webhooks)全部落在带 developer 档的域入口
 * 父项之下,由下面第二节的移除集实验逐条证明继承真的把它们藏掉了。
 */
import { describe, it, expect } from 'vitest'
import {
  AI_HUB_ITEMS,
  CONTENT_HUB_ITEMS,
  EDU_HUB_ITEMS,
  PERSONAL_HUB_ITEMS,
  TRADE_HUB_ITEMS,
  NAV_GROUPS,
  flattenNavItems,
} from '@/components/sidebar/nav-data'
import { filterNavItemsByRole, filterNavItemsByTier } from '@/components/sidebar/use-nav-visibility'
import type { NavAdvancedTier, NavItem } from '@/components/sidebar/types'

// ── HEAD 面标注普查(逐字快照自合并时的 HEAD blob,出处见头注) ──

const HEAD_ADVANCED_DIRECT: Record<NavAdvancedTier, string[]> = {
  developer: [
    '/developer',
    '/developer/api-docs',
    '/developer/relay',
    '/developer/relay/subscriptions',
    '/developer/webhooks',
  ],
  relayOps: [
    '/available-channels',
    '/models/api-docs',
    '/models/billing',
    '/models/channels',
    '/models/chats',
    '/models/eval',
    '/models/groups',
    '/models/keys',
    '/models/logs',
    '/models/openclaw',
    '/models/prompts',
    '/models/redeem',
    '/models/referral',
    '/models/skills',
    '/models/trajectory',
    '/models/users',
  ],
  advancedAi: ['/memory'],
  experimental: [
    '/account-pool',
    '/agent-canvas',
    '/agent-workbench',
    '/checkin',
    '/figma-import',
    '/knowledge-cards',
    '/repo-wiki',
    '/team-knowledge',
    '/voices',
    '/web-tools',
  ],
}

/** HEAD 面 developer 档的**有效**成员集(直标 + 由 relay 父项/子菜单父项继承),20 个唯一 href。
 *  这是合并前普通用户在侧边栏实际会被简洁模式藏掉的集合,收敛后必须一字不差。 */
const HEAD_DEVELOPER_EFFECTIVE = [
  '/developer',
  '/developer/api-docs',
  '/developer/billing',
  '/developer/error-codes',
  '/developer/limits',
  '/developer/logs',
  '/developer/notifications',
  '/developer/relay',
  '/developer/relay/benefits',
  '/developer/relay/keys',
  '/developer/relay/subscriptions',
  '/developer/relay/usage',
  '/developer/sandbox',
  '/developer/settings',
  '/developer/subscription',
  '/developer/team',
  '/developer/versions',
  '/developer/webhooks',
  '/playground',
  '/purchase',
]

/** advancedAi 有效成员 = 父项 /memory + 14 子项(两代都靠继承) */
const HEAD_ADVANCED_AI_EFFECTIVE = [
  '/a2a',
  '/agent-teams',
  '/cloud-agent',
  '/computer-use',
  '/context',
  '/context-compaction',
  '/deep-research',
  '/memory',
  '/orchestration',
  '/personas',
  '/plan',
  '/registry',
  '/spec',
  '/subagents',
]

/** HEAD 面 adminOnly 静态行(18 行,/admin/theme 出现两次 = 分组父项 + 子清单首项)。
 *  AdminNav 动态分组行不在此面(该文件本批一字未动)。 */
const HEAD_ADMIN_ONLY_ROWS = [
  '/admin',
  '/admin/logs',
  '/admin/meta-learner',
  '/admin/statistics',
  '/admin/tags',
  '/admin/theme',
  '/admin/theme',
  '/admin/theme/assets',
  '/admin/theme/colors',
  '/admin/theme/create',
  '/admin/theme/dark-mode',
  '/admin/theme/export',
  '/admin/theme/fonts',
  '/admin/theme/presets',
  '/admin/user-center',
  '/admin/workflows',
  '/edu-ai/tbox',
  '/members',
]

/** HEAD 面 permission 枚(10,全部 edu:manage) */
const HEAD_PERMISSION_HREFS = [
  '/edu/edu-management/attendance',
  '/edu/edu-management/enrollment',
  '/edu/edu-management/finance',
  '/edu/edu-management/grades',
  '/edu/edu-management/homework',
  '/edu/edu-management/meal',
  '/edu/edu-management/procurement',
  '/edu/edu-management/schedule',
  '/edu/edu-management/scheduling',
  '/edu/edu-management/study-plan',
]

// ── 结果面取材:侧边栏树 + 五域清单全集(与 DOMAIN_HUB_ITEM_GROUPS 同集) ──

const RESULT_ROWS = flattenNavItems([
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...EDU_HUB_ITEMS,
  ...CONTENT_HUB_ITEMS,
  ...TRADE_HUB_ITEMS,
  ...AI_HUB_ITEMS,
  ...PERSONAL_HUB_ITEMS,
])

/** 生产顺序的两层过滤(role → tier),facet = 消费方实际拿到的清单 */
const productionFilter = (
  facet: NavItem[],
  isAdmin: boolean,
  perms: readonly string[],
  hiddenTiers: readonly NavAdvancedTier[],
): NavItem[] => filterNavItemsByTier(filterNavItemsByRole(facet, isAdmin, perms), hiddenTiers)

/** 藏一档前后同一棵树的 href 差集 = 生产实现认定的该档有效成员(不复制判据,§22c)。
 *  两侧都走生产顺序(role→tier):before 若不先过 role,adminOnly 行会整批混进差集,
 *  量出来的就不是档位成员而是 role∪tier 的并 —— 2026-10-23 本锁首跑实测到这一格。 */
const removedByTier = (facet: NavItem[], tier: NavAdvancedTier): string[] => {
  const before = new Set(flattenNavItems(productionFilter(facet, false, [], [])).map((i) => i.href))
  const after = new Set(
    flattenNavItems(productionFilter(facet, false, [], [tier])).map((i) => i.href),
  )
  return [...before].filter((h) => !after.has(h)).sort()
}

const sidebarFacet = () => NAV_GROUPS.flatMap((g) => g.items)

describe('三方合并档位对账:advancedOnly', () => {
  it('结果面直标普查:除记档的 4 枚 developer 转继承外,HEAD 32 枚直标一枚不少一枚不多', () => {
    const census = (tier: NavAdvancedTier) =>
      RESULT_ROWS.filter((i) => i.advancedOnly === tier)
        .map((i) => i.href)
        .sort()
    expect(census('relayOps')).toEqual([...HEAD_ADVANCED_DIRECT.relayOps].sort())
    expect(census('experimental')).toEqual([...HEAD_ADVANCED_DIRECT.experimental].sort())
    expect(census('advancedAi')).toEqual(HEAD_ADVANCED_DIRECT.advancedAi)
    // developer 面:HEAD 直标 5 枚 → 结果面直标 1 枚(域入口父项),差的 4 枚由下一条证明合法
    expect(census('developer')).toEqual(['/developer'])
  })

  it('developer 档转继承的 4 枚 + 原继承 16 枚:藏 developer 档后与 HEAD 有效成员集逐字相同', () => {
    // 这条是全场最高风险格的现读证明:摊平的 20 个子项若继承链断,这里会少一大截
    expect(removedByTier(sidebarFacet(), 'developer')).toEqual(HEAD_DEVELOPER_EFFECTIVE)
    // 正向对照:不藏时它们全在(排除"项根本不在树上"的空过)
    const shown = new Set(
      flattenNavItems(productionFilter(sidebarFacet(), false, [], [])).map((i) => i.href),
    )
    for (const h of HEAD_DEVELOPER_EFFECTIVE) expect(shown.has(h)).toBe(true)
  })

  it('AI 域三档整体搬家进 AI_HUB_ITEMS 后,逐档有效成员与 HEAD 面一致', () => {
    expect(removedByTier(AI_HUB_ITEMS, 'relayOps')).toEqual(
      [...HEAD_ADVANCED_DIRECT.relayOps].sort(),
    )
    expect(removedByTier(AI_HUB_ITEMS, 'experimental')).toEqual(
      [...HEAD_ADVANCED_DIRECT.experimental].sort(),
    )
    expect(removedByTier(AI_HUB_ITEMS, 'advancedAi')).toEqual(HEAD_ADVANCED_AI_EFFECTIVE)
  })
})

describe('三方合并档位对账:adminOnly 与 permission(不可继承层)', () => {
  it('HEAD 17 枚唯一 adminOnly href 逐一在结果面仍带 adminOnly,且同名行无一裸奔', () => {
    const wanted = [...new Set(HEAD_ADMIN_ONLY_ROWS)]
    // 每个 href 至少有一行带 adminOnly(动态 AdminNav 行本就带 adminOnly:true,不干扰本判据)
    for (const h of wanted) {
      expect(
        RESULT_ROWS.some((i) => i.href === h && i.adminOnly === true),
        `${h} 在结果面必须仍有带 adminOnly 的行`,
      ).toBe(true)
    }
    // 反向:结果面里这些 href 的任何一行都不许是裸行(丢了 adminOnly 就是越权入口裸奔)
    const bare = RESULT_ROWS.filter(
      (i) => wanted.includes(i.href) && i.adminOnly !== true && i.permission === undefined,
    ).map((i) => i.href)
    expect(bare).toEqual([])
  })

  it('role 层实跑:非 admin 视角下 HEAD 的 17 枚唯一 adminOnly href 全部消失', () => {
    const visible = new Set(
      flattenNavItems(productionFilter(sidebarFacet(), false, [], [])).map((i) => i.href),
    )
    for (const h of new Set(HEAD_ADMIN_ONLY_ROWS)) expect(visible.has(h)).toBe(false)
    const adminVisible = new Set(
      flattenNavItems(productionFilter(sidebarFacet(), true, ['*:*:*'], [])).map((i) => i.href),
    )
    for (const h of new Set(HEAD_ADMIN_ONLY_ROWS)) expect(adminVisible.has(h)).toBe(true)
  })

  it('permission 层:10 枚 edu:manage 逐条保留自标,普通用户不可见/教师可见', () => {
    const marked = RESULT_ROWS.filter((i) => i.permission === 'edu:manage').map((i) => i.href)
    expect([...new Set(marked)].sort()).toEqual(HEAD_PERMISSION_HREFS)
    const normal = new Set(
      flattenNavItems(productionFilter(EDU_HUB_ITEMS, false, [], [])).map((i) => i.href),
    )
    const teacher = new Set(
      flattenNavItems(productionFilter(EDU_HUB_ITEMS, false, ['edu:manage'], [])).map(
        (i) => i.href,
      ),
    )
    for (const h of HEAD_PERMISSION_HREFS) {
      expect(normal.has(h)).toBe(false)
      expect(teacher.has(h)).toBe(true)
    }
  })

  it('三层判据未被合并成一个字段:同一行上 adminOnly 与 advancedOnly 互不顶替', () => {
    // 结果面 developer 域入口:只带档位、不带 adminOnly/permission(带了就是把降噪写成鉴权)
    const hub = NAV_GROUPS.find((g) => g.label === 'developerGroup')!.items[0]!
    expect(hub.advancedOnly).toBe('developer')
    expect(hub.adminOnly).toBeUndefined()
    expect(hub.permission).toBeUndefined()
    // AI 域入口父项:不带任何一档(入口被藏 = 域内用户功能一起锁死)
    const aiHub = NAV_GROUPS.find((g) => g.label === 'aiGroupLabel')!.items[0]!
    expect(aiHub.advancedOnly).toBeUndefined()
    expect(aiHub.adminOnly).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
