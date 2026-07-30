'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X, ChevronDown, XCircle, Search, Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTagsViewStore, type TagItem } from '@/stores/tags-view'
import { Dropdown } from '@/components/feedback'
import { SearchBar } from '@/components/business'
import { resolvePathLabelSpec } from '@/lib/path-labels'
import { TOPBAR_BTN_BASE, TOPBAR_BTN_W9 } from '@/lib/nav-styles'

/**
 * 兜底标题:取 URL 最后一段,处理 [id] 占位符 + kebab-case → Title Case。
 * 仅当 resolvePathLabelSpec 未命中(路由未在 path-labels.ts 注册)时使用。
 *
 * 2026-07-28 改进:原版本只 decode URL 段(返回 "questions" 这种无意义单词),
 * 现版本将 kebab-case 转 Title Case("user-agent-audio" → "User Agent Audio"),
 * 让直接 URL 访问的页面也显示有意义的英文标题。
 */
function toTitleCase(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function deriveTitle(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  // 取最后一段(忽略查询参数)
  const seg = pathname.split('/').filter(Boolean).pop() ?? pathname
  // 移除 Next.js 动态路由占位符 [id]/[slug] 等
  const clean = seg.replace(/^\[.+\]$/, 'Detail')
  let decoded = clean
  try {
    decoded = decodeURIComponent(clean)
  } catch {
    /* decode 失败就用 raw */
  }
  // kebab-case → Title Case (user-agent-audio → User Agent Audio)
  return decoded.split('-').map(toTitleCase).join(' ')
}

function buildQuery(search: URLSearchParams | null): Record<string, string> | undefined {
  if (!search) return undefined
  const obj: Record<string, string> = {}
  search.forEach((v, k) => {
    obj[k] = v
  })
  return Object.keys(obj).length ? obj : undefined
}

function buildHref(tag: TagItem): string {
  if (!tag.query) return tag.path
  const sp = new URLSearchParams(tag.query)
  const qs = sp.toString()
  return qs ? `${tag.path}?${qs}` : tag.path
}

interface CtxMenuState {
  x: number
  y: number
  path: string
}

/**
 * 标签栏搜索按钮(2026-07-28 立,从侧边栏 SearchNavItem 迁移):
 * 作为标签栏第一个固定标签,只显示一个搜索图标。点击后通过 portal 将搜索弹层
 * 渲染到右侧工作区(#work-area-portal-root),居中于工作区顶部、向下滑出。
 * 提交后跳 /search?q=...。点击外部 / Esc 键 / 路由变化均会关闭弹层。
 */
export const TagsViewSearchButton = React.memo(function TagsViewSearchButton() {
  const router = useRouter()
  const tNav = useTranslations('nav')
  const tCommon = useTranslations('common')
  const tSearch = useTranslations('search')
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsStr = searchParams?.toString()

  // 2026-07-28 修复(用户反馈"输入内容后没下拉 + Enter 没反应"):
  // 原 TagsViewSearchButton 调用 SearchBar 时只传 onSearch + placeholder,
  // suggestions 和 history 默认 [],导致 SearchBar 内部 showDropdown 永远 false,
  // 下拉永远不显示。补充:
  // - history:从 localStorage 读取历史搜索记录,提交时(onSearch)追加并写回
  // - suggestions:从 i18n 读 search.quickSuggestions,无 key 时降级硬编码 8 个常用项
  // - 提交时 history 去重 + 最多 10 条 + 持久化 localStorage
  const [history, setHistory] = React.useState<string[]>([])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem('searchHistory')
      if (stored) setHistory(JSON.parse(stored))
    } catch {
      /* ignore */
    }
  }, [])

  const suggestions = React.useMemo<string[]>(() => {
    try {
      const arr = tSearch.raw('quickSuggestions') as unknown
      if (Array.isArray(arr)) {
        return (arr as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 8)
      }
    } catch {
      /* ignore */
    }
    return ['设置', '个人资料', '项目', '对话历史', '成员', '工作区', '快捷键', 'AI 模型']
  }, [tSearch])

  // 挂载后查询右侧工作区容器作为 portal 目标(只在客户端执行)
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    setPortalTarget(document.getElementById('work-area-portal-root'))
  }, [])

  // 路由变化(同路径不同 query 也算)时关闭弹层
  React.useEffect(() => {
    setOpen(false)
  }, [pathname, searchParamsStr])

  // Esc 关闭弹层
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 点击外部关闭(需同时检查 trigger 与 dropdown 两个 ref,因为 dropdown 通过 portal 渲染在别处)
  React.useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const handleSearch = (kw: string) => {
    const trimmed = kw.trim()
    if (!trimmed) return
    // 写历史(去重 + 最多 10 条 + 持久化 localStorage)
    const next = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, 10)
    setHistory(next)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('searchHistory', JSON.stringify(next))
      } catch {
        /* ignore */
      }
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    setOpen(false)
  }

  const handleHistoryClick = (kw: string) => {
    handleSearch(kw)
  }

  const handleClearHistory = () => {
    setHistory([])
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('searchHistory')
      } catch {
        /* ignore */
      }
    }
  }

  // 通过 portal 渲染到右侧工作区容器:绝对定位、水平居中(inset-x-0 + mx-auto,避免
  // 与 slide-in-from-top 动画的 transform 冲突)、顶部向下滑出。
  // 工作区容器 overflow-hidden 会裁剪初始 translateY(-100%) 状态,形成从顶部边缘"向下滑出"的视觉效果。
  // 2026-07-28 改动:
  // - 删除内层 p-3 内边距(SearchBar 已合并为单层 div,input 直接占满父容器,p-3 会留白)
  // - 弹窗滑出时叠加 fixed 半透明遮罩(对标 CommandPalette modal 模式),让其他区域稍微暗下去
  //   突出搜索弹窗(用户规则:2026-07-28 立)
  const dropdown =
    open && portalTarget
      ? createPortal(
          <>
            {/* 遮罩层(2026-07-28 立):fixed inset-0 全屏覆盖,半透明 black/40,
                弹窗打开时其他区域稍微暗下去突出搜索弹窗。点击遮罩关闭弹窗。 */}
            <div
              aria-hidden="true"
              data-testid="tagsview-search-overlay"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-popover bg-black/40 animate-in fade-in-0 duration-200"
            />
            <div
              ref={dropdownRef}
              role="dialog"
              aria-label={tCommon('searchPlaceholder')}
              className="absolute inset-x-0 top-2 z-popover mx-auto w-[min(640px,calc(100%-2rem))] animate-in fade-in-0 slide-in-from-top duration-200"
            >
              <div className="rounded-md border bg-popover text-popover-foreground shadow-md">
                <SearchBar
                  onSearch={handleSearch}
                  onHistoryClick={handleHistoryClick}
                  onClearHistory={handleClearHistory}
                  history={history}
                  suggestions={suggestions}
                  placeholder={tCommon('searchPlaceholder')}
                  focusOnMount
                />
              </div>
            </div>
          </>,
          portalTarget,
        )
      : null

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-label={tNav('search')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        // 2026-07-30 第九轮"做减法 v5 根治"(用户反馈"搜索按钮容器不是正方形,没贴最左侧"):
        // - 加 w-9(36px):搜索按钮 36x36 正方形(配合父 h-full=36px 形成完美正方形)
        //   跟 Plus / 窗口控制按钮 w-7(28x36) 视觉上区分:搜索按钮更大更突出,作为主要操作
        // - 顶栏内层 div 已删 pl-4 pr-4,搜索按钮真贴最左侧 x=0(不再被 pl-8=32 挤到中间)
        // - 仍用 TOPBAR_BTN_BASE(layout / 圆角 / transition / focus 行为)共享样式
        // 2026-07-30 用户规则:"应该有背景色设定啊 全局统一 hover时突出"
        //   - 默认 bg + hover 已提到 TOPBAR_BTN_BASE 统一,此处只保留 w-9 宽度差异项
        className={cn(TOPBAR_BTN_BASE, TOPBAR_BTN_W9)}
      >
        <Search className="h-4 w-4" />
      </button>
      {dropdown}
    </>
  )
})

