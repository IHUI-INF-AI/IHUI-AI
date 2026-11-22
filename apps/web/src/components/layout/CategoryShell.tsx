// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 统一分类侧边栏布局(2026-08-01 立,用户要求“整个项目统一侧边栏切换形式”;
 * 2026-11-16 用户反馈「子功能页还得好好设计设计美化一下」后重做外观)
 *
 * 适用场景:多子页面模块(settings/user/developer/models/docs 等),左侧分组导航 + 右侧内容区
 *
 * 视觉系统(2026-11-16 起与域入口页 DomainHub 同一套语言,共享 workspace-tokens.ts):
 *   - 页头条升级为浅渐变头卡(HERO_SURFACE + 柔光 + 主色图标砖),与 /domains/* 域头卡同族;
 *   - 侧栏整体收进边框容器,分组标题「主色圆点 + SECTION_TITLE」与 hub 分组头同式;
 *   - 导航项图标统一 16×16(ICON_GLYPH)、圆角 lg、text-body 字号 —— 域卡片怎么排,这里就怎么排;
 *   - 激活态仍走品牌 CTA 同源令牌(bg-cta + text-cta-foreground,AGENTS.md §4),不引新色;
 *   - 所有槽位收敛到 SHELL_TOKENS,共享档位一律引用 workspace-tokens,不在 JSX 散写 class。
 *
 * 布局:
 *   +--------------------------------------------------+
 *   | 页头卡:图标砖 + 标题 + 描述(shrink-0)            |
 *   +----------+---------------------------------------+
 *   | 侧栏面板  | 内容区(min-h-0 flex-1 overflow-y-auto)|
 *   | ● 分组1  |                                       |
 *   | │ 项1    |   children                            |
 *   | │ 项2    |                                       |
 *   | ● 分组2  |                                       |
 *   +----------+---------------------------------------+
 *
 * 关键(历次事故锁,不得回退):
 *   - 整体 flex h-full flex-col,不滚动;标题区 shrink-0 固定;主体 flex-1 min-h-0 两栏各自内滚
 *   - 移动端抽屉(Sheet=Radix Dialog)客户端挂载后才渲染 —— 2026-09-16 根治静态导出预渲染
 *     崩溃(React19 prerender 中 Radix context 断裂抛 "must be used within Dialog",
 *     CI 4 平台实证 run#42-44;/models 与 /developer/api-docs);e2e
 *     desktop-window-controls-dim.spec 以 aria-label="打开导航菜单" 锁定该触发器存在。
 *   - contentOwnsH1:内容页自带主题 H1 时容器标题降级为非标题元素(a11y + SEO 单 H1,
 *     2026-11-03 立;docs-slug-404.spec 锁定)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import {
  HERO_GLOW,
  HERO_SURFACE,
  ICON_BRICK,
  ICON_GLYPH,
  ICON_TILE_TONE_PRIMARY,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  SECTION_DOT,
  SECTION_TITLE,
} from './workspace-tokens'

export interface CategoryNavItem {
  /** 路由路径,用于 Link href 和当前路由匹配 */
  href: string
  /** 显示文字(已翻译) */
  label: string
  /** 可选图标 */
  icon?: React.ComponentType<{ className?: string }>
  /** 可选描述(侧边栏不显示,仅用于无障碍) */
  description?: string
}

export interface CategoryNavGroup {
  /** 分组标题(已翻译),不传则无标题 */
  label?: string
  /** 分组下的导航项 */
  items: CategoryNavItem[]
}

export interface CategoryShellProps {
  /** 模块标题(已翻译) */
  title: string
  /** 模块描述(已翻译) */
  description?: string
  /**
   * 模块图标(2026-11-16 立):与侧边栏该分类的图标保持一致;
   * 未传回落 LayoutGrid —— 同 DomainHub 的域图标兜底口径。
   */
  icon?: React.ComponentType<{ className?: string }>
  /** 分组导航配置 */
  navGroups: CategoryNavGroup[]
  /** 右侧内容区(children) */
  children: React.ReactNode
  /** 可选:额外 className(加在根容器) */
  className?: string
  /** 可选:侧边栏宽度,默认 w-fit(自适应文字宽度) */
  sidebarWidth?: string
  /**
   * 内容区是否自带主题 H1(2026-11-03 立,治「文档中心每页两个 H1」)。
   * true ⇒ 模块标题降级为非标题元素(档位 token 原样保留,视觉零变化),把唯一的 H1 让给
   * 内容页自己的 hero 标题(a11y + SEO:一页只能有一个 H1,且必须是该页主题)。
   * 默认 false = 模块标题继续充当该页 H1(正文没有 hero 标题的模块保持原行为)。
   */
  contentOwnsH1?: boolean
}

