// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 侧边栏 / 移动抽屉的导航单一真相源（2026-11-23 立）。
 *
 * 机主定令：「要都跟 web 端统一，改一处多端相当于都改」。
 * 形态 = web 侧栏当前终态（2026-11-23 域入口收敛）：首页 + 10 个域入口，每组 1 项。
 *
 * 三端各自只做两件事（本文件不写任何平台分支，AGENTS §4 共享层禁 Platform.OS）：
 *  1. `iconKey` → 本端图标组件（web lucide-react / RN lucide-react-native / 小程序 LineIcon）；
 *  2. `key` → 本端目标（web 直接用 `webHref`；RN 用 route/web target；小程序用页面路径，缺映射即隐藏）。
 *
 * 改清单只改这里：组顺序、组标题、条目文案键、图标身份、权限标记三端同变。
 * 任何端内不得再写第二份导航清单（§0.6 单一真相源）。
 */

/** 图标身份（各端映射到本端图标库的同义图形，不是组件本身） */
export type SidebarNavIconKey =
  | 'home'
  | 'layoutGrid'
  | 'usersRound'
  | 'wallet'
  | 'sparkles'
  | 'shieldCheck'
  | 'graduationCap'
  | 'user'
  | 'terminal'

/** 高级/运维分档（web 端降噪用；iOS/安卓/小程序不消费，继承规则由 web filterNavItemsByTier 负责） */
export type SidebarNavAdvancedTier = 'developer' | 'relayOps' | 'advancedAi' | 'experimental'

export interface SidebarNavSourceEntry {
  /** 稳定身份：各端「key → 本端目标」映射表的键（不用 href/label 当 key，文案改名不漂移） */
  key: string
  /** 分组稳定键（同组多条时按清单出现顺序聚组） */
  groupKey: string
  /** 组标题 i18n 键（web 走 useTranslations('nav')；首页组为空串 = 不渲染组标题） */
  groupLabelKey: string
  /** 组标题中文兜底（缺 i18n 键时展示，三端同一份文案） */
  groupLabel: string
  /** 热门组：标题强化档（web/RN 的 hot 视觉） */
  groupVariant?: 'hot'
  /** 条目 i18n 键 */
  itemLabelKey: string
  /** 条目中文兜底 */
  itemLabel: string
  /** 图标身份 */
  iconKey: SidebarNavIconKey
  /** web 路径（web 直用；RN/小程序可作为 WebView / web-view 的降级落点） */
  webHref: string
  /** 仅管理员（roleId ≥ 1）可见；与 web `adminOnly` 同判据，最终硬闸仍在后端 */
  adminOnly?: boolean
  /** 高级档（web 端降噪） */
  advancedOnly?: SidebarNavAdvancedTier
}

/**
 * 清单本体：顺序即三端渲染顺序。
 *
 * 与 `apps/web/src/components/sidebar/nav-data.ts` 的 `NAV_GROUPS` 逐条等值
 * （2026-11-23 抽取；web 侧已改为由本清单派生，端内不再直写）。
 */
