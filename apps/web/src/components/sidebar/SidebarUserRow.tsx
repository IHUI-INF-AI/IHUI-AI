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
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useMounted } from '@/hooks/use-mounted'
import { useLanguageStore, type Language } from '@/stores/language'
import { useNotificationStore } from '@/stores/notification'
import { useAnalytics } from '@/hooks/use-analytics'
import { useDownloadTrack } from '@ihui/shared/hooks'
import { formatDateOnly, formatTimeOnly } from '@/lib/date-utils'
import { DOWNLOADS, isDownloadAvailable, isExternalDownloadHref } from '@/lib/downloads'
import { liveEntryView } from '@/config/downloads-live-meta'
import { useLiveDownloads } from '@/hooks/use-live-downloads'
import { Avatar } from '@/components/data/Avatar'
import { Dropdown, Modal, type DropdownItem } from '@/components/feedback'
import {
  NotificationCenter,
  type NoticeItem,
  type PendingDecisionView,
} from '@/components/feature-center'
import { LANGUAGES } from './nav-data'
import { useChatStore } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import {
  getNotifications,
  listPendingDecisions,
  markAllNotificationsRead,
  markNotificationRead,
} from '@ihui/api-client'

/**
 * 从 WS 通知条目的业务载荷里读会话深链 id(G2 自动化结果推送,2026-10-30)。
 * 载荷来源:shared 的 transformWsNotification 把 `data.data` 原样透传为 `payload`;
 * 字段缺失/形态不对时返回 null(侧栏只是不渲染深链,不因此丢整条通知)。
 */
function readNoticeSessionId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const sid = (payload as Record<string, unknown>).sessionId
  return typeof sid === 'string' && sid.length > 0 ? sid : null
}

/** 二级菜单里的消息时间:当天只显示时分,跨天显示日期(时区口径由 date-utils 统一)。 */
function formatNoticeTime(iso: string): string {
  const day = formatDateOnly(iso)
  return day === formatDateOnly(new Date()) ? formatTimeOnly(iso) : day
}

/** 消息类型视觉档(飞书式列表行:左侧圆形类型图标 + 标题/摘要 + 右侧时间)。
 *  与 NotificationCenter 的 TYPE_META 同源同义,新增类型时两处一起改。 */
