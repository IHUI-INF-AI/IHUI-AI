'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  MessageSquare,
  FolderOpen,
  Bot,
  FileText,
  Users,
  CreditCard,
  Settings,
  HelpCircle,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Gift,
  Shield,
  Search,
  Star,
  Tag,
  Rss,
  X,
  Package,
  Award,
  Calendar,
  BarChart3,
  ShoppingBag,
  UserCircle,
  Workflow,
  ScrollText,
  LayoutGrid,
  LayoutDashboard,
  Crown,
  Wallet,
  KeyRound,
  GraduationCap,
  Download,
  PlayCircle,
  BookOpen,
  Plus,
  Home,
  Newspaper,
  Megaphone,
  Bell,
  Sun,
  Moon,
  LogIn,
  Briefcase,
  Globe,
} from 'lucide-react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'
import {
  NAV_ITEM_BASE_CLASS,
  NAV_ITEM_COLLAPSED_CLASS,
  NAV_ITEM_EXPANDED_CLASS,
  NAV_CHILD_CLASS,
  BTN_NEW_CONVERSATION_CLASS,
} from '@/lib/nav-styles'
import { Button, ThemeLogo } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useLanguageStore, type Language } from '@/stores/language'
import { useNotificationStore } from '@/stores/notification'
import { Avatar } from '@/components/data/Avatar'
import { Tooltip, TooltipProvider, Dropdown, Popover } from '@/components/feedback'
import { SearchBar } from '@/components/business'
import { NotificationCenter, type NoticeItem } from '@/components/feature-center'
import { useAiPanelStore } from '@/stores/ai-panel'
import { SidebarChatHistory } from '@/components/sidebar-chat-history'
import { useMounted } from '@/hooks/use-mounted'

interface NavItem {
  href: string
  labelKey:
    | 'home'
    | 'chat'
    | 'chatHistory'
    | 'models'
    | 'workspace'
    | 'teams'
    | 'learn'
    | 'exam'
    | 'circles'
    | 'plaza'
    | 'asks'
    | 'docs'
    | 'payment'
    | 'vip'
    | 'user'
    | 'settings'
    | 'admin'
    | 'help'
    | 'search'
    | 'favorites'
    | 'following'
    | 'subscriptions'
    | 'tags'
    | 'activities'
    | 'feedback'
    | 'points'
    | 'orders'
    | 'live'
    | 'members'
    | 'resources'
    | 'eduPoints'
    | 'schedule'
    | 'adminStatistics'
    | 'userCenter'
    | 'messages'
    | 'topics'
    | 'adminWorkflows'
    | 'adminTags'
    | 'adminLogs'
    | 'wallet'
    | 'oauthMyAuthorized'
    | 'news'
    | 'lecturers'
    | 'student'
    | 'agents'
    | 'distribution'
    | 'oauthPlatform'
    | 'myLearning'
    | 'knowledgeBase'
    | 'announcements'
    | 'overview'
    | 'enterprise'
    | 'aiWorld'
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  children?: NavItem[]
}

/** 侧边栏宽度常量(2026-07-17 统一)
 * - 130px 是展开态默认宽度(桌面 + 移动抽屉复用)
 * - 60px 是折叠态宽度,只显图标
 * - 桌面端展开态支持拖拽调整,范围 130-180px(2026-07-18)
 */
const SIDEBAR_WIDTH = 130
const SIDEBAR_MIN_WIDTH = 130
const SIDEBAR_MAX_WIDTH = 180
const SIDEBAR_COLLAPSED_WIDTH = 60
const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-width'

