// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useNavigateWithProgress } from '@/stores/navigation'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import {
  LogIn,
  User,
  Settings,
  Crown,
  LogOut,
  Bell,
  Sun,
  Moon,
  Languages,
  Download,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useMounted } from '@/hooks/use-mounted'
import { useLanguageStore, type Language } from '@/stores/language'
import { useNotificationStore } from '@/stores/notification'
import { useAnalytics } from '@/hooks/use-analytics'
import { useDownloadTrack } from '@ihui/shared/hooks'
import { DOWNLOADS, isDownloadAvailable, isExternalDownloadHref } from '@/lib/downloads'
import { Avatar } from '@/components/data/Avatar'
import { Dropdown, Modal, type DropdownItem } from '@/components/feedback'
import { NotificationCenter, type NoticeItem } from '@/components/feature-center'
import { LANGUAGES } from './nav-data'

/** 侧边栏底部用户区:头像 + 用户名 + 下拉菜单。
 *  2026-09-21 用户要求(Qoder 风格):原 SidebarActions 底部 5 按钮
 *  (语言 / 下载客户端 / 站内消息 / 主题切换 / 设置)全部收进本菜单,
 *  侧边栏底部只保留用户行;未登录态镜像同一套工具项 + 登录项。 */
export function SidebarUserRow({
  collapsed,
  onCloseMobile,
}: {
  collapsed: boolean
  onCloseMobile: () => void
}) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const tt = useTranslations('themeToggle')
  const navigate = useNavigateWithProgress()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const { locale, setLocale } = useLanguageStore()
  const { resolvedTheme, setTheme } = useTheme()
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  const { trackClick } = useAnalytics()
  const trackDownload = useDownloadTrack()
  // hydration-safe: 首屏按"未登录"渲染,挂载后才显示真实态,避免 SSR/CSR 不一致
  const mounted = useMounted()
  const showAuthed = mounted && isAuthenticated
  // hydration-safe: next-themes 的 theme 在 SSR 返回 undefined,未挂载时固定 Moon + "深色",
  // 挂载后再切真实态(与原 SidebarActions 同策略)。
  const isDark = mounted && resolvedTheme === 'dark'
  const [msgOpen, setMsgOpen] = React.useState(false)

  const handleLogout = () => {
    logout()
    useLoginDialogStore.getState().open('login')
  }

  // 语言切换:store 更新 → I18nProvider 重新渲染 → NextIntlClientProvider 拿到新 locale+messages。
  const handleLocaleChange = (code: Language) => {
    if (code === locale) return
    // setLocale 内部会镜像写 `locale` cookie 供 SSR 首帧取用(见 @/lib/locale-cookie)
    setLocale(code)
  }

  // 底层加固(承继自原 SidebarActions 2026-08-29):以 <html> 的 .dark class 为事实源取对立面,
  // 彻底消灭 resolvedTheme 为 undefined / 状态滞后等一切时序极端情况。
  const handleToggleTheme = () => {
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

  // 原 SidebarActions 的 5 个工具项(除"设置"已有外,其余全部迁入):
  // 站内消息(未读徽标,点击弹 Modal)/ 语言(子菜单,当前项勾选)/
  // 下载客户端(子菜单,即将上线的平台 disabled)/ 主题切换(明暗一键切换)。
  const actionItems: DropdownItem[] = [
    {
      key: 'messages',
      label: t('messages'),
      icon: Bell,
      trailing:
        unreadCount > 0 ? (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null,
      onSelect: () => setMsgOpen(true),
    },
    {
      key: 'language',
      label: t('language'),
      icon: Languages,
      children: LANGUAGES.map((lang) => ({
        key: `lang-${lang.code}`,
        label: (
          <span className="flex items-center gap-2">
            <span
              data-lang-code={lang.code}
              className="flex h-5 w-7 shrink-0 items-center justify-center rounded-sm border border-border text-[10px] font-bold tracking-wide text-foreground"
            >
              {lang.badge}
            </span>
            <span>{lang.name}</span>
          </span>
        ),
        trailing: locale === lang.code ? <Check className="h-4 w-4" /> : null,
        onSelect: () => handleLocaleChange(lang.code),
      })),
    },
    {
      key: 'downloadClient',
      label: t('downloadClient'),
      icon: Download,
      children: DOWNLOADS.map((dl) => {
        const available = isDownloadAvailable(dl.platform)
        const isExternal = isExternalDownloadHref(dl.href)
        return {
          key: `download-${dl.platform}`,
          icon: dl.icon,
          disabled: !available,
          label: (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <span className={cn('truncate', !available && 'text-muted-foreground')}>
                  {t(dl.labelKey)}
                </span>
                {dl.version && available && (
                  <span className="shrink-0 rounded-sm bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground">
                    v{dl.version}
                  </span>
                )}
                {!available && (
                  <span className="shrink-0 rounded-sm bg-amber-500/15 px-1 py-px text-[9px] font-medium text-amber-600 dark:text-amber-400">
                    {t('downloadComingSoon')}
                  </span>
                )}
              </span>
              {dl.descKey && (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {t(dl.descKey)}
                </span>
              )}
            </span>
          ),
          onSelect: () => {
            if (!available) return
            trackClick(`download_${dl.platform}`, 'user_menu')
            trackDownload(dl.platform, 'sidebar')
            if (isExternal) {
              window.open(dl.href, '_blank', 'noopener,noreferrer')
            } else {
              navigate(dl.href)
              onCloseMobile()
            }
          },
        }
      }),
    },
    {
      key: 'themeToggle',
      label: isDark ? tt('lightMode') : tt('darkMode'),
      icon: isDark ? Sun : Moon,
      onSelect: handleToggleTheme,
    },
  ]

  // 菜单内容:已登录 = 用户信息头 + 个人中心/会员中心 + 工具项(消息/语言/下载/主题/设置) + 退出登录
  const userMenuItems: DropdownItem[] = [
    {
      key: 'header',
      label: (
        <div className="flex items-center gap-2 px-1 py-1">
          <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user?.nickname ?? 'User'}</div>
            {user?.phone && (
              <div className="truncate text-xs text-muted-foreground">{user.phone}</div>
            )}
          </div>
        </div>
      ),
    },
    { key: 'div1', divider: true },
    {
      key: 'profile',
      label: t('user'),
      icon: User,
      onSelect: () => {
        navigate('/user/profile')
        onCloseMobile()
      },
    },
    {
      key: 'vip',
      label: t('vip'),
      icon: Crown,
      onSelect: () => {
        navigate('/vip')
        onCloseMobile()
      },
    },
    { key: 'div2', divider: true },
    ...actionItems,
    {
      key: 'settings',
      label: t('settings'),
      icon: Settings,
      onSelect: () => {
        navigate('/settings')
        onCloseMobile()
      },
    },
    { key: 'div3', divider: true },
    {
      key: 'logout',
      label: tc('logout'),
      icon: LogOut,
      danger: true,
      onSelect: handleLogout,
    },
  ]

  // 未登录 = 同一套工具项 + 分隔线 + 登录(替代原独立登录按钮的直接打开行为)
  const guestMenuItems: DropdownItem[] = [
    ...actionItems,
    { key: 'div-login', divider: true },
    {
      key: 'login',
      label: tc('login'),
      icon: LogIn,
      onSelect: () => {
        useLoginDialogStore.getState().open('login')
        onCloseMobile()
      },
    },
  ]

  // 未登录态 trigger:与已登录态占据同一位置,渲染为"图标 + 登录文字"单行按钮,
  // 整行作为 Dropdown 触发器打开同一套工具菜单(菜单末尾含"登录"项)。
  // 默认黑白背景(bg-foreground text-background):亮色模式黑底白字、暗色模式白底黑字,
  // hover 保持黑白但稍淡 (bg-foreground/90),不切色相避免视觉跳跃。
  const loginTrigger = (
    <button
      type="button"
      aria-label={tc('login')}
      className={cn(
        'flex w-full items-center justify-center gap-1.5 rounded-md p-1 text-sm font-medium transition-colors bg-foreground text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
    >
      <LogIn className="h-3.5 w-3.5 shrink-0" />
      {!collapsed && <span>{tc('login')}</span>}
    </button>
  )

  // 已登录态 trigger:头像 + 用户名整行,任意位置点击都打开菜单(承继 v4 结构)。
  const userTrigger = (
    <button
      aria-label={user?.nickname ?? 'User'}
      className={cn(
        // 整行 row 容器样式:flex + h-9(与 NavLink 行高一致) + gap-2 + 圆角 + padding
        // flex w-full 与导航项(NavLink w-full)同宽,px-2.5 与导航区对齐
        'group/row flex h-9 w-full items-center justify-center gap-2 rounded-md px-2.5 transition-colors hover:bg-sidebar-item-hover-bg',
        // 按钮态样式:outline-none + focus-visible ring 保留键盘可访问性
        'outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {/* 内层 28×28 命中区,内含 24×24 Avatar(xs),保留 2px 留白 */}
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
        <Avatar
          src={user?.avatar ?? undefined}
          name={user?.nickname ?? 'U'}
          size="xs"
          className="ring-1 ring-inset ring-border/30"
        />
        {/* 未读红点:菜单收起时唯一可见的"有新消息"信号(承继原铃铛徽标职责) */}
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
        )}
      </span>
      {!collapsed && (
        <span
          className={cn(
            'min-w-0 truncate text-sm font-medium text-foreground/70 transition-colors group-hover/row:text-foreground',
          )}
        >
          {user?.nickname ?? 'User'}
        </span>
      )}
    </button>
  )

  return (
    <div className="px-2 pb-2">
      {/*
        group/row:头像+昵称作为整体悬停单元
        - 2026-07-20 v3 改(根除"文字贴上按钮右侧"问题):
          1) 子容器加 `px-2`(左右各 8px padding):hover 背景覆盖到 padding,
             button 左侧 + span 右侧各有 8px 留白,hover bg 视觉左右对称。
             原方案子容器无 padding,hover bg 紧贴 button 左 + span 右,看起来"贴边"。
          2) gap 从 `gap-1.5`(6px) → `gap-2`(8px):button 跟 span 间距增大,
             "系统管理员"5 字不再贴上 button 右侧,视觉有呼吸感。
          3) inline-flex 让子容器宽度 = padding*2 + button + gap + span 文字宽度,
             内容宽度完全由子内容决定,父 `flex justify-center` 居中 → 左右空白 100% 对称。
          4) 几个字的名称(2-7 字)自适应宽度,row 永远按内容宽度收缩,
             不会出现"文字被截断贴到 button 右侧"的视觉问题。
          5) 只有当 sidebar 拖到极窄(130px 最小)+ 长昵称(8 字+)时,span 才用 `min-w-0 truncate` 截断,
             截断时显示省略号,不会贴到 button(因为有 gap-2 + px-2 双重间距)。
        - 父容器 hover:bg-sidebar-item-hover-bg 出现弱色底(亮色纯白/暗色纯黑),
          与项目内其他导航项(NavLink/二级菜单)hover 行为完全一致,统一 hover 策略
        - 文本 group-hover/row:text-foreground 变亮(默认 text-foreground/70 弱化)
        - 折叠态 trigger button 加 p-1.5(12px) + 内部 Avatar h-6 w-6(24px) = 36×36 命中区,
          解决折叠态下小图标难以点中的体验问题
        - 子容器 h-9 (36px) 严格与 h-9 导航项高度一致,避免比邻项多出 8px 的视觉错位
        - 头像 fallback 加 ring-1 ring-inset ring-border/30,无头像时字符 fallback 有弱边框,
          在白底/灰底上更易辨识
      */}
      {/*
        2026-08-07 v4 改(根除"只有点头像才弹窗"问题):
        旧结构:外层 div(只负责 hover 样式) + Dropdown trigger=button(只包头像) + 外面的 span(用户名)
        → 用户名 span 在 Dropdown 外,点击不弹窗。
        新结构:把整行(row)合并到 Dropdown 的 trigger button 内,button 成为"头像 + 用户名"整体,
        任意位置点击都触发 Radix DropdownMenu 打开。
        - button 继承原外层 div 的所有样式(inline-flex h-9 gap-1.5 rounded-md px-2 hover:bg-sidebar-item-hover-bg
          group/row transition-colors)以保证视觉零回归,只是把 hover bg 从 div 转移到 button。
        - 头像原本在 button(h-7 w-7)内有 2px 留白(28×28 button 套 24×24 Avatar);现在 button 变成 row 容器
          (h-9 高度 + 内边距),用一个内层 span(h-7 w-7 flex items-center justify-center rounded-md)复用
          同样的 28×28 命中区,把 Avatar 居中放在内层 span 里,视觉与旧版一致。
        - 用户名 span 移入 button 内,继续走 group-hover/row:text-foreground 的文字变亮效果。
        - 折叠态(!collapsed=false)只渲染内层 28×28 头像 span,不渲染用户名,行为与旧版一致。
      */}
      <Dropdown
        align="start"
        side="top"
        items={showAuthed ? userMenuItems : guestMenuItems}
        trigger={showAuthed ? userTrigger : loginTrigger}
      />
      {/* 站内消息弹窗(承继原 SidebarActions MessageCenter 的 PortalPanel):
          NotificationCenter 为"裸内容"组件,自带"通知中心"头部 + 全部已读 + max-h-60vh 滚动,
          Modal 提供卡片外观与右上角关闭按钮。 */}
      <Modal open={msgOpen} onClose={() => setMsgOpen(false)} size="sm">
        <NotificationCenter items={noticeItems} onMarkAllRead={() => markAllAsRead()} />
      </Modal>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