/**
 * 标签栏"更多Actions"按钮(2026-07-30 第十一轮"做减法 v7"用户反馈
 * "把 chevron/Plus 挪到搜索按钮后面 a 标签前面"后抽出独立组件)
 * - 内部独立订阅 tagsview store (tags.length / activePath / closeAll),
 *   tags.length === 0 时不渲染(无 tag 时不显示批量关闭)
 * - 跟 TagsViewSearchButton 平级,放在 GlobalTopBar 内层 flex 的 chevron 位置
 * - 渲染 chevron-down + Dropdown 弹层(复制路径 / 刷新 / closeAll)
 *
 * 2026-07-31 第十三轮做减法:删除 closeOther / closeRight(与 closeAll 语义重叠,
 * 用户规则:"做彻底然后收尾",pin + closeAll 已覆盖所有清理场景)
 */
export const TagsViewChevronButton = React.memo(function TagsViewChevronButton() {
  const tCommon = useTranslations('common')
  const router = useRouter()
  const tags = useTagsViewStore((s) => s.tags)
  const activePath = useTagsViewStore((s) => s.activePath)
  const closeAll = useTagsViewStore((s) => s.closeAll)

  if (tags.length === 0) return null

  return (
    <Dropdown
      align="end"
      items={[
        {
          key: 'copy',
          label: tCommon('copyPath'),
          onSelect: () => {
            // 复制当前 activePath 到剪贴板(SSR 安全:可选链 + catch 吞权限拒绝)
            if (activePath) {
              navigator.clipboard?.writeText(activePath).catch(() => {})
            }
          },
        },
        {
          key: 'refresh',
          label: tCommon('refresh'),
          onSelect: () => router.refresh(),
        },
        // divider 分隔 destructive 项(§4 禁止 hr/divide-y,但 Radix Separator 是组件级分割,合法)
        { key: 'div1', divider: true },
        {
          key: 'all',
          label: tCommon('closeAll'),
          danger: true,
          onSelect: () => closeAll(),
        },
      ]}
      trigger={
        // 2026-07-30 第十轮"做减法 v6"(用户反馈"Plus/chevron-down/窗口控制 按钮应跟搜索按钮一致"):
        // - 改 w-7 → w-9(36px) 跟搜索按钮对齐,4 类按钮全部 36x36 正方形
        // 2026-07-30 用户规则:"应该有背景色设定啊 全局统一 hover时突出"
        //   - 默认 bg + hover 已提到 TOPBAR_BTN_BASE 统一,此处只保留 w-9 宽度
        <button
          type="button"
          className={cn(TOPBAR_BTN_BASE, TOPBAR_BTN_W9)}
          aria-label={tCommon('moreActions')}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      }
    />
  )
})

