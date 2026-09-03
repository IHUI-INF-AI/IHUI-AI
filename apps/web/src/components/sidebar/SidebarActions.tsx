// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useNavigateWithProgress } from '@/stores/navigation'
import { useTranslations } from 'next-intl'
import { Flag, Download, Bell, Sun, Moon, Settings } from 'lucide-react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'
import { TOPBAR_BTN_BASE } from '@/lib/nav-styles'
import { Button } from '@ihui/ui-react'
import { useDownloadTrack } from '@ihui/shared/hooks'
import { useLanguageStore, type Language } from '@/stores/language'
import { useNotificationStore } from '@/stores/notification'
import { useMounted } from '@/hooks/use-mounted'
import { useAnalytics } from '@/hooks/use-analytics'
import { DOWNLOADS, isDownloadAvailable, isExternalDownloadHref } from '@/lib/downloads'
import { Tooltip } from '@/components/feedback'
import { createPortal } from 'react-dom'
import { NotificationCenter, type NoticeItem } from '@/components/feature-center'
import { LANGUAGES } from './nav-data'

/**
 * 侧边栏底部统一工具栏(5 按钮单行):语言 / 下载客户端 / 消息中心 / 主题切换 / 设置。
 * 登录按钮独立到下方 SidebarUserRow(与已登录态同位置)。
 * 130px 默认宽度下单行排开;拉伸到 180px 仍单行;极端窄宽时 flex-wrap 兜底换行。
 */