/**
 * 模块页样式令牌(2026-11-16 立)
 *
 * 与 DomainHub.HUB_TOKENS 同纪律:共享档位(图标几何 / 头卡表面 / 标题 / 分组头)一律
 * 引用 workspace-tokens.ts 的单一真相源,本表只保留 shell 特有的组合与紧凑变体。
 */
export const SHELL_TOKENS = {
  /** 整体:flex 纵排,页头固定 + 主体两栏各自内滚 */
  root: 'flex h-full flex-col',
  /** 页头容器(shrink-0 固定) */
  head: 'shrink-0 px-4 pt-3',
  /** 页头卡:与域头卡同一表面(hub 全页 hero 的紧凑内边距变体) */
  headCard: `${HERO_SURFACE} px-3 py-2.5`,
  headGlow: HERO_GLOW,
  headRow: 'relative flex items-center gap-2.5',
  /** 页头图标砖:几何与域卡片同档(36×36),皮肤与 hub 头卡同色 */
  headIcon: `${ICON_BRICK} ${ICON_TILE_TONE_PRIMARY}`,
  headIconGlyph: ICON_GLYPH,
  headText: 'min-w-0 flex-1',
  /** 页标题档位:手机 20px → 桌面 24px(与域入口页同档) */
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  /** 移动端抽屉触发器(<640px 显示) */
  trigger:
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground min-[640px]:hidden',
  triggerGlyph: ICON_GLYPH,
  /** 移动端当前项指示(<640px 显示) */
  mobileActiveLabel:
    'hidden min-w-0 max-w-[40%] truncate text-label text-muted-foreground min-[640px]:hidden',
  /** 主体:侧栏 + 内容区 */
  body: 'flex min-h-0 flex-1 gap-3 px-4 pb-3 pt-3',
  /** 桌面侧栏(≥640px 固定显示,自身内滚) */
  sidebar: 'hidden min-h-0 shrink-0 flex-col overflow-y-auto min-[640px]:flex',
  /** 侧栏容器卡:与域页面板同描边档 */
  sidebarPanel: 'rounded-xl border border-border bg-card/60 p-2 shadow-elevation-sm',
  nav: 'space-y-2',
  group: 'space-y-0.5',
  /** 分组头:主色圆点 + 标题(与 hub 的 sectionHead 同式) */
  groupHead: 'flex items-center gap-1.5 px-2 pb-0.5 pt-1.5',
  groupDot: SECTION_DOT,
  groupTitle: SECTION_TITLE,
  /** 导航项:图标 + 文案统一 10px 节奏,字号升到 text-body 与域卡片同档 */
  item: 'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-body font-medium transition-colors',
  /** 激活态:品牌 CTA 同源令牌(§4),不引新色 */
  itemActive: 'bg-cta text-cta-foreground font-semibold shadow-elevation-sm',
  itemIdle: 'text-muted-foreground hover:bg-accent hover:text-foreground',
  itemIcon: `${ICON_GLYPH} shrink-0`,
  itemLabel: 'min-w-0 truncate whitespace-nowrap',
  /** 移动端抽屉 */
  sheetContent: 'w-[90vw] p-3 min-[640px]:w-72',
  sheetHead: 'mb-3 flex items-center gap-2',
  sheetHeadIcon: `${ICON_BRICK} ${ICON_TILE_TONE_PRIMARY}`,
  sheetHeadText: 'min-w-0 flex-1 truncate text-body font-semibold',
  sheetScroll: 'min-h-0 flex-1 overflow-y-auto',
} as const

/**
 * 判断当前导航项是否激活:精确匹配,或 pathname 落在 href 的子路径下。
 * 例:href=/settings/llm,pathname=/settings/llm → 激活(精确)
 * 例:href=/settings,pathname=/settings/llm → 激活(子树归属 —— /settings 是父页,
 *     其子页在导航上仍属于它;旁支 /settings/mail 不命中,因为它不是 pathname 的前缀段)
 */
function isItemActive(href: string, pathname: string): boolean {
  if (pathname === href) return true
  // 子路径匹配:href 后跟 / 开头的子路径
  return pathname.startsWith(href + '/')
}

