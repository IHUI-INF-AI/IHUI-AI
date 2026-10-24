// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「关于我们」屏的分段数据 —— RN 端与小程序端共用的唯一真相源。
 *
 * 立因:此前这份构成住在两处(RN `screens/aboutPageSections.ts` 与小程序
 * `pkg-about/about/aboutSections.ts`),两份手抄表必然漂成「一端多一段/顺序不同」,
 * 而两端页面"看起来一样"没有任何一层能判(§0.6 单一真相源)。
 *
 * 这里只放**平台无关**的部分:段落构成、顺序、i18n 键、lucide 字形名。
 * 图标组件句柄与路由/文案落点属平台侧,留在各端(RN 用 lucide-react-native 组件、
 * 小程序用本端 LineIcon 注册表键 + Taro 路由)。
 */

/** 字形名 = lucide 官方 kebab-case 名,同时是小程序端 LineIcon 注册表键(两端同源) */
export type AboutFeatureEntry = {
  readonly icon: string
  readonly titleKey: string
  readonly descKey: string
}

/** 4 项价值观(与 web `AboutContent.tsx` 的 values 表逐行同物) */
export const ABOUT_VALUES: readonly AboutFeatureEntry[] = [
  { icon: 'globe', titleKey: 'about.valueOpenTitle', descKey: 'about.valueOpenDesc' },
  { icon: 'blocks', titleKey: 'about.valueCrossTitle', descKey: 'about.valueCrossDesc' },
  {
    icon: 'circle-dollar-sign',
    titleKey: 'about.valueFreeTitle',
    descKey: 'about.valueFreeDesc',
  },
  {
    icon: 'shield-check',
    titleKey: 'about.valueEnterpriseTitle',
    descKey: 'about.valueEnterpriseDesc',
  },
]

/** 6 项平台能力 */
export const ABOUT_PLATFORMS: readonly AboutFeatureEntry[] = [
  { icon: 'blocks', titleKey: 'about.platformAgentsTitle', descKey: 'about.platformAgentsDesc' },
  { icon: 'database', titleKey: 'about.platformRagTitle', descKey: 'about.platformRagDesc' },
  { icon: 'cpu', titleKey: 'about.platformModelsTitle', descKey: 'about.platformModelsDesc' },
  { icon: 'plug', titleKey: 'about.platformMcpTitle', descKey: 'about.platformMcpDesc' },
  {
    icon: 'workflow',
    titleKey: 'about.platformWorkflowTitle',
    descKey: 'about.platformWorkflowDesc',
  },
  { icon: 'users', titleKey: 'about.platformCollabTitle', descKey: 'about.platformCollabDesc' },
]

export type AboutStatEntry = { readonly valueKey: string; readonly descKey: string }

/** 4 项数字见证 */
export const ABOUT_STATS: readonly AboutStatEntry[] = [
  { valueKey: 'about.statUsers', descKey: 'about.statUsersDesc' },
  { valueKey: 'about.statAgents', descKey: 'about.statAgentsDesc' },
  { valueKey: 'about.statLanguages', descKey: 'about.statLanguagesDesc' },
  { valueKey: 'about.statOpensource', descKey: 'about.statOpensourceDesc' },
]

/**
 * 合规/帮助类入口的稳定身份。两端各自把它映射到本端在册出口
 * (RN = RootStackParamList 屏名,小程序 = 分包页面 URL),
 * **条目集合与顺序**由这张表定,不允许一端自己多一条或换顺序。
 */
export const ABOUT_ENTRY_IDS = [
  'agreement',
  'privacy',
  'appPermission',
  'usageRules',
  'businessLicense',
  'icpRecord',
  'modelRecord',
  'apiSettings',
  'help',
  'contact',
] as const

export type AboutEntryId = (typeof ABOUT_ENTRY_IDS)[number]

/** 渲染顺序:Hero → 故事 → 价值观 → 平台能力 → 数字见证 → CTA → 合规入口 */
export const ABOUT_SECTION_ORDER = [
  'hero',
  'story',
  'values',
  'platforms',
  'stats',
  'cta',
  'entries',
] as const

export type AboutSectionId = (typeof ABOUT_SECTION_ORDER)[number]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
