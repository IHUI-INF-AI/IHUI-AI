'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { Tooltip, Popover } from '@/components/feedback'
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
  const router = useRouter()
  const { trackClick } = useAnalytics()
  const trackDownload = useDownloadTrack()
  const { locale, setLocale } = useLanguageStore()
  const { resolvedTheme, setTheme } = useTheme()
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  // hydration-safe: next-themes 的 theme 在 SSR 返回 undefined, 客户端才返回真实值,
  // 直接用 theme 渲染 aria-label/icon 会触发 "深色模式/浅色模式" 不匹配。
  // 未挂载时渲染固定占位 (Moon + "深色模式"), 与 SSR 一致; 挂载后再切到真实态。
  const mounted = useMounted()
  // 必须用 resolvedTheme(已按 OS 解析的真实明暗),而非 theme:
  // 默认 'system' 时 theme==='system'(≠'dark'),用 theme 判断会导致首点设成 'dark'(=当前外观)无变化,需点两下。
  const isDark = mounted && resolvedTheme === 'dark'

  const handleLocaleChange = (code: Language) => {
    if (code === locale) return
    // 2026-07-27:语言切换已修复(客户端 I18nProvider 响应 useLanguageStore.locale)。
    // setLocale 更新 store → I18nProvider 重新渲染 → NextIntlClientProvider 拿到新 locale+messages → UI 切换。
    document.cookie = `locale=${code};path=/;max-age=31536000`
    setLocale(code)
  }

  const handleToggleTheme = () => {
    // 底层加固(2026-08-29):以 DOM 真实状态为事实源,而非任何 React/next-themes 状态。
    // 用户点按钮时看到的明暗 = <html> 上的 .dark class,直接取对立面,
    // 彻底消灭 resolvedTheme 为 undefined / 状态滞后等一切时序极端情况。
    const isDarkNow =
      (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ||
      resolvedTheme === 'dark'
    setTheme(isDarkNow ? 'light' : 'dark')
  }

  // store 中的 NotificationItem 映射为 NotificationCenter 所需的 NoticeItem
  const noticeItems: NoticeItem[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.content,
    type: n.type === 'warning' || n.type === 'error' || n.type === 'success' ? n.type : 'info',
    read: n.isRead,
    createdAt: n.createdAt,
  }))

  // 2026-08-07 升级(用户反馈"图标还是太小,再大点"):
  // - 容器 26×26 → 28×28 (h-7 w-7),与侧边栏其他图标按钮(NavLink h-5、折叠按钮 h-5)视觉一致
  // - svg 18×18 → 20×20 (h-5 w-5),跟 NavLink / 新建任务 / 折叠按钮的 20px 图标同尺寸
  //   ⚠️ 必须用 [&>svg]:!h-5 [&>svg]:!w-5 覆盖 TOPBAR_BTN_BASE 内置的
  //   [&>svg]:!h-3.5 [&>svg]:!w-3.5(14px !important)—— 同为 !important,后写胜出
  //   (tailwind-merge 识别同 group,后写覆盖前写)。
  // - 4×28 + gap(3×2) + padding(2×4) = 126px ≤ 130px 侧边栏最小宽度,单行排开不折行
  const btnClass = cn(TOPBAR_BTN_BASE, 'h-7 w-7 p-0 bg-transparent', '[&>svg]:!h-5 [&>svg]:!w-5')

  return (
    <div
      className={cn(
        'flex gap-0.5 rounded-md p-1',
        // 折叠态:aside 的 border-r(1px)使内容区 59px,居中后按钮会偏左 0.5px。
        // 用 pl-[9px] pr-2 补偿,让按钮回到 60px 视觉中心。
        collapsed ? 'flex-col items-center pl-[9px] pr-2' : 'flex-row flex-wrap justify-center',
      )}
    >
      {/* 语言切换 — portal 让弹窗脱离 MainShell overflow-hidden 祖先避免被裁剪,
          align: 折叠态用 end(底边对齐 trigger 底边,与下载/消息中心一致),
                展开态用 center(水平居中在 trigger 上方)
          tooltip: hover 显示按钮名称(与主题切换按钮一致),click 弹语言菜单 */}
      <Popover
        position={collapsed ? 'right' : 'top'}
        align={collapsed ? 'end' : 'center'}
        portal
        tooltip={t('language')}
        tooltipSide={collapsed ? 'right' : 'top'}
        className="p-0"
        content={
          <div className="flex w-36 flex-col gap-px p-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLocaleChange(lang.code)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent',
                  locale === lang.code && 'bg-accent font-medium',
                )}
              >
                {/* 2026-07-31 国旗 img 改为单色语言代码徽章,与项目线性图标风格统一;
                    data-lang-code 供 E2E 稳定定位。尺寸与原国旗一致(h-5 w-7)保持布局不变。 */}
                <span
                  data-lang-code={lang.code}
                  className="flex h-5 w-7 shrink-0 items-center justify-center rounded-sm border border-border text-[10px] font-bold tracking-wide text-foreground"
                >
                  {lang.badge}
                </span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        }
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(btnClass, 'p-0')}
          aria-label={t('language')}
        >
          {/* 2026-07-31 v3: 触发器改为 lucide Flag(通用旗帜),用户要求"类似国旗"的图标;
              下拉项保留单色语言代码徽章(ZH/TW/EN/JA/KO)不动;
              2026-08-06:svg 显式 18×18,用户反馈图标太小(原依赖 Button 内置 size-4=16px 偏小)。 */}
          <Flag className="h-[18px] w-[18px]" />
        </Button>
      </Popover>

      {/* 下载客户端 — portal 模式让弹窗脱离 MainShell overflow-hidden 祖先,
          从侧边栏右侧弹出,底部对齐 trigger 按钮(避免被裁剪 + 视觉对齐工具栏行)
          2026-08-06 深度扩展:
          - 已接入端(web/desktop/extension/cli/mobile):渲染为 Link/a,点击跳转 /download/[platform] 详情页或直接下载
          - 未接入端(ios/android-apk/wechat-miniapp):渲染为 div + disabled + "即将上线" badge
          - 每项显示版本号(若有)+ 描述文字 */}
      <Popover
        position="right"
        align="end"
        portal
        tooltip={t('downloadClient')}
        tooltipSide={collapsed ? 'right' : 'top'}
        className="p-0"
        content={
          <div className="w-60 p-1">
            <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t('downloadTitle')}
            </div>
            {DOWNLOADS.map((item) => {
              const Icon = item.icon
              const isExternal = isExternalDownloadHref(item.href)
              const available = isDownloadAvailable(item.platform)
              // 内部路由(/ 或 /download/xxx)用 Next Link 走 SPA;外链/下载文件用 <a>
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
                // 未接入端:渲染为 div,不可点击
                return (
                  <div key={item.platform} className={className} aria-disabled="true">
                    {inner}
                  </div>
                )
              }

              if (isInternalRoute) {
                // 内部 SPA 路由(/ 或 /download/xxx)用 Next Link
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

              // 外链 / 真实文件下载用 <a>
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
        }
      >
        <Button variant="ghost" size="icon" className={btnClass} aria-label={t('downloadClient')}>
          <Download className="h-5 w-5" />
        </Button>
      </Popover>

      {/* 消息中心 — w-80 远超 130px 侧边栏,必须 portal 到 document.body 才能从右侧弹出不被裁剪。
          NotificationCenter 设计为"裸内容",不带自己的卡片容器,由 Popover 当唯一卡片:
          className 提供 w-80 宽度 + 保留默认 border/bg-popover/shadow,p-0 让 NotificationCenter 自己控 padding */}
      <Popover
        position="right"
        align="end"
        portal
        tooltip={t('messages')}
        tooltipSide={collapsed ? 'right' : 'top'}
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
        content={<NotificationCenter items={noticeItems} onMarkAllRead={() => markAllAsRead()} />}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(btnClass, 'relative')}
          aria-label={t('messages')}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </Popover>

      {/* 主题切换 — isDark 来自 useMounted 门控, SSR 永远 false (Moon + "深色模式") */}
      <Tooltip
        content={isDark ? tt('lightMode') : tt('darkMode')}
        side={collapsed ? 'right' : 'top'}
      >
        <Button
          variant="ghost"
          size="icon"
          className={btnClass}
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
          className={btnClass}
          onClick={() => router.push('/settings')}
          aria-label={t('settings')}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </Tooltip>
    </div>
  )
}
