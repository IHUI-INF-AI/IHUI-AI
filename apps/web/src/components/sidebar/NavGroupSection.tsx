// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Flame } from 'lucide-react'
import { NavLink } from './NavLink'
import { ExpandableNavItem } from './ExpandableNavItem'
import type { NavItem, RegisterRef } from './types'

/**
 * 折叠动画时长(G-815942 立):档位与卸载延时是同一件事的两个投影,所以只许这一份定义 ——
 * className 里的 `duration-200` 与 setTimeout 的毫秒数必须同值,改档位只改这两行。
 * 为什么卸载要等满时长:`grid-rows-[0fr]` + 内层 `overflow-hidden` **只裁高度**,内容始终挂载,
 * 于是键盘 Tab 会走进视觉上已经收起的链接(用户看不见焦点在哪)。上游同款技法
 * (`packages/ui/src/workspace-grouped-tasks/group-item.tsx`)的口径是"收起动画跑完之后才卸载组内内容" ——
 * 立刻卸载会把动画做没(内容瞬间消失),一直挂载就是本票的病灶,所以两条都不许。
 */
const COLLAPSE_DURATION_CLASS = 'duration-200'
const COLLAPSE_UNMOUNT_DELAY_MS = 200

/**
 * 顶级分组渲染器(2026-07-20 立):支持分组级别的展开/折叠。
 *
 * 业务诉求:AI教育 / 内容 / 交易 / 个人 / 管理 等次要分类默认折叠(只显示分组标题),
 * 仅 "AI" 核心分类默认展开,降低视觉噪音。点击分组标题切换。
 *
 * 行为细则:
 *  - 折叠态(collapsed=true):沿用旧行为(不显示 label,所有 items 直接铺开),
 *    因为折叠态下分组标题本就不渲染,无法承载点击切换。
 *  - 无 label 分组(首页):不参与折叠,沿用旧行为(items 直接铺开)。
 *  - 有 label 分组(展开态):
 *      · 默认值:label === 'AI' → true,其他 → false
 *      · hydration 后真实状态优先级:命中当前路由 > localStorage > 默认值
 *      · localStorage 持久化用户切换结果,跨会话保留偏好
 *  - SSR 安全:初始 open 固定 false(hydration 一致),真实状态由 useEffect 注入,
 *    避免与 ExpandableNavItem 同型的 hydration mismatch。
 *  - 折叠的可访问性(G-815942):收起动画跑完(COLLAPSE_UNMOUNT_DELAY_MS)后组内 items 整体卸载,
 *    键盘 Tab 因此不会走进已收起、看不见的链接;header 的 aria-controls 与内容容器的 id
 *    由同一个 useId() 配对。展开时立刻渲染,不等动画。
 */
interface NavGroupSectionProps {
  group: { label: string; items: NavItem[] }
  collapsed: boolean
  /** 当前活跃路由 href，由父级 Sidebar 通过 useMemo 预计算。
   *  替换 pathname 传递，避免每次路由变化时全部 NavGroupSection 重渲染。
   *  NavGroupSection 只在其 activeHref 匹配本组某项时才重渲染。 */
  activeHref: string | undefined
  onCloseMobile: () => void
  registerRef: RegisterRef
  t: (key: string) => string
  scope: 'desktop' | 'mobile'
  isFirst: boolean
  /** 点击导航时立即更新 active 状态不等导航完成 */
  onBeforeNav?: (href: string) => void
}

