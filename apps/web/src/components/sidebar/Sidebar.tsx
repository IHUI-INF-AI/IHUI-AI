// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useAdminRouters } from '@/hooks/use-admin-routers'
import { useNavigationStore } from '@/stores/navigation'
import { SidebarChatHistory } from '@/components/sidebar-chat-history'
import { ADMIN_NAV_GROUPS } from '@/components/layout/AdminNav'
import { NAV_GROUPS, flattenNavItems, isHrefActive } from './nav-data'
import type { SidebarProps, NavItem, RegisterRef } from './types'
import { SidebarActions } from './SidebarActions'
import { SidebarUserRow } from './SidebarUserRow'
import { NavGroupSection } from './NavGroupSection'
import { SidebarHeader } from './SidebarHeader'
import { SidebarQuickActions } from './SidebarQuickActions'
// 宽度常量保留在 barrel (../sidebar.tsx) 中,供 scripts/check-sidebar-width-consistency.mjs 守门脚本校验;
// 此处从 barrel 读取(与 Sidebar 形成安全的单向常量引用,常量仅在组件渲染期被读取,无模块求值期 TDZ 风险)。
import {
  SIDEBAR_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '../sidebar'

const Sidebar = React.memo(function Sidebar({
  id,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  // 性能修复(2026-09-04 深挖"所有按钮都慢"定位):
  // useTranslations 返回的 t 函数引用不稳定,每次 Sidebar 重渲染都产生新引用 →
  // 传给 React.memo(NavGroupSection/ExpandableNavItem) 时引用变化 → memo 失效 →
  // 80+ 导航项 + Radix Tooltip 组件链全量重渲染(实测 TooltipProvider 283ms + Sidebar 208ms)。
  // 用 useLocale 作为唯一依赖稳定 t 引用:locale 不变时 t 功能等价(同 messages),memo 可正确跳过。
  const locale = useLocale()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- t 功能仅依赖 locale,稳定引用是本次性能修复的核心目的
  const stableT = React.useMemo(() => t, [locale])
  const pathname = usePathname()
  // 性能修复(2026-07-25):仅订阅 user.roleId 单字段,而非整个 user 对象。
  // 原全对象订阅导致任何 setUser(登录/profile 刷新/auth bootstrap/persist hydration)
  // 都触发 Sidebar 根重渲染 → 80+ NavLink/ExpandableNavItem/NavGroupSection 连锁。
  const userRoleId = useAuthStore((s) => s.user?.roleId)

  // 乐观路由状态(2026-08-05 立):
  // 根因:usePathname() 在 Next.js 16 中不随点击立即更新,而是等导航完成(新页面 RSC 数据返回)后才变。
  // 这导致用户点击侧边栏菜单后,active 状态不立即变化,用户感知不到"已响应点击"。
  // 方案:点击链接时立即设置 pendingHref,activeHref 基于 pendingHref 计算,
  //      导航完成后用 useEffect 检测 pathname 与 pendingHref 一致时清空。
  // 效果:用户点击菜单 → 侧边栏 active 状态立即更新 → 页面加载中 → 新页面出现
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)

  // 显示用 pathname:有 pendingHref 且与真实 pathname 不一致时用 pendingHref,
  // 让 activeHref 在导航完成前就指向新路由。
  const displayPathname = pendingHref ?? pathname

  // 导航完成后清空 pendingHref
  React.useEffect(() => {
    if (pendingHref && pendingHref === pathname) {
      setPendingHref(null)
    }
  }, [pathname, pendingHref])

  // 预取策略(2026-09-04 修正:恢复生产预取,只删过度预热):
  // next 16.3.4 升级后 Turbopack 编译已快到 17~49ms,专为"对抗 3-5s 冷编译"设计的
  // dev fetch(RSC) 预热 worker 与"挂载即全量预取 184 条"已无必要,反而:
  //   · 撑大 Turbopack 缓存(曾 24~40GB 膨胀)+ 拖累 LCP
  //   · dev 预热 worker 并发抢发请求,与点击竞争带宽
  // 故移除 Sidebar 层主动预热。但**保留 Next 原生预取**——实测生产模式悬停预取后
  // 点击 314ms→143ms(prefetchRsc 缓存命中),这是"立马响应"的关键:
  //   · <Link> 默认视口预取(NavLink/ExpandableNavItem 不设 prefetch={false})
  //   · NavLink onPointerEnter/onFocus → router.prefetch(悬停按需,精准幂等)
  // dev 模式 cache-bypass 使预取缓存失效(点击仍走 RSC 往返,~350-850ms 为 Next dev 架构下限),
  // 但预取请求由 Next 内部去重,不构成额外负担。
  const startNav = useNavigationStore((s) => s.start)

  // 点击导航项时立即设置乐观路由 + 触发全局进度条。
  // 2026-09-02 修复:点击当前已激活页面时直接跳过 — Next 会拒绝相同导航(pathname 不变),
  // end() 永远不会被 NavigationProgress 的 pathname 变化检测触发,pending 只能等兜底
  // 定时器(原 10s),骨架屏遮住真实内容整整 10 秒。
  const handleBeforeNav = React.useCallback(
    (href: string) => {
      if (href === pathname) return
      setPendingHref(href)
      startNav()
    },
    [startNav, pathname],
  )

  // 稳定引用 registerRef(2026-08-05 深度修复):
  // 原定义在 navContent 内部 → 每次 Sidebar 渲染创建新函数引用 →
  // 传递给 NavGroupSection(React.memo) 时引用变化导致 memo 失效,所有分组重渲染。
  // 使用 useCallback + 空依赖确保引用稳定,让 NavGroupSection 的 memo 比较生效。
  const registerRef = React.useCallback<RegisterRef>((href, el) => {
    if (el) itemRefs.current.set(href, el)
    else itemRefs.current.delete(href)
  }, [])
  const isAdmin = (userRoleId ?? 0) >= 1
  // admin 动态路由:仅 admin 用户拉取,合并到"管理"分组 items 前部(过滤掉已分组的项)
  const { list: adminDynamicList, loaded: adminLoaded } = useAdminRouters()

  const navRef = React.useRef<HTMLElement>(null)
  const mobileNavRef = React.useRef<HTMLElement>(null)
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map())

  // 移动抽屉懒挂载(2026-09-02 P2 首屏 HTML 体积优化):
  // 原实现:移动抽屉 <aside> 常驻 DOM,仅靠 -translate-x-full 移出屏幕。
  //   SSR 阶段无媒体查询生效 → 桌面 + 移动两套完整导航同时输出,
  //   290 个内联 SVG 图标 + Tailwind class 字符串双份(~120KB 冗余)。
  // 现实现:首次打开前不挂载(SSR/首屏零移动导航开销,桌面端 ≥1024px 永不打开则永不挂载);
  //   首次打开先以 -translate-x-full 挂载,下一帧再置 mobileEntered,
  //   让 CSS transition 播放滑入动画;此后保持挂载,开合动画与旧实现一致。
  const [mobileMounted, setMobileMounted] = React.useState(false)
  const [mobileEntered, setMobileEntered] = React.useState(false)

  // 挂载闩:首次打开前不挂载,首次打开后保持挂载(供后续开合动画)
  React.useEffect(() => {
    if (mobileOpen && !mobileMounted) setMobileMounted(true)
  }, [mobileOpen, mobileMounted])

  // 滑入位:挂载后经一帧再置 0,保证浏览器先绘制 -translate-x-full 帧,
  // CSS transition 才有起始值可播放滑入动画(直接同帧置 0 会闪现无动画)。
  React.useEffect(() => {
    if (!mobileOpen) {
      setMobileEntered(false) // 关闭:滑出(-translate-x-full)
      return
    }
    if (!mobileMounted) return // 等挂载帧
    const raf = requestAnimationFrame(() => setMobileEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [mobileOpen, mobileMounted])

  // 桌面端展开态拖拽调整宽度(160-180px,2026-08-01 最小宽度从 130 加大到 160),localStorage 持久化。
  // 2026-07-22 修复首屏 width 闪烁(2026-08-01 修订,根治残留闪烁):
  // - layout.tsx inline script 在 React hydrate 前同步预设 :root --sidebar-width CSS 变量
  //   (读 localStorage sidebar-width,范围 160-180,fallback 160px),首帧 aside width = 预设值。
  // - aside 元素 width 用 `var(--sidebar-width, 160px)` 字符串引用(SSR/CSR 字节级一致),
  //   React 不解析 CSS 变量,只比较 style 字符串,无 hydration mismatch 警告。
  // - useEffect 首次 mount 只读 localStorage 同步 sidebarWidth state,不覆盖 inline script 预设的
  //   CSS 变量(避免 160→localStorage 值的跳变);state 变化触发 effect 重新执行时才设 CSS 变量。
  // - 拖拽时 setSidebarWidth + useEffect 同步 CSS 变量保留(运行时宽度变化仍平滑过渡)。
  const [sidebarWidth, setSidebarWidth] = React.useState(SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = React.useState(false)

  // 桌面 / 移动两个 <nav> 必须有不同 id(避免 DOM 重复 id + a11y 工具误判)。
  // 派生自父级传入的 id,SSR/CSR 完全一致,杜绝 useId 漂移导致的 hydration mismatch。
  const desktopNavId = id ? `${id}-desktop` : 'sidebar-nav-desktop'
  const mobileNavId = id ? `${id}-mobile` : 'sidebar-nav-mobile'

  // 首次 render 标志:首次 effect 只读 localStorage 同步 state,不覆盖 inline script 预设的 CSS 变量。
  // 根因:layout.tsx inline script 已在 hydrate 前预设 --sidebar-width(读 localStorage 或 fallback 160px),
  // 若首次 effect 直接用 sidebarWidth state(SIDEBAR_WIDTH=160)覆盖 CSS 变量,当 localStorage 有非 160 值时
  // 会触发"inline script 值 → state 值"跳变。首次跳过 setProperty,state 变化触发 effect 重新执行时才同步。
  const isFirstRender = React.useRef(true)

  // 同步当前实际宽度(折叠态用 60px,展开态用 sidebarWidth)到 :root 的 --sidebar-width CSS 变量,
  // 供 AISidePanel 等 fixed 定位组件通过 left: var(--sidebar-width) 紧贴 Sidebar 右侧。
  // 2026-08-01 升级:首次 mount 读 localStorage 同步 state(不设 CSS 变量),根治首屏宽度闪烁。
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      // 首次 mount:读 localStorage 同步 sidebarWidth state。
      // CSS 变量已由 layout.tsx inline script 预设(读 localStorage sidebar-width, fallback 160px),
      // 这里不设 CSS 变量,避免覆盖 inline script 预设值;state 变化会触发 effect 重新执行。
      try {
        const saved = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
        if (saved) {
          const n = Number(saved)
          if (Number.isFinite(n) && n >= SIDEBAR_MIN_WIDTH && n <= SIDEBAR_MAX_WIDTH) {
            setSidebarWidth(n)
            return // state 变化触发 effect 重新执行,届时设 CSS 变量
          }
        }
      } catch {
        // localStorage 不可用
      }
      // localStorage 无有效值,设 CSS 变量 = 默认值(与 inline script fallback 一致)
      const effectiveDefault = collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth
      document.documentElement.style.setProperty('--sidebar-width', `${effectiveDefault}px`)
      return
    }
    // 非首次:正常同步 state 到 CSS 变量(用户拖拽/折叠变化)
    const effective = collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth
    document.documentElement.style.setProperty('--sidebar-width', `${effective}px`)
  }, [collapsed, sidebarWidth])

  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      // 折叠态下拖拽手柄:先展开再开始 resize,实现"拖拽即展开"
      if (collapsed) {
        onToggleCollapse()
      }
      setIsResizing(true)
      const startX = e.clientX
      const startWidth = sidebarWidth
      let latest = startWidth
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX
        const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta))
        latest = next
        setSidebarWidth(next)
      }
      const onUp = () => {
        setIsResizing(false)
        window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(latest))
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [sidebarWidth, collapsed, onToggleCollapse],
  )

  // admin 动态路由合并:已加载 + 有数据 + admin 用户时,把不在 ADMIN_NAV_GROUPS 分组内的
  // 动态路由作为扁平 NavItem 合并到"管理"分组前部(放在静态 /admin 入口之后)。
  // 静态 /admin/statistics 等保留在前,动态项跟在后面,11 个分组展开项放最后。
  const adminDynamicItems: NavItem[] = React.useMemo(() => {
    if (!isAdmin || !adminLoaded || adminDynamicList.length === 0) return []
    const groupedHrefs = new Set(ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)))
    return adminDynamicList
      .filter((r) => r.visible !== 0 && r.path && !groupedHrefs.has(r.path))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((r) => ({
        href: r.path,
        labelKey: 'adminDynamic',
        icon: LayoutDashboard,
        adminOnly: true,
        dynamicLabel: r.name,
      }))
  }, [isAdmin, adminLoaded, adminDynamicList])

  // adminOnly 递归过滤(2026-08-30 修复):原逻辑只过滤分组一级 items,不递归过滤 item.children,
  // adminOnly 子项挂在非 adminOnly 父项下时会对普通用户泄漏(此前仅靠 nav-data 配置约定保障)。
  // permission 过滤(2026-08-30 教师角色接入):按 RBAC 权限点放行,admin(roleId>=1)始终可见,
  // 其余用户需持有任一权限码或通配符(与 HasPermi.checkPermission 的匹配规则一致)。
  // permission 支持数组(2026-08-30 权限粒度细化):如 ['edu:manage','edu:view'],任一命中即可见。
  // 仅订阅 user.permissions 单字段(而非整个 user 对象),避免 setUser 触发 Sidebar 全量重渲染。
  const userPermissions = useAuthStore((s) => s.user?.permissions)
  const filterByRole = React.useCallback(
    (items: NavItem[]): NavItem[] =>
      items
        .filter((item) => {
          if (item.adminOnly) return isAdmin
          if (item.permission) {
            if (isAdmin) return true
            if (!userPermissions || userPermissions.length === 0) return false
            if (userPermissions.includes('*:*:*') || userPermissions.includes('*')) {
              return true
            }
            const required = Array.isArray(item.permission) ? item.permission : [item.permission]
            return required.some((p) => userPermissions.includes(p))
          }
          return true
        })
        .map((item) => (item.children ? { ...item, children: filterByRole(item.children) } : item)),
    [isAdmin, userPermissions],
  )

  const visibleGroups = React.useMemo(() => {
    return NAV_GROUPS.map((g) => {
      const filtered = filterByRole(g.items)
      // 合并 admin 动态路由到"管理"分组(items[0] 是 /admin 入口,动态项插在它后面)
      if (g.label === 'adminGroupLabel' && adminDynamicItems.length > 0) {
        const [head, ...rest] = filtered
        return {
          ...g,
          items: head ? [head, ...adminDynamicItems, ...rest] : [...adminDynamicItems, ...rest],
        }
      }
      return { ...g, items: filtered }
    }).filter((g) => g.items.length > 0)
  }, [filterByRole, adminDynamicItems])

  const allVisibleItems = React.useMemo(
    () => flattenNavItems(visibleGroups.flatMap((g) => g.items)),
    [visibleGroups],
  )

  const activeHref = React.useMemo(() => {
    const found = allVisibleItems.find((item) => isHrefActive(item.href, displayPathname))
    return found?.href
  }, [allVisibleItems, displayPathname])

  React.useEffect(() => {
    if (!activeHref) return
    const el = itemRefs.current.get(activeHref)
    if (!el) return
    // 桌面 / 移动两个 nav 选当前 visible 的那个来计算可见区域
    const isMobileVisible = mobileNavRef.current
      ? mobileNavRef.current.getBoundingClientRect().width > 0
      : false
    const nav = isMobileVisible ? mobileNavRef.current : navRef.current
    if (!nav) return
    const navRect = nav.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    if (elRect.top < navRect.top || elRect.bottom > navRect.bottom) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }, [activeHref])

  const navContent = (navId: string, ref: React.Ref<HTMLElement>, scope: 'desktop' | 'mobile') => (
    <nav
      ref={ref}
      id={navId}
      aria-label={t('title')}
      className={cn(
        'hover-scroll min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto py-2',
        // 滚动条已完全隐藏(globals.css .hover-scroll),不占布局空间。
        // px-2 左右各 8px 对称,折叠态 aside border-r(1px)用 pl-[9px] pr-2 补偿图标视觉中心。
        collapsed ? 'pl-[9px] pr-2' : 'px-2',
      )}
    >
      {/* 顶部快捷操作区:新建任务 / 插件市场 / 自动化任务 */}
      <SidebarQuickActions collapsed={collapsed} onCloseMobile={onCloseMobile} />

      {/* 侧边栏任务列表卡片(展开态显示) */}
      <SidebarChatHistory collapsed={collapsed} />

      {visibleGroups.map((group, gi) => (
        <NavGroupSection
          key={group.label || `group-${gi}`}
          group={group}
          collapsed={collapsed}
          activeHref={activeHref}
          onCloseMobile={onCloseMobile}
          registerRef={registerRef}
          t={stableT}
          scope={scope}
          isFirst={gi === 0}
          onBeforeNav={handleBeforeNav}
        />
      ))}
    </nav>
  )

  /**
   * 桌面端 sidebar footer:仅在桌面端可见,移动端(<1024px)隐藏。
   * 移动端桌面 sidebar 被 CSS 强制 60px 宽,但 collapsed prop 可能为 false,
   * 导致 SidebarActions(flex-row 4 按钮溢出)和登录按钮(文字溢出)在 60px 容器中错乱,
   * 溢出内容会遮挡下方按钮,导致移动端不可点击。
   * 移动端 footer 内容由 mobileFooter 在移动 drawer 中提供。
   */
  const desktopFooter = (
    <div className="shrink-0 hidden min-[1024px]:block">
      <SidebarActions collapsed={collapsed} />
      <SidebarUserRow collapsed={collapsed} onCloseMobile={onCloseMobile} />
    </div>
  )

  /** 移动端 drawer footer:始终显示在移动 drawer 中(160px+ 宽,正常布局) */
  const mobileFooter = (
    <div className="shrink-0">
      <SidebarActions collapsed={collapsed} />
      <SidebarUserRow collapsed={collapsed} onCloseMobile={onCloseMobile} />
    </div>
  )

  return (
    <>
      {/* 桌面端固定侧边栏(2026-08-02 改:小尺寸也挂载,纯 CSS 控制显示 60px 图标条)
          - 始终 flex 挂载(不再 hidden min-[1024px]:flex)
          - 小尺寸(<1024px)由 CSS 媒体查询强制 60px 宽 + 隐藏文字 span,只显示图标
            (纯 CSS 无 hydration mismatch,无 JS effect 时序闪烁)
          - collapsed prop 控制用户手动折叠态(持久化 localStorage),与 CSS 互不干扰
          - data-viewport-collapsed 属性供 globals.css 选择器在小尺寸下隐藏文字 span
          - 移动端抽屉 + 汉堡菜单保留作为完整菜单备用入口 */}
      <aside
        // 2026-08-28 修复:把 GlobalShell 传入的 id 渲染到桌面 aside DOM。
        // 此前 id 只用于派生 navId,DOM 中不存在 aside#main-sidebar,
        // e2e icon-text-alignment.spec.ts 选择器命中 0 元素。
        // 移动抽屉 aside(line ~2249)不设 id,保证 DOM id 唯一,
        // 测试可用 aside#main-sidebar 精准锁定桌面侧边栏(避免 strict mode violation)。
        id={id}
        aria-label={t('mainNav')}
        data-viewport-collapsed="true"
        className={cn(
          'relative h-screen shrink-0 flex-col overflow-visible bg-background transition-[width] duration-200 flex z-popover',
          collapsed && 'w-[60px]',
        )}
        // 2026-07-22 修复首屏 width 闪烁:
        // width 改为 `var(--sidebar-width, 160px)` 字符串引用 CSS 变量。
        // - SSR/CSR 字节级一致(都是同一字符串),无 hydration mismatch 警告
        // - 实际渲染 width = layout.tsx inline script 预设的 --sidebar-width 值
        // - 折叠态直接 60px inline 覆盖 CSS 变量(避免与 var() 计算冲突)
        // - 2026-08-01:fallback 160px 跟随 SIDEBAR_WIDTH 默认值同步加大
        style={
          collapsed
            ? { width: SIDEBAR_COLLAPSED_WIDTH }
            : {
                width: 'var(--sidebar-width, 160px)',
                transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
              }
        }
      >
        <SidebarHeader
          variant="desktop"
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
        {navContent(desktopNavId, navRef, 'desktop')}
        {desktopFooter}
        {/* 右侧拖拽手柄:展开/折叠态均显示(折叠态可拖拽展开)。
            外层 w-2(8px)为透明命中区,right-[-4px] 让命中区居中跨越 aside 右边缘(左右各 4px)。
            内层 w-0.5(0.5px)可见细线,left-[calc(50%-0.25px)] -translate-x-1/2 让线居中在命中区中心,正好与 aside 右边缘重合。
            0.5px 线在 2x DPR 高分屏渲染为 1 物理像素,更纤细精致;子像素 calc 避免 1px 线在奇数像素容器中模糊。
            默认 opacity:0 完全隐藏,仅 hover 或拖拽时显现渐变色。 */}
        <div
          onPointerDown={handleResizeStart}
          className="group absolute right-[-4px] top-0 bottom-0 z-20 w-2 cursor-col-resize"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={tc('resize')}
            className={cn(
              'absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line',
              isResizing && 'is-resizing',
            )}
          />
        </div>
      </aside>

      {/* 移动端抽屉遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-modal bg-black/50 min-[1024px]:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* 移动端抽屉 — 2026-07-31 第十五次微调(用户反馈"侧边栏太宽,要跟 web 设定尺寸一样,可以拉伸"):
          - 宽度从 min(85vw, 320px) 改为复用 desktop 共享的 sidebarWidth state (默认 160px = SIDEBAR_WIDTH,
            跟 web 桌面端默认宽度字节级一致),范围 160-180px = SIDEBAR_MIN_WIDTH-SIDEBAR_MAX_WIDTH
          - 复用 desktop handleResizeStart(pointermove/pointerup 兼容触屏,无需额外 touch 事件)
          - 加 resize 手柄(结构跟 desktop 一致:外层 w-2 命中区 + 内层 w-0.5 可见细线)
          - 跟 desktop aside 共享 sidebarWidth state + localStorage 持久化
            (用户在任一端拖过宽度,另一端下次打开自动同步)
          - 仍走 transition-transform 200ms 从左滑出,resize 时 width 200ms 平滑过渡
          - 2026-09-02 P2 优化:mobileMounted 懒挂载(见上),SSR/首屏不含移动导航副本 */}
      {mobileMounted && (
        <aside
          aria-modal="true"
          aria-label={t('mainNav')}
          role="dialog"
          className={cn(
            // 2026-07-31 第十七次微调(用户反馈"底部语言/通知/登录按钮没显示在侧边栏底部"):
            // 改 overflow-y-auto → overflow-hidden,让 nav 自己处理 overflow-y-auto
            // 之前 aside 整体 overflow-y-auto,内容超长时 footer 被推下屏幕外不可见
            // 现在 footer (shrink-0) 固定在底部,nav (flex-1 overflow-y-auto) 独立滚动
            'fixed inset-y-0 left-0 z-modal flex flex-col overflow-hidden bg-background shadow-xl transition-transform duration-200 ease-out min-[1024px]:hidden',
            mobileEntered ? 'translate-x-0' : '-translate-x-full',
          )}
          style={{
            width: sidebarWidth,
            transition: isResizing
              ? 'none'
              : 'width 0.2s cubic-bezier(0.4,0,0.2,1), transform 0.2s ease-out',
          }}
        >
          <SidebarHeader variant="mobile" collapsed={collapsed} onCloseMobile={onCloseMobile} />
          {navContent(mobileNavId, mobileNavRef, 'mobile')}
          {mobileFooter}
          {/* 移动端拖拽手柄(2026-07-31 第十五次新增):复用 desktop 同款结构
            - onPointerDown 兼容鼠标 + 触屏,无需额外 touch event listener
            - 命中区 w-2 (8px),right-[-4px] 跨越 aside 右边缘
            - 内层 w-0.5 可见细线,默认 opacity:0,hover/拖拽时显渐变色
            - 范围自动跟随 SIDEBAR_MIN_WIDTH-SIDEBAR_MAX_WIDTH (130-180),跟 web 统一 */}
          <div
            onPointerDown={handleResizeStart}
            className="group absolute right-[-4px] top-0 bottom-0 z-20 w-2 cursor-col-resize"
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={tc('resize')}
              className={cn(
                'absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line',
                isResizing && 'is-resizing',
              )}
            />
          </div>
        </aside>
      )}
    </>
  )
})

Sidebar.displayName = 'Sidebar'

export { Sidebar }
export default Sidebar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
