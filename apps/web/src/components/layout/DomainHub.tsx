// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 域入口页(DomainHub)—— 侧边栏各一级分类的右侧工作区落地页(2026-10-19 立)
 *
 * 背景:侧边栏从 72 个一级菜单项收敛成 9 个域入口后,每个域的全部子页面需要
 * 一个落点承载。A 方案**不改现有路由**(教育/内容/交易三域的页面散在
 * `(main)/` 根层,不在 `/edu/*` 子树里 —— CategoryShell 作为 Next.js layout
 * 只管自己目录子树,搬目录等于改 URL、破坏全部外部链接),故用卡片网格列出该域
 * 全部功能,点击进二级。
 *
 * 权限:本组件**必须**过 `useNavVisibilityFilter`。`EDU_ITEMS` 里有 11 项带
 * `permission: 'edu:manage'` 的教师/管理员入口,不过滤就会对普通用户泄漏 ——
 * 点进去只剩 403/404(AGENTS.md §5 鉴权面公开化禁令针对的 fail-open 表现)。
 * 与 Sidebar 共用同一判据(use-nav-visibility.ts),不另写一份。
 *
 * 视觉系统(2026-11-16 用户反馈「挺难看的」后重做):
 *  ① 所有样式收敛进 `HUB_TOKENS` —— 八个域页(/domains/{edu,content,trade,ai,
 *    personal,hr,admin,developer})共用,改样式只改这一处;
 *  ② 页面结构固定为「域头卡(图标 + 标题 + 描述 + 功能数 + 搜索)→ 分组 → 卡片网格」,
 *    不再各域各写一套;颜色只用 border/card/muted/primary/ring 等语义令牌;
 *  ③ 带 children 的父项不再"卡片 + 裸数字"重复出现,改为独立的分组面板
 *    (父项一条链接头 + 子项网格),层级一眼可读;
 *  ④ 搜索框按已翻译标签即时过滤(教育域 42 项、管理域 80+ 项时必需),
 *    无结果有空态,不让用户面对一片空白。
 *  ⑤ 与 CategoryShell(子功能模块页)共享 workspace-tokens.ts 的档位 ——
 *    hub×shell 同一套视觉语言,漂移只会发生在令牌文件内部,不会两头各改各的。
 */

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, LayoutGrid, Search } from 'lucide-react'
import { useNavVisibilityFilter } from '@/components/sidebar/use-nav-visibility'
import type { NavItem } from '@/components/sidebar/types'
import { cn } from '@/lib/utils'
import {
  CHIP,
  HERO_GLOW,
  HERO_ICON_GLYPH,
  HERO_ICON_TILE,
  HERO_SURFACE,
  ICON_BRICK,
  ICON_GLYPH,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  SECTION_COUNT,
  SECTION_DOT,
  SECTION_TITLE,
} from './workspace-tokens'

/**
 * 域入口页的样式令牌(2026-11-16 立;共享档位收敛至 workspace-tokens.ts)
 *
 * 只允许在样式槽位里引用这些常量,不在 JSX 里散写 class —— 否则八个域页会再次漂移
 * 成"有的卡片两行、有的字号不同、hover 行为各异"的形态。槽位命名按页面结构而非
 * 具体样式,换视觉时只替换值即可。
 * 图标几何 / 页头表面 / 标题档位等与 CategoryShell 共用的槽位一律取 workspace-tokens,
 * 本文件只保留 hub 特有的组合(卡片、面板、网格、搜索)。
 */