export function SidebarActions({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('nav')
  const tt = useTranslations('themeToggle')
  const navigate = useNavigateWithProgress()
  const { resolvedTheme, setTheme } = useTheme()
  // hydration-safe: next-themes 的 theme 在 SSR 返回 undefined, 客户端才返回真实值,
  // 直接用 theme 渲染 aria-label/icon 会触发 "深色模式/浅色模式" 不匹配。
  // 未挂载时渲染固定占位 (Moon + "深色模式"), 与 SSR 一致; 挂载后再切到真实态。
  const mounted = useMounted()
  // 必须用 resolvedTheme(已按 OS 解析的真实明暗),而非 theme:
  // 默认 'system' 时 theme==='system'(≠'dark'),用 theme 判断会导致首点设成 'dark'(=当前外观)无变化,需点两下。
  const isDark = mounted && resolvedTheme === 'dark'

  const handleToggleTheme = () => {
    // 底层加固(2026-08-29):以 DOM 真实状态为事实源,而非任何 React/next-themes 状态。
    // 用户点按钮时看到的明暗 = <html> 上的 .dark class,直接取对立面,
    // 彻底消灭 resolvedTheme 为 undefined / 状态滞后等一切时序极端情况。
    const isDarkNow =
      (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ||
      resolvedTheme === 'dark'
    setTheme(isDarkNow ? 'light' : 'dark')
  }

  return (
    <div
      className={cn(
        'flex gap-0.5 rounded-md p-1',
        // 折叠态:aside 的 border-r(1px)使内容区 59px,居中后按钮会偏左 0.5px。
        // 用 pl-[9px] pr-2 补偿,让按钮回到 60px 视觉中心。
        collapsed ? 'flex-col items-center pl-[9px] pr-2' : 'flex-row flex-wrap justify-center',
      )}
    >
      {/* 语言切换 — 自定义 portal,脱离 MainShell overflow-hidden 祖先避免被裁剪 */}
      <LanguageSwitcher collapsed={collapsed} />

      {/* 下载客户端 — 自定义 portal */}
      <DownloadPopover collapsed={collapsed} />

      {/* 消息中心 — 自定义 portal */}
      <MessageCenter collapsed={collapsed} />

      {/* 主题切换 — isDark 来自 useMounted 门控, SSR 永远 false (Moon + "深色模式") */}
      <Tooltip
        content={isDark ? tt('lightMode') : tt('darkMode')}
        side={collapsed ? 'right' : 'top'}
      >
        <Button
          variant="ghost"
          size="icon"
          className={SIDEBAR_BTN_CLASS}
          onClick={handleToggleTheme}
          aria-label={isDark ? tt('lightMode') : tt('darkMode')}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </Tooltip>

      {/* 设置 — 2026-08-14 用户要求"从功能菜单拿出来,放到左侧侧边栏底部明暗切换按钮右侧"
          (原放顶栏 GlobalTopBar 被用户纠正,改放此处;Plus 菜单内设置项已移除) */}
      <Tooltip content={t('settings')} side={collapsed ? 'right' : 'top'}>
        <Button
          variant="ghost"
          size="icon"
          className={SIDEBAR_BTN_CLASS}
          onClick={() => navigate('/settings')}
          aria-label={t('settings')}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </Tooltip>
    </div>
  )
}

// 2026-08-07 升级(用户反馈"图标还是太小,再大点"):
// - 容器 26×26 → 28×28 (h-7 w-7),与侧边栏其他图标按钮(NavLink h-5、折叠按钮 h-5)视觉一致
// - svg 18×18 → 20×20 (h-5 w-5),跟 NavLink / 新建任务 / 折叠按钮的 20px 图标同尺寸
//   ⚠️ 必须用 [&>svg]:!h-5 [&>svg]:!w-5 覆盖 TOPBAR_BTN_BASE 内置的
//   [&>svg]:!h-3.5 [&>svg]:!w-3.5(14px !important)—— 同为 !important,后写胜出
//   (tailwind-merge 识别同 group,后写覆盖前写)。
// - 4×28 + gap(3×2) + padding(2×4) = 126px ≤ 130px 侧边栏最小宽度,单行排开不折行
// 模块级常量:无 collapsed 依赖,所有按钮共用同一套尺寸类。
const SIDEBAR_BTN_CLASS = cn(
  TOPBAR_BTN_BASE,
  'h-7 w-7 p-0 bg-transparent',
  '[&>svg]:!h-5 [&>svg]:!w-5',
)

/** 语言切换(独立子组件:IIFE 内调 Hook 违反 rules-of-hooks,提取为组件后合法) */
function LanguageSwitcher({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('nav')
  const { locale, setLocale } = useLanguageStore()

  const [langOpen, setLangOpen] = React.useState(false)
  const langTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const langPanelRef = React.useRef<HTMLDivElement | null>(null)
  const [langCoords, setLangCoords] = React.useState<{ top: number; left: number } | null>(null)
  const langRafRef = React.useRef<number | null>(null)

  const handleLocaleChange = (code: Language) => {
    if (code === locale) return
    // 2026-07-27:语言切换已修复(客户端 I18nProvider 响应 useLanguageStore.locale)。
    // setLocale 更新 store → I18nProvider 重新渲染 → NextIntlClientProvider 拿到新 locale+messages → UI 切换。
    document.cookie = `locale=${code};path=/;max-age=31536000`
    setLocale(code)
  }

  const updateLangCoords = React.useCallback(() => {
    if (!langTriggerRef.current || !langPanelRef.current) return
    const r = langTriggerRef.current.getBoundingClientRect()
    const panelRect = langPanelRef.current.getBoundingClientRect()
    const gap = 8
    const pad = 8
    const VW = window.innerWidth

    let top: number
    let left = r.left

    if (collapsed) {
      // 折叠态:右侧弹出,底边对齐 trigger 底边
      top = r.bottom - panelRect.height
      left = r.right + gap
    } else {
      // 展开态:上方弹出,水平居中
      top = r.top - gap - panelRect.height
      left = r.left + r.width / 2 - panelRect.width / 2
    }

    if (left + panelRect.width > VW - pad) {
      left = VW - pad - panelRect.width
    }
    left = Math.max(pad, left)

    if (top < pad) {
      top = collapsed ? r.top + gap : r.bottom + gap
    }
    top = Math.max(pad, top)

    setLangCoords({ top, left })
  }, [collapsed])

  React.useLayoutEffect(() => {
    if (!langOpen) return
    const id = window.requestAnimationFrame(() => {
      updateLangCoords()
    })
    return () => window.cancelAnimationFrame(id)
  }, [langOpen, updateLangCoords])

  React.useEffect(() => {
    if (!langOpen) return
    const throttledUpdate = () => {
      if (langRafRef.current !== null) return
      langRafRef.current = requestAnimationFrame(() => {
        langRafRef.current = null
        updateLangCoords()
      })
    }
    window.addEventListener('scroll', throttledUpdate, { capture: true, passive: true })
    window.addEventListener('resize', throttledUpdate, { passive: true })
    return () => {
      if (langRafRef.current !== null) cancelAnimationFrame(langRafRef.current)
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
    }
  }, [langOpen, updateLangCoords])

  React.useEffect(() => {
    if (!langOpen) return
    const handler = (event: MouseEvent | TouchEvent) => {
      const triggerEl = langTriggerRef.current
      const contentEl = langPanelRef.current
      const target = event.target as Node
      if (triggerEl && triggerEl.contains(target)) return
      if (contentEl && contentEl.contains(target)) return
      setLangOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [langOpen])

  React.useEffect(() => {
    if (!langOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [langOpen])

  return (
    <>
      <Tooltip content={t('language')} side={collapsed ? 'right' : 'top'}>
        <Button
          ref={langTriggerRef}
          variant="ghost"
          size="icon"
          className={cn(SIDEBAR_BTN_CLASS, 'p-0')}
          aria-label={t('language')}
          aria-haspopup="menu"
          aria-expanded={langOpen}
          // 2026-09-02 治理:自写 popover trigger 加 data-state,让 globals.css:1090
          // `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制关闭后焦点环常驻。
          data-state={langOpen ? 'open' : 'closed'}
          onClick={() => setLangOpen((prev) => !prev)}
        >
          <Flag className="h-[18px] w-[18px]" />
        </Button>
      </Tooltip>
      {langOpen &&
        createPortal(
          <div
            ref={langPanelRef}
            className="flex w-36 flex-col gap-px rounded-md border bg-popover p-2 text-popover-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={
              langCoords
                ? { top: langCoords.top, left: langCoords.left }
                : { top: -9999, left: -9999 }
            }
            role="menu"
            aria-label={t('language')}
            tabIndex={-1}
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                role="menuitem"
                onClick={() => {
                  handleLocaleChange(lang.code)
                  setLangOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent',
                  locale === lang.code && 'bg-accent font-medium',
                )}
              >
                <span
                  data-lang-code={lang.code}
                  className="flex h-5 w-7 shrink-0 items-center justify-center rounded-sm border border-border text-[10px] font-bold tracking-wide text-foreground"
                >
                  {lang.badge}
                </span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

/** 下载客户端(独立子组件) */
function DownloadPopover({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('nav')
  const { trackClick } = useAnalytics()
  const trackDownload = useDownloadTrack()

  const [dlOpen, setDlOpen] = React.useState(false)
  const dlTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const dlPanelRef = React.useRef<HTMLDivElement | null>(null)
  const [dlCoords, setDlCoords] = React.useState<{ top: number; left: number } | null>(null)
  const dlRafRef = React.useRef<number | null>(null)

  const updateDlCoords = React.useCallback(() => {
    if (!dlTriggerRef.current || !dlPanelRef.current) return
    const r = dlTriggerRef.current.getBoundingClientRect()
    const panelRect = dlPanelRef.current.getBoundingClientRect()
    const gap = 8
    const pad = 8
    const VW = window.innerWidth

    let top = r.bottom - gap - panelRect.height
    let left = r.right + gap

    if (left + panelRect.width > VW - pad) {
      left = VW - pad - panelRect.width
    }
    left = Math.max(pad, left)

    if (top < pad) {
      top = r.bottom + gap
    }
    top = Math.max(pad, top)

    setDlCoords({ top, left })
  }, [])

  React.useLayoutEffect(() => {
    if (!dlOpen) return
    const id = window.requestAnimationFrame(() => {
      updateDlCoords()
    })
    return () => window.cancelAnimationFrame(id)
  }, [dlOpen, updateDlCoords])

  React.useEffect(() => {
    if (!dlOpen) return
    const throttledUpdate = () => {
      if (dlRafRef.current !== null) return
      dlRafRef.current = requestAnimationFrame(() => {
        dlRafRef.current = null
        updateDlCoords()
      })
    }
    window.addEventListener('scroll', throttledUpdate, { capture: true, passive: true })
    window.addEventListener('resize', throttledUpdate, { passive: true })
    return () => {
      if (dlRafRef.current !== null) cancelAnimationFrame(dlRafRef.current)
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
    }
  }, [dlOpen, updateDlCoords])

  React.useEffect(() => {
    if (!dlOpen) return
    const handler = (event: MouseEvent | TouchEvent) => {
      const triggerEl = dlTriggerRef.current
      const contentEl = dlPanelRef.current
      const target = event.target as Node
      if (triggerEl && triggerEl.contains(target)) return
      if (contentEl && contentEl.contains(target)) return
      setDlOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [dlOpen])

  React.useEffect(() => {
    if (!dlOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDlOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dlOpen])

  return (
    <>
      <Tooltip content={t('downloadClient')} side={collapsed ? 'right' : 'top'}>
        <Button
          ref={dlTriggerRef}
          variant="ghost"
          size="icon"
          className={SIDEBAR_BTN_CLASS}
          aria-label={t('downloadClient')}
          aria-haspopup="dialog"
          aria-expanded={dlOpen}
          // 2026-09-02 治理:自写 popover trigger 加 data-state,让 globals.css:1090
          // `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制关闭后焦点环常驻。
          data-state={dlOpen ? 'open' : 'closed'}
          onClick={() => setDlOpen((prev) => !prev)}
        >
          <Download className="h-5 w-5" />
        </Button>
      </Tooltip>
      {dlOpen &&
        createPortal(
          <div
            ref={dlPanelRef}
            className="w-60 rounded-md border bg-popover text-popover-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={
              dlCoords ? { top: dlCoords.top, left: dlCoords.left } : { top: -9999, left: -9999 }
            }
            role="dialog"
            aria-label={t('downloadTitle')}
            aria-modal="true"
            tabIndex={-1}
          >
            <div className="w-60 p-1">
              <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t('downloadTitle')}
              </div>
              {DOWNLOADS.map((item) => {
                const Icon = item.icon
                const isExternal = isExternalDownloadHref(item.href)
                const available = isDownloadAvailable(item.platform)
                const isInternalRoute = available && !isExternal

                const inner = (
                  <>
                    <Icon
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 transition-colors',
                        available
                          ? 'text-foreground/80 group-hover:text-foreground'
                          : 'text-muted-foreground/40',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'truncate font-medium',
                            available ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {t(item.labelKey)}
                        </span>
                        {item.version && available && (
                          <span className="shrink-0 rounded-sm bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground">
                            v{item.version}
                          </span>
                        )}
                        {!available && (
                          <span className="shrink-0 rounded-sm bg-amber-500/15 px-1 py-px text-[9px] font-medium text-amber-600 dark:text-amber-400">
                            {t('downloadComingSoon')}
                          </span>
                        )}
                      </span>
                      {item.descKey && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {t(item.descKey)}
                        </span>
                      )}
                    </span>
                  </>
                )

                const className = cn(
                  'group flex items-start gap-2.5 rounded px-2 py-1.5 text-sm transition-colors',
                  available
                    ? 'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none cursor-pointer'
                    : 'cursor-not-allowed opacity-60',
                )

                if (!available) {
                  return (
                    <div key={item.platform} className={className} aria-disabled="true">
                      {inner}
                    </div>
                  )
                }

                if (isInternalRoute) {
                  return (
                    <Link
                      key={item.platform}
                      href={item.href}
                      onClick={() => {
                        trackClick(`download_${item.platform}`, 'download_popover')
                        trackDownload(item.platform, 'sidebar')
                      }}
                      className={className}
                    >
                      {inner}
                    </Link>
                  )
                }

                return (
                  <a
                    key={item.platform}
                    href={item.href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    onClick={() => {
                      trackClick(`download_${item.platform}`, 'download_popover')
                      trackDownload(item.platform, 'sidebar')
                    }}
                    className={className}
                  >
                    {inner}
                  </a>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

/** 消息中心(独立子组件) */
function MessageCenter({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('nav')
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)

  // store 中的 NotificationItem 映射为 NotificationCenter 所需的 NoticeItem
  const noticeItems: NoticeItem[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.content,
    type: n.type === 'warning' || n.type === 'error' || n.type === 'success' ? n.type : 'info',
    read: n.isRead,
    createdAt: n.createdAt,
  }))

  const [msgOpen, setMsgOpen] = React.useState(false)
  const msgTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const msgPanelRef = React.useRef<HTMLDivElement | null>(null)
  const [msgCoords, setMsgCoords] = React.useState<{ top: number; left: number } | null>(null)
  const msgRafRef = React.useRef<number | null>(null)

  const updateMsgCoords = React.useCallback(() => {
    if (!msgTriggerRef.current || !msgPanelRef.current) return
    const r = msgTriggerRef.current.getBoundingClientRect()
    const panelRect = msgPanelRef.current.getBoundingClientRect()
    const gap = 8
    const pad = 8
    const VW = window.innerWidth

    let top = r.bottom - gap - panelRect.height
    let left = r.right + gap

    if (left + panelRect.width > VW - pad) {
      left = VW - pad - panelRect.width
    }
    left = Math.max(pad, left)

    if (top < pad) {
      top = r.bottom + gap
    }
    top = Math.max(pad, top)

    setMsgCoords({ top, left })
  }, [])

  React.useLayoutEffect(() => {
    if (!msgOpen) return
    const id = window.requestAnimationFrame(() => {
      updateMsgCoords()
    })
    return () => window.cancelAnimationFrame(id)
  }, [msgOpen, updateMsgCoords])

  React.useEffect(() => {
    if (!msgOpen) return
    const throttledUpdate = () => {
      if (msgRafRef.current !== null) return
      msgRafRef.current = requestAnimationFrame(() => {
        msgRafRef.current = null
        updateMsgCoords()
      })
    }
    window.addEventListener('scroll', throttledUpdate, { capture: true, passive: true })
    window.addEventListener('resize', throttledUpdate, { passive: true })
    return () => {
      if (msgRafRef.current !== null) cancelAnimationFrame(msgRafRef.current)
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
    }
  }, [msgOpen, updateMsgCoords])

  React.useEffect(() => {
    if (!msgOpen) return
    const handler = (event: MouseEvent | TouchEvent) => {
      const triggerEl = msgTriggerRef.current
      const contentEl = msgPanelRef.current
      const target = event.target as Node
      if (triggerEl && triggerEl.contains(target)) return
      if (contentEl && contentEl.contains(target)) return
      setMsgOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [msgOpen])

  React.useEffect(() => {
    if (!msgOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMsgOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [msgOpen])

  return (
    <>
      <Tooltip content={t('messages')} side={collapsed ? 'right' : 'top'}>
        <Button
          ref={msgTriggerRef}
          variant="ghost"
          size="icon"
          className={cn(SIDEBAR_BTN_CLASS, 'relative')}
          aria-label={t('messages')}
          aria-haspopup="dialog"
          aria-expanded={msgOpen}
          // 2026-09-02 治理:自写 popover trigger 加 data-state,让 globals.css:1090
          // `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制关闭后焦点环常驻。
          data-state={msgOpen ? 'open' : 'closed'}
          onClickCapture={(e) => {
            e.stopPropagation()
            setMsgOpen((prev) => !prev)
          }}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </Tooltip>
      {msgOpen &&
        createPortal(
          <div
            ref={msgPanelRef}
            className="w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={
              msgCoords ? { top: msgCoords.top, left: msgCoords.left } : { top: -9999, left: -9999 }
            }
            role="dialog"
            aria-label={t('messages')}
            aria-modal="true"
            tabIndex={-1}
          >
            <NotificationCenter items={noticeItems} onMarkAllRead={() => markAllAsRead()} />
          </div>,
          document.body,
        )}
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