/**
 * 主导航项尺寸常量(2026-07-19 抽出,消除 NavLink / SearchNavItem / ExpandableNavItem 三处重复)
 *
 * 2026-07-19 升级:常量已迁移到 `apps/web/src/lib/nav-styles.ts` 共享模块,
 * 配套 globals.css 第 144 行 `--text-vcenter-offset` CSS 变量 +
 * 第 150 行 `:where(button):has(>span) > span` 全局规则,
 * 所有 button/a/[role=button] 子 span 自动应用 0.5px translateY,无需逐处加类。
 *
 * - NAV_ITEM_BASE_CLASS: 基础类,h-9=36px 统一所有主导航项高度,与新建任务按钮 h-9 一致
 * - NAV_ITEM_COLLAPSED_CLASS: 折叠态宽度类,w-9=36px 与 h-9 严格相等形成 36×36 正方形,
 *   与新建任务按钮 h-9 w-9 统一尺寸;mx-auto 在 block 父级 <nav> 中水平居中,
 *   消除折叠态下 43×36 的非正方形拉伸(原 bug:w-full + px-2.5 在 60px aside 内容区下变成 43px 宽)
 * - NAV_ITEM_EXPANDED_CLASS: 展开态宽度类,占满父容器宽度,左对齐图标 + 文字
 *
 * 守门:e2e/sidebar-visual.spec.ts "折叠态导航项背景容器统一为 36×36 正方形" 用例
 * 防止再次出现部分导航项漏改导致尺寸不一致
 *
 * 【2026-07-19 二次根因修复】实测数据反推 +0.3px translateY 是根治方案:
 *   1) 原"几何居中 ≠ 视觉居中,加 -mt-px"是错误推论,实测 mt=-1 让 delta 从 0 变 -0.5,反向恶化
 *   2) 移除 -mt-px 后,mt=0 状态下 box midY = icon midY,但 text ink 仍偏低 0.5px(实测一致)
 *   3) 根因:中文字体 ascent≈11px, descent≈3px,ascent/descent 不对称导致 ink 几何中心
 *      在 line-box 中心**下方 0.5px**(HarmonyOS Sans SC @ 14px 测得);
 *      icon 是 SVG 居中填充,box 中心 = ink 中心,二者视觉中心累积 0.5px 偏差
 *   4) 根治:用 `translateY(0.3px)` (GPU 视觉位移)替代 margin 微调,
 *      让 text ink 视觉下移 0.3px,实测 delta 收敛到 0.000(完美居中,跨 11 个 nav 验证);
 *      0.3px = 14px 字号下肉眼可识别阈值(7%=1px)的 1/3 以下,任何 DPR 下都安全。
 *      不用 margin 是因为 margin 走 flex 布局通道会同时改变 box,可能与 align-items 冲突;
 *      不用 leading-tight 是因为 line-height 改大撑高 line-box,破坏 button 36px 高度;
 *      translateY 不改 box 几何,与 align-items: center 完全解耦,稳定可靠。
 *   5) hover/active 态下 span transform 不变,只改 background/color/focus ring,
 *      translateY 不会被 transition-colors 抖动(初始值就是 0.3px,无 0→0.3 过渡)。
 *   6) 2026-07-19 升级: translateY 改为读 CSS 变量 `var(--text-vcenter-offset)` (globals.css 第 162 行),
 *      换字体时只改 globals.css 一处,全站生效。
 *      同时 globals.css 第 165 行全局规则自动覆盖所有 button 子 span,
 *      新增按钮无需手动加类,杜绝"漏改导致 1 处错位"的回归。
 */
// ↑↑↑ 上述常量已迁移到 `@/lib/nav-styles` 复用(2026-07-19 立),
// 保留本文件重新导出仅为向后兼容外部引用(如 TagsView 旧版可能 import)
// 未来新代码请直接 import from '@/lib/nav-styles'
export {
  NAV_ITEM_BASE_CLASS,
  NAV_ITEM_COLLAPSED_CLASS,
  NAV_ITEM_EXPANDED_CLASS,
} from '@/lib/nav-styles'

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: '',
    items: [{ href: '/home', labelKey: 'home', icon: Home }],
  },
  {
    label: 'AI',
    items: [
      // /chat 路由已废弃:AI 任务是全局 docked 面板(挂载于 MainShell,与 Sidebar 同级),
      // 顶部"+"按钮(下方)即 toggle 面板的入口,不再放可点击的 /chat 导航项,
      // 避免点击后右侧工作区被占位空状态"开始新任务"替换。
      { href: '/chat/history', labelKey: 'chatHistory', icon: MessageSquare },
      { href: '/models', labelKey: 'models', icon: Bot },
      { href: '/agents', labelKey: 'agents', icon: Bot },
      { href: '/ai-world', labelKey: 'aiWorld', icon: Globe },
      { href: '/workspace', labelKey: 'workspace', icon: FolderOpen },
    ],
  },
  {
    label: 'AI教育',
    items: [
      { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
      { href: '/learn', labelKey: 'learn', icon: GraduationCap },
      { href: '/live', labelKey: 'live', icon: PlayCircle },
      { href: '/exam', labelKey: 'exam', icon: ScrollText },
      { href: '/lecturers', labelKey: 'lecturers', icon: Users },
      { href: '/schedule', labelKey: 'schedule', icon: Calendar },
      { href: '/topics', labelKey: 'topics', icon: FileText },
      { href: '/asks', labelKey: 'asks', icon: MessageSquare },
      { href: '/circles', labelKey: 'circles', icon: Users },
      { href: '/knowledge-base', labelKey: 'knowledgeBase', icon: BookOpen },
      { href: '/resources', labelKey: 'resources', icon: Package },
      { href: '/news', labelKey: 'news', icon: Newspaper },
      { href: '/announcements', labelKey: 'announcements', icon: Megaphone },
    ],
  },
  {
    label: '内容',
    items: [
      { href: '/plaza', labelKey: 'plaza', icon: LayoutGrid },
      { href: '/enterprise', labelKey: 'enterprise', icon: Briefcase },
      { href: '/distribution', labelKey: 'distribution', icon: Gift },
      { href: '/teams', labelKey: 'teams', icon: Users },
      { href: '/messages', labelKey: 'messages', icon: MessageSquare },
      { href: '/docs', labelKey: 'docs', icon: FileText },
      { href: '/search', labelKey: 'search', icon: Search },
      { href: '/tags', labelKey: 'tags', icon: Tag },
      { href: '/oauth/platform', labelKey: 'oauthPlatform', icon: KeyRound },
    ],
  },
  {
    label: '交易',
    items: [
      { href: '/vip-membership', labelKey: 'vip', icon: Crown },
      { href: '/wallet', labelKey: 'wallet', icon: Wallet },
      { href: '/payment', labelKey: 'payment', icon: CreditCard },
      { href: '/orders', labelKey: 'orders', icon: ShoppingBag },
      { href: '/activities', labelKey: 'activities', icon: Gift },
      { href: '/points', labelKey: 'points', icon: Star },
      { href: '/edu-points', labelKey: 'eduPoints', icon: Award },
      { href: '/oauth/my-authorized', labelKey: 'oauthMyAuthorized', icon: KeyRound },
    ],
  },
  {
    label: '个人',
    items: [
      {
        href: '/favorites',
        labelKey: 'myLearning',
        icon: BookOpen,
        children: [
          { href: '/favorites', labelKey: 'favorites', icon: Star },
          { href: '/following', labelKey: 'following', icon: Users },
          { href: '/subscriptions', labelKey: 'subscriptions', icon: Rss },
        ],
      },
      { href: '/user/profile', labelKey: 'user', icon: User },
      { href: '/student', labelKey: 'student', icon: GraduationCap },
      { href: '/settings', labelKey: 'settings', icon: Settings },
      { href: '/feedback', labelKey: 'feedback', icon: MessageSquare },
      { href: '/help', labelKey: 'help', icon: HelpCircle },
    ],
  },
  {
    label: '管理',
    items: [
      { href: '/admin', labelKey: 'admin', icon: Shield, adminOnly: true },
      { href: '/admin/statistics', labelKey: 'adminStatistics', icon: BarChart3, adminOnly: true },
      { href: '/user-center', labelKey: 'userCenter', icon: UserCircle, adminOnly: true },
      { href: '/members', labelKey: 'members', icon: Users, adminOnly: true },
      { href: '/admin/workflows', labelKey: 'adminWorkflows', icon: Workflow, adminOnly: true },
      { href: '/admin/tags', labelKey: 'adminTags', icon: Tag, adminOnly: true },
      { href: '/admin/logs', labelKey: 'adminLogs', icon: ScrollText, adminOnly: true },
    ],
  },
]

function flattenNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNavItems(item.children) : [])])
}

export const ALL_NAV_HREFS = flattenNavItems(NAV_GROUPS.flatMap((g) => g.items)).map((i) => i.href)

/** 扁平化主侧边栏导航项,供 TagsView 等复用 path -> labelKey 映射 */
export const FLAT_NAV_ITEMS = flattenNavItems(NAV_GROUPS.flatMap((g) => g.items))

const LANGUAGES: { code: Language; name: string }[] = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
]

const DOWNLOADS = [
  { labelKey: 'downloadIOS', href: 'https://apps.apple.com/cn/app/ihui-ai' },
  { labelKey: 'downloadAndroidApk', href: '/apk/ihui-ai-latest.apk' },
  { labelKey: 'downloadWechatMiniApp', href: '/minapp' },
  { labelKey: 'downloadDesktop', href: '/download/desktop' },
]

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  id?: string
  mobileOpen: boolean
  onCloseMobile: () => void
}

/**
 * 侧边栏底部统一工具栏(4 按钮单行):语言 / 下载客户端 / 消息中心 / 主题切换。
 * 登录按钮独立到下方 SidebarUserRow(与已登录态同位置)。
 * 130px 默认宽度下单行排开;拉伸到 180px 仍单行;极端窄宽时 flex-wrap 兜底换行。
 */