export const HUB_TOKENS = {
  /** 页面外壳:与主工作区其它页一致的内边距,宽屏限宽避免卡片被拉成长条 */
  page: 'mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6',
  /** 域头卡:淡主色渐变 + 描边,与工作台其它 hero 区同语言 */
  hero: HERO_SURFACE,
  /** 域头卡右上角的柔光,纯装饰 */
  heroGlow: HERO_GLOW,
  heroInner: 'relative p-4 sm:p-5',
  heroRow: 'flex items-start gap-3',
  /** 域图标方砖 */
  heroIcon: HERO_ICON_TILE,
  heroGlyph: HERO_ICON_GLYPH,
  heroText: 'min-w-0 flex-1',
  /** 页面主标题:与站内其它工作区页同档(手机 20px → 桌面 24px) */
  title: PAGE_TITLE,
  /** 页面描述 */
  description: PAGE_DESCRIPTION,
  metaRow: 'mt-3 flex flex-wrap items-center gap-2',
  /** 功能数徽标 */
  chip: CHIP,
  /** 搜索区 */
  searchWrap: 'relative mt-3 w-full sm:max-w-sm',
  searchIcon:
    'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
  searchInput:
    'h-9 w-full rounded-lg border border-border bg-background/80 pl-8 pr-3 text-body text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-ring/25',
  body: 'mt-5 space-y-6',
  /** 单个分组 */
  section: 'space-y-2.5',
  sectionHead: 'flex items-center gap-2',
  sectionDot: SECTION_DOT,
  sectionTitle: SECTION_TITLE,
  sectionCount: SECTION_COUNT,
  /** 卡片网格:手机 1 列 → 平板 2 列 → 桌面 3 列 → 宽屏 4 列 */
  grid: 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  /**
   * 单张入口卡片。
   * 2026-11-19:浮起不再端内手写(原 `transition-all duration-150 hover:-translate-y-0.5
   * hover:shadow-md` 是守门 287 点名的散写数值)—— 改挂单一源头 `.ui-lift`
   * (globals.css 的 --lift-scale / --lift-offset + --shadow-elevation-lg)。
   * 显式挂类而不是只靠"main 内 bg-card 自动浮"那条选择器:本组件也可能被非 main 容器渲染。
   */
  card: 'ui-lift group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  /** 卡片图标砖:几何走 ICON_BRICK,与父项表头同尺寸 */
  cardIcon: `${ICON_BRICK} bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary`,
  cardGlyph: ICON_GLYPH,
  cardBody: 'min-w-0 flex-1',
  cardLabel: 'block truncate text-body font-medium text-foreground',
  /** 卡片右侧箭头:hover/focus 才出现,静态时不抢注意力 */
  cardArrow:
    'h-4 w-4 shrink-0 -translate-x-1 text-muted-foreground/40 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-hover/parent:translate-x-0 group-hover/parent:opacity-100',
  /** 带 children 的父项面板 */
  parentPanel: 'rounded-xl border border-border/70 bg-muted/30 p-2.5 sm:p-3',
  /** 父项表头:gap-3 与普通卡片一致,图标砖 36×36 同档 */
  parentLink:
    'group/parent flex items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  parentIcon: `${ICON_BRICK} bg-background text-muted-foreground transition-colors group-hover/parent:bg-primary/10 group-hover/parent:text-primary`,
  parentTitle: 'min-w-0 flex-1 truncate text-body font-medium text-foreground',
  parentCount: 'shrink-0 text-label tabular-nums text-muted-foreground',
  /** 子项网格:mt/gap 与分组节奏(2.5 = 10px)同档,不再比普通网格紧 2px */
  parentGrid: 'mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  /** 搜索无结果 */
  empty:
    'rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-label text-muted-foreground',
} as const

interface DomainHubSection {
  /** 分组标题(已翻译);不传则不渲染分组头 */
  title?: string
  items: NavItem[]
}

export interface DomainHubProps {
  /** 页面主标题(已翻译) */
  title: string
  /** 页面描述(已翻译) */
  description?: string
  /** 域图标,与侧边栏该分类的图标保持一致 */
  /**
   * 页头图标(lucide 组件;2026-11-16 起三个新域入口页 admin/developer/hr 传 `icon`)。
   */
  icon?: React.ComponentType<{ className?: string }>
  sections: DomainHubSection[]
  className?: string
}

/**
 * 域入口页的 nav 命名空间全键表(2026-10-19 立)
 *
 * 与 P1 在 settings 域做的是同一件事:门 121(`check-declared-policy-has-consumer.mjs`
 * C6 档)判 i18n 键接线**只认静态发射点** —— 「t 后接字符串字面量」的静态键,或全键字面量表 + `t(表[表达式])`。
 * 本组件原先用 `t(item.labelKey)`(变量取键),三键判不出 ⇒ en.json 未接线
 * 5599 > 锚点 5596,顶破棘轮。
 *
 * 值必须是 nav 命名空间内的相对键:取词器用的是 useTranslations('nav'),
 * 写成 'nav.eduHubTitle' 会被解析成 nav.nav.eduHubTitle(卡片显示原始键)。
 */
const HUB_NAV_LABEL_KEY: Record<string, string> = {
  eduHubTitle: 'eduHubTitle',
  contentHubTitle: 'contentHubTitle',
  tradeHubTitle: 'tradeHubTitle',
}

/**
 * 取词器:返回一个 item → 显示名的函数(只创建一次 t,避免每张卡各建一个翻译器)。
 * dynamicLabel(admin 后端下发名)优先;域入口页自增的三个键走 HUB_NAV_LABEL_KEY 静态表,
 * 其余沿用侧边栏既有 nav.* 键。
 */
function useHubLabelGetter() {
  const t = useTranslations('nav')
  return React.useCallback(
    (item: NavItem) => item.dynamicLabel ?? t(HUB_NAV_LABEL_KEY[item.labelKey] ?? item.labelKey),
    [t],
  )
}

/** 单个入口卡片:图标砖 + 名称 + hover 箭头 */
function HubCard({ item, label }: { item: NavItem; label: string }) {
  const Icon = item.icon
  return (
    <Link href={item.href} className={HUB_TOKENS.card} title={label}>
      <span className={HUB_TOKENS.cardIcon} aria-hidden="true">
        {Icon && <Icon className={HUB_TOKENS.cardGlyph} />}
      </span>
      <span className={HUB_TOKENS.cardBody}>
        <span className={HUB_TOKENS.cardLabel}>{label}</span>
      </span>
      <ArrowRight className={HUB_TOKENS.cardArrow} aria-hidden="true" />
    </Link>
  )
}

/**
 * 域入口页。结构:域头卡 → (搜索) → 分组 → 卡片网格。
 * 带 children 的父项渲染为独立面板,父项本身仍是一条可点链接(入口不丢)。
 */