const NavGroupSection = React.memo(function NavGroupSection({
  group,
  collapsed,
  activeHref,
  onCloseMobile,
  registerRef,
  t,
  scope,
  isFirst,
  onBeforeNav,
}: NavGroupSectionProps) {
  // 分组是否参与折叠:展开态 + 有 label
  const isCollapsible = !collapsed && group.label !== ''
  // 分组标题:i18n 解析(group.label 是 nav namespace 下的 key,如 'adminGroup' / 'AI')
  const groupLabel = group.label ? t(group.label) : group.label
  // 默认展开的分组(2026-07-20 立):
  //   - AI:核心分类,所有用户高频入口
  //   - 管理:admin 用户的核心入口(非 admin 用户此分组被 visibleGroups 过滤掉,此设置不影响)
  // 其余分组(AI教育/内容/交易/个人)默认折叠,降低视觉噪音。
  const defaultOpen =
    group.label === 'hotGroupLabel' ||
    group.label === 'aiGroupLabel' ||
    group.label === 'adminGroupLabel'
  // v3 后缀:版本化 key。重要:旧实现用 useEffect 在 open 变化时写 localStorage,
  // 导致首次挂载 setOpen(defaultOpen) 触发写入,污染了测试环境的 localStorage。
  // 新实现只在用户主动 toggle 时写,首次挂载只读不写,因此 localStorage 在用户切换前保持空,
  // 默认值才能可靠生效。v3 key 同时让 v2 旧测试残留失效。
  const storageKey = `sidebar-group-v3-${group.label}`

  // 命中当前路由 → 强制展开(用户在用该分组的某个页面时,不应被折叠隐藏)
  // 性能修复:使用预计算的 activeHref 替代 pathname，避免每次路由变化遍历所有子项。
  const groupActive = activeHref
    ? group.items.some(
        (item) => item.href === activeHref || item.children?.some((c) => c.href === activeHref),
      )
    : false

  // hydration-safe 持久化展开(2026-08-28 根因修复):
  // 旧实现(2026-07-22)用 useState lazy initializer 读 localStorage,看似"首帧即持久化值",
  // 实际是 hydration 陷阱:SSR HTML 固定为 defaultOpen(如 eduGroup 折叠),
  // client hydration 时 React 对不一致的属性只警告不 patch(suppressHydrationWarning 连警告也压制),
  // 且后续 re-render diff 的是 client vdom(已是 open=true),DOM 永远停留在服务端折叠版本——
  // 用户持久化的展开偏好在首屏永不生效。
  // 正确方案:首帧(hydration)用 defaultOpen,与 SSR HTML 完全一致;
  // mount 后 effect 读取持久化值 setOpen → 真实 state 变化 → React diff defaultOpen→stored,DOM 被正确 patch。
  // - 默认展开分组(hot/AI/admin):defaultOpen=true 即持久化意图,首帧无过渡无闪烁(保留 2026-07-22 收益)
  // - 持久化展开的非默认分组:mount 后一次 0fr→1fr 过渡,属于持久化状态恢复的正确行为
  // - 本 effect 只读不写,不复发 2026-07-20 的"mount 时写 localStorage 污染测试环境"问题
  const [open, setOpen] = React.useState(defaultOpen)

  // 折叠后内容的挂载状态(G-815942):收起动画跑完才卸载,展开时立刻渲染。
  // 首帧取 !open —— 与 SSR 首帧(固定 defaultOpen)同形,不产生 hydration mismatch;
  // 卸载/回退时由 cleanup 清掉定时器,所以 StrictMode 双跑 effect 也不会提前卸载或泄漏。
  const contentId = React.useId()
  const [contentMounted, setContentMounted] = React.useState(() => !open)
  React.useEffect(() => {
    if (open) {
      setContentMounted(true)
      return undefined
    }
    const timer = window.setTimeout(() => setContentMounted(false), COLLAPSE_UNMOUNT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  // mount 后同步 localStorage 持久化值(见上方注释)
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored === '1') setOpen(true)
      else if (stored === '0') setOpen(false)
    } catch {
      // localStorage 不可用(隐私模式等),保持 defaultOpen
    }
  }, [storageKey])

  // 路由切换后,若新路由命中本组,强制展开(覆盖用户上次折叠的偏好)
  React.useEffect(() => {
    if (groupActive) setOpen(true)
  }, [groupActive])

  // 用户主动 toggle:切换 open + 持久化(只此处写 localStorage)
  const handleToggle = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        // localStorage 不可用
      }
      return next
    })
  }, [storageKey])

  // 渲染单个 nav item(三种分支:可展开 / 搜索行 / 普通 Link)
  // label 优先级:dynamicLabel(admin 动态加载的路由名)> t(labelKey)(i18n 翻译)
  // 性能修复:使用 activeHref 替代 pathname 计算 active 状态，减少 isHrefActive 重复遍历。
  const renderItem = (item: NavItem) => {
    const active = activeHref === item.href
    const label = item.dynamicLabel ?? t(item.labelKey)
    if (item.children && item.children.length > 0) {
      return (
        <ExpandableNavItem
          key={item.href}
          item={item}
          collapsed={collapsed}
          activeHref={activeHref}
          onCloseMobile={onCloseMobile}
          registerRef={registerRef}
          t={t}
          scope={scope}
        />
      )
    }
    return (
      <NavLink
        key={item.href}
        item={item}
        collapsed={collapsed}
        active={active}
        label={label}
        onCloseMobile={onCloseMobile}
        registerRef={registerRef}
        onBeforeNav={onBeforeNav}
      />
    )
  }

  // 不参与折叠:沿用旧行为(折叠态或无 label 分组)
  if (!isCollapsible) {
    return (
      <div className={isFirst ? '' : 'pt-2'}>
        {!collapsed && group.label && (
          <div className="px-2.5 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {groupLabel}
          </div>
        )}
        {group.items.map(renderItem)}
      </div>
    )
  }

  // 可折叠分组(展开态 + 有 label)
  return (
    <div className={isFirst ? '' : 'pt-2'}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={groupLabel}
        data-testid={`nav-group-${group.label}-toggle`}
        className="group/grp flex w-full items-center gap-1.5 px-2.5 pb-1.5 pt-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        {group.label === 'hotGroupLabel' ? (
          <>
            <span className="min-w-0 whitespace-nowrap text-left text-red-600 transition-colors group-hover/grp:text-red-700 dark:text-red-400 dark:group-hover/grp:text-red-300">
              {groupLabel}
            </span>
            <Flame
              className="h-4 w-4 shrink-0 text-orange-500 transition-colors group-hover/grp:text-orange-600 dark:text-orange-400 dark:group-hover/grp:text-orange-300"
              aria-hidden="true"
            />
          </>
        ) : (
          <span className="min-w-0 whitespace-nowrap text-left">{groupLabel}</span>
        )}
        <ChevronDown
          className={cn(
            'ml-auto h-4 w-4 shrink-0 transition-transform',
            COLLAPSE_DURATION_CLASS,
            !open && '-rotate-90',
          )}
          aria-hidden="true"
        />
      </button>
      {/*
        分组折叠动画(2026-07-20 立):用 CSS grid-template-rows 0fr↔1fr 现代方案。
        优势 vs max-height:
          - 内容自适应高度,无需设固定 max-height 值(避免内容少时"快进-慢停")
          - transition-[grid-template-rows] 浏览器原生支持,流畅无抖动
        实现:外层 grid 容器过渡 rows,内层 overflow-hidden 裁剪 0fr 时的内容。
        折叠态(grid-rows-[0fr]):内容高度 0,被 overflow-hidden 裁剪不可见。
        展开态(grid-rows-[1fr]):内容高度自适应,可见。
        G-815942 补:裁剪只解决"看不见",不解决"摸得着" —— 收起动画跑完后内容整体卸载,
        于是组内链接撤出 Tab 序;卸载后不留 visibility/opacity 假隐藏(那只是把问题藏起来)。
        header 与本容器由同一个 useId 配对(aria-controls ↔ id),屏幕阅读器能跟着折叠状态走。
      */}
      <div
        id={contentId}
        className={cn(
          'grid transition-[grid-template-rows]',
          COLLAPSE_DURATION_CLASS,
          'ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          {contentMounted ? (
            <div className="flex flex-col gap-0.5">{group.items.map(renderItem)}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
})

export { NavGroupSection }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
