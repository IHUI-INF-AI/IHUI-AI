/**
 * 集中式 path → 标签规格映射单一事实来源。
 *
 * 用途:TagsView 渲染时根据 tag.path + 当前 locale 实时派生标签标题,
 * 取代"store 中存 title 字符串"的旧设计 — 语言切换后已存在标签自动重译。
 *
 * 复用现有导航定义,不重复维护:
 * - FLAT_NAV_ITEMS(主侧边栏) → ns='nav'
 * - ADMIN_NAV(AdminNav)     → ns='admin'
 * - EXTRA_PATH_LABELS       → 未在侧边栏的 17 条独立页面路由
 *
 * 匹配策略:精确匹配优先,未命中则按最长前缀匹配回退。
 */

import { FLAT_NAV_ITEMS } from '@/components/sidebar'
import { ADMIN_NAV } from '@/components/layout/AdminNav'

export interface PathLabelSpec {
  /** 翻译命名空间(对应 messages/*.json 的顶层 key,如 'nav'/'admin'/'about') */
  ns: string
  /** 该命名空间下的翻译键 */
  key: string
}

interface PathLabelEntry {
  href: string
  spec: PathLabelSpec
}

/** 主侧边栏路由 → ns='nav',key=labelKey */
const NAV_ENTRIES: PathLabelEntry[] = FLAT_NAV_ITEMS.map((item) => ({
  href: item.href,
  spec: { ns: 'nav', key: item.labelKey },
}))

/** AdminNav 路由 → ns='admin',key=labelKey */
const ADMIN_ENTRIES: PathLabelEntry[] = ADMIN_NAV.map((item) => ({
  href: item.href,
  spec: { ns: 'admin', key: item.labelKey },
}))

/**
 * 未在侧边栏中暴露但用户可能通过 URL 直接访问的独立页面路由。
 * 这些路由的标签规格走对应独立页面命名空间,确保标题正确翻译。
 */
const EXTRA_PATH_LABELS: PathLabelEntry[] = [
  { href: '/about', spec: { ns: 'about', key: 'aboutUs' } },
  { href: '/articles', spec: { ns: 'articles', key: 'title' } },
  { href: '/business-card', spec: { ns: 'businessCard', key: 'title' } },
  { href: '/pricing', spec: { ns: 'nav', key: 'pricing' } },
  { href: '/support', spec: { ns: 'nav', key: 'support' } },
  { href: '/ai-generation', spec: { ns: 'nav', key: 'aiGeneration' } },
  { href: '/ask', spec: { ns: 'nav', key: 'ask' } },
  { href: '/comments', spec: { ns: 'nav', key: 'comments' } },
  { href: '/developer', spec: { ns: 'nav', key: 'developer' } },
  { href: '/drama', spec: { ns: 'nav', key: 'drama' } },
  { href: '/edu', spec: { ns: 'nav', key: 'edu' } },
  { href: '/image-gen', spec: { ns: 'nav', key: 'imageGen' } },
  { href: '/member', spec: { ns: 'nav', key: 'member' } },
  { href: '/mobile-dashboard', spec: { ns: 'nav', key: 'mobileDashboard' } },
  { href: '/notifications', spec: { ns: 'nav', key: 'notifications' } },
  { href: '/commission', spec: { ns: 'nav', key: 'commission' } },
  { href: '/contact', spec: { ns: 'nav', key: 'contact' } },
  { href: '/mcp-projects', spec: { ns: 'nav', key: 'mcpProjects' } },
  { href: '/openclaw', spec: { ns: 'nav', key: 'openclaw' } },
  { href: '/recruitment', spec: { ns: 'nav', key: 'recruitment' } },
]

/** 合并所有路由 → 标签规格映射 */
const ALL_PATH_LABEL_MAP: PathLabelEntry[] = [
  ...NAV_ENTRIES,
  ...ADMIN_ENTRIES,
  ...EXTRA_PATH_LABELS,
]

/** 按 href 长度降序排列,用于最长前缀匹配(长的优先) */
const SORTED_PATH_LABELS = [...ALL_PATH_LABEL_MAP].sort((a, b) => b.href.length - a.href.length)

/**
 * 解析 pathname → 标签规格。
 *
 * 1. '/' → {ns:'nav', key:'home'}
 * 2. 精确匹配 ALL_PATH_LABEL_MAP
 * 3. 最长前缀匹配(SORTED_PATH_LABELS 中按 href 长度降序的第一条 startsWith 命中)
 * 4. 未命中返回 null(TagsView 会回退到 deriveTitle 取 URL 最后一段)
 */
export function resolvePathLabelSpec(pathname: string): PathLabelSpec | null {
  if (!pathname || pathname === '/') return { ns: 'nav', key: 'home' }

  // 精确匹配
  const exact = ALL_PATH_LABEL_MAP.find((e) => e.href === pathname)
  if (exact) return exact.spec

  // 最长前缀匹配(已按 href 长度降序)
  for (const entry of SORTED_PATH_LABELS) {
    if (pathname.startsWith(`${entry.href}/`)) return entry.spec
  }

  return null
}
