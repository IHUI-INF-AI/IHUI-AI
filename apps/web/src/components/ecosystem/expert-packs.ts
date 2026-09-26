// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:D17 生态统一入口的"专家包"注册表,仅描述本端路由拓扑,不适合共享层。

import { Library, Rocket, Sparkles, Store, Wand2, Wrench, Boxes } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** 生态里的五个既有能力市场(D17 收敛对象,老 URL 一律继续可达) */
export type MarketKey = 'aiSkills' | 'mcpStore' | 'capabilityMarket' | 'skillsMarket' | 'connectors'

interface MarketMeta {
  key: MarketKey
  /** 列表页 href(既有页面) */
  href: string
  icon: LucideIcon
  /**
   * 详情页 href 构造器。
   * 只有**真存在详情页**的市场才有值 —— 缺省即入口只渲染列表链接,
   * 不得凭空拼一个 404 地址(死链是本仓反复被抓的那类交付事故)。
   */
  detailHref?: (id: string) => string
}

export const MARKETS: Record<MarketKey, MarketMeta> = {
  aiSkills: {
    key: 'aiSkills',
    href: '/ai-skills',
    icon: Sparkles,
    // apps/web/app/(main)/ai-skills/[id]/page.tsx 在库
    detailHref: aiSkillDetailHref,
  },
  mcpStore: { key: 'mcpStore', href: '/mcp-store', icon: Store },
  capabilityMarket: { key: 'capabilityMarket', href: '/capability-market', icon: Boxes },
  skillsMarket: {
    key: 'skillsMarket',
    href: '/skills-market',
    icon: Wand2,
    // apps/web/app/(main)/skills-market/[id]/page.tsx 在库(动态段是 skill name)
    detailHref: skillDetailHref,
  },
  connectors: { key: 'connectors', href: '/connectors', icon: Library },
}

export const MARKET_ORDER: MarketKey[] = [
  'aiSkills',
  'mcpStore',
  'capabilityMarket',
  'skillsMarket',
  'connectors',
]

/** Skill 市场详情页(动态段是 skill name;`skills-market/[id]` 在库) */
export function skillDetailHref(name: string): string {
  return `/skills-market/${encodeURIComponent(name)}`
}

/** AI 技能详情页(`ai-skills/[id]` 在库,动态段是 skill id) */
export function aiSkillDetailHref(id: string): string {
  return `/ai-skills/${encodeURIComponent(id)}`
}

/**
 * 连接器授权详情:`/connectors` 是唯一的配置/同步实现,
 * 本路由只做**只读**的授权状态与文档概览 + 回链到配置页,不复制第二套编辑表单。
 */
export function connectorAuthDetailHref(key: string): string {
  return `/ecosystem/connectors/${encodeURIComponent(key)}`
}

/** 专家包 = 跨多个既有市场的能力组合(纯导航聚合,不新增数据实体、不新增接口) */
interface ExpertPack {
  /** URL slug(kebab-case) */
  slug: string
  /** i18n 词表键(camelCase,与既有 ecosystem.bundles.* 对齐) */
  titleKey: string
  icon: LucideIcon
  /** 该包按顺序走通市场的路径;每一项都是既有市场 */
  members: MarketKey[]
}

export const EXPERT_PACKS: ExpertPack[] = [
  {
    slug: 'content-creator',
    titleKey: 'contentCreator',
    icon: Rocket,
    members: ['aiSkills', 'skillsMarket', 'connectors'],
  },
  {
    slug: 'developer-extension',
    titleKey: 'developerExtension',
    icon: Wrench,
    members: ['mcpStore', 'capabilityMarket'],
  },
]

/** 统一入口本体(子页回链的唯一地址,不得在各页各写一份) */
export const ecosystemHubHref = '/ecosystem'

export function expertPackListHref(): string {
  return '/ecosystem/expert-packs'
}

export function expertPackDetailHref(slug: string): string {
  return `/ecosystem/expert-packs/${encodeURIComponent(slug)}`
}

export function findExpertPack(slug: string | undefined): ExpertPack | undefined {
  if (!slug) return undefined
  return EXPERT_PACKS.find((p) => p.slug === slug)
}
