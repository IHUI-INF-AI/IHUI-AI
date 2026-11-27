// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/message-center/MessageCenterScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { MessageCenterScreen } from '@ihui/rn-app/features/message-center/MessageCenterScreen'
import { NoticeDetailSheet } from '@ihui/rn-app/features/message-center/NoticeDetailSheet'
import {
  buildNoticeDetail,
  noticeDetailCopyText,
  readNoticeSessionId,
} from '@ihui/shared/notifications'
import type { MessageCenterItem, NoticeDetailData } from '@ihui/types'
import {
  get,
  post,
  patch,
  del,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { logger } from '@/utils/logger'
import { getTopBarMetrics } from '@/utils/system-info'
import ThemeRoot from '@/components/ThemeRoot'
import {
  NavBar,
  SystemNotice,
  PrivateMessageList,
  MessageDetail,
  MessageActions,
  NotificationSettings,
  type MessageTabItem,
  type SystemNoticeItem,
  type PrivateMessageItem,
  type MessageDetailItem,
  type NotificationSettingItem,
} from '@/components'
// 同目录 ./ 子模块:共享屏 order/course 两类的站内消息卡片(还原度门并入本页载体面)
import { InSiteMessagePane } from './in-site-messages'
import { onToast } from '@/host/on-toast'

/** 与 Web 消息页同页长:通知行走 /notifications,私信会话行走 /messages/list */
type RoomKind = 'notification' | 'conversation'

interface Room {
  id?: string
  name?: string
  lastMessage?: string
  createdAt?: string
  /** 原始 ISO 时间(列表展示用本地化串,详情抽屉要原始串才能再格式化一次) */
  iso?: string
  /** 仅当接口回了数字未读才挂上;缺字段不写成 0 */
  unread?: number
  /** 仅当接口回了布尔已读才挂上 */
  isRead?: boolean
  /** G2 自动化终态深链会话 id(notification.data 里的 sessionId) */
  sessionId?: string
  kind?: RoomKind
}

interface NotificationRow {
  id: string
  title?: string | null
  content?: string | null
  isRead?: boolean
  createdAt?: string
  type?: string | null
  /** notifications.data(jsonb)透传;G2 深链 sessionId 在这里 */
  payload?: unknown
  data?: unknown
}

interface NotificationListRes {
  list?: NotificationRow[]
  total?: number
  /** 列表响应里的未读总数(countUnread),不是某一类的分项 */
  unread?: number
}

interface ConversationRow {
  id: string
  peerName?: string | null
  title?: string | null
  peerAvatar?: string | null
  lastMessage?: string
  lastTime?: string
  unread?: number
}

interface ConversationListRes {
  list?: ConversationRow[]
}

interface HistoryRow {
  id: string
  content: string
  createdAt: string
  isMine?: boolean
}

/** Web 消息页 PageClient 的 PAGE_SIZE */
const PAGE_SIZE = 10

function formatStamp(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const numericUnread = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined

/**
 * 共享屏静态键 → 小程序既有词条。共享屏新增的 4 枚键(searchPh/markRead/deleteConv/loadMore)
 * 已按 §19 与词包同批落到本端五语言,表内不再回声映射。
 */
const MESSAGE_TEXT: Record<string, string> = {
  'messageCenter.settings': 'message.settings',
  'messageCenter.empty': 'message.empty',
  'messageCenter.type.system': 'message.tabs.system',
  'messageCenter.type.social': 'message.tabs.interaction',
}

const EMPTY_ITEMS: MessageCenterItem[] = []

const { menuButton } = getTopBarMetrics()

/** 有 id 且知道走哪条已读端点才给入口 */
const canActRoom = (room: Room): boolean => Boolean(room.id) && Boolean(room.kind)
/**
 * 未读:会话用接口的 unread 数字;通知用 isRead。两个都没有就不算未读,也不补 0。
 */
const roomHasUnread = (room: Room): boolean => {
  if (typeof room.unread === 'number') return room.unread > 0
  if (typeof room.isRead === 'boolean') return room.isRead === false
  return false
}

const DEFAULT_SYSTEM: SystemNoticeItem[] = []
const DEFAULT_PRIVATE: PrivateMessageItem[] = []

export default function MessageIndex() {
  const { t, locale } = useI18n()
  const gate = useAuthReadyGate()
  const [list, setList] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  // XUI-066:四个取数请求都在 catch 里静默忽略,失败只剩空列表;现在如实上抛给共享屏。
  const [loadError, setLoadError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [bannerClosed, setBannerClosed] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedPrivate, setSelectedPrivate] = useState<PrivateMessageItem | null>(null)
  const [detailInput, setDetailInput] = useState('')
  const [detailMessages, setDetailMessages] = useState<MessageDetailItem[]>([])
  const [systemList, setSystemList] = useState<SystemNoticeItem[]>(DEFAULT_SYSTEM)
  /** 系统通知的原始 ISO 时间(id → createdAt);SystemNoticeItem 只有展示串,详情不能再格式化 */
  const [systemIso, setSystemIso] = useState<Record<string, string>>({})
  /** 系统通知的 G2 深链 sessionId(id → sessionId);与 systemIso 同一条投影口径 */
  const [systemSession, setSystemSession] = useState<Record<string, string>>({})
  /** 2026-11-27 三端统一:消息行点击 → 全文抽屉(与 RN/Web 同一份 NoticeDetailSheet) */
  const [noticeDetail, setNoticeDetail] = useState<NoticeDetailData | null>(null)
  const [privateList, setPrivateList] = useState<PrivateMessageItem[]>(DEFAULT_PRIVATE)
  const [tabs, setTabs] = useState<MessageTabItem[]>(() => [
    { key: 'all', label: t('message.tabs.all') },
    { key: 'system', label: t('message.tabs.system') },
    { key: 'order', label: t('messageCenter.type.order') },
    { key: 'course', label: t('messageCenter.type.course') },
    { key: 'interaction', label: t('message.tabs.interaction') },
    { key: 'private', label: t('message.tabs.private') },
  ])
  const [settings, setSettings] = useState<NotificationSettingItem[]>(() => [
    {
      key: 'system',
      label: t('message.notifLabels.system'),
      desc: t('message.notifDescs.system'),
      enabled: true,
    },
    {
      key: 'interaction',
      label: t('message.notifLabels.interaction'),
      desc: t('message.notifDescs.interaction'),
      enabled: true,
    },
    {
      key: 'private',
      label: t('message.notifLabels.private'),
      desc: t('message.notifDescs.private'),
      enabled: true,
    },
    {
      key: 'marketing',
      label: t('message.notifLabels.marketing'),
      desc: t('message.notifDescs.marketing'),
      enabled: false,
    },
  ])

  /** 共享屏词条适配:表内键走小程序既有词条,其余原样交回本端 t */
  const sharedT = useCallback(
    (key: string, params?: Record<string, string | number>) => t(MESSAGE_TEXT[key] ?? key, params),
    [t],
  )

  /**
   * 打开站内消息全文(2026-11-27 三端统一口径):
   * 所有入口(全部/系统/order/course)都投影成同一份 NoticeDetailData,
   * 渲染交给 packages/app 的 NoticeDetailSheet(经 rn-compat 直渲,不端内抄第二份)。
   */
  const openNotice = useCallback(
    (source: {
      id: string
      title?: string | null
      content?: string | null
      type?: string | null
      iso?: string
      read?: boolean
      isRead?: boolean
      sessionId?: string
    }) => {
      setNoticeDetail(
        buildNoticeDetail({
          id: source.id,
          title: source.title,
          content: source.content,
          type: source.type ?? 'system',
          level: 'info',
          createdAt: source.iso ?? '',
          read: source.read ?? source.isRead ?? true,
          sessionId: source.sessionId ?? null,
        }),
      )
    },
    [],
  )

  /** 删除当前站内消息:与 Web/RN 同一条 DELETE /notifications/:id;成功后关抽屉并同步本地列表。 */
  const deleteNotice = useCallback(
    async (detail: NoticeDetailData) => {
      try {
        await del(`/notifications/${encodeURIComponent(detail.id)}`)
        setNoticeDetail(null)
        setList((prev) => prev.filter((room) => room.id !== detail.id))
        setSystemList((prev) => prev.filter((item) => item.id !== detail.id))
      } catch {
        onToast(t('common.failed'), { kind: 'error' })
      }
    },
    [t],
  )

  const setTabUnread = useCallback((key: string, count: number | undefined) => {    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.key !== key) return tab
        if (typeof count === 'number' && count > 0) return { ...tab, unread: count }
        if (tab.unread === undefined) return tab
        const next = { ...tab }
        delete next.unread
        return next
      }),
    )
  }, [])

  /** Web 通知页「全部」:GET /notifications(不带 type)。未读数只用响应里的 unread。 */
  const loadInbox = useCallback(async () => {
    try {
      const res = await get<NotificationListRes>('/notifications', {
        page: 1,
        pageSize: PAGE_SIZE,
      })
      const rooms: Room[] = (res.list ?? []).map((row) => ({
        id: row.id,
        name: row.title ?? '',
        lastMessage: row.content ?? '',
        createdAt: formatStamp(row.createdAt, locale),
        iso: row.createdAt ?? '',
        sessionId: readNoticeSessionId(row.payload ?? row.data) ?? undefined,
        ...(typeof row.isRead === 'boolean' ? { isRead: row.isRead } : {}),
        kind: 'notification' as const,
      }))
      setList(rooms)
      const inboxUnread = numericUnread(res.unread)
      setTabUnread('all', inboxUnread !== undefined && inboxUnread > 0 ? inboxUnread : undefined)
    } catch {
      setLoadError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [locale, setTabUnread, t])

  /** Web 消息页 notice:GET /notifications?type=system。已读只用行上的 isRead。 */
  const loadSystemNotices = useCallback(async () => {
    try {
      const res = await get<NotificationListRes>('/notifications', {
        type: 'system',
        page: 1,
        pageSize: PAGE_SIZE,
      })
      const items: SystemNoticeItem[] = (res.list ?? []).map((row) => ({
        id: row.id,
        title: row.title ?? '',
        content: row.content ?? '',
        ...(row.type === 'system' ? { type: 'system' as const } : {}),
        createdAt: formatStamp(row.createdAt, locale),
        ...(typeof row.isRead === 'boolean' ? { read: row.isRead } : {}),
      }))
      setSystemList(items)
      setSystemIso(
        Object.fromEntries(
          (res.list ?? []).flatMap((row) =>
            typeof row.createdAt === 'string' && row.createdAt.length > 0
              ? [[row.id, row.createdAt] as const]
              : [],
          ),
        ),
      )
      setSystemSession(
        Object.fromEntries(
          (res.list ?? []).flatMap((row) => {
            const sid = readNoticeSessionId(row.payload ?? row.data)
            return sid ? [[row.id, sid] as const] : []
          }),
        ),
      )
    } catch {
      setLoadError(t('common.loadFailed'))
    }
  }, [locale, t])

  /** Web 私信页:GET /messages/list。unread 原样透传,缺字段不补 0,也不编在线状态。 */
  const loadPrivateMessages = useCallback(async () => {
    try {
      const res = await get<ConversationListRes>('/messages/list', {
        page: 1,
        pageSize: PAGE_SIZE,
      })
      const items: PrivateMessageItem[] = (res.list ?? []).map((row) => {
        const unread = numericUnread(row.unread)
        return {
          id: row.id,
          userId: row.id,
          userName: row.peerName || row.title || '',
          ...(row.peerAvatar ? { userAvatar: row.peerAvatar } : {}),
          lastMessage: row.lastMessage ?? '',
          lastTime: formatStamp(row.lastTime, locale),
          ...(unread !== undefined ? { unread } : {}),
        }
      })
      setPrivateList(items)
      const known = items.flatMap((item) => (typeof item.unread === 'number' ? [item.unread] : []))
      const sum = known.reduce((total, count) => total + count, 0)
      setTabUnread('private', known.length > 0 && sum > 0 ? sum : undefined)
    } catch {
      setLoadError(t('common.loadFailed'))
    }
  }, [locale, setTabUnread, t])

  const loadPreferences = useCallback(async () => {
    try {
      const res: NotificationPreferences = await getNotificationPreferences()
      const items: NotificationSettingItem[] = [
        {
          key: 'system',
          label: t('message.notifLabels.system'),
          desc: t('message.notifDescs.system'),
          enabled: res.inAppEnabled,
        },
        {
          key: 'interaction',
          label: t('message.notifLabels.interaction'),
          desc: t('message.notifDescs.interaction'),
          enabled: res.pushEnabled,
        },
        {
          key: 'private',
          label: t('message.notifLabels.private'),
          desc: t('message.notifDescs.private'),
          enabled: res.inAppEnabled,
        },
        {
          key: 'marketing',
          label: t('message.notifLabels.marketing'),
          desc: t('message.notifDescs.marketing'),
          enabled: res.smsEnabled,
        },
      ]
      setSettings(items)
    } catch {
      setLoadError(t('common.loadFailed'))
    }
  }, [t])

  const load = useCallback(async () => {
    setLoadError('')
    await Promise.all([loadInbox(), loadSystemNotices(), loadPrivateMessages(), loadPreferences()])
  }, [loadInbox, loadSystemNotices, loadPrivateMessages, loadPreferences])

  // 冷启动门控:通知列表 / 系统通知 / 会话列表 / 通知偏好均需鉴权,判定落定前整批不发
  useDidShow(() => gate.waitUntilReady(() => void load()))

  const notification = useMemo(() => {
    if (bannerClosed) return undefined
    const unreadRoom = list.find((r) => roomHasUnread(r))
    const target = unreadRoom || list[0]
    if (!target || !target.lastMessage) return undefined
    // 共享屏横幅无关闭按钮 ⇒ 点按横幅关闭,保留原 onClose 的可撤销语义
    return { text: target.lastMessage, onPress: () => setBannerClosed(true) }
  }, [list, bannerClosed])

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    if (!kw) return list
    return list.filter((r) => (r.name || '').includes(kw))
  }, [list, keyword])

  const onTabChange = (k: string) => setActiveTab(k)

  /**
   * 标记已读,与 Web 同出口:通知 PATCH /notifications/:id/read,
   * 会话 POST /messages/:id/read。成功只改本行已读,不把缺字段写成 0。
   */
  const onRoomMarkRead = (room: Required<Pick<Room, 'id'>> & Room) => {
    const encoded = encodeURIComponent(room.id)
    const call =
      room.kind === 'conversation'
        ? post(`/messages/${encoded}/read`)
        : patch(`/notifications/${encoded}/read`)
    void call
      .then(() => {
        setList((prev) =>
          prev.map((r) => (r.id === room.id ? { ...r, isRead: true, unread: undefined } : r)),
        )
      })
      .catch(() => {
        onToast(t('common.failed'), { kind: 'error' })
      })
  }

  const onOpenPrivate = async (item: PrivateMessageItem) => {
    setSelectedPrivate(item)
    setDetailMessages([])
    try {
      const res = await get<{ list?: HistoryRow[] }>(
        `/messages/${encodeURIComponent(item.id)}/history`,
      )
      setDetailMessages(
        (res.list ?? []).map((row) => ({
          id: row.id,
          content: row.content,
          createdAt: formatStamp(row.createdAt, locale),
          self: row.isMine === true,
        })),
      )
      if (typeof item.unread === 'number' && item.unread > 0) {
        void post(`/messages/${encodeURIComponent(item.id)}/read`)
          .then(() => {
            setPrivateList((prev) =>
              prev.map((row) => (row.id === item.id ? { ...row, unread: undefined } : row)),
            )
          })
          .catch(() => {
            onToast(t('common.failed'), { kind: 'error' })
          })
      }
    } catch (e) {
      logger.error('message', '加载历史消息', e)
      setDetailMessages([])
      onToast(t('common.loadFailed'), { kind: 'error' })
    }
  }

  const onSendDetail = () => {
    const text = detailInput.trim()
    if (!text || !selectedPrivate) return
    void post<{ message?: { id: string; content: string; createdAt: string; isMine?: boolean } }>(
      '/messages/send',
      { conversationId: selectedPrivate.id, content: text },
    )
      .then((res) => {
        const message = res.message
        if (!message) return
        setDetailMessages((prev) => [
          ...prev,
          {
            id: message.id,
            content: message.content,
            createdAt: formatStamp(message.createdAt, locale),
            self: message.isMine !== false,
          },
        ])
        setDetailInput('')
      })
      .catch(() => {
        onToast(t('common.failed'), { kind: 'error' })
      })
  }

  const onToggleSetting = async (key: string, enabled: boolean) => {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, enabled } : s)))
    try {
      const pref: Partial<NotificationPreferences> = {}
      if (key === 'system' || key === 'private') pref.inAppEnabled = enabled
      if (key === 'interaction') pref.pushEnabled = enabled
      if (key === 'marketing') pref.smsEnabled = enabled
      await updateNotificationPreferences(pref)
    } catch {
      // ignore - local state already updated
    }
  }

  /**
   * 共享屏缺段(进缺段表,不造字段):聚合会话行、系统通知、私信列表、order/course 站内消息
   * 由本端注入;'all' 空态返回 null ⇒ 交回共享屏 EmptyState,'interaction' 同。
   */
  const renderTabBody = (tab: string) => {
    if (tab === 'order' || tab === 'course') {
      return (
        <InSiteMessagePane
          msgType={tab}
          onOpen={(row) =>
            openNotice({
              id: row.id,
              title: row.title,
              content: row.content,
              type: row.msgType,
              iso: row.createdAt,
              isRead: row.isRead,
            })
          }
        />
      )
    }
    if (tab === 'system') {
      return (
        <SystemNotice
          list={systemList}
          onClick={(item) => {
            openNotice({
              id: item.id,
              title: item.title,
              content: item.content,
              type: 'system',
              iso: systemIso[item.id],
              read: item.read ?? true,
              sessionId: systemSession[item.id],
            })
            if (item.read !== false) return
            void patch(`/notifications/${encodeURIComponent(item.id)}/read`)
              .then(() => {
                setSystemList((prev) =>
                  prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)),
                )
              })
              .catch(() => {
                onToast(t('common.failed'), { kind: 'error' })
              })
          }}
        />
      )
    }
    if (tab === 'private') {
      return <PrivateMessageList list={privateList} onClick={onOpenPrivate} />
    }
    if (tab !== 'all') return null
    if (loading) {
      return (
        <Text className="block text-center text-body text-muted-foreground py-[96rpx]">
          {t('common.loading')}
        </Text>
      )
    }
    if (!filtered.length) return null
    return (
      <View className="space-y-2 p-[20rpx]">
        <Text className="block text-body-sm font-semibold text-muted-foreground">
          {t('messageCenter.conversations')}
        </Text>
        {filtered.map((room) => {
          const unread = roomHasUnread(room)
          return (
            <View
              key={(room.id || room.name) as string}
              className={`flex flex-row items-start gap-[24rpx] rounded-lg border border-stroke-default px-[32rpx] py-[24rpx] ${
                unread ? 'bg-primary/5' : 'bg-card'
              }`}
              onClick={() => {
                if (room.id) {
                  openNotice({
                    id: room.id,
                    title: room.name,
                    content: room.lastMessage,
                    type: 'system',
                    iso: room.iso,
                    isRead: room.isRead,
                    sessionId: room.sessionId,
                  })
                }
                if (room.id && canActRoom(room) && room.isRead === false) {
                  onRoomMarkRead(room as { id: string } & Room)
                }
              }}
            >
              <View className="flex h-[64rpx] w-[64rpx] shrink-0 items-center justify-center rounded-lg bg-muted">
                <Text className="text-body font-semibold text-foreground">
                  {(room.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex flex-row items-center gap-[16rpx]">
                  <Text
                    className={`truncate text-body font-medium ${
                      unread ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {room.name || t('message.unnamedRoom')}
                  </Text>
                  {unread ? (
                    <View className="h-[12rpx] w-[12rpx] shrink-0 rounded-full bg-primary" />
                  ) : null}
                </View>
                <Text className="mt-[4rpx] line-clamp-2 text-label text-muted-foreground">
                  {room.lastMessage || t('message.empty')}
                </Text>
                {room.createdAt ? (
                  <Text className="mt-[8rpx] text-label tabular-nums text-muted-foreground">
                    {room.createdAt}
                  </Text>
                ) : null}
              </View>
              {canActRoom(room) && unread ? (
                <MessageActions
                  onMarkRead={() => onRoomMarkRead(room as { id: string } & Room)}
                  markReadLabel={t('messageCenter.markRead')}
                />
              ) : null}
            </View>
          )
        })}
      </View>
    )
  }

  if (selectedPrivate) {
    return (
      <ThemeRoot>
        <View className="min-h-screen bg-background">
          <NavBar
            title={selectedPrivate.userName}
            showBack
            onBack={() => setSelectedPrivate(null)}
          />
          <View style={{ height: `${menuButton.top + menuButton.height + 8}px` }} />
          <View style={{ height: 'calc(100vh - 60px)' }}>
            <MessageDetail
              userName={selectedPrivate.userName}
              userAvatar={undefined}
              messages={detailMessages}
              inputValue={detailInput}
              onInput={setDetailInput}
              onSend={onSendDetail}
            />
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      <MessageCenterScreen
        t={sharedT}
        items={EMPTY_ITEMS}
        activeTab={activeTab}
        onSelectTab={onTabChange}
        tabs={tabs}
        loading={loading}
        refreshing={false}
        error={loadError}
        onRefresh={() => void load()}
        search={
          activeTab === 'all'
            ? {
                value: keyword,
                placeholder: sharedT('messageCenter.searchPh'),
                onChangeText: setKeyword,
              }
            : undefined
        }
        notification={notification}
        onPressSettings={() => setShowSettings(true)}
        onBack={() => void Taro.navigateBack()}
        emptyText={keyword ? t('message.notFound') : t('message.empty')}
        renderTabBody={renderTabBody}
        onToast={onToast}
      />
      {/* 全文抽屉:与 RN 共用 packages/app 的同一份 NoticeDetailSheet(经 rn-compat 直渲) */}
      {noticeDetail && (
        <NoticeDetailSheet
          t={sharedT}
          visible
          detail={noticeDetail}
          onClose={() => setNoticeDetail(null)}
          onDelete={(detail) => void deleteNotice(detail)}
          onCopy={(detail) => {
            void Taro.setClipboardData({ data: noticeDetailCopyText(detail) })
          }}
          // G2 深链与 Web「查看会话」同义:小程序聊天页认 sessionId 参数
          onOpenSession={(sessionId) => {
            setNoticeDetail(null)
            void Taro.navigateTo({
              url: `/pkg-ai/ai/chat?sessionId=${encodeURIComponent(sessionId)}`,
            }).catch(() => onToast(t('common.failed'), { kind: 'error' }))
          }}
          colorScheme="light"
        />
      )}
      {showSettings && (
        <View
          className="fixed inset-0 z-[2000]"
          style={{ background: 'var(--color-black-50)' }}
          onClick={() => setShowSettings(false)}
        >
          <View
            className="absolute bottom-0 left-0 right-0 bg-card ui-panel rounded-t-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            hoverClass="opacity-60"
          >
            <View className="flex items-center justify-between px-lg py-md mb-sm">
              <Text className="text-body font-medium text-foreground">
                {t('message.notificationSettings')}
              </Text>
              <Text
                className="text-body text-muted-foreground"
                onClick={() => setShowSettings(false)}
              >
                {t('message.close')}
              </Text>
            </View>
            <NotificationSettings items={settings} onToggle={onToggleSetting} />
          </View>
        </View>
      )}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