const NOTICE_META: Record<NoticeItem['type'], { icon: LucideIcon; tone: string }> = {
  info: { icon: Info, tone: 'bg-primary/10 text-primary' },
  success: { icon: CheckCircle2, tone: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  warning: { icon: AlertTriangle, tone: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  error: { icon: XCircle, tone: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

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
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const hydrateNotifications = useNotificationStore((s) => s.hydrateNotifications)
  const { trackClick } = useAnalytics()
  const trackDownload = useDownloadTrack()
  // 下载栏的版本号/落点改由运行期真值投影(/downloads.json);取不到时保持构建期底稿
  const liveDownloads = useLiveDownloads()
  // hydration-safe: 首屏按"未登录"渲染,挂载后才显示真实态,避免 SSR/CSR 不一致
  const mounted = useMounted()
  const showAuthed = mounted && isAuthenticated
  // hydration-safe: next-themes 的 theme 在 SSR 返回 undefined,未挂载时固定 Moon + "深色",
  // 挂载后再切真实态(与原 SidebarActions 同策略)。
  const isDark = mounted && resolvedTheme === 'dark'
  const [msgOpen, setMsgOpen] = React.useState(false)

  // D193 决策收件箱装车链(2026-09-30):打开站内消息弹窗 → 只读取数 → 渲染"待我决策"区。
  // null = 未取数/取数中(整区隐藏);[] = 取数失败或确实为空(渲染空态,只读查询不打扰)。
  const [pendingDecisions, setPendingDecisions] = React.useState<PendingDecisionView[] | null>(null)
  React.useEffect(() => {
    if (!msgOpen) return
    let cancelled = false
    listPendingDecisions()
      .then((res) => {
        if (!cancelled) setPendingDecisions(res.data?.items ?? [])
      })
      .catch(() => {
        // 静默落空态:收件箱是只读增强,失败不弹任何打扰
        if (!cancelled) setPendingDecisions([])
      })
    return () => {
      cancelled = true
    }
  }, [msgOpen])

  // 2026-11-11:站内消息二级菜单要显示"真实内容",但 store 此前只接 WS 推送、
  // 从不拉服务端列表 —— 角标有数字、菜单却恒为空。这里登录后拉一次首页列表做缓存,
  // 角标仍以服务端 unread-count 为准(hydrateNotifications 不重算计数)。
  React.useEffect(() => {
    if (!showAuthed) return
    let cancelled = false
    getNotifications({ page: 1, pageSize: 20 })
      .then((res) => {
        if (cancelled || !res.success || !res.data?.list) return
        hydrateNotifications(res.data.list)
      })
      .catch(() => {
        // 静默失败:消息预览是增强项,拉取失败不影响侧栏其余功能
      })
    return () => {
      cancelled = true
    }
  }, [showAuthed, hydrateNotifications])

  // 点击待决策条目:有 threadId → 切会话(与 sidebar-chat-history handleSelect 同机制);
  // 无 threadId → 只开面板。随后开 AI 面板 + 关弹窗 + 收起移动端侧栏。
  const setConversationId = useChatStore((s) => s.setConversationId)
  const openPanel = useAiPanelStore((s) => s.openPanel)
  const handleDecisionItemClick = (item: PendingDecisionView) => {
    if (item.threadId) setConversationId(item.threadId)
    openPanel()
    setMsgOpen(false)
    onCloseMobile()
  }

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
    // G2 结果推送(2026-10-30):保留原始 type + 会话深链 —— WS 载荷的 data.sessionId
    // 经 shared 适配器透传到 payload,侧栏据此渲染「查看会话」。
    rawType: n.type,
    sessionId: readNoticeSessionId(n.payload),
  }))

  /** 点「查看会话」:切到该会话 + 关弹窗 + 收起移动端侧栏(与待决策条目同一套收尾)。 */
  const handleNoticeSessionLink = (sessionId: string) => {
    setConversationId(sessionId)
    setMsgOpen(false)
    onCloseMobile()
  }

  /**
   * 2026-11-11 用户反馈:点「全部已读」后红点又回来 —— 旧实现只改本地 store,
   * 服务端仍是未读,重新挂载时 unread-count / 列表快照把红点原样拉回。
   * 这里改为双写:先乐观更新本地(即时反馈),再落服务端(刷新后不回潮)。
   */
  const handleMarkAllRead = () => {
    markAllAsRead()
    void markAllNotificationsRead().catch(() => {
      // 落库失败只影响下次刷新的一致性,不打断当前交互
    })
  }

  /** 单条已读同样双写,否则刷新后该条红点复活 */
  const handleNoticeRead = (id: string) => {
    markAsRead(id)
    void markNotificationRead(id).catch(() => {})
  }

  // 2026-11-11 用户要求:悬停「站内消息」直接展开二级菜单显示消息内容,
  // 不必先点开完整通知弹窗。最多取最近 6 条(store 已是最新在前),
  // 点击条目 = 标记已读 + 自动化终态通知直接深链回会话;底部「查看全部通知」进入完整通知中心。
  // 2026-11-11 二次改:列表行按飞书消息列表样式 —— 圆形类型图标 + 加粗标题/灰色摘要 + 右侧时间与未读红点。
  const messagePreviewItems: DropdownItem[] = noticeItems.slice(0, 6).map((n) => {
    const Meta = NOTICE_META[n.type]
    const Icon = Meta.icon
    return {
      key: `notice-${n.id}`,
      itemClassName: 'items-start rounded-md px-2.5 py-2',
      label: (
        <span className="flex w-full min-w-0 items-start gap-2.5">
          <span
            className={cn(
              'mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              Meta.tone,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-body',
                  n.read ? 'text-foreground/70' : 'font-medium text-foreground',
                )}
              >
                {n.title}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatNoticeTime(n.createdAt)}
              </span>
            </span>
            {n.description && (
              <span className="mt-0.5 block truncate text-label text-muted-foreground">
                {n.description}
              </span>
            )}
          </span>
          <span
            className={cn(
              'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
              !n.read ? 'bg-red-500' : 'bg-transparent',
            )}
          />
        </span>
      ),
      onSelect: () => {
        handleNoticeRead(n.id)
        if (n.sessionId) handleNoticeSessionLink(n.sessionId)
      },
    }
  })

  // 原 SidebarActions 的 5 个工具项(除"设置"已有外,其余全部迁入):
  // 站内消息(未读徽标 + 悬停二级菜单预览)/ 语言(子菜单,当前项勾选)/
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
      contentClassName: 'w-80 p-2',
      // 空态也要保留「查看全部通知」入口 —— 绝不能因为没拉到条目就把整条消息入口做成死路。
      children: [
        ...(messagePreviewItems.length > 0
          ? messagePreviewItems
          : [
              {
                key: 'messages-empty',
                // 不设 disabled:空态只是占位文案,禁用态的半透明反而更脏
                itemClassName:
                  'cursor-default justify-center px-2.5 py-6 text-label text-muted-foreground focus:bg-transparent',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5" />
                    {t('messagesEmpty')}
                  </span>
                ),
              } as DropdownItem,
            ]),
        {
          key: 'messages-view-all',
          // 底部入口做成整块分隔式 footer:去掉圆角与左侧内边距,顶部一条细分隔线
          itemClassName:
            'mt-1 justify-center rounded-none border-t border-border/60 px-2.5 pt-2 text-label font-medium text-muted-foreground',
          label: t('messagesViewAll'),
          onSelect: () => setMsgOpen(true),
        },
      ],
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
        // 运行期真值优先,判据单源 = downloads-live-meta 的 liveEntryView(与详情页 mergeLiveMeta 同规则);
        // 取不到时照旧用构建期底稿 —— 这条腿挂掉的可见表现必须是"版本号旧一格",不是"整栏点不动"
        const liveView = liveEntryView(liveDownloads?.[dl.platform], dl.href)
        const href = liveView.href
        const version = liveView.version ?? dl.version
        const available = isDownloadAvailable(dl.platform) || liveView.hasLiveAsset
        const isExternal = isExternalDownloadHref(href)
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
                {version && available && (
                  <span className="shrink-0 rounded-sm bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground">
                    v{version}
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
              window.open(href, '_blank', 'noopener,noreferrer')
            } else {
              navigate(href)
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
            <div className="truncate text-body font-medium">{user?.nickname ?? 'User'}</div>
            {user?.phone && (
              <div className="font-[weight:inherit] truncate text-label text-muted-foreground">
                {user.phone}
              </div>
            )}
          </div>
        </div>
      ),
    },
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
    {
      key: 'logout',
      label: tc('logout'),
      icon: LogOut,
      danger: true,
      onSelect: handleLogout,
    },
  ]

  // 未登录 = 同一套工具项 + 登录(替代原独立登录按钮的直接打开行为)
  const guestMenuItems: DropdownItem[] = [
    ...actionItems,
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
        // 2026-10-16 CLS 修复:旧值 p-1(text-sm + h-3.5 图标 ⇒ 内容 20px + 上下各 4px = 28px),
        // 而已登录态 userTrigger 是 h-9(36px)。实测 @1280px /checkin 量到
        // `div.shrink-0` 160x36@0,864 -> 160x44@0,856 —— auth store 是 zustand persist,
        // 首帧 showAuthed=false 渲染矮一号的登录按钮,rehydrate 后换成高的用户行,整条底栏上下跳 8px。
        // 这里改 h-9 + px-1:与 userTrigger、与导航项行高(NavLink h-9)三方严格同高,
        // 既消除位移,也顺带修掉「登录按钮比旁边导航项矮一截」的观感不一致。
        // 2026-11-11 实测(1440×900):外框本来就是 144×36,与 NavLink 完全一致;
        // 肉眼"不一样大"来自内部四处不同 —— 圆角 4px vs 6px、内边距 4px vs 10px、
        // 图标 14px vs 20px、字号 body vs sm。这里按 NAV_ITEM_BASE_CLASS 口径逐项对齐
        // (圆角除外:按钮是 control 档=sm,守门 150 于 2026-11-11 根治时定档);
        // 同时去掉 justify-center,内容与导航项一样左对齐(与已登录态 userTrigger 同源)。
        'flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-body font-medium transition-colors bg-foreground text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
    >
      <LogIn className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{tc('login')}</span>}
    </button>
  )

  // 已登录态 trigger:头像 + 用户名整行,任意位置点击都打开菜单(承继 v4 结构)。
  const userTrigger = (
    <button
      aria-label={user?.nickname ?? 'User'}
      className={cn(
        // 整行 row 容器样式:与 NAV_ITEM_BASE_CLASS 对齐 —— h-9 + px-2.5 + gap-2.5 +
        // text-sm,左对齐(不再居中)。圆角按角色表取 control=sm(守门 150,2026-11-11 根治),
        // 与导航项(chip=md)的 2px 差由角色表裁决。
        'font-[weight:inherit] group/row flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-body transition-colors hover:bg-sidebar-item-hover-bg',
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
            'min-w-0 truncate text-body font-medium text-foreground/70 transition-colors group-hover/row:text-foreground',
          )}
        >
          {user?.nickname ?? 'User'}
        </span>
      )}
    </button>
  )

  return (
    // 机主 2026-10-21 定档:这一格不做任何透明/玻璃效果 —— 纯色底(与侧栏同源)+ 上下对称 8px。
    <div className="px-2 py-2 bg-background">
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
          5) 只有当 sidebar 拖到极窄(SIDEBAR_MIN_WIDTH 最小)+ 长昵称(8 字+)时,span 才用 `min-w-0 truncate` 截断,
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
          Modal 提供卡片外观与右上角关闭按钮。p-0:让列表行贴边到卡片圆角,内边距由头部/行自己控。 */}
      <Modal
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
        size="md"
        className="overflow-hidden p-0"
      >
        <NotificationCenter
          items={noticeItems}
          onMarkAllRead={handleMarkAllRead}
          pendingDecisions={pendingDecisions ?? undefined}
          onDecisionItemClick={handleDecisionItemClick}
          onSessionLinkClick={handleNoticeSessionLink}
        />
      </Modal>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