export function CategoryShell({
  title,
  description,
  icon,
  navGroups,
  children,
  className,
  sidebarWidth = 'w-fit',
  contentOwnsH1 = false,
}: CategoryShellProps) {
  const pathname = usePathname()
  const t = useTranslations('a11y')
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  // 2026-09-16 根治静态导出预渲染崩溃:移动端抽屉(Sheet=Radix Dialog)是纯交互组件,
  // React19 prerender 中 Radix 内部 context 断裂导致 SheetTrigger/DialogPortal 抛
  // "must be used within Dialog"(CI 4 平台实证,run#42-44;/models 与 /developer/api-docs)。
  // 该抽屉 <640px 显示且 open=false,SSR HTML 无 SEO/首屏价值——延迟到客户端挂载后渲染。
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // 路由变化时关闭移动端抽屉
  React.useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  // 找当前激活项,用于移动端触发器显示
  const activeItem = React.useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isItemActive(item.href, pathname)) return item
      }
    }
    return null
  }, [navGroups, pathname])

  // 内容页自带主题 H1 时,模块标题降级为普通段落(档位 token 一字不改,只让出标签语义)——
  // 保证「一页只有一个 H1,且它是本页主题」(a11y + SEO)。默认仍渲染 <h1>。
  const TitleTag: React.ElementType = contentOwnsH1 ? 'p' : 'h1'
  const HeadIcon = icon ?? LayoutGrid

  const renderNavItems = (items: CategoryNavItem[]) =>
    items.map((item) => {
      const active = isItemActive(item.href, pathname)
      const Icon = item.icon
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileNavOpen(false)}
          aria-current={active ? 'page' : undefined}
          aria-label={item.description ? `${item.label}: ${item.description}` : item.label}
          className={cn(
            SHELL_TOKENS.item,
            active ? SHELL_TOKENS.itemActive : SHELL_TOKENS.itemIdle,
          )}
        >
          {Icon && <Icon className={SHELL_TOKENS.itemIcon} aria-hidden="true" />}
          <span className={SHELL_TOKENS.itemLabel}>{item.label}</span>
        </Link>
      )
    })

  const renderNavGroups = () => (
    <nav className={SHELL_TOKENS.nav}>
      {navGroups.map((group, idx) => (
        <div key={group.label ?? idx} className={SHELL_TOKENS.group}>
          {group.label && (
            <div className={SHELL_TOKENS.groupHead}>
              <span className={SHELL_TOKENS.groupDot} aria-hidden="true" />
              <p className={SHELL_TOKENS.groupTitle}>{group.label}</p>
            </div>
          )}
          {renderNavItems(group.items)}
        </div>
      ))}
    </nav>
  )

  return (
    <div className={cn(SHELL_TOKENS.root, className)}>
      {/* 页头卡(shrink-0 固定;表面语言与 /domains/* 域头卡同源) */}
      <div className={SHELL_TOKENS.head}>
        <div className={SHELL_TOKENS.headCard}>
          <span className={SHELL_TOKENS.headGlow} aria-hidden="true" />
          <div className={SHELL_TOKENS.headRow}>
            {/* 移动端抽屉触发器(<640px 显示;客户端挂载后才渲染,见上方 mounted 注释) */}
            {mounted && (
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className={SHELL_TOKENS.trigger}
                    aria-label={t('openNavMenu')}
                  >
                    <Menu className={SHELL_TOKENS.triggerGlyph} />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className={SHELL_TOKENS.sheetContent}>
                  <div className={SHELL_TOKENS.sheetHead}>
                    <span className={SHELL_TOKENS.sheetHeadIcon} aria-hidden="true">
                      <HeadIcon className={SHELL_TOKENS.headIconGlyph} />
                    </span>
                    <p className={SHELL_TOKENS.sheetHeadText}>{title}</p>
                  </div>
                  <div className={SHELL_TOKENS.sheetScroll}>{renderNavGroups()}</div>
                </SheetContent>
              </Sheet>
            )}
            <span className={SHELL_TOKENS.headIcon} aria-hidden="true">
              <HeadIcon className={SHELL_TOKENS.headIconGlyph} />
            </span>
            <div className={SHELL_TOKENS.headText}>
              <TitleTag className={SHELL_TOKENS.title}>{title}</TitleTag>
              {description && <p className={SHELL_TOKENS.description}>{description}</p>}
            </div>
            {/* 移动端当前项指示(<640px 显示) */}
            {activeItem && <p className={SHELL_TOKENS.mobileActiveLabel}>{activeItem.label}</p>}
          </div>
        </div>
      </div>

      {/* 主体:侧边栏 + 内容区 */}
      <div className={SHELL_TOKENS.body}>
        {/* 桌面侧边栏(≥640px 固定显示,收进边框容器卡) */}
        <aside className={cn(SHELL_TOKENS.sidebar, sidebarWidth)} aria-label={title}>
          <div className={SHELL_TOKENS.sidebarPanel}>{renderNavGroups()}</div>
        </aside>

        {/* 内容区(min-h-0 flex-1 内部滚动) */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
