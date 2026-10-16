// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { GripVertical, Plus, X } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
 * 收进这一栏,并可用拖拽调整顺序,不用去翻下面的全部分组。
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
 * - 拖拽只在展开态启用:折叠态只有 36px 图标,没有放拖拽手柄的地方,
 *   强行开启会让整条图标行变成拖拽热区、误触率极高。
 */

/**
 * 可拖拽的自定义项行(展开态专用)。
 *
 * 拖拽手柄是**独立按钮**而不是"整行可拖":整行可拖会让点击导航与拖拽共用
 * 同一个 pointerdown,在触摸设备上尤其容易把"想点进去"判成"想拖动"。
 * 手柄独立后,点击语义与拖拽语义物理分离,且手柄天然可聚焦 ⇒ 键盘也能排序
 * (KeyboardSensor + sortableKeyboardCoordinates)。
 * 手柄放在右侧、与移除按钮并排,仅在 hover / 聚焦时浮现,平时不干扰阅读。
 */
function SortableCustomItem({
  item,
  label,
  active,
  collapsed,
  onCloseMobile,
  registerRef,
  onBeforeNav,
  onRemove,
  removeLabel,
  dragLabel,
}: {
  item: NavItem
  label: string
  active: boolean
  collapsed: boolean
  onCloseMobile: () => void
  registerRef: RegisterRef
  onBeforeNav?: (href: string) => void
  onRemove: (href: string) => void
  removeLabel: string
  dragLabel: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.href,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // 拖拽中的那一条浮到其余行之上,否则会被相邻行盖住半个身位
    zIndex: isDragging ? 1 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group/citem relative', isDragging && 'opacity-90')}
    >
      <NavLink
        item={item}
        collapsed={collapsed}
        active={active}
        label={label}
        onCloseMobile={onCloseMobile}
        registerRef={registerRef}
        onBeforeNav={onBeforeNav}
      />
      {/*
        右侧浮层:拖拽手柄 + 移除。只在 hover / 键盘聚焦时浮现。

        【P0 修复 2026-10-17】此前只有 opacity-0 没有 pointer-events-none ——
        opacity 不影响命中测试,于是行右侧约 54px 是一排**隐形但可点**的按钮:
        最右 24px 落在「移除」上 ⇒ 点条目右侧 = 静默删除收藏(无确认无撤销);
        再左 24px 落在拖拽手柄上 ⇒ 点击被吞、行毫无反应。160px 侧栏里这占了近 1/3 行宽。
        现在:隐藏态 pointer-events-none(不可点),hover / 键盘聚焦时恢复 auto;
        触屏无 hover,靠 touch-reveal(项目既有口径,animations.css)常驻可见,
        并用 [@media(hover:none)] 把 pointer-events 也常开 —— 否则手机上按钮看得见摸不着。
      */}
      <div
        className={cn(
          'absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity',
          'pointer-events-none group-hover/citem:pointer-events-auto has-[:focus-visible]:pointer-events-auto',
          'group-hover/citem:opacity-100 has-[:focus-visible]:opacity-100 touch-reveal',
          '[@media(hover:none)]:pointer-events-auto',
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={dragLabel}
          title={dragLabel}
          data-testid={`nav-custom-drag-${item.href}`}
          className="flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove(item.href)
          }}
          aria-label={removeLabel}
          title={removeLabel}
          data-testid={`nav-custom-remove-${item.href}`}
          className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

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

  // 当前可见项的 href 集合 —— 作为"允许集"交给数据层。
  // admin 的 80 项后台路由是运行时拉取合并进 visibleGroups 的,不在模块级静态表
  // (ALL_NAV_HREFS)里;不把它们并进允许集,用户收藏的动态项会在刷新后被当失效项
  // 剔除 ⇒ "加了之后刷新就没了"。引用由 groups memo 稳定,只在导航结构真变时换。
  const visibleHrefs = React.useMemo(() => {
    const set = new Set<string>()
    for (const group of groups) {
      for (const item of flattenNavItems(group.items)) set.add(item.href)
    }
    return set
  }, [groups])

  const { userId, hydrated, customHrefs, addHref, removeHref, reorderHref } =
    useCustomNav(visibleHrefs)
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

  // distance 6px:低于此位移视为点击(放行给 NavLink),高于才起拖。
  // 键盘传感器让手柄可 Tab 聚焦后用方向键排序 —— 不这么做,排序功能对
  // 键盘/读屏用户就是不可达的(本仓无障碍口径不允许"只有鼠标能用"的功能)。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const itemIndex = React.useMemo(() => {
    const map = new Map<string, number>()
    customItems.forEach((item, i) => map.set(item.href, i))
    return map
  }, [customItems])

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const from = itemIndex.get(String(active.id))
      const to = itemIndex.get(String(over.id))
      if (from === undefined || to === undefined) return
      reorderHref(from, to)
    },
    [itemIndex, reorderHref],
  )

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

  // 折叠态:36×36 的 + 按钮 + 已添加项的纯图标入口(不显示分组标题,也不开拖拽)
  if (collapsed) {
    return (
      <div className="pt-2">
        <Tooltip content={t('customAddTitle')} side="right">
          <button
            type="button"
            onClick={openDialog}
            aria-label={t('customAddTitle')}
            data-testid="nav-custom-add"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-sidebar-item-hover-bg hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-5 w-5 shrink-0" />
          </button>
        </Tooltip>
        <div className="flex flex-col gap-0.5">
          {customItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed
              active={isHrefActive(item.href, pathname)}
              label={item.dynamicLabel ?? t(item.labelKey)}
              onCloseMobile={onCloseMobile}
              registerRef={registerRef}
              onBeforeNav={onBeforeNav}
            />
          ))}
        </div>
        {dialog}
      </div>
    )
  }

  // 展开态:标题行(标签 + 右侧 + 号)+ 可拖拽排序的自定义项列表 / 空态引导
  return (
    <div className="pt-2">
      {/* 标题行字号/内边距对齐紧邻的「热门」等可折叠分组标题(text-sm、pb/pt-1.5);
          此前 text-xs 比所有邻居弱一档,视觉上像另一层东西。
          + 号按钮 24×24:20×20 低于 WCAG 2.5.8 最小目标尺寸,手指/鼠标都更难点中。 */}
      <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-1.5">
        <span className="min-w-0 whitespace-nowrap text-left text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t('customGroup')}
        </span>
        <button
          type="button"
          onClick={openDialog}
          aria-label={t('customAddTitle')}
          title={t('customAddTitle')}
          data-testid="nav-custom-add"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-sidebar-item-hover-bg hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {customItems.length === 0 ? (
        <button
          type="button"
          onClick={openDialog}
          className={cn(
            'flex h-9 w-full min-w-0 items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-medium leading-none whitespace-nowrap transition-colors',
            'text-muted-foreground/60 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span className="min-w-0 whitespace-nowrap text-left">{t('customEmptyHint')}</span>
        </button>
      ) : (
        <DndContext
          // 显式 id:不传时 dnd-kit 用 useId 生成,SSR/CSR 两侧不一致会触发
          // hydration 警告(本仓对 hydration 一致性零容忍)。
          id="sidebar-custom-nav-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={customItems.map((i) => i.href)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-0.5">
              {customItems.map((item) => (
                <SortableCustomItem
                  key={item.href}
                  item={item}
                  label={item.dynamicLabel ?? t(item.labelKey)}
                  active={isHrefActive(item.href, pathname)}
                  collapsed={collapsed}
                  onCloseMobile={onCloseMobile}
                  registerRef={registerRef}
                  onBeforeNav={onBeforeNav}
                  onRemove={removeHref}
                  removeLabel={t('customRemove')}
                  dragLabel={t('customDragHint')}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {dialog}
    </div>
  )
})

export { CustomNavSection }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
