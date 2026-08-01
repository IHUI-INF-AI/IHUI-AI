/**
 * Server-Driven UI schema for marketing/home sections (P3-4.3).
 *
 * 把 HomeSections 的硬编码 7-section 改为 JSON schema 驱动:
 * - section 顺序/显隐可通过配置(后端 system_configs)调整,无需改代码
 * - admin 可编辑 schema,前端渲染时加载后端 schema(fallback 默认)
 * - 局部增强:只改造 HomeSections,不作整体架构
 *
 * 组件注册表在 SchemaDrivenSections.tsx,schema 只描述"渲染哪个组件 + 是否启用"。
 * section 内部布局由组件自己封装,schema 不控制子元素(避免过度设计)。
 */

/** 可渲染的 section 组件类型(注册表 key) */
export type SectionComponentType =
  | 'hero' // Page 1: TypewriterHero + 4 徽章 + 6 Benefits + Marquee + GithubStarBanner
  | 'featureGrid' // Page 2: HomeFeatureGrid
  | 'scenarios' // Page 3: HomeScenarios
  | 'roi' // Page 4: HomeRoi
  | 'comparison' // Page 5: HomeComparison
  | 'pricing' // Page 6: HomePage4Pricing + 4 Stat + BrandMarquee
  | 'magazine' // Page 7: HomePage3Magazine + SiteFooter(可选)

/** 单个 section 的 schema 描述 */
export interface HomeSectionSchema {
  /** 唯一标识(admin 排序/显隐用) */
  id: string
  /** 渲染哪个 section 组件 */
  component: SectionComponentType
  /** 是否渲染(false 则跳过该 section) */
  enabled: boolean
  /** 预留扩展(props 透传,当前未使用) */
  props?: Record<string, unknown>
}

/** 首页完整 schema */
export interface HomeSchema {
  /** schema 版本(向后兼容检测) */
  version: string
  /** section 列表(顺序即渲染顺序) */
  sections: HomeSectionSchema[]
}

/** 所有可用的 section 组件类型(用于 admin UI 列表 + 校验) */
export const ALL_SECTION_COMPONENTS: readonly SectionComponentType[] = [
  'hero',
  'featureGrid',
  'scenarios',
  'roi',
  'comparison',
  'pricing',
  'magazine',
] as const

/** 默认 schema — 映射现有 7-section 行为(零回归) */
export const DEFAULT_HOME_SCHEMA: HomeSchema = {
  version: '1.0.0',
  sections: [
    { id: 'page-1-hero', component: 'hero', enabled: true },
    { id: 'page-2-features', component: 'featureGrid', enabled: true },
    { id: 'page-3-scenarios', component: 'scenarios', enabled: true },
    { id: 'page-4-roi', component: 'roi', enabled: true },
    { id: 'page-5-comparison', component: 'comparison', enabled: true },
    { id: 'page-6-pricing', component: 'pricing', enabled: true },
    { id: 'page-7-magazine', component: 'magazine', enabled: true },
  ],
}

/** 计算启用 section 数量(用于 PageIndicator total) */
export function getEnabledSectionCount(schema: HomeSchema): number {
  return schema.sections.filter((s) => s.enabled).length
}

/** 校验 schema 合法性(后端返回的 schema 可能损坏,前端需防御) */
export function validateHomeSchema(schema: unknown): schema is HomeSchema {
  if (typeof schema !== 'object' || schema === null) return false
  const s = schema as Record<string, unknown>
  if (typeof s.version !== 'string') return false
  if (!Array.isArray(s.sections)) return false
  return s.sections.every((sec) => {
    if (typeof sec !== 'object' || sec === null) return false
    const r = sec as Record<string, unknown>
    return (
      typeof r.id === 'string' &&
      typeof r.component === 'string' &&
      (ALL_SECTION_COMPONENTS as readonly string[]).includes(r.component) &&
      typeof r.enabled === 'boolean'
    )
  })
}

/** 安全获取 schema:校验失败则 fallback 默认(防止后端数据损坏导致页面空白) */
export function safeGetHomeSchema(schema: unknown): HomeSchema {
  return validateHomeSchema(schema) ? schema : DEFAULT_HOME_SCHEMA
}
