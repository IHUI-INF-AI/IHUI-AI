'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 统一分类侧边栏布局(2026-08-01 立,用户要求"整个项目统一侧边栏切换形式")
 *
 * 适用场景:多子页面模块(settings/user/developer/models/docs 等),左侧分组导航 + 右侧内容区
 *
 * 布局:
 *   +--------------------------------------------------+
 *   | 模块标题 + 描述(shrink-0)                         |
 *   +----------+---------------------------------------+
 *   | 侧边栏    | 内容区(min-h-0 flex-1 overflow-y-auto)|
 *   | 分组1    |                                       |
 *   | - 项1   |   children                            |
 *   | - 项2   |                                       |
 *   | 分组2    |                                       |
 *   +----------+---------------------------------------+
 *
 * 关键:
 *   - 整体 flex h-full flex-col,不滚动
 *   - 标题区 shrink-0 固定
 *   - 主体 flex-1 min-h-0,侧边栏 + 内容区各自内部滚动
 *   - 当前路由高亮(与全局 Tabs 统一:bg-white dark:bg-black)
 *   - 桌面端(≥768px)侧边栏固定显示;移动端折叠为 Sheet/Select
 */

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
  /** 分组导航配置 */
  navGroups: CategoryNavGroup[]
  /** 右侧内容区(children) */
  children: React.ReactNode
  /** 可选:额外 className(加在根容器) */
  className?: string
  /** 可选:侧边栏宽度,默认 w-52 */
  sidebarWidth?: string
}

/**
 * 判断当前导航项是否激活(精确匹配或子路径匹配)
 * 例:href=/settings/llm,pathname=/settings/llm → 激活
 * 例:href=/settings,pathname=/settings/llm → 不激活(避免父项总是高亮)
 */
function isItemActive(href: string, pathname: string): boolean {
  if (pathname === href) return true
  // 子路径匹配:href 后跟 / 开头的子路径
  return pathname.startsWith(href + '/')
}

export function CategoryShell({
  title,
  description,
  navGroups,
  children,
  className,
  sidebarWidth = 'w-52',
}: CategoryShellProps) {
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  // 找当前激活项,用于移动端 Select 显示
  const activeItem = React.useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isItemActive(item.href, pathname)) return item
      }
    }
    return null
  }, [navGroups, pathname])

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
            'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            active
              ? 'bg-white text-foreground shadow-sm dark:bg-black dark:text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </Link>
      )
    })

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* 标题区(shrink-0 固定) */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {/* 主体:侧边栏 + 内容区 */}
      <div className="flex min-h-0 flex-1 gap-3 px-4 pb-3">
        {/* 桌面端侧边栏(≥768px 固定显示) */}
        <aside
          className={cn(
            'hidden min-h-0 shrink-0 flex-col overflow-y-auto min-[768px]:flex',
            sidebarWidth,
          )}
          aria-label={title}
        >
          <nav className="space-y-3">
            {navGroups.map((group, idx) => (
              <div key={group.label ?? idx} className="space-y-1">
                {group.label && (
                  <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                )}
                {renderNavItems(group.items)}
              </div>
            ))}
          </nav>
        </aside>

        {/* 移动端侧边栏切换(<768px 显示 Select) */}
        <div className="min-[768px]:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium"
            aria-expanded={mobileNavOpen}
          >
            <span className="min-w-0 flex-1 truncate">
              {activeItem ? activeItem.label : title}
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                mobileNavOpen && 'rotate-180',
              )}
            />
          </button>
          {mobileNavOpen && (
            <div className="mt-1 max-h-64 space-y-3 overflow-y-auto rounded-md border border-border bg-card p-2">
              {navGroups.map((group, idx) => (
                <div key={group.label ?? idx} className="space-y-1">
                  {group.label && (
                    <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {group.label}
                    </p>
                  )}
                  {renderNavItems(group.items)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 内容区(min-h-0 flex-1 内部滚动) */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
