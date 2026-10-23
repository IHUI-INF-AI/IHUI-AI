// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「开发者空间」屏的跨端共用数据表 —— RN 端与小程序端共用的唯一真相源(条目构成/顺序/i18n 键)。
 *
 * 立因:这一屏的构成(四个功能入口 + 两张问题解答卡)此前只写在
 * `apps/mobile-rn/src/screens/DeveloperScreen.tsx` 的模块作用域里,小程序侧另抄一份
 * (§0.6 单一真相源:第二份必然漂成「一端多一个入口/顺序不同」)。与
 * `./about-sections.ts` 同一先例同形:这里只放**平台无关**的部分,
 * 渲染与路由落点留在各端。
 *
 * 图标:四个入口沿用历史项目(Uniapp pagesA/plaza/developer.vue)的 CDN 位图素材,
 * 域名 2026-10-21 由恒 502 的 `file.aizhs.top` 改指活 CDN `https://aizhs.top`
 * (与小程序端 `apps/miniapp-taro/src/constants/remote-icons.ts` 的 `aizhsUrl(...)` 同形,逐条实测 200)。
 * 小程序端若改用本端 LineIcon 线性素材,须同批改 `icon` 字段为 lucide kebab 名并同步 RN,
 * 不得各留一份表。
 */
import type { DeveloperSpaceEntryId } from '@ihui/types'

/** 入口分派键的类型单一来源在 @ihui/types(跨端类型住 packages/types),本文件只 re-export */
export type { DeveloperSpaceEntryId }

export type DeveloperSpaceEntry = {
  readonly id: DeveloperSpaceEntryId
  readonly labelKey: string
  readonly iconUrl: string
}

/** 无头像时的默认 logo(对齐原 devlogo.png) */
export const DEVELOPER_DEFAULT_LOGO_URL = 'https://aizhs.top/sys-mini/xtk/devlogo.png' as const

/** dev_list 四入口(顺序即渲染顺序:我的智能体 → 智能体收入 → n8n智能体 → 创客名片) */
export const DEVELOPER_SPACE_ENTRIES: readonly DeveloperSpaceEntry[] = [
  {
    id: 'myAgents',
    labelKey: 'devSpace.entryMyAgents',
    iconUrl: 'https://aizhs.top/sys-mini/xtk/my_model.png',
  },
  {
    id: 'agentIncome',
    labelKey: 'devSpace.entryAgentIncome',
    iconUrl: 'https://aizhs.top/sys-mini/xtk/my_input.png',
  },
  {
    id: 'n8nModel',
    labelKey: 'devSpace.entryN8nModel',
    iconUrl: 'https://aizhs.top/remote-images/n8n.png',
  },
  {
    id: 'businessCard',
    labelKey: 'devSpace.entryBusinessCard',
    iconUrl: 'https://aizhs.top/remote-images/geren-icon.png',
  },
] as const

export type DeveloperSpaceProblem = {
  readonly id: 'incentive' | 'publishGuide'
  readonly titleKey: string
  readonly descKey: string
  readonly btnKey: string
  readonly url: string
}

/**
 * 问题解答卡(对齐 Uniapp problems 数据)。
 * 点击语义:复制链接并提示到浏览器打开(RN/小程序各自的 webview 承载点不同,由端侧决定)。
 */
export const DEVELOPER_SPACE_PROBLEMS: readonly DeveloperSpaceProblem[] = [
  {
    id: 'incentive',
    titleKey: 'devSpace.faqIncentiveTitle',
    descKey: 'devSpace.faqIncentiveDesc',
    btnKey: 'devSpace.faqIncentiveBtn',
    url: 'https://blurb.kou.aizhs.top/',
  },
  {
    id: 'publishGuide',
    titleKey: 'devSpace.faqGuideTitle',
    descKey: 'devSpace.faqGuideDesc',
    btnKey: 'devSpace.faqGuideBtn',
    url: 'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh',
  },
] as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
