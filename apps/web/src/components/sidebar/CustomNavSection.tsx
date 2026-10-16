// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Search, X } from 'lucide-react'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { NavLink } from './NavLink'
import { CustomNavDialog } from './CustomNavDialog'
import { useCustomNav } from './use-custom-nav'
import { flattenNavItems, isHrefActive } from './nav-data'
import type { NavItem, RegisterRef } from './types'

/**
 * 「自定义」栏(2026-10-16 立):渲染在「热门」分组上方的用户自选快捷入口。
 *
 * 业务诉求:登录态下,用户通过标题行右侧的 + 号把自己常用的侧边栏功能键
 * 收进这一栏,不用去翻下面的全部分组。
 *
 * 设计要点:
 * - 只存 href(见 use-custom-nav),图标/文案/active 高亮全部渲染期从 nav-data 解析,
 *   与既有导航项视觉、预取、乐观高亮行为完全一致。
 * - 仅登录态渲染:userId 为空或尚未水合时返回 null,SSR 首帧同样为空,
 *   保证 hydration 一致,也不会给未登录用户露出这个栏。
 * - active 判定不走父级 activeHref:自定义项可能因角色/RBAC 变化已不在
 *   visibleGroups 里(activeHref 由 allVisibleItems 算出),直接用
 *   isHrefActive(item.href, pathname) 自行判定,收藏项永不失高亮。
 * - 已收藏但当前不可见(RBAC 收敛)的项自动隐藏,不留死链。
 * - 移动端抽屉与桌面侧栏共用同一组件(collapsed=false),折叠态退化为
 *   36×36 图标条 + 已添加项的纯图标入口,与 NavGroupSection 折叠语义一致。
 */

const CustomNavSection = React.memo(function CustomNavSection({
  collapsed,
  onCloseMobile,
  registerRef,
  onBeforeNav,
  groups,
}: {
  collapsed: boolean
  onCloseMobile: () => void
  registerRef: RegisterRef
  onBeforeNav?: (href: string) => void
  /** 已按角色/RBAC 过滤的分组(来自 Sidebar 的 visibleGroups) */
  groups: { label: string; items: NavItem[] }[]
}) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { userId, hydrated, customHrefs, addHref, removeHref } = useCustomNav()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // href -> NavItem 索引:groups 在父级已 memo,导航结构不变则零重建
  const itemMap = React.useMemo(() => {
    const map = new Map<string, NavItem>()
    for (const group of groups) {
      for (const item of flattenNavItems(group.items)) {
        if (!map.has(item.href)) map.set(item.href, item)
      }
    }
    return map
  }, [groups])

  // 仅渲染当前用户仍可见的收藏项(不可见项自动隐藏)
  const customItems = React.useMemo(
    () => customHrefs.map((href) => itemMap.get(href)).filter((i): i is NavItem => i !== undefined),
    [customHrefs, itemMap],
  )

  const openDialog = React.useCallback(() => setDialogOpen(true), [])
  const closeDialog = React.useCallback(() => setDialogOpen(false), [])

  // 未登录 / 尚未水合:不渲染(SSR 首帧同样为空,hydration 一致)
  if (!userId || !hydrated) return null

  const dialog = (
    <CustomNavDialog
      open={dialogOpen}
      onClose={closeDialog}
      groups={groups}
      customHrefs={customHrefs}
      onAdd={addHref}
      onRemove={removeHref}
    />
  )

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.href}
      item={item}
      collapsed={collapsed}
      active={isHrefActive(item.href, pathname)}
      label={item.dynamicLabel ?? t(item.labelKey)}
      onCloseMobile={onCloseMobile}
      registerRef={registerRef}
      onBeforeNav={onBeforeNav}
    />
  )

  const addButton = (
    <button
      type="button"
      onClick={openDialog}
      aria-label={t('customAddTitle')}
      title={t('customAddTitle')}
      data-testid="nav-custom-add"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-sidebar-item-hover-bg hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  )

  // 折叠态:36×36 的 + 按钮 + 已添加项的纯图标入口(不显示分组标题)
  if (collapsed) {
    return (
      <div className="pt-2">
        <Tooltip content={t('customAddTitle')} side="right">
          <button
            type="button"
            onClick={openDialog}
            aria-label={t('customAddTitle')}
            data-testid="nav-custom-add"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-sidebar-item-hover-bg hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-5 w-5 shrink-0" />
          </button>
        </Tooltip>
        <div className="flex flex-col gap-0.5">{customItems.map(renderItem)}</div>
        {dialog}
      </div>
    )
  }

  // 展开态:标题行(标签 + 右侧 + 号)+ 自定义项列表 / 空态引导
  return (
    <div className="pt-2">
      <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-1">
        <span className="min-w-0 whitespace-nowrap text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t('customGroup')}
        </span>
        {addButton}
      </div>

      {customItems.length === 0 ? (
        <button
          type="button"
          onClick={openDialog}
          className={cn(
            'flex h-9 w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium leading-none whitespace-nowrap transition-colors',
            'text-muted-foreground/60 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Search className="h-5 w-5 shrink-0" />
          <span className="min-w-0 whitespace-nowrap text-left">{t('customEmptyHint')}</span>
        </button>
      ) : (
        <div className="flex flex-col gap-0.5">
          {customItems.map((item) => (
            <div key={item.href} className="group/citem relative">
              {renderItem(item)}
              {/* hover 条目时浮现的移除按钮:阻止冒泡,避免触发底层 Link 导航 */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  removeHref(item.href)
                }}
                aria-label={t('customRemove')}
                title={t('customRemove')}
                data-testid={`nav-custom-remove-${item.href}`}
                className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/citem:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {dialog}
    </div>
  )
})

export { CustomNavSection }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