export const SIDEBAR_NAV_SOURCE: readonly SidebarNavSourceEntry[] = [
  {
    key: 'home',
    groupKey: 'homeGroup',
    groupLabelKey: '',
    groupLabel: '',
    itemLabelKey: 'home',
    itemLabel: '首页',
    iconKey: 'home',
    webHref: '/',
  },
  {
    key: 'ecosystem',
    groupKey: 'hot',
    groupLabelKey: 'hotGroupLabel',
    groupLabel: '热门',
    groupVariant: 'hot',
    itemLabelKey: 'ecosystemHub',
    itemLabel: '生态',
    iconKey: 'layoutGrid',
    webHref: '/ecosystem',
  },
  {
    key: 'hr',
    groupKey: 'hr',
    groupLabelKey: 'hrGroup',
    groupLabel: '人事部',
    itemLabelKey: 'hrGroup',
    itemLabel: '人事部',
    iconKey: 'usersRound',
    webHref: '/domains/hr',
  },
  {
    key: 'finance',
    groupKey: 'finance',
    groupLabelKey: 'financeGroup',
    groupLabel: '财务部',
    itemLabelKey: 'financeAi',
    itemLabel: '财务部',
    iconKey: 'wallet',
    webHref: '/finance-ai',
  },
  {
    key: 'ai',
    groupKey: 'ai',
    groupLabelKey: 'aiGroupLabel',
    groupLabel: 'AI',
    itemLabelKey: 'aiGroupLabel',
    itemLabel: 'AI',
    iconKey: 'sparkles',
    webHref: '/domains/ai',
  },
  {
    key: 'admin',
    groupKey: 'admin',
    groupLabelKey: 'adminGroupLabel',
    groupLabel: '管理',
    itemLabelKey: 'adminGroupLabel',
    itemLabel: '管理',
    iconKey: 'shieldCheck',
    webHref: '/domains/admin',
    adminOnly: true,
  },
  {
    key: 'edu',
    groupKey: 'edu',
    groupLabelKey: 'eduGroup',
    groupLabel: '教育',
    itemLabelKey: 'eduHubTitle',
    itemLabel: '教育',
    iconKey: 'graduationCap',
    webHref: '/domains/edu',
  },
  {
    key: 'content',
    groupKey: 'content',
    groupLabelKey: 'contentGroup',
    groupLabel: '内容',
    itemLabelKey: 'contentHubTitle',
    itemLabel: '内容',
    iconKey: 'layoutGrid',
    webHref: '/domains/content',
  },
  {
    key: 'trade',
    groupKey: 'trade',
    groupLabelKey: 'tradeGroup',
    groupLabel: '交易',
    itemLabelKey: 'tradeHubTitle',
    itemLabel: '交易',
    iconKey: 'wallet',
    webHref: '/domains/trade',
  },
  {
    key: 'personal',
    groupKey: 'personal',
    groupLabelKey: 'personalGroup',
    groupLabel: '个人中心',
    itemLabelKey: 'user',
    itemLabel: '个人中心',
    iconKey: 'user',
    webHref: '/domains/personal',
  },
  {
    key: 'developer',
    groupKey: 'developer',
    groupLabelKey: 'developerGroup',
    groupLabel: '开发者',
    itemLabelKey: 'developerTools',
    itemLabel: '开发者工具',
    iconKey: 'terminal',
    webHref: '/domains/developer',
    advancedOnly: 'developer',
  },
]

/**
 * 端内入口区（2026-11-23 立，机主明令「之前侧边栏有的功能不能丢，比如灵感 需求 免费领取」）。
 *
 * 与 `SIDEBAR_NAV_SOURCE` 分开登记：那一份是「一域一入口」的导航收敛结果，
 * 这一份是侧栏顶部的常驻功能面（三端同序同形，web / RN / 小程序都画）。
 * 收敛只许收「一域多入口」，**不许收这些端内原始功能**。
 */
export type SidebarEntryIconKey =
  'cart' | 'users' | 'bulb' | 'share' | 'cap' | 'hand' | 'gift' | 'msg'

export interface SidebarEntrySource {
  /** 稳定身份：端内「key → 本端动作」映射表的键 */
  key: string
  /** menu = 普通入口行；label = 带右箭头的标签行（有二级落点） */
  kind: 'menu' | 'label'
  /** 文案 i18n 键（web 走 nav 命名空间；移动端可自行转译到本端键，缺键回落 label） */
  labelKey: string
  /** 中文兜底（三端同一份文案） */
  label: string
  iconKey: SidebarEntryIconKey
  /** web 落点；缺省 = 端内无该页，走 action */
  webHref?: string
  /** 无页面时的动作身份（复制链接等，端内各自实现） */
  action?: 'copyFreeResource'
  /**
   * 归属的分类（2026-11-23 机主令「都要收紧适合他们的分类大按钮里」）：
   * 端内不再平铺一块独立入口区，而是作为该分类大按钮（组内那个唯一域入口）的**子项**。
   * 取值 = `SIDEBAR_NAV_SOURCE` 的 groupKey，必须真实存在（端内派生时断言，写歪即丢功能）。
   */
  attachTo: 'hot' | 'content' | 'edu' | 'personal'
}

