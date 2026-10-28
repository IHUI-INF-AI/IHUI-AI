// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  Blocks,
  CircleDollarSign,
  Cpu,
  Database,
  Globe,
  Plug,
  ShieldCheck,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react-native'

/**
 * 「关于我们」页的分段数据(与 web `AboutContent.tsx` 的 values / platforms / stats 三张表逐行同物)。
 * 拆出本文件只为把屏本身压回 §3 的 250 行上限;取词一律用 i18n 键,这里不存任何文案。
 */
export type AboutFeature = { Icon: LucideIcon; titleKey: string; descKey: string }

export const ABOUT_VALUES: readonly AboutFeature[] = [
  { Icon: Globe, titleKey: 'about.valueOpenTitle', descKey: 'about.valueOpenDesc' },
  { Icon: Blocks, titleKey: 'about.valueCrossTitle', descKey: 'about.valueCrossDesc' },
  { Icon: CircleDollarSign, titleKey: 'about.valueFreeTitle', descKey: 'about.valueFreeDesc' },
  {
    Icon: ShieldCheck,
    titleKey: 'about.valueEnterpriseTitle',
    descKey: 'about.valueEnterpriseDesc',
  },
]

export const ABOUT_PLATFORMS: readonly AboutFeature[] = [
  { Icon: Blocks, titleKey: 'about.platformAgentsTitle', descKey: 'about.platformAgentsDesc' },
  { Icon: Database, titleKey: 'about.platformRagTitle', descKey: 'about.platformRagDesc' },
  { Icon: Cpu, titleKey: 'about.platformModelsTitle', descKey: 'about.platformModelsDesc' },
  { Icon: Plug, titleKey: 'about.platformMcpTitle', descKey: 'about.platformMcpDesc' },
  {
    Icon: Workflow,
    titleKey: 'about.platformWorkflowTitle',
    descKey: 'about.platformWorkflowDesc',
  },
  { Icon: Users, titleKey: 'about.platformCollabTitle', descKey: 'about.platformCollabDesc' },
]

export const ABOUT_STATS: readonly { valueKey: string; descKey: string }[] = [
  { valueKey: 'about.statUsers', descKey: 'about.statUsersDesc' },
  { valueKey: 'about.statAgents', descKey: 'about.statAgentsDesc' },
  { valueKey: 'about.statLanguages', descKey: 'about.statLanguagesDesc' },
  { valueKey: 'about.statOpensource', descKey: 'about.statOpensourceDesc' },
]

/** 合规条目:历史 Uniapp about.vue 的 7 项,target 必须是 RootStackParamList 里真实在册的屏 */
export type ComplianceTarget =
  | 'Agreement'
  | 'Privacy'
  | 'AppPermission'
  | 'UsageRules'
  | 'BusinessLicense'
  | 'IcpRecord'
  | 'ModelRecord'

export const ABOUT_COMPLIANCE: readonly { labelKey: string; target: ComplianceTarget }[] = [
  { labelKey: 'menu.agreement', target: 'Agreement' },
  { labelKey: 'menu.privacy', target: 'Privacy' },
  { labelKey: 'menu.appPermission', target: 'AppPermission' },
  { labelKey: 'menu.usageRules', target: 'UsageRules' },
  { labelKey: 'menu.businessLicense', target: 'BusinessLicense' },
  { labelKey: 'menu.icpRecord', target: 'IcpRecord' },
  { labelKey: 'menu.modelRecord', target: 'ModelRecord' },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
