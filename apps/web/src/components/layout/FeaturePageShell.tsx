// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 子功能页统一外壳(2026-11-16 立,用户「子功能页好好设计设计美化一下」+「立统一外壳组件再分批」)
 *
 * 定位:从 /domains/<slug> 卡片点进去的**内容页**用 —— 与域入口页(DomainHub)、
 * 模块导航页(CategoryShell)同一套视觉语言(共享 workspace-tokens.ts 单一真相源):
 *   - 页头条升级为浅渐变头卡(HERO_SURFACE + 柔光 + 主色图标砖 44 档),与域头卡同族;
 *   - 自动解析当前页所属域(resolveDomainSlugForPath),在页头渲一条面包屑:
 *     「域名 chip(可点返回 /domains/<slug>) › 当前页」,把"我从哪来、怎么回去"钉死;
 *   - 标题档位 PAGE_TITLE / PAGE_DESCRIPTION,与域入口页、模块页同档;
 *   - 内容区交给页面自己(children),本组件只管"壳"。
 *
 * 渐进接入:915 个内容页不可能一把梭。本外壳**不接管路由、不改 URL、不强制任何页**;
 * 页面想美化就把自己的 <div> 顶栏换成 <FeaturePageShell title=... icon=...>,内容照旧。
 * 未登记进任何域的页(/login、独立工具页)自动降级为不渲染返回 chip,照常可用。
 *
 * 关键纪律:
 *   - 图标几何 / 头卡表面 / 标题档位一律引用 workspace-tokens,不在 JSX 散写 class(§0.6)。
 *   - 域名取词走各域入口页自己的命名空间(<slug>Hub.title),与域入口页大标题恒等。
 *   - contentOwnsH1 同 CategoryShell 口径:内容页自带主题 H1 时容器标题降级为 <p>,
 *     保证「一页只有一个 H1,且它是本页主题」(a11y + SEO,2026-11-03 立)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  HERO_GLOW,
  HERO_ICON_TILE,
  HERO_ICON_GLYPH,
  HERO_SURFACE,
  ICON_GLYPH,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
} from './workspace-tokens'
import { DOMAINS, resolveDomainSlugForPath, type DomainSlug } from './domain-registry'

export interface FeaturePageShellProps {
  /** 当前页标题(已翻译) */
  title: string
  /** 当前页描述(可选) */
  description?: string
  /** 当前页图标(可选,缺省用域图标) */
  icon?: React.ComponentType<{ className?: string }>
  /** 页级操作区(按钮等,渲染在标题右侧) */
  actions?: React.ReactNode
  /**
   * 显式指定所属域 slug(可选)。不传则按 pathname 自动解析;
   * 传 null 强制不显示返回 chip(用于确实不属于八域的独立页)。
   */
  domain?: DomainSlug | null
  /** 内容页自带主题 H1 时容器标题降级为非标题元素(2026-11-03 立,单 H1) */
  contentOwnsH1?: boolean
  /** 内容区额外 className */
  contentClassName?: string
  /** 外层容器额外 className */
  className?: string
  children: React.ReactNode
}

/**
 * 外壳样式令牌(2026-11-16 立)—— 与 DomainHub.HUB_TOKENS / CategoryShell.SHELL_TOKENS
 * 同纪律:共享档位一律引用 workspace-tokens,本表只保留壳特有的组合。
 */
export const SHELL_TOKENS = {
  /** 页面外壳:与域入口页(DomainHub.page)同限宽 mx-auto max-w-6xl,不再无限撑满 */
  root: 'mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6',
  /** 页头卡:与域头卡同一表面(HERO_SURFACE 已含 rounded-2xl + 主色渐变) */
  headCard: HERO_SURFACE,
  headGlow: HERO_GLOW,
  /** 页头内层:面包屑行 + 主标题行,两行 */
  headInner: 'relative flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5',
  /** 面包屑行:域返回 chip + 分隔箭头 + 当前页名 */
  crumbRow: 'flex min-w-0 items-center gap-1.5',
  /** 域返回 chip:主色图标砖(36 档) + 域名,整块可点返回域入口 */
  domainChip:
    'inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-label font-medium text-primary transition-colors hover:bg-primary/10',
  domainChipIcon: ICON_GLYPH,
  crumbSep: 'text-muted-foreground/50',
  crumbSepIcon: ICON_GLYPH,
  crumbCurrent: 'min-w-0 truncate text-label text-muted-foreground',
  /** 主标题行:图标砖(44 档) + 标题/描述 + 操作区 */
  titleRow: 'flex items-start gap-3',
  headIcon: HERO_ICON_TILE,
  headIconGlyph: HERO_ICON_GLYPH,
  headText: 'min-w-0 flex-1',
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  actions: 'flex shrink-0 items-center gap-2',
} as const