export function DomainHub({ title, description, icon, sections, className }: DomainHubProps) {
  const filterByRole = useNavVisibilityFilter()
  const t = useTranslations('domainHub')
  const getLabel = useHubLabelGetter()
  const [query, setQuery] = React.useState('')

  // 权限过滤:整页统一走一次,与 Sidebar 同一判据(先顶层,再各父项的子项)
  const visibleSections = React.useMemo(
    () =>
      sections
        .map((section) => {
          const topLevel = filterByRole(section.items)
          return {
            ...section,
            items: topLevel.map((item) => ({
              ...item,
              children: item.children ? filterByRole(item.children) : undefined,
            })),
          }
        })
        // 整组被过滤空(如普通用户的「管理」组)则不渲染该组标题
        .filter((section) => section.items.length > 0),
    [sections, filterByRole],
  )

  // 标签搜索:父项命中则保留全部子项,仅子项命中则只保留命中的子项
  const q = query.trim().toLowerCase()
  const searchedSections = React.useMemo(() => {
    if (!q) return visibleSections
    return visibleSections
      .map((section) => ({
        ...section,
        items: section.items
          .map((item): NavItem | null => {
            const selfHit = getLabel(item).toLowerCase().includes(q)
            const hitChildren = item.children?.filter((child) =>
              getLabel(child).toLowerCase().includes(q),
            )
            if (!selfHit && (!hitChildren || hitChildren.length === 0)) return null
            return { ...item, children: selfHit ? item.children : hitChildren }
          })
          .filter((item): item is NavItem => item !== null),
      }))
      .filter((section) => section.items.length > 0)
  }, [visibleSections, q, getLabel])

  const total = visibleSections.reduce((sum, section) => sum + section.items.length, 0)
  const shown = searchedSections.reduce((sum, section) => sum + section.items.length, 0)
  const HeroIcon = icon ?? LayoutGrid

  return (
    <div className={cn(HUB_TOKENS.page, className)}>
      <header className={HUB_TOKENS.hero}>
        <div className={HUB_TOKENS.heroGlow} aria-hidden="true" />
        <div className={HUB_TOKENS.heroInner}>
          <div className={HUB_TOKENS.heroRow}>
            <span className={HUB_TOKENS.heroIcon} aria-hidden="true">
              <HeroIcon className={HUB_TOKENS.heroGlyph} />
            </span>
            <div className={HUB_TOKENS.heroText}>
              <h1 className={HUB_TOKENS.title}>{title}</h1>
              {description && <p className={HUB_TOKENS.description}>{description}</p>}
            </div>
          </div>

          <div className={HUB_TOKENS.metaRow}>
            <span className={HUB_TOKENS.chip}>
              {t('functionCount', { count: q ? shown : total })}
            </span>
          </div>

          <div className={HUB_TOKENS.searchWrap}>
            <Search className={HUB_TOKENS.searchIcon} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className={HUB_TOKENS.searchInput}
            />
          </div>
        </div>
      </header>

      <div className={HUB_TOKENS.body}>
        {searchedSections.length === 0 ? (
          <p className={HUB_TOKENS.empty}>{t('empty')}</p>
        ) : (
          searchedSections.map((section) => {
            const parentItems = section.items.filter(
              (item) => item.children && item.children.length > 0,
            )
            const plainItems = section.items.filter(
              (item) => !item.children || item.children.length === 0,
            )
            return (
              <section key={section.title ?? 'items'} className={HUB_TOKENS.section}>
                {section.title && (
                  <div className={HUB_TOKENS.sectionHead}>
                    <span className={HUB_TOKENS.sectionDot} aria-hidden="true" />
                    <h2 className={HUB_TOKENS.sectionTitle}>{section.title}</h2>
                    <span className={HUB_TOKENS.sectionCount}>{section.items.length}</span>
                  </div>
                )}

                {plainItems.length > 0 && (
                  <div className={HUB_TOKENS.grid}>
                    {plainItems.map((item) => (
                      <HubCard key={item.href} item={item} label={getLabel(item)} />
                    ))}
                  </div>
                )}

                {parentItems.map((parent) => {
                  const ParentIcon = parent.icon
                  return (
                    <div key={`parent-${parent.href}`} className={HUB_TOKENS.parentPanel}>
                      <Link href={parent.href} className={HUB_TOKENS.parentLink}>
                        <span className={HUB_TOKENS.parentIcon} aria-hidden="true">
                          {ParentIcon && <ParentIcon className={HUB_TOKENS.cardGlyph} />}
                        </span>
                        <span className={HUB_TOKENS.parentTitle}>{getLabel(parent)}</span>
                        <span className={HUB_TOKENS.parentCount}>
                          {t('subItems', { count: parent.children?.length ?? 0 })}
                        </span>
                        <ArrowRight className={HUB_TOKENS.cardArrow} aria-hidden="true" />
                      </Link>
                      <div className={HUB_TOKENS.parentGrid}>
                        {(parent.children ?? []).map((child) => (
                          <HubCard key={child.href} item={child} label={getLabel(child)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
