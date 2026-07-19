'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X, ChevronDown, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTagsViewStore, type TagItem } from '@/stores/tags-view'
import { Dropdown } from '@/components/feedback'
import { resolvePathLabelSpec } from '@/lib/path-labels'

/**
 * 兜底标题:取 URL 最后一段。
 * 仅当 resolvePathLabelSpec 未命中(路由未在 path-labels.ts 注册)时使用。
 */
function deriveTitle(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  const seg = pathname.split('/').filter(Boolean).pop() ?? pathname
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
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

export function TagsView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  // 通过 useTranslations 获取各命名空间翻译函数。
  // 关键设计:TagsView 在每次渲染时根据 tag.path + 当前 locale 派生标签标题,
  // 因此语言切换会自动触发重渲染,所有已存在标签立即重新翻译,无需刷新。
  const tCommon = useTranslations('common')
  // 各页面命名空间按需懒加载(useTranslations 接受动态 ns),覆盖 EXTRA_PATH_LABELS 中
  // 指向独立页面命名空间的项(如 about/articles/workflows 等)。
  const tags = useTagsViewStore((s) => s.tags)
  const activePath = useTagsViewStore((s) => s.activePath)
  const addTag = useTagsViewStore((s) => s.addTag)
  const removeTag = useTagsViewStore((s) => s.removeTag)
  const closeOther = useTagsViewStore((s) => s.closeOther)
  const closeAll = useTagsViewStore((s) => s.closeAll)
  const reorderTags = useTagsViewStore((s) => s.reorderTags)
  // 订阅 dirtyPaths(Set 引用变化时触发重渲染);各标签用 dirtyPaths.has(path) 判定 dirty
  const dirtyPaths = useTagsViewStore((s) => s.dirtyPaths)

  // 按 ns 分组缓存 useTranslations 实例。
  // 注意:useTranslations 必须在组件顶层调用(不能在循环/条件中),
  // 因此先收集所有出现的 ns,再统一调用。
  // 这里采用"声明所有可能用到的 ns"策略,确保 hook 顺序稳定。
  const tNav = useTranslations('nav')
  const tAdmin = useTranslations('admin')
  const tAbout = useTranslations('about')
  const tAgreement = useTranslations('agreement')
  const tAiCareer = useTranslations('aiCareer')
  const tApiTest = useTranslations('apiTest')
  const tArticles = useTranslations('articles')
  const tBiDashboard = useTranslations('biDashboard')
  const tBusinessCard = useTranslations('businessCard')
  const tChat = useTranslations('chat')
  const tDesignSystem = useTranslations('designSystem')
  const tFeatureCenter = useTranslations('featureCenter')
  const tInvitations = useTranslations('invitations')
  const tN8nAgents = useTranslations('n8nAgents')
  const tRanking = useTranslations('ranking')
  const tRefund = useTranslations('refund')
  const tSecurityAudit = useTranslations('securityAudit')
  const tShare = useTranslations('share')
  const tTokenValue = useTranslations('tokenValue')
  const tTools = useTranslations('tools')
  const tWorkflows = useTranslations('workflows')

  /** ns → useTranslations 实例的查找表(供 resolveTitle 使用) */
  const nsTranslators = React.useMemo<Record<string, (key: string) => string>>(
    () => ({
      nav: tNav,
      admin: tAdmin,
      about: tAbout,
      agreement: tAgreement,
      aiCareer: tAiCareer,
      apiTest: tApiTest,
      articles: tArticles,
      biDashboard: tBiDashboard,
      businessCard: tBusinessCard,
      chat: tChat,
      designSystem: tDesignSystem,
      featureCenter: tFeatureCenter,
      invitations: tInvitations,
      n8nAgents: tN8nAgents,
      ranking: tRanking,
      refund: tRefund,
      securityAudit: tSecurityAudit,
      share: tShare,
      tokenValue: tTokenValue,
      tools: tTools,
      workflows: tWorkflows,
    }),
    [
      tNav,
      tAdmin,
      tAbout,
      tAgreement,
      tAiCareer,
      tApiTest,
      tArticles,
      tBiDashboard,
      tBusinessCard,
      tChat,
      tDesignSystem,
      tFeatureCenter,
      tInvitations,
      tN8nAgents,
      tRanking,
      tRefund,
      tSecurityAudit,
      tShare,
      tTokenValue,
      tTools,
      tWorkflows,
    ],
  )

  /** 根据 path 派生标签标题(渲染时实时计算,语言切换自动更新) */
  const resolveTitle = React.useCallback(
    (p: string): string => {
      const spec = resolvePathLabelSpec(p)
      if (spec) {
        const t = nsTranslators[spec.ns]
        if (t) {
          try {
            return t(spec.key)
          } catch {
            // 翻译键缺失时回退到 deriveTitle
          }
        }
      }
      return deriveTitle(p)
    },
    [nsTranslators],
  )

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

  if (tags.length === 0) return null

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
    <div className="mx-2 mt-2 flex h-9 items-center gap-1 rounded-lg bg-muted/70 px-2 dark:bg-white/[0.07]">
      <div className="thin_scroll flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
        {tags.map((tag, index) => {
          const active = tag.path === activePath
          const draggable = !active
          const isOver = overIndex === index && dragIndex !== null
          const isDirty = dirtyPaths.has(tag.path)
          // 派生式标题:每次渲染根据 path + 当前 locale 实时计算
          const title = resolveTitle(tag.path)
          return (
            // 标签宽度契约:右侧 = gap-1 (4px) + X (w-5=20px) + pr-1 (4px) = 28px
            // 左侧 pl-7 (28px) 与右侧对称,文字几何居中
            // X 宽度若调整,需同步修改 pl 值(每 ±4px X 宽度 → ±4px pl)
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
                'group inline-flex h-7 shrink-0 items-center gap-1 rounded-md border py-0 pl-7 pr-1 text-xs leading-none transition-colors',
                active
                  ? 'border-primary/30 bg-primary/10 font-medium text-primary'
                  : 'border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                // 拖拽中视觉:目标位透明,源项半透明,其它项降不透明
                dragIndex !== null &&
                  (isOver
                    ? 'border-dashed border-primary/50 opacity-50'
                    : dragIndex === index
                      ? 'opacity-40'
                      : 'opacity-100'),
                draggable && 'cursor-grab active:cursor-grabbing',
              )}
            >
              <span className="leading-none">{title}</span>
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
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-opacity duration-150',
                  'hover:bg-destructive/10 hover:text-destructive',
                  // 默认 hidden hover 显示;减少动画偏好的用户始终可见 60% 不透明
                  'opacity-0 group-hover:opacity-100 motion-reduce:opacity-60',
                  // 键盘焦点态:补齐 a11y,让 Tab 用户能看到关闭按钮
                  'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                aria-label={tCommon('close')}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </Link>
          )
        })}
      </div>
      {tags.length > 0 && (
        <Dropdown
          align="end"
          items={[
            {
              key: 'other',
              label: tCommon('closeOther'),
              onSelect: () => closeOther(activePath ?? ''),
            },
            { key: 'all', label: tCommon('closeAll'), onSelect: () => closeAll() },
          ]}
          trigger={
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={tCommon('moreActions')}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          }
        />
      )}
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
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeOther(ctxMenu.path)
              setCtxMenu(null)
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
          >
            <XCircle className="h-4 w-4" />
            {tCommon('closeOther')}
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

export default TagsView