export const SIDEBAR_ENTRY_SOURCE: readonly SidebarEntrySource[] = [
  {
    key: 'appStore',
    kind: 'menu',
    labelKey: 'entryAppStore',
    label: '应用商店',
    iconKey: 'cart',
    webHref: '/skills-market',
    attachTo: 'hot',
  },
  {
    key: 'demand',
    kind: 'menu',
    labelKey: 'demandSquare',
    label: '需求广场',
    iconKey: 'users',
    webHref: '/plaza',
    attachTo: 'content',
  },
  {
    key: 'inspiration',
    kind: 'menu',
    labelKey: 'entryInspiration',
    label: '灵感',
    iconKey: 'bulb',
    webHref: '/ai-generation',
    attachTo: 'content',
  },
  {
    key: 'dynamic',
    kind: 'menu',
    labelKey: 'entryDynamic',
    label: '动态',
    iconKey: 'share',
    webHref: '/ai-news',
    attachTo: 'content',
  },
  {
    key: 'course',
    kind: 'menu',
    labelKey: 'courses',
    label: '课程',
    iconKey: 'cap',
    webHref: '/edu/courses',
    attachTo: 'edu',
  },
  {
    key: 'company',
    kind: 'label',
    labelKey: 'entryCompany',
    label: '我的一人公司',
    iconKey: 'hand',
    webHref: '/distribution',
    attachTo: 'personal',
  },
  {
    key: 'freebie',
    kind: 'label',
    labelKey: 'entryFreebie',
    label: '领取免费资料',
    iconKey: 'gift',
    action: 'copyFreeResource',
    attachTo: 'personal',
  },
]

/** 按归属分类分组（保持清单顺序）：端内把它挂成对应组条目的 children */
export function groupSidebarEntriesByAttach(
  source: readonly SidebarEntrySource[] = SIDEBAR_ENTRY_SOURCE,
): Map<string, SidebarEntrySource[]> {
  const buckets = new Map<string, SidebarEntrySource[]>()
  for (const entry of source) {
    const list = buckets.get(entry.attachTo)
    if (list) list.push(entry)
    else buckets.set(entry.attachTo, [entry])
  }
  return buckets
}

/** 按 kind 取子集（menu 段与 label 段各自渲染，三端同序） */
export function splitSidebarEntrySource(
  source: readonly SidebarEntrySource[] = SIDEBAR_ENTRY_SOURCE,
): { menu: SidebarEntrySource[]; labels: SidebarEntrySource[] } {
  return {
    menu: source.filter((entry) => entry.kind === 'menu'),
    labels: source.filter((entry) => entry.kind === 'label'),
  }
}

/** 按 groupKey 聚组（保持清单顺序；同组多条按出现顺序） */
export function groupSidebarNavSource(
  source: readonly SidebarNavSourceEntry[] = SIDEBAR_NAV_SOURCE,
): {
  groupKey: string
  groupLabelKey: string
  groupLabel: string
  groupVariant?: 'hot'
  entries: SidebarNavSourceEntry[]
}[] {
  const order: string[] = []
  const buckets = new Map<string, SidebarNavSourceEntry[]>()
  for (const entry of source) {
    if (!buckets.has(entry.groupKey)) {
      order.push(entry.groupKey)
      buckets.set(entry.groupKey, [])
    }
    buckets.get(entry.groupKey)!.push(entry)
  }
  return order.map((groupKey) => {
    const entries = buckets.get(groupKey)!
    const first = entries[0]!
    return {
      groupKey,
      groupLabelKey: first.groupLabelKey,
      groupLabel: first.groupLabel,
      ...(first.groupVariant ? { groupVariant: first.groupVariant } : {}),
      entries,
    }
  })
}

/**
 * 端内可达过滤：给「key → 本端目标」映射表，返回仍可渲染的组（映射缺失 = 本端不可达 ⇒ 整组隐藏）。
 * 失效方向恒为「隐藏」，绝不构造死入口；web 端映射齐全，天然不过滤。
 */
export function filterSidebarNavSourceByKeys(
  reachableKeys: ReadonlySet<string>,
  source: readonly SidebarNavSourceEntry[] = SIDEBAR_NAV_SOURCE,
): SidebarNavSourceEntry[] {
  return source.filter((entry) => reachableKeys.has(entry.key))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