/**
 * 域名取词器:八个域各一个静态 useTranslations 实例,按 slug 选用。
 * next-intl 要求命名空间静态字面量发射(接线门 C6),故不能写 useTranslations(meta.ns)。
 * 取 title 键与域入口页大标题恒等(改一处两处同动)。
 */
function useDomainLabel() {
  const tEdu = useTranslations('eduHub')
  const tAi = useTranslations('aiHub')
  const tContent = useTranslations('contentHub')
  const tTrade = useTranslations('tradeHub')
  const tPersonal = useTranslations('personalHub')
  const tHr = useTranslations('hrHub')
  const tDeveloper = useTranslations('developerHub')
  const tAdmin = useTranslations('adminHub')
  return React.useCallback(
    (slug: DomainSlug): string => {
      switch (slug) {
        case 'edu':
          return tEdu('title')
        case 'ai':
          return tAi('title')
        case 'content':
          return tContent('title')
        case 'trade':
          return tTrade('title')
        case 'personal':
          return tPersonal('title')
        case 'hr':
          return tHr('title')
        case 'developer':
          return tDeveloper('title')
        case 'admin':
          return tAdmin('title')
      }
    },
    [tEdu, tAi, tContent, tTrade, tPersonal, tHr, tDeveloper, tAdmin],
  )
}

export function FeaturePageShell({
  title,
  description,
  icon,
  actions,
  domain,
  contentOwnsH1 = false,
  contentClassName,
  className,
  children,
}: FeaturePageShellProps) {
  const pathname = usePathname()
  const getDomainLabel = useDomainLabel()
  const tA11y = useTranslations('a11y')

  // 所属域:显式 domain 优先;未传按 pathname 解析;传 null 强制关闭
  const resolvedSlug = React.useMemo<DomainSlug | null>(() => {
    if (domain !== undefined) return domain
    return resolveDomainSlugForPath(pathname)
  }, [domain, pathname])
  const domainMeta = resolvedSlug ? DOMAINS[resolvedSlug] : null
  const domainLabel = resolvedSlug ? getDomainLabel(resolvedSlug) : null

  const HeadIcon = icon ?? domainMeta?.icon
  const TitleTag: React.ElementType = contentOwnsH1 ? 'p' : 'h1'

  return (
    <div className={cn(SHELL_TOKENS.root, className)}>
      {/* 页头卡:域返回面包屑 + 标题/描述 + 操作区 */}
      <div className={SHELL_TOKENS.headCard}>
        <span className={SHELL_TOKENS.headGlow} aria-hidden="true" />
        <div className={SHELL_TOKENS.headInner}>
          {domainMeta && domainLabel && (
            <nav aria-label={tA11y('breadcrumb')} className={SHELL_TOKENS.crumbRow}>
              <Link href={domainMeta.href} className={SHELL_TOKENS.domainChip}>
                {/* chip 已带主色皮肤,域图标只出字形(16 档),不再套图标砖 */}
                {(() => {
                  const DomainIcon = domainMeta.icon
                  return <DomainIcon className={SHELL_TOKENS.domainChipIcon} aria-hidden="true" />
                })()}
                <span className="truncate">{domainLabel}</span>
              </Link>
              <ChevronRight className={SHELL_TOKENS.crumbSepIcon} aria-hidden="true" />
              <span className={SHELL_TOKENS.crumbCurrent}>{title}</span>
            </nav>
          )}
          <div className={SHELL_TOKENS.titleRow}>
            {HeadIcon && (
              <span className={SHELL_TOKENS.headIcon} aria-hidden="true">
                <HeadIcon className={SHELL_TOKENS.headIconGlyph} />
              </span>
            )}
            <div className={SHELL_TOKENS.headText}>
              <TitleTag className={SHELL_TOKENS.title}>{title}</TitleTag>
              {description && <p className={SHELL_TOKENS.description}>{description}</p>}
            </div>
            {actions && <div className={SHELL_TOKENS.actions}>{actions}</div>}
          </div>
        </div>
      </div>

      {/* 内容区:交给页面自己 */}
      <div className={cn('min-w-0 flex-1', contentClassName)}>{children}</div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
