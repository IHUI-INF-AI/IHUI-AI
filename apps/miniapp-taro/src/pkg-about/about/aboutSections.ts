// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序端「关于我们」分段数据 —— 与 RN `apps/mobile-rn/src/screens/aboutPageSections.ts`
// 的 values / platforms / stats 三张表逐行同物(图标名换成本端 LineIcon 注册表键,字形同为 lucide)。
// 拆出本文件只为把页面压回 §3 的 250 行上限;取词一律用 i18n 键,这里不存任何文案。
import type { IconName } from '@/components/LineIcon'

export type AboutFeature = { icon: IconName; titleKey: string; descKey: string }

export const ABOUT_VALUES: readonly AboutFeature[] = [
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

export const ABOUT_PLATFORMS: readonly AboutFeature[] = [
  { icon: 'blocks', titleKey: 'about.platformAgentsTitle', descKey: 'about.platformAgentsDesc' },
  { icon: 'database', titleKey: 'about.platformRagTitle', descKey: 'about.platformRagDesc' },
  { icon: 'cpu', titleKey: 'about.platformModelsTitle', descKey: 'about.platformModelsDesc' },
  { icon: 'plug', titleKey: 'about.platformMcpTitle', descKey: 'about.platformMcpDesc' },
  {
    icon: 'workflow',
    titleKey: 'about.platformWorkflowTitle',
    descKey: 'about.platformWorkflowDesc',
  },
  {
    icon: 'users',
    titleKey: 'about.platformCollabTitle',
    descKey: 'about.platformCollabDesc',
  },
]

export const ABOUT_STATS: readonly { valueKey: string; descKey: string }[] = [
  { valueKey: 'about.statUsers', descKey: 'about.statUsersDesc' },
  { valueKey: 'about.statAgents', descKey: 'about.statAgentsDesc' },
  { valueKey: 'about.statLanguages', descKey: 'about.statLanguagesDesc' },
  { valueKey: 'about.statOpensource', descKey: 'about.statOpensourceDesc' },
]

/**
 * 合规/帮助类入口:本端另有实装页,改版不得删(路由为 pkg-about 分包在册页面)。
 * labelKey 全部复用该端既有 about.* 取词,不抄第二份中文标签(守门 70 / §0.6)。
 */
export type AboutMenuEntry = { key: string; labelKey: string; url: string }

export const ABOUT_MENUS: readonly AboutMenuEntry[] = [
  { key: 'protocol', labelKey: 'about.protocol.title', url: '/pkg-about/about/protocol' },
  { key: 'privacy', labelKey: 'about.privacy.mainTitle', url: '/pkg-about/about/privacy' },
  {
    key: 'businessLicense',
    labelKey: 'about.businessLicense.title',
    url: '/pkg-about/about/business-license/index',
  },
  {
    key: 'icpRecord',
    labelKey: 'about.icpRecord.title',
    url: '/pkg-about/about/icp-record/index',
  },
  {
    key: 'modelRecord',
    labelKey: 'about.modelRecord.title',
    url: '/pkg-about/about/model-record/index',
  },
  {
    key: 'usageRules',
    labelKey: 'about.usageRules.title',
    url: '/pkg-about/about/usage-rules/index',
  },
  {
    key: 'apiSettings',
    labelKey: 'about.apiSettings.title',
    url: '/pkg-about/about/api-settings/index',
  },
  {
    key: 'appPermission',
    labelKey: 'about.appPermission.title',
    url: '/pkg-about/about/app-permission/index',
  },
  { key: 'help', labelKey: 'about.help.title', url: '/pkg-about/about/help' },
  { key: 'contact', labelKey: 'about.contact.title', url: '/pkg-about/about/contact' },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