function SidebarActions({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('nav')
  const tt = useTranslations('themeToggle')
  const { locale, setLocale } = useLanguageStore()
  const { theme, setTheme } = useTheme()
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  // hydration-safe: next-themes 的 theme 在 SSR 返回 undefined, 客户端才返回真实值,
  // 直接用 theme 渲染 aria-label/icon 会触发 "深色模式/浅色模式" 不匹配。
  // 未挂载时渲染固定占位 (Moon + "深色模式"), 与 SSR 一致; 挂载后再切到真实态。
  const mounted = useMounted()
  const isDark = mounted && theme === 'dark'
  const router = useRouter()

  const handleLocaleChange = (code: Language) => {
    if (code === locale) return
    document.cookie = `locale=${code};path=/;max-age=31536000`
    setLocale(code)
    // 不整页刷新, 让服务端重新读取 cookie + 重渲染当前路由的 server components,
    // NextIntlClientProvider 的 locale/messages 随之更新, 所有 useTranslations 自动重译。
    // 客户端状态(zustand store、TagsView 标签等)完整保留, 派生式 title 会按新 locale 重算。
    router.refresh()
  }

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
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

  // 按钮统一 h-[26px] w-[26px] + svg size-5 (20×20):
  // 图标尺寸与 NavLink 导航项 (h-5 w-5=20px) 完全一致,避免底部工具栏图标过小不一致;
  // 4 个按钮 + 3 个 gap-0.5 (6px) = 110px,正好填满 130px 默认宽度 (扣 px-1.5 + p-1 = 20px padding);
  // [&_svg]:size-5 覆盖 Button 默认的 [&_svg]:size-4,让 svg 渲染为 20×20 与导航项图标尺寸一致。
  const btnClass = 'h-[26px] w-[26px] shrink-0 p-0 [&_svg]:size-5'

  return (
    <div
      className={cn(
        'flex gap-0.5 rounded-md p-1',
        // 折叠态:aside 的 border-r(1px)使内容区 59px,居中后按钮会偏左 0.5px。
        // 用 pl-[9px] pr-2 补偿,让按钮回到 60px 视觉中心。
        collapsed ? 'flex-col items-center pl-[9px] pr-2' : 'flex-row flex-wrap justify-center',
      )}
    >
      {/* 语言切换 */}
      <Popover
        position={collapsed ? 'right' : 'top'}
        content={
          <div className="w-36 py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLocaleChange(lang.code)}
                className={cn(
                  'flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent',
                  locale === lang.code && 'bg-accent font-medium',
                )}
              >
                {}
                <img
                  src={`/images/flags/${lang.code}.svg`}
                  className="block h-5 w-7 shrink-0 object-contain"
                  alt={lang.name}
                />
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
          title={collapsed ? t('language') : undefined}
          aria-label={t('language')}
        >
          {}
          <img
            src={`/images/flags/${locale}.svg`}
            className="block h-3 w-4 shrink-0 object-contain"
            alt={locale}
          />
        </Button>
      </Popover>

      {/* 下载客户端 */}
      <Popover
        position={collapsed ? 'right' : 'top'}
        className={collapsed ? undefined : 'left-0 translate-x-0'}
        content={
          <div className="w-36 py-1">
            {DOWNLOADS.map((item) => (
              <a
                key={item.labelKey}
                href={item.href}
                className="block px-2 py-1.5 text-sm hover:bg-accent"
              >
                {t(item.labelKey)}
              </a>
            ))}
          </div>
        }
      >
        <Button
          variant="ghost"
          size="icon"
          className={btnClass}
          title={collapsed ? t('downloadClient') : undefined}
          aria-label={t('downloadClient')}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </Popover>

      {/* 消息中心 */}
      <Popover
        position={collapsed ? 'right' : 'top'}
        className={collapsed ? undefined : 'left-0 translate-x-0'}
        content={
          <div className="w-80 max-w-[calc(100vw-2rem)]">
            <NotificationCenter items={noticeItems} onMarkAllRead={() => markAllAsRead()} />
          </div>
        }
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(btnClass, 'relative')}
          title={collapsed ? t('messages') : undefined}
          aria-label={t('messages')}
        >
          <Bell className="h-3.5 w-3.5" />
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
          title={collapsed ? (isDark ? tt('lightMode') : tt('darkMode')) : undefined}
          aria-label={isDark ? tt('lightMode') : tt('darkMode')}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
      </Tooltip>
    </div>
  )
}

/** 侧边栏底部用户区:头像 + 用户名 + 下拉菜单(profile/settings/logout)。未登录态不渲染(Header 已有登录入口)。 */
function SidebarUserRow({
  collapsed,
  onCloseMobile,
}: {
  collapsed: boolean
  onCloseMobile: () => void
}) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  // hydration-safe: 首屏按"未登录"渲染,挂载后才显示真实态,避免 SSR/CSR 不一致
  const mounted = useMounted()
  const showAuthed = mounted && isAuthenticated

  const handleLogout = () => {
    logout()
    useLoginDialogStore.getState().open('login')
  }

  // 未登录态:与已登录态占据同一位置(px-1.5 pb-2 + flex items-center gap-1.5 rounded-md p-1),
  // 渲染为"图标 + 登录文字"单行按钮,折叠态只显图标。
  // 默认黑白背景(bg-foreground text-background):亮色模式黑底白字、暗色模式白底黑字,
  // 居中显示(justify-center 始终生效,展开态文字 + 图标也居中),
  // hover 保持黑白但稍淡 (bg-foreground/90),不切色相避免视觉跳跃。
  if (!showAuthed) {
    return (
      <div className="px-1.5 pb-2">
        <button
          type="button"
          onClick={() => {
            useLoginDialogStore.getState().open('login')
            onCloseMobile()
          }}
          aria-label={tc('login')}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-md p-1 text-sm font-medium transition-colors bg-foreground text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <LogIn className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{tc('login')}</span>}
        </button>
      </div>
    )
  }

  return (
    <div className="px-1.5 pb-2">
      {/*
        group/row:头像+昵称作为整体悬停单元
        - 父容器 hover:bg-sidebar-item-hover-bg 出现弱色底(亮色纯白/暗色纯黑)
          与项目内其他导航项(NavLink/二级菜单)hover 行为完全一致,统一 hover 策略
        - 文本 group-hover/row:text-foreground 变亮(默认 text-foreground/70 弱化)
        - 不使用 flex-1 在昵称上(会导致头像被挤到左侧,justify-center 失效)
        - 折叠态 trigger button 加 p-1.5(12px) + 内部 Avatar h-6 w-6(24px) = 36×36 命中区,
          解决折叠态下小图标难以点中的体验问题
        - 头像 fallback 加 ring-1 ring-inset ring-border/30,无头像时字符 fallback 有弱边框,
          在白底/灰底上更易辨识
      */}
      <div
        className={cn(
          'group/row flex w-full items-center justify-center gap-1.5 rounded-md p-1 transition-colors hover:bg-sidebar-item-hover-bg',
        )}
      >
        <Dropdown
          align="start"
          side="top"
          items={[
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
                router.push('/user/profile')
                onCloseMobile()
              },
            },
            {
              key: 'settings',
              label: t('settings'),
              icon: Settings,
              onSelect: () => {
                router.push('/settings')
                onCloseMobile()
              },
            },
            { key: 'div2', divider: true },
            {
              key: 'logout',
              label: tc('logout'),
              icon: LogOut,
              danger: true,
              onSelect: handleLogout,
            },
          ]}
          trigger={
            <button
              className="shrink-0 rounded-md p-1.5 outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={user?.nickname ?? 'User'}
              title={user?.nickname ?? 'User'}
            >
              <Avatar
                src={user?.avatar ?? undefined}
                name={user?.nickname ?? 'U'}
                size="xs"
                className="ring-1 ring-inset ring-border/30"
              />
            </button>
          }
        />
        {!collapsed && (
          <span
            className={cn(
              'min-w-0 truncate text-sm font-medium text-foreground/70 transition-colors group-hover/row:text-foreground',
            )}
          >
            {user?.nickname ?? 'User'}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * 侧边栏'搜索'导航行:点击后通过 portal 将搜索弹层渲染到右侧工作区(#work-area-portal-root),
 * 居中于工作区顶部、向下滑出。提交后跳 /search?q=... 并关闭。
 * 折叠态与展开态行为一致。点击外部 / Esc 键 / 路由变化均会关闭弹层。
 * 实现:createPortal(dropdown, portalTarget) 将 DOM 节点挂载到工作区容器。
 */
function SearchNavItem({
  collapsed,
  active,
  label,
  onCloseMobile,
  refCb,
}: {
  collapsed: boolean
  active: boolean
  label: string
  onCloseMobile: () => void
  refCb: (el: HTMLElement | null) => void
}) {
  const router = useRouter()
  const tc = useTranslations('common')
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsStr = searchParams?.toString()

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
    router.push(`/search?q=${encodeURIComponent(kw)}`)
    setOpen(false)
    onCloseMobile()
  }

  const className = cn(
    NAV_ITEM_BASE_CLASS,
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground/70 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
    collapsed ? NAV_ITEM_COLLAPSED_CLASS : NAV_ITEM_EXPANDED_CLASS,
  )

  // 通过 portal 渲染到右侧工作区容器:绝对定位、水平居中(inset-x-0 + mx-auto,避免
  // 与 slide-in-from-top 动画的 transform 冲突)、顶部向下滑出。
  // 工作区容器 overflow-hidden + rounded-xl 会裁剪初始 translateY(-100%) 状态,
  // 形成从顶部边缘"向下滑出"的视觉效果。
  const dropdown =
    open && portalTarget
      ? createPortal(
          <div
            ref={dropdownRef}
            role="dialog"
            aria-label={tc('searchPlaceholder')}
            className="absolute inset-x-0 top-2 z-50 mx-auto w-[min(640px,calc(100%-2rem))] animate-in fade-in-0 slide-in-from-top duration-200"
          >
            <div className="rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
              <SearchBar
                onSearch={handleSearch}
                placeholder={tc('searchPlaceholder')}
                focusOnMount
              />
            </div>
          </div>,
          portalTarget,
        )
      : null

  const setTriggerRef = (el: HTMLButtonElement | null) => {
    triggerRef.current = el
    refCb(el)
  }

  return (
    <div className="relative">
      {collapsed ? (
        <Tooltip content={label} side="right">
          <button
            type="button"
            ref={setTriggerRef}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-current={active ? 'page' : undefined}
            onClick={() => setOpen((o) => !o)}
            className={className}
          >
            <Search className="h-5 w-5 shrink-0" />
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          ref={setTriggerRef}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-current={active ? 'page' : undefined}
          onClick={() => setOpen((o) => !o)}
          className={className}
        >
          <Search className="h-5 w-5 shrink-0" />
          <span>{label}</span>
        </button>
      )}
      {dropdown}
    </div>
  )
}

interface NavLinkProps {
  item: NavItem
  collapsed: boolean
  active: boolean
  label: string
  onCloseMobile: () => void
  registerRef: (href: string, el: HTMLElement | null) => void
}

function NavLink({ item, collapsed, active, label, onCloseMobile, registerRef }: NavLinkProps) {
  const Icon = item.icon
  const className = cn(
    NAV_ITEM_BASE_CLASS,
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground/70 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
    collapsed ? NAV_ITEM_COLLAPSED_CLASS : NAV_ITEM_EXPANDED_CLASS,
  )
  const refCb = (el: HTMLElement | null) => registerRef(item.href, el)

  if (collapsed) {
    return (
      <Tooltip key={item.href} content={label} side="right">
        <Link
          href={item.href}
          ref={refCb}
          onClick={onCloseMobile}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={className}
        >
          <Icon className="h-5 w-5 shrink-0" />
        </Link>
      </Tooltip>
    )
  }

  return (
    <Link
      key={item.href}
      href={item.href}
      ref={refCb}
      onClick={onCloseMobile}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

interface ExpandableNavItemProps {
  item: NavItem
  collapsed: boolean
  isActive: (href: string) => boolean
  onCloseMobile: () => void
  registerRef: (href: string, el: HTMLElement | null) => void
  t: (key: string) => string
  /**
   * 桌面 / 移动 aside 各自独立 ID 空间,避免 DOM 重复 id。
   * 派生 listId 必须含 scope 才能保证 HTML5 id 唯一性 + SSR/CSR 完全一致(不依赖 useId)。
   */
  scope: 'desktop' | 'mobile'
}

function ExpandableNavItem({
  item,
  collapsed,
  isActive,
  onCloseMobile,
  registerRef,
  t,
  scope,
}: ExpandableNavItemProps) {
  const router = useRouter()
  const children = item.children ?? []
  const parentActive = children.some((child) => isActive(child.href))
  const storageKey = `sidebar-expand-${item.href}`
  // 初始值固定 false,确保 SSR 与客户端首次渲染一致,避免 hydration mismatch。
  // 真实展开状态在 hydration 后由 useEffect 读取(parentActive 优先,其次 localStorage)。
  const [open, setOpen] = React.useState(false)
  // 静态派生 listId(不含 useId),保证 SSR/CSR 字节级一致 + DOM 唯一 id。
  // React 18 useId 在两个 React 树(桌面/移动 aside)间偶发漂移会导致 hydration mismatch + Radix aria-controls 失效。
  const listId = `exp-list-${scope}-${item.href.replace(/[^a-z0-9]+/gi, '-')}`

  // hydration 后读取真实展开状态
  React.useEffect(() => {
    if (parentActive) {
      setOpen(true)
      return
    }
    try {
      setOpen(localStorage.getItem(storageKey) === '1')
    } catch {
      // localStorage 不可用
    }
  }, [parentActive, storageKey])

  // 持久化展开状态到 localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? '1' : '0')
    } catch {
      // localStorage 不可用
    }
  }, [open, storageKey])

  const Icon = item.icon
  const label = t(item.labelKey)

  const parentClassName = cn(
    // group/exp:精简高级的二级菜单指示样式(GitHub/Linear/Notion 风格)
    //   - 闭合态:与普通 NavLink 一致,底部居中一个朝下的小 chevron 提示"可展开"
    //   - 展开态:微弱主色背景(bg-primary/10)+ 主色文本(text-primary)+ 文本加粗 + chevron 旋转 180° 朝上
    //   - 父级激活(子路由命中):bg-primary text-primary-foreground
    //   - focus-visible ring 保留键盘可访问性指示
    // 指示符是 lucide ChevronDown 图标(absolute 定位在按钮底部居中),不是 border/hr/divide-*
    // 不违反项目"禁止分割线"硬约束(规则禁止的是 <hr>、divide-*、单边 border 分隔,不禁止图标指示符)
    'group/exp relative',
    NAV_ITEM_BASE_CLASS,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    parentActive
      ? 'bg-primary text-primary-foreground'
      : open
        ? 'bg-primary/10 text-primary'
        : 'text-foreground/70 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
    collapsed ? NAV_ITEM_COLLAPSED_CLASS : NAV_ITEM_EXPANDED_CLASS,
  )

  const childClassName = (active: boolean) =>
    cn(
      NAV_CHILD_CLASS,
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-foreground/70 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
    )

  const childList = (
    <div id={listId} role="group" aria-label={label} className="flex flex-col gap-0.5">
      {children.map((child) => {
        const ChildIcon = child.icon
        const active = isActive(child.href)
        const childLabel = t(child.labelKey)
        const refCb = (el: HTMLElement | null) => registerRef(child.href, el)
        return (
          <Link
            key={child.href}
            data-testid={`nav-${child.labelKey}`}
            href={child.href}
            ref={refCb}
            onClick={onCloseMobile}
            aria-current={active ? 'page' : undefined}
            className={childClassName(active)}
          >
            <ChildIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{childLabel}</span>
          </Link>
        )
      })}
    </div>
  )

  if (collapsed) {
    return (
      <Dropdown
        side="right"
        align="start"
        items={children.map((child) => ({
          key: child.href,
          label: t(child.labelKey),
          icon: child.icon,
          onSelect: () => {
            router.push(child.href)
            onCloseMobile()
          },
        }))}
        trigger={
          <button
            type="button"
            data-testid={`nav-${item.labelKey}`}
            aria-label={label}
            aria-controls={listId}
            className={parentClassName}
            title={label}
          >
            <Icon className="h-5 w-5 shrink-0" />
          </button>
        }
      />
    )
  }

  return (
    <div>
      <button
        type="button"
        data-testid={`nav-${item.labelKey}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={listId}
        className={parentClassName}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span
          className={cn(
            // 展开态额外加粗,与 bg-primary/10 背景同步强化"已展开"反馈
            'min-w-0 flex-1 whitespace-nowrap transition-all duration-200',
            open && 'font-semibold',
          )}
        >
          {label}
        </span>
        {/*
          二级菜单底部指示符 — 居中横线(absolute 定位在按钮内部底边)
          设计(精简高级时尚,Linear/Notion 风格):
            1. 位置:absolute bottom-1 left-1/2 -translate-x-1/2
               横线完全在按钮内部,距底边 4px,水平居中
            2. 尺寸:w-10(40px)宽 × h-[2px]细线,显眼不抢眼
            3. 颜色(纯 background-color,无 box-shadow/光晕):
               - 闭合态:bg-muted-foreground/40(弱化提示)
               - 展开态:bg-primary(主色,与背景同步强化)
               - 父级激活:bg-primary-foreground/70(在 bg-primary 上要反色)
            4. hover 态:group-hover/exp 升至 /70 透明度,提示可点击
            5. 无动画、无呼吸、无光晕 — 静态精致
          合规说明:
            - 这不是分割线(规则禁止的是 <hr>、divide-*、单边 border-t/b/l/r 作分隔)
            - 这是 absolute 定位的装饰性横线指示符(类似 lucide 图标),居中独立元素
            - 不使用 box-shadow,不违反"扁平化禁不必要 box-shadow"
        */}
        <span
          aria-hidden="true"
          data-testid={`nav-${item.labelKey}-indicator`}
          className={cn(
            'pointer-events-none absolute bottom-1 left-1/2 h-[2px] w-10 -translate-x-1/2 transition-colors duration-200',
            parentActive
              ? 'bg-primary-foreground/70'
              : open
                ? 'bg-primary'
                : 'bg-muted-foreground/40 group-hover/exp:bg-muted-foreground/70',
          )}
        />
      </button>
      {open && <div className="mt-0.5">{childList}</div>}
    </div>
  )
}

export function Sidebar({
  id,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const tchat = useTranslations('aiChat')
  const aiPanelOpen = useAiPanelStore((s) => s.open)
  const toggleAiPanel = useAiPanelStore((s) => s.togglePanel)

  const navRef = React.useRef<HTMLElement>(null)
  const mobileNavRef = React.useRef<HTMLElement>(null)
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map())

  // 桌面端展开态拖拽调整宽度(130-180px),localStorage 持久化
  const [sidebarWidth, setSidebarWidth] = React.useState(SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = React.useState(false)

  // 桌面 / 移动两个 <nav> 必须有不同 id(避免 DOM 重复 id + a11y 工具误判)。
  // 派生自父级传入的 id,SSR/CSR 完全一致,杜绝 useId 漂移导致的 hydration mismatch。
  const desktopNavId = id ? `${id}-desktop` : 'sidebar-nav-desktop'
  const mobileNavId = id ? `${id}-mobile` : 'sidebar-nav-mobile'

  React.useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (saved) {
      const n = Number(saved)
      if (Number.isFinite(n)) {
        setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, n)))
      }
    }
  }, [])

  // 同步当前实际宽度(折叠态用 60px,展开态用 sidebarWidth)到 :root 的 --sidebar-width CSS 变量,
  // 供 AISidePanel 等 fixed 定位组件通过 left: var(--sidebar-width) 紧贴 Sidebar 右侧。
  React.useEffect(() => {
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

  const isActive = React.useCallback(
    (href: string) => {
      if (!pathname.startsWith(href)) return false
      // 更具体的同前缀项优先高亮，避免 /chat 与 /chat/history 同时高亮
      return !ALL_NAV_HREFS.some((h) => h !== href && h.startsWith(href) && pathname.startsWith(h))
    },
    [pathname],
  )

  const isAdmin = (user?.roleId ?? 0) >= 1
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((g) => g.items.length > 0)

  const allVisibleItems = React.useMemo(
    () => flattenNavItems(visibleGroups.flatMap((g) => g.items)),
    [visibleGroups],
  )

  const activeHref = React.useMemo(() => {
    const found = allVisibleItems.find((item) => isActive(item.href))
    return found?.href
  }, [allVisibleItems, isActive])

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
    <TooltipProvider>
      <nav
        ref={ref}
        id={navId}
        aria-label={t('title') ?? '主导航'}
        className={cn(
          'hover-scroll min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto py-2',
          // 滚动条已完全隐藏(globals.css .hover-scroll),不占布局空间。
          // px-2 左右各 8px 对称,折叠态 aside border-r(1px)用 pl-[9px] pr-2 补偿图标视觉中心。
          collapsed ? 'pl-[9px] pr-2' : 'px-2',
        )}
      >
        {/* 新建任务按钮(对齐旧架构 .nav-new-chat,黑白对调主题)
            2026-07-19 用户反馈:整体偏灰,不再用极端黑/白对比;
            改用 bg-foreground/10 + text-foreground,保持"亮色暗色反向对比"特性
            (亮色模式 10% 黑 = 浅灰底 + 黑字 / 暗色模式 10% 白 = 深灰底 + 白字),
            hover 升至 /20 给出明显反馈,但整体仍不抢眼。 */}
        <div className={cn('mb-1', collapsed && 'flex justify-center')}>
          {collapsed ? (
            <Tooltip content={tchat('newConversation')} side="right">
              <button
                type="button"
                onClick={toggleAiPanel}
                aria-label={tchat('newConversation')}
                aria-pressed={aiPanelOpen}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20"
              >
                <Plus className="h-4 w-4" />
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={toggleAiPanel}
              aria-pressed={aiPanelOpen}
              className={cn(
                BTN_NEW_CONVERSATION_CLASS,
                'bg-foreground/10 text-foreground hover:bg-foreground/20',
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">{tchat('newConversation')}</span>
            </button>
          )}
        </div>

        {/* 侧边栏任务列表卡片(展开态显示) */}
        <SidebarChatHistory collapsed={collapsed} />

        {visibleGroups.map((group, gi) => (
          <div key={group.label || `group-${gi}`} className={gi > 0 ? 'pt-2' : ''}>
            {!collapsed && group.label && (
              <div className="px-2.5 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href)
              const label = t(item.labelKey)
              const registerRef = (href: string, el: HTMLElement | null) => {
                if (el) itemRefs.current.set(href, el)
                else itemRefs.current.delete(href)
              }
              if (item.children && item.children.length > 0) {
                return (
                  <ExpandableNavItem
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    isActive={isActive}
                    onCloseMobile={onCloseMobile}
                    registerRef={registerRef}
                    t={t}
                    scope={scope}
                  />
                )
              }
              // 搜索行:展开态承载弹层 + SearchBar,折叠态保留 Link 跳 /search
              if (item.labelKey === 'search') {
                return (
                  <SearchNavItem
                    key={item.href}
                    collapsed={collapsed}
                    active={active}
                    label={label}
                    onCloseMobile={onCloseMobile}
                    refCb={(el) => registerRef(item.href, el)}
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
                />
              )
            })}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  )

  const footer = (
    <TooltipProvider>
      <div className="shrink-0">
        <SidebarActions collapsed={collapsed} />
        <SidebarUserRow collapsed={collapsed} onCloseMobile={onCloseMobile} />
      </div>
    </TooltipProvider>
  )

  const header = (
    <div
      className={cn(
        // header 高 52px。px-2 mx-0 与 nav 的 px-2 对齐:logo 左侧 + collapse 按钮右侧与菜单项左右侧各 8px 对齐。
        // gap-1(4px)让 logo(80) + gap(4) + 按钮(28) = 112px < 内容区 114px,不溢出。
        'flex h-[52px] shrink-0 items-center justify-between gap-1 px-2 mx-0 transition-[padding] duration-200',
        // 折叠态:aside 的 border-r(1px)使内容区 59px,header 居中后按钮会偏左 0.5px。
        // 用 pl-[9px] pr-2 补偿,让按钮回到 60px 视觉中心。
        collapsed && 'justify-center pl-[9px] pr-2 mx-0',
      )}
    >
      {!collapsed && (
        <ThemeLogo
          clickable
          width={80}
          height={26}
          className="h-[26px] w-auto max-w-[80px] flex-shrink-0 cursor-pointer transition-opacity hover:opacity-75"
          onClick={() => router.push('/home')}
        />
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        // h-[26px] 与底部工具栏 icon 按钮/ThemeLogo 统一(原 h-7=28px)
        className={cn('h-[26px] w-[26px] flex-shrink-0 p-0', 'hidden lg:flex')}
        title={collapsed ? t('expand') : t('collapse')}
        aria-label={collapsed ? t('expand') : t('collapse')}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onCloseMobile}
        // h-[26px] 与折叠按钮/底部工具栏统一(原 h-7=28px)
        className="ml-auto h-[26px] w-[26px] flex-shrink-0 p-0 lg:hidden"
        aria-label={tc('close')}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <>
      {/* 桌面端固定侧边栏 */}
      <aside
        aria-label={t('mainNav')}
        className={cn(
          'relative hidden h-screen shrink-0 flex-col overflow-visible bg-background transition-[width] duration-200 lg:flex',
          collapsed && 'w-[60px]',
        )}
        style={
          collapsed
            ? { width: SIDEBAR_COLLAPSED_WIDTH }
            : {
                width: sidebarWidth,
                transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
              }
        }
      >
        {header}
        {navContent(desktopNavId, navRef, 'desktop')}
        {footer}
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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      {/* 移动端抽屉 */}
      <aside
        aria-modal="true"
        aria-label={t('mainNav')}
        role="dialog"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col overflow-visible bg-background transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ width: SIDEBAR_WIDTH }}
      >
        {header}
        {navContent(mobileNavId, mobileNavRef, 'mobile')}
        {footer}
      </aside>
    </>
  )
}

export default Sidebar
