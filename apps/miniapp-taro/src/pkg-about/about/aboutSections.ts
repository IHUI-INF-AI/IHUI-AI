// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序端「关于我们」的分段数据 —— 段落构成/顺序/取词键/字形名一律取自跨端单一源
// `@ihui/shared/constants/about-sections`(与 RN 共享屏同一张表,不再各抄一份)。
// 本文件只剩两件平台侧的东西:字形名 → 本端 LineIcon 注册表键的收窄映射、入口 → 本端在册页面路由。
import {
  ABOUT_ENTRY_IDS,
  ABOUT_PLATFORMS as ABOUT_SOURCE_PLATFORMS,
  ABOUT_STATS as ABOUT_SOURCE_STATS,
  ABOUT_VALUES as ABOUT_SOURCE_VALUES,
  type AboutEntryId,
} from '@ihui/shared/constants'
import type { IconName } from '@/components/LineIcon'

export type AboutFeature = { icon: IconName; titleKey: string; descKey: string }

/**
 * 本端 LineIcon 只认注册表里真实存在的键。共享表给的是 lucide 官方 kebab 名(字符串),
 * 这里逐枚收窄:漏登记的字形会在编译期落不进这张表,而不是运行时静默画不出图标。
 */
const LINE_ICON: Record<string, IconName> = {
  globe: 'globe',
  blocks: 'blocks',
  'circle-dollar-sign': 'circle-dollar-sign',
  'shield-check': 'shield-check',
  database: 'database',
  cpu: 'cpu',
  plug: 'plug',
  workflow: 'workflow',
  users: 'users',
}

const toPageFeature = (f: { icon: string; titleKey: string; descKey: string }): AboutFeature => ({
  icon: LINE_ICON[f.icon] ?? 'globe',
  titleKey: f.titleKey,
  descKey: f.descKey,
})

export const ABOUT_VALUES: readonly AboutFeature[] = ABOUT_SOURCE_VALUES.map(toPageFeature)
export const ABOUT_PLATFORMS: readonly AboutFeature[] = ABOUT_SOURCE_PLATFORMS.map(toPageFeature)
export const ABOUT_STATS = ABOUT_SOURCE_STATS

/**
 * 合规/帮助入口:条目与顺序由共享表的 ABOUT_ENTRY_IDS 定,本端只补 URL。
 * `url` 必须是 app.config.ts 里真实在册的页面 —— 此前本端有 4 条指向不存在页面
 * (protocol / privacy / help / contact),点了没反应,已在本次一并核对。
 */
export type AboutMenuEntry = { key: AboutEntryId; labelKey: string; url: string }

const MENU_ROUTES: Record<AboutEntryId, { labelKey: string; url: string }> = {
  agreement: { labelKey: 'about.protocol.title', url: '/pkg-about/about/protocol' },
  privacy: { labelKey: 'about.privacy.mainTitle', url: '/pkg-about/about/privacy' },
  appPermission: {
    labelKey: 'about.appPermission.title',
    url: '/pkg-about/about/app-permission/index',
  },
  usageRules: { labelKey: 'about.usageRules.title', url: '/pkg-about/about/usage-rules/index' },
  businessLicense: {
    labelKey: 'about.businessLicense.title',
    url: '/pkg-about/about/business-license/index',
  },
  icpRecord: { labelKey: 'about.icpRecord.title', url: '/pkg-about/about/icp-record/index' },
  modelRecord: { labelKey: 'about.modelRecord.title', url: '/pkg-about/about/model-record/index' },
  apiSettings: { labelKey: 'about.apiSettings.title', url: '/pkg-about/about/api-settings/index' },
  help: { labelKey: 'about.help.title', url: '/pkg-about/about/help' },
  contact: { labelKey: 'about.contact.title', url: '/pkg-about/about/contact' },
}

export const ABOUT_MENUS: readonly AboutMenuEntry[] = ABOUT_ENTRY_IDS.map((id) => ({
  key: id,
  ...MENU_ROUTES[id],
}))

export { ABOUT_ENTRY_IDS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