export function TagsView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  // 性能修复(2026-07-25):原 TagsView 顶层声明 22 个 useTranslations 调用,
  // 每次路由切换 / Sidebar 拖拽 / AI 面板 toggle 触发 TagsView 重渲染时,
  // 22 个 translator 实例全部重新初始化。改为:
  // - 主体只保留 1 个 useTranslations('common')(右键菜单 / 关闭按钮文案)
  // - 每个 tag 的标题翻译下推到 <TagLabel> 子组件,内部只调 1 次 useTranslations
  // - 子组件用 React.memo 浅比较 path prop,避免父组件无关重渲染连锁
  const tCommon = useTranslations('common')
  // 2026-07-28 立:无 tag 时占位文本走 tagsview.empty 命名空间(用户反馈"标签栏卡片文本没做好 i18n")
  const tTagsView = useTranslations('tagsview')
  const tags = useTagsViewStore((s) => s.tags)
  const activePath = useTagsViewStore((s) => s.activePath)
  const addTag = useTagsViewStore((s) => s.addTag)
  const removeTag = useTagsViewStore((s) => s.removeTag)
  const closeAll = useTagsViewStore((s) => s.closeAll)
  const reorderTags = useTagsViewStore((s) => s.reorderTags)
  // 订阅 dirtyPaths(Set 引用变化时触发重渲染);各标签用 dirtyPaths.has(path) 判定 dirty
  const dirtyPaths = useTagsViewStore((s) => s.dirtyPaths)
  // 订阅 pinnedPaths(Chrome 风格 pin 功能,2026-07-31 立)
  const pinnedPaths = useTagsViewStore((s) => s.pinnedPaths)
  const togglePin = useTagsViewStore((s) => s.togglePin)

  // 路由切换:把当前 path 加入标签栏(只存 path+query,标题由渲染时派生)
  React.useEffect(() => {
    if (!pathname) return
    addTag({
      path: pathname,
      query: buildQuery(searchParams),
    })
  }, [pathname, searchParams, addTag])

  // Feature 6: Alt+W 关闭当前 active 标签(Ctrl+W 会被浏览器拦截关闭标签页,故用 Alt+W)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (e.key.toLowerCase() !== 'w') return
      const current = useTagsViewStore.getState().activePath
      if (!current) return
      e.preventDefault()
      removeTag(current)
      const next = useTagsViewStore.getState().activePath
      if (next) router.push(next)
      else router.push('/')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, removeTag])

  const handleClose = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    e.stopPropagation()
    const willNavigate = path === activePath
    removeTag(path)
    if (willNavigate) {
      const next = useTagsViewStore.getState().activePath
      if (next) router.push(next)
      else router.push('/')
    }
  }

  // Feature 3: 右键上下文菜单(自己渲染一个轻量菜单,不引新依赖;若位置溢出则贴 viewport 边缘)
  const [ctxMenu, setCtxMenu] = React.useState<CtxMenuState | null>(null)
  React.useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    // 用 capture 阶段确保任何 click 都能关掉菜单
    document.addEventListener('click', close, true)
    document.addEventListener('contextmenu', close, true)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close, true)
      document.removeEventListener('contextmenu', close, true)
      document.removeEventListener('scroll', close, true)
    }
  }, [ctxMenu])
  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, path })
  }

  // Feature 4: HTML5 拖拽排序(active 标签不可拖,避免误移走当前页)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)
  const onDragStart = (e: React.DragEvent, index: number) => {
    if (tags[index]?.path === activePath) {
      e.preventDefault()
      return
    }
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // 必须 setData 才能在 Firefox 触发 drag
    e.dataTransfer.setData('text/plain', String(index))
  }
  const onDragOver = (e: React.DragEvent, index: number) => {
    if (dragIndex === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overIndex !== index) setOverIndex(index)
  }
  const onDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    reorderTags(dragIndex, index)
    setDragIndex(null)
    setOverIndex(null)
  }
  const onDragEnd = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  // 2026-07-25 用户反馈:即使无 tag 也不返回 null,显示一行 placeholder 占位
  // 填满"右侧工作展示区最上面那块空白区域",不让裸背景露出来。
  // 容器始终存在,内部内容根据 tags.length 切换:
  //   - 有 tags:渲染标签栏 + Dropdown
  //   - 无 tags:渲染一行 "暂无打开的页面" 占位文本 + Dropdown(禁用)

  // ctxMenu 位置越界修正:贴 viewport 边缘(避免菜单出框)
  const menuStyle = ctxMenu
    ? {
        left: Math.min(
          ctxMenu.x,
          typeof window !== 'undefined' ? window.innerWidth - 160 : ctxMenu.x,
        ),
        top: Math.min(
          ctxMenu.y,
          typeof window !== 'undefined' ? window.innerHeight - 140 : ctxMenu.y,
        ),
      }
    : null

  return (
    <div
      data-tagsview
      data-empty={tags.length === 0 ? 'true' : 'false'}
      className="flex h-full min-w-0 flex-1 items-center gap-1"
    >
      <div className="hover-scroll flex h-full flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
        {/* 第十一轮"做减法 v7"(2026-07-30 用户反馈"把 chevron/Plus 挪到搜索按钮后面 a 标签前面"):
            搜索按钮和 chevron 按钮已抽出为 TagsViewSearchButton / TagsViewChevronButton 独立组件,
            移到 GlobalTopBar 内层 flex 直接渲染,本组件只保留 a 标签 + 关闭按钮 (a 标签本身)。
            顺序契约:GlobalTopBar 内部 flex 顺序 = 搜索 → chevron → Plus → 标签栏(TagsView) */}
        {tags.length === 0 ? (
          // 2026-07-25 用户反馈:无 tag 时不返回 null,显示一行 placeholder 占位文本
          // 2026-07-28 立:走 tagsview 命名空间(用户反馈"标签栏卡片文本没做好 i18n"),
          // 翻译 fallback 链:tTagsView('empty') → '暂无打开的页面'
          <span
            data-testid="tagsview-empty"
            className="select-none px-1 text-xs text-muted-foreground/70"
          >
            {tTagsView('empty')}
          </span>
        ) : (
          tags.map((tag, index) => {
            const active = tag.path === activePath
            const isPinned = pinnedPaths.has(tag.path)
            // pinned 标签不可拖拽(Chrome 风格,位置固定在 pinned 区)
            const draggable = !active && !isPinned
            const isOver = overIndex === index && dragIndex !== null
            const isDirty = dirtyPaths.has(tag.path)
            return (
              // 标签宽度契约(2026-07-30 第十一轮"做减法 v8"用户反馈"X 关闭按钮右侧空间也要在左侧复刻"):
              // - 文字到右边缘: gap-1 (4) + X span w-5 (20) + pr-1 (4) = 28px
              //   (X 按钮 + 它的右内边距 = 24px 是"X 关闭按钮占的右侧空间")
              // - 文字到左边缘: pl-6 (24px) — 与 X 关闭按钮+pr 的 24px 对称,文字几何居中
              //   (gap-1 是 X 按钮前的视觉留白,不算"X 关闭按钮占的"空间,对称以 X 视觉边界为准)
              // - 若 X 宽度调整,需同步修改 pl-6 → pl-±N(每 ±4px X 宽度 → ±4px pl)
              <Link
                key={tag.path}
                href={buildHref(tag)}
                draggable={draggable}
                onDragStart={(e) => onDragStart(e, index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDrop={(e) => onDrop(e, index)}
                onDragEnd={onDragEnd}
                onContextMenu={(e) => handleContextMenu(e, tag.path)}
                className={cn(
                  // 2026-07-30 第七轮"做减法 v3 根治":
                  // - 改用共享 TOPBAR_BTN_BASE(layout / 圆角 / transition / focus 行为)
                  // - 真去掉所有 border(第六轮 v2 没做干净,残留 border-primary/30 /
                  //   border-border/40 / border-dashed border-primary/50 / 主类 border)
                  // - active 态靠 bg-primary/10 + font-medium + text-primary 已足够视觉指示
                  // - 拖拽视觉简化:目标位 + 源项共用 opacity-50,无 border-dashed 残留
                  // - pl-6 (24px) 对应 X 关闭按钮 w-5 (20px) + pr-1 (4px) = 24px,
                  //   左右对称,文字几何居中(用户规则 2026-07-30)
                  TOPBAR_BTN_BASE,
                  'group relative cursor-pointer gap-1 pl-6 pr-1 text-xs',
                  active
                    ? 'bg-primary/10 font-medium text-primary'
                    : isPinned
                      // pinned 标签:略亮背景 + 字重加深(Chrome 风格,2026-07-31 立)
                      ? 'bg-muted/70 font-medium text-foreground'
                      : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                  // 拖拽中视觉简化:isOver 给 placeholder 半透明,源项半透明
                  dragIndex !== null && isOver && 'opacity-50',
                  dragIndex === index && 'opacity-40',
                  draggable && 'cursor-grab active:cursor-grabbing',
                )}
              >
                {/* pinned 图钉图标(absolute 左侧,不占文字空间;2026-07-31 Chrome 风格) */}
                {isPinned && (
                  <Pin
                    aria-label={tCommon('pin')}
                    className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 shrink-0 text-primary/70"
                  />
                )}
                {/* 性能修复:TagLabel 子组件内部根据 path 解析到的 ns 只调用 1 次 useTranslations,
                  而非顶层 22 个 translator 全量初始化。React.memo 浅比较 path 避免无关重渲染。 */}
                <TagLabel path={tag.path} />
                {/* Feature 5: 未保存指示点 - 文字左侧小圆点,使用 amber-500 与项目主色区分 */}
                {isDirty && (
                  <span
                    aria-label={tCommon('unsaved')}
                    data-testid="tag-dirty-dot"
                    className="ml-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 motion-reduce:animate-none"
                  />
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleClose(e, tag.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleClose(e as unknown as React.MouseEvent, tag.path)
                    }
                  }}
                  className={cn(
                    'inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground/70 transition-all duration-200 will-change-transform',
                    'hover:bg-destructive/20 hover:text-destructive hover:rotate-90 active:scale-90',
                    // 默认 hidden hover 显示;减少动画偏好的用户始终可见 60% 不透明
                    'opacity-0 group-hover:opacity-100 motion-reduce:opacity-60 motion-reduce:hover:rotate-0 motion-reduce:active:scale-100',
                    // 键盘焦点态:补齐 a11y,让 Tab 用户能看到关闭按钮
                    'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  aria-label={tCommon('close')}
                >
                  <X className="h-4 w-4" />
                </span>
              </Link>
            )
          })
        )}
      </div>
      {/* Feature 3: 右键菜单本体(独立 fixed 定位,避免父容器 transform 影响) */}
      {ctxMenu && (
        <div
          role="menu"
          data-testid="tagsview-context-menu"
          className="fixed z-popover min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={menuStyle ?? undefined}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              handleClose(new MouseEvent('click') as unknown as React.MouseEvent, ctxMenu.path)
              setCtxMenu(null)
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
          >
            <X className="h-4 w-4" />
            {tCommon('close')}
          </button>
          {/* pin/unpin 项(2026-07-31 Chrome 风格,根据当前 pinned 状态切换文案 + 图标) */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              togglePin(ctxMenu.path)
              setCtxMenu(null)
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
          >
            {pinnedPaths.has(ctxMenu.path) ? (
              <PinOff className="h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
            {pinnedPaths.has(ctxMenu.path) ? tCommon('unpin') : tCommon('pin')}
          </button>
          <div className="my-1" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeAll()
              setCtxMenu(null)
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/20 focus:bg-destructive/20 focus:outline-none"
          >
            <XCircle className="h-4 w-4" />
            {tCommon('closeAll')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 单个标签标题渲染器(性能修复 2026-07-25)。
 *
 * 设计:每个 tag 只渲染自己的标题,内部根据 path 解析到的 ns 调用 1 次 useTranslations,
 * 而非旧实现中 TagsView 顶层 22 个 useTranslations 全量初始化。
 *
 * - useTranslations 必须在顶层调用(不能条件),所以 spec 为 null 时也调用 useTranslations('common'),
 *   但实际走 deriveTitle 分支不调用 t()
 * - React.memo 浅比较 path prop,TagsView 父组件无关重渲染时本组件不重渲染
 * - 语言切换时 NextIntlClientProvider context 变化,本组件自动重渲染重新翻译
 */
const TagLabel = React.memo(function TagLabel({ path }: { path: string }) {
  const spec = resolvePathLabelSpec(path)
  // spec 为 null 时也必须无条件调用 useTranslations(React hook 规则)
  const t = useTranslations(spec?.ns ?? 'common')
  if (!spec) return <span className="text-sm leading-none">{deriveTitle(path)}</span>
  // 2026-07-29 根治"标签栏显示 i18n 键名"问题:
  // next-intl 的 t() 在 key 缺失时不会抛错,而是调用 onError 后返回 key 路径字符串
  // (如 "aiChat.title"),导致标签栏直接显示键名。原 try/catch 永远进不去 catch 分支。
  // 改用 t.has() 显式检查 key 是否存在,不存在则回退到 deriveTitle(英文 Title Case 兜底),
  // 至少不泄露键名;后续可由 path-labels.ts 补齐 key 让标签显示正确翻译。
  if (!t.has(spec.key)) {
    return <span className="text-sm leading-none">{deriveTitle(path)}</span>
  }
  return <span className="text-sm leading-none">{t(spec.key)}</span>
})

export default TagsView
