// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentType } from 'react'
import {
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  Sparkles,
  Terminal,
  User,
  UsersRound,
  Wallet,
} from 'lucide-react'
import {
  ADMIN_HUB_ITEMS,
  AI_HUB_ITEMS,
  CONTENT_HUB_ITEMS,
  DEVELOPER_HUB_ITEMS,
  EDU_HUB_ITEMS,
  HR_HUB_ITEMS,
  PERSONAL_HUB_ITEMS,
  TRADE_HUB_ITEMS,
} from '@/components/sidebar/nav-data'
import type { NavItem } from '@/components/sidebar/types'

/**
 * 域元数据注册表(2026-11-16 立,「子功能页统一外壳」地基)
 *
 * 作用:子功能页(从 /domains/<slug> 卡片点进去的内容页)套 FeaturePageShell 时,
 * 借此把「当前页属于哪个域」解析出来,自动生成:
 *   - 面包屑「域入口」一段(返回 /domains/<slug>);
 *   - 域图标 / 域名。
 *
 * 取材纪律(§0.6 单一真相源):域名 i18n 命名空间、域图标、域入口 href、域条目清单
 * **全部复用域入口页(/domains/<slug>)已经在用的同一份定义**,本表只做"把八域组装成
 * 可检索结构"这一件新事,不另抄任何清单 / 图标 —— 域入口页改哪,这里跟哪。
 *
 * 域名取词:各域入口页大标题用的是 <slug>Hub.title(如 eduHub.title)。FeaturePageShell
 * 持有这八个命名空间的静态 useTranslations 实例(见 SHELL_DOMAIN_NS),按 slug 选用
 * —— next-intl 要求命名空间静态发射,故不能在这里用变量拼键。
 */
export interface DomainMeta {
  /** 域 slug(= /domains/<slug> 的一段) */
  slug: string
  /** 域入口页 href */
  href: string
  /** 域名取词命名空间(该域入口页大标题所在,如 'eduHub') */
  ns: string
  /** 域图标(与域入口页 / 侧边栏分组同源) */
  icon: ComponentType<{ className?: string }>
  /** 域条目清单(用于把子页 href 归属到本域) */
  items: NavItem[]
}

/** 八域的静态命名空间表:供 FeaturePageShell 各建一个 useTranslations(接线门 C6 认字面量) */
export const DOMAIN_NS = {
  edu: 'eduHub',
  ai: 'aiHub',
  content: 'contentHub',
  trade: 'tradeHub',
  personal: 'personalHub',
  hr: 'hrHub',
  developer: 'developerHub',
  admin: 'adminHub',
} as const

export type DomainSlug = keyof typeof DOMAIN_NS

export const DOMAINS: Record<DomainSlug, DomainMeta> = {
  edu: {
    slug: 'edu',
    href: '/domains/edu',
    ns: DOMAIN_NS.edu,
    icon: GraduationCap,
    items: EDU_HUB_ITEMS,
  },
  ai: {
    slug: 'ai',
    href: '/domains/ai',
    ns: DOMAIN_NS.ai,
    icon: Sparkles,
    items: AI_HUB_ITEMS,
  },
  content: {
    slug: 'content',
    href: '/domains/content',
    ns: DOMAIN_NS.content,
    icon: LayoutGrid,
    items: CONTENT_HUB_ITEMS,
  },
  trade: {
    slug: 'trade',
    href: '/domains/trade',
    ns: DOMAIN_NS.trade,
    icon: Wallet,
    items: TRADE_HUB_ITEMS,
  },
  personal: {
    slug: 'personal',
    href: '/domains/personal',
    ns: DOMAIN_NS.personal,
    icon: User,
    items: PERSONAL_HUB_ITEMS,
  },
  hr: {
    slug: 'hr',
    href: '/domains/hr',
    ns: DOMAIN_NS.hr,
    icon: UsersRound,
    items: HR_HUB_ITEMS,
  },
  developer: {
    slug: 'developer',
    href: '/domains/developer',
    ns: DOMAIN_NS.developer,
    icon: Terminal,
    items: DEVELOPER_HUB_ITEMS,
  },
  admin: {
    slug: 'admin',
    href: '/domains/admin',
    ns: DOMAIN_NS.admin,
    icon: LayoutDashboard,
    items: ADMIN_HUB_ITEMS,
  },
}

/** 展开父项 children 后的扁平 href 索引(惰性构建一次) */
let HREF_TO_DOMAIN: Map<string, DomainSlug> | null = null

function flattenHrefs(items: NavItem[], out: string[] = []): string[] {
  for (const item of items) {
    out.push(item.href)
    if (item.children?.length) flattenHrefs(item.children, out)
  }
  return out
}

function getIndex(): Map<string, DomainSlug> {
  if (!HREF_TO_DOMAIN) {
    HREF_TO_DOMAIN = new Map()
    for (const [slug, meta] of Object.entries(DOMAINS)) {
      // 域入口本身也纳入索引 —— 它是返回 chip 的目标,自己要能解析到本域,
      // 否则从子页返回域入口页时归属会断(navigate 后 chip 消失)。
      if (!HREF_TO_DOMAIN.has(meta.href)) HREF_TO_DOMAIN.set(meta.href, slug as DomainSlug)
      for (const href of flattenHrefs(meta.items)) {
        // 多域登记同一 href 时保持首个(与 nav 去重口径一致),不覆盖
        if (!HREF_TO_DOMAIN.has(href)) HREF_TO_DOMAIN.set(href, slug as DomainSlug)
      }
    }
  }
  return HREF_TO_DOMAIN
}

/**
 * 把子页 pathname 归属到域:先精确匹配,未命中按"最长前缀"回退
 * (与 path-labels 同策略)—— /learn/exam 归到登记了 /learn 的教育域。
 * 未登记进任何域的页(如 /login、独立工具页)返回 null,外壳降级为不渲染返回 chip。
 */
export function resolveDomainSlugForPath(pathname: string): DomainSlug | null {
  const index = getIndex()
  if (index.has(pathname)) return index.get(pathname) ?? null
  let best: { slug: DomainSlug; len: number } | null = null
  for (const [href, slug] of index) {
    // 路径段边界:裸 startsWith 会把 /administrator、/live-extra 误判进域
    // (/admin、/live 是别的路由的前缀);与 isHrefActive 同口径(2026-11-16)。
    if (pathname !== href && !pathname.startsWith(`${href}/`)) continue
    if (!best || href.length > best.len) best = { slug, len: href.length }
  }
  return best?.slug ?? null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
