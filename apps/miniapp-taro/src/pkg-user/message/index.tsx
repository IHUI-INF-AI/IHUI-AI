// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/message-center/MessageCenterScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import {
  getMessageRooms,
  getSystemNotices,
  getPrivateMessages,
  getNotificationPreferences,
  updateNotificationPreferences,
  markRoomRead,
  type AggregateMessages,
  type NotificationPreferences,
} from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { IHUI_KEY_PREFIX } from '@/constants/storage'
import { getUserInfo } from '@/utils/auth'
import { logger } from '@/utils/logger'
import { getTopBarMetrics } from '@/utils/system-info'
import ThemeRoot from '@/components/ThemeRoot'
import {
  NavBar,
  MessageTabs,
  SystemNotice,
  PrivateMessageList,
  MessageDetail,
  UnreadBadge,
  MessageActions,
  NotificationSettings,
  SearchBar,
  type MessageTabItem,
  type SystemNoticeItem,
  type PrivateMessageItem,
  type MessageDetailItem,
  type NotificationSettingItem,
} from '@/components'
// 同目录 ./ 子模块:共享屏 order/course 两类的站内消息卡片(还原度门并入本页载体面)
import { InSiteMessagePane } from './in-site-messages'

interface Room {
  id?: string
  name?: string
  lastMessage?: string
  unreadCount?: number
  unread?: number
  isUnread?: boolean
  /** 数据来源桶:aggregate 三类房间的已读出口不同(只有私信有 markRoomRead 端点) */
  kind?: 'announcement' | 'private' | 'system'
}

const { menuButton } = getTopBarMetrics()

/** 系统通知 / 私信两个列表的页大小(与 RN wrapper 的 PAGE_SIZE 同值,后端默认也是 20) */
const PAGE_SIZE = 20

/**
 * 已删除会话的本地屏蔽表。
 *
 * 本页聚合数据源 `GET /messages/aggregate` 没有删除端点(公告 / 系统通知 / 私信三类房间
 * 都没有端内可用的删除出口),所以「删除会话」= 本地移除 + 记入本表,保证 `useDidShow`
 * 重拉后不会复活。key 前缀取 `@/constants/storage` 的 `IHUI_KEY_PREFIX`(页面不硬编码
 * 完整字面 key,该前缀也是内存告警清理的识别面)。
 */
const HIDDEN_CONV_KEY = `${IHUI_KEY_PREFIX}msg_center_hidden_convs`

function readHiddenConvIds(): string[] {
  try {
    const raw: unknown = Taro.getStorageSync(HIDDEN_CONV_KEY)
    if (!raw) return []
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    // storage 读不到 ⇒ 不屏蔽任何行(失效方向 = 多显示,不丢数据)
    return []
  }
}

function writeHiddenConvIds(ids: string[]): void {
  try {
    Taro.setStorageSync(HIDDEN_CONV_KEY, JSON.stringify(ids))
  } catch {
    // storage 不可用不阻断删除本身:本次会话内已从 state 移除
  }
}

type SystemNoticeRaw = Awaited<ReturnType<typeof getSystemNotices>>['list'][number]
type PrivateMessageRaw = Awaited<ReturnType<typeof getPrivateMessages>>['list'][number]

function toSystemNoticeItem(s: SystemNoticeRaw): SystemNoticeItem {
  return {
    id: s.id,
    title: s.title,
    content: s.content || '',
    type: (s.type === 'activity' || s.type === 'upgrade' ? s.type : 'system') as
      'system' | 'activity' | 'upgrade',
    createdAt: s.createdAt,
    read: false,
  }
}

function toPrivateMessageItem(p: PrivateMessageRaw): PrivateMessageItem {
  return {
    id: String(p.id),
    userId: p.senderId,
    userName: p.senderId,
    lastMessage: p.content,
    lastTime: p.createdAt,
    unread: p.isRead ? 0 : 1,
    online: false,
  }
}

const DEFAULT_SYSTEM: SystemNoticeItem[] = []
const DEFAULT_PRIVATE: PrivateMessageItem[] = []

export default function MessageIndex() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [list, setList] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [bannerClosed, setBannerClosed] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedPrivate, setSelectedPrivate] = useState<PrivateMessageItem | null>(null)
  const [detailInput, setDetailInput] = useState('')
  const [detailMessages, setDetailMessages] = useState<MessageDetailItem[]>([])
  const [systemList, setSystemList] = useState<SystemNoticeItem[]>(DEFAULT_SYSTEM)
  const [privateList, setPrivateList] = useState<PrivateMessageItem[]>(DEFAULT_PRIVATE)
  // 系统通知 / 私信两个列表的分页游标与「还有更多」判据(接口不回 total,以整页返回作判据)
  const [sysPage, setSysPage] = useState(1)
  const [sysHasMore, setSysHasMore] = useState(false)
  const [privPage, setPrivPage] = useState(1)
  const [privHasMore, setPrivHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [tabs, setTabs] = useState<MessageTabItem[]>(() => [
    { key: 'all', label: t('message.tabs.all') },
    { key: 'system', label: t('message.tabs.system'), unread: 0 },
    { key: 'order', label: t('messageCenter.type.order') },
    { key: 'course', label: t('messageCenter.type.course') },
    { key: 'interaction', label: t('message.tabs.interaction'), unread: 0 },
    { key: 'private', label: t('message.tabs.private'), unread: 0 },
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

  const loadAggregate = useCallback(async () => {
    try {
      const res: AggregateMessages = await getMessageRooms()
      const hidden = new Set(readHiddenConvIds())
      const rooms: Room[] = []
      for (const ann of res.announcements || []) {
        if (hidden.has(ann.id)) continue
        rooms.push({
          id: ann.id,
          name: ann.title,
          lastMessage: ann.content || '',
          unreadCount: 0,
          kind: 'announcement',
        })
      }
      for (const priv of res.privateMessages || []) {
        const id = String(priv.id)
        if (hidden.has(id)) continue
        rooms.push({
          id,
          name: priv.senderId,
          lastMessage: priv.content,
          unreadCount: priv.isRead ? 0 : 1,
          isUnread: !priv.isRead,
          kind: 'private',
        })
      }
      for (const sys of res.systemNotices || []) {
        if (hidden.has(sys.id)) continue
        rooms.push({
          id: sys.id,
          name: sys.title,
          lastMessage: sys.content || '',
          unreadCount: 0,
          kind: 'system',
        })
      }
      setList(rooms)
      setTabs([
        { key: 'all', label: t('message.tabs.all') },
        { key: 'system', label: t('message.tabs.system'), unread: res.unreadCount?.system || 0 },
        { key: 'order', label: t('messageCenter.type.order') },
        { key: 'course', label: t('messageCenter.type.course') },
        { key: 'interaction', label: t('message.tabs.interaction'), unread: 0 },
        { key: 'private', label: t('message.tabs.private'), unread: res.unreadCount?.private || 0 },
      ])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadSystemNotices = useCallback(async () => {
    try {
      const res = await getSystemNotices({ page: 1, pageSize: PAGE_SIZE })
      const raw = res.list || []
      const hidden = new Set(readHiddenConvIds())
      setSystemList(raw.map(toSystemNoticeItem).filter((s) => !hidden.has(s.id)))
      setSysPage(1)
      // 接口只回 page/pageSize 不回 total:末页未满 ⇒ 没有更多
      setSysHasMore(raw.length === PAGE_SIZE)
    } catch {
      // ignore
    }
  }, [])

  const loadPrivateMessages = useCallback(async () => {
    try {
      const res = await getPrivateMessages({ page: 1, pageSize: PAGE_SIZE })
      const raw = res.list || []
      const hidden = new Set(readHiddenConvIds())
      setPrivateList(raw.map(toPrivateMessageItem).filter((p) => !hidden.has(p.id)))
      setPrivPage(1)
      setPrivHasMore(raw.length === PAGE_SIZE)
    } catch {
      // ignore
    }
  }, [])

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
      // ignore - keep defaults
    }
  }, [t])

  const load = useCallback(async () => {
    await Promise.all([
      loadAggregate(),
      loadSystemNotices(),
      loadPrivateMessages(),
      loadPreferences(),
    ])
  }, [loadAggregate, loadSystemNotices, loadPrivateMessages, loadPreferences])

  // G-933 冷启动门控:聚合消息/系统通知/私信/通知偏好四枚请求均挂 checkAuth/authenticate(需鉴权),
  // 鉴权判定落定前整批不发
  useDidShow(() => gate.waitUntilReady(() => void load()))

  const notification = useMemo(() => {
    if (bannerClosed) return undefined
    const unreadRoom = list.find((r) => (r.unreadCount ?? r.unread ?? 0) > 0 || r.isUnread === true)
    const target = unreadRoom || list[0]
    if (!target || !target.lastMessage) return undefined
    return { text: target.lastMessage, onClose: () => setBannerClosed(true) }
  }, [list, bannerClosed])

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    if (!kw) return list
    return list.filter((r) => (r.name || '').includes(kw))
  }, [list, keyword])

  const headerOffset = menuButton.top + (menuButton.height + 8) + (notification ? 40 : 0)

  const onTabChange = (k: string) => setActiveTab(k)

  /**
   * 标记单条会话已读(对齐 RN MessageCenterScreen 的 onMarkRead 语义:只在未读行出现)。
   * 网络出口 = 本端既有的 markRoomRead(POST /messages/rooms/:roomId/read,按登录身份鉴权);
   * 只有私信类房间有该端点,其余两类在聚合接口里本就没有未读源(unreadCount 恒 0),
   * 不制造「先翻 UI 再补请求」的假成功:请求失败就只喊错、不回写。
   * 视觉反馈 = 未读点消失(该行 unread 归零)+ 私信 tab 的未读数同步递减。
   */
  const onMarkRead = useCallback(
    async (room: Room) => {
      const id = room.id
      if (!id) return
      const cleared = room.unreadCount ?? room.unread ?? 0
      try {
        if (room.kind === 'private') await markRoomRead(id)
        setList((prev) =>
          prev.map((r) => (r.id === id ? { ...r, unreadCount: 0, unread: 0, isUnread: false } : r)),
        )
        setPrivateList((prev) => prev.map((p) => (p.id === id ? { ...p, unread: 0 } : p)))
        if (cleared > 0) {
          setTabs((prev) =>
            prev.map((tb) =>
              tb.key === 'private'
                ? { ...tb, unread: Math.max(0, (tb.unread ?? 0) - cleared) }
                : tb,
            ),
          )
        }
        Taro.showToast({ title: t('message.markedRead'), icon: 'none' })
      } catch {
        Taro.showToast({ title: t('common.failed'), icon: 'none' })
      }
    },
    [t],
  )

  /**
   * 删除会话:先 Taro.showModal 二次确认(破坏性动作),确认后从列表移除并记入本地屏蔽表
   * (`/messages/aggregate` 无删除端点,见 HIDDEN_CONV_KEY 注释),三个列表同步摘除。
   */
  const onDeleteConversation = useCallback(
    (room: Room) => {
      const id = room.id
      if (!id) return
      Taro.showModal({
        title: t('messageCenter.deleteConv'),
        content: room.name || t('message.unnamedRoom'),
        cancelText: t('common.cancel'),
        confirmText: t('common.delete'),
        success: (res) => {
          if (!res.confirm) return
          writeHiddenConvIds(Array.from(new Set([...readHiddenConvIds(), id])))
          setList((prev) => prev.filter((r) => r.id !== id))
          setSystemList((prev) => prev.filter((s) => s.id !== id))
          setPrivateList((prev) => prev.filter((p) => p.id !== id))
          Taro.showToast({ title: t('common.deleteSuccess'), icon: 'success' })
        },
      })
    },
    [t],
  )

  /**
   * 加载下一页:系统通知 / 私信两个 tab 各有独立游标(接口分页字段同源)。
   * 按 id 去重防重入追加;"是否还有更多"由末页是否满页判定,失败显式喊错不静默。
   */
  const onLoadMore = useCallback(async () => {
    if (loadingMore) return
    if (activeTab !== 'system' && activeTab !== 'private') return
    const hasMore = activeTab === 'system' ? sysHasMore : privHasMore
    if (!hasMore) return
    const nextPage = (activeTab === 'system' ? sysPage : privPage) + 1
    const hidden = new Set(readHiddenConvIds())
    setLoadingMore(true)
    try {
      if (activeTab === 'system') {
        const res = await getSystemNotices({ page: nextPage, pageSize: PAGE_SIZE })
        const incoming = (res.list || []).map(toSystemNoticeItem).filter((s) => !hidden.has(s.id))
        setSystemList((prev) => {
          const seen = new Set(prev.map((it) => it.id))
          return [...prev, ...incoming.filter((it) => !seen.has(it.id))]
        })
        setSysPage(nextPage)
        setSysHasMore((res.list || []).length === PAGE_SIZE)
      } else {
        const res = await getPrivateMessages({ page: nextPage, pageSize: PAGE_SIZE })
        const incoming = (res.list || []).map(toPrivateMessageItem).filter((p) => !hidden.has(p.id))
        setPrivateList((prev) => {
          const seen = new Set(prev.map((it) => it.id))
          return [...prev, ...incoming.filter((it) => !seen.has(it.id))]
        })
        setPrivPage(nextPage)
        setPrivHasMore((res.list || []).length === PAGE_SIZE)
      }
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setLoadingMore(false)
    }
  }, [activeTab, loadingMore, privHasMore, privPage, sysHasMore, sysPage, t])

  const onOpenPrivate = async (item: PrivateMessageItem) => {
    setSelectedPrivate(item)
    setDetailMessages([])
    try {
      const params: { page?: number; pageSize?: number; peerId?: string } = {
        peerId: item.userId,
        page: 1,
        pageSize: 50,
      }
      const res = await getPrivateMessages(params)
      const me = String(getUserInfo()?.id ?? '')
      const msgs: MessageDetailItem[] = (res.list || [])
        .slice()
        .reverse()
        .map((p) => ({
          id: String(p.id),
          content: p.content,
          createdAt: p.createdAt,
          self: String(p.senderId) === me,
        }))
      setDetailMessages(
        msgs.length
          ? msgs
          : [
              {
                id: 'm1',
                content: t('message.hello', { name: item.userName }),
                createdAt: item.lastTime,
                self: false,
              },
            ],
      )
    } catch (e) {
      logger.error('message', '加载历史消息', e)
      setDetailMessages([
        {
          id: 'm1',
          content: t('message.hello', { name: item.userName }),
          createdAt: item.lastTime,
          self: false,
        },
      ])
    }
  }

  const onSendDetail = () => {
    const text = detailInput.trim()
    if (!text || !selectedPrivate) return
    setDetailMessages((prev) => [
      ...prev,
      { id: `m${prev.length + 1}`, content: text, createdAt: t('message.justNow'), self: true },
    ])
    setDetailInput('')
  }

  const onToggleSetting = async (key: string, enabled: boolean) => {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, enabled } : s)))
    try {
      const patch: Partial<NotificationPreferences> = {}
      if (key === 'system' || key === 'private') patch.inAppEnabled = enabled
      if (key === 'interaction') patch.pushEnabled = enabled
      if (key === 'marketing') patch.smsEnabled = enabled
      await updateNotificationPreferences(patch)
    } catch {
      // ignore - local state already updated
    }
  }

  /**
   * 底部「加载更多」脚注(对齐 RN MessageCenterScreen loadMoreBtn):
   * 加载中 → common.loading;还有下一页 → messageCenter.loadMore(可点);
   * 到头 → common.noMore(不可点)。列表为空时不渲染。
   */
  const renderLoadMoreFooter = (visible: boolean, hasMore: boolean) => {
    if (!visible) return null
    const shell = hasMore ? 'bg-card border border-border' : 'bg-muted'
    return (
      <View className="flex justify-center mt-[24rpx] pb-[24rpx]">
        <View
          className={`px-[32rpx] py-[16rpx] rounded-sm ${shell}`}
          hoverClass="opacity-60"
          onClick={() => void onLoadMore()}
        >
          <Text className="text-[length:28rpx] text-muted-foreground">
            {loadingMore
              ? t('common.loading')
              : hasMore
                ? t('messageCenter.loadMore')
                : t('common.noMore')}
          </Text>
        </View>
      </View>
    )
  }

  const renderTabContent = () => {
    if (activeTab === 'order' || activeTab === 'course') {
      // 对齐共享屏 TABS=['system','order','course','social'] 的 order/course 两类:
      // 站内消息卡片(与 spec NotificationCard 同信息结构:类型徽章 + 标题 + 正文 + 时间)
      return (
        <ThemeRoot>
          <InSiteMessagePane msgType={activeTab} />
        </ThemeRoot>
      )
    }
    if (activeTab === 'system') {
      return (
        <ThemeRoot>
          <SystemNotice
            list={systemList}
            onClick={(item) => Taro.showToast({ title: item.title, icon: 'none' })}
          />
          {renderLoadMoreFooter(systemList.length > 0, sysHasMore)}
        </ThemeRoot>
      )
    }
    if (activeTab === 'interaction') {
      // 原先这里渲染三条**写死的演示互动**(张三赞了你的笔记 / 李四回复 / 王五关注,
      // 日期硬编码 2026-07-13):用户会把它们当成真实消息。互动端点尚未接入,
      // 按同页 announcements / private 的真数据轨道口径落空态。
      return (
        <ThemeRoot>
          <Text className="block text-center text-body text-muted-foreground py-[96rpx]">
            {t('message.empty')}
          </Text>
        </ThemeRoot>
      )
    }
    if (activeTab === 'private') {
      return (
        <View>
          <PrivateMessageList list={privateList} onClick={onOpenPrivate} />
          {renderLoadMoreFooter(privateList.length > 0, privHasMore)}
        </View>
      )
    }
    return (
      <ThemeRoot>
        {/* 对齐 RN MessageCenterScreen listBody(padding 10dp) */}
        <View className="p-[20rpx]">
          <SearchBar
            value={keyword}
            placeholder={t('messageCenter.searchPh')}
            onInput={setKeyword}
            onClear={() => setKeyword('')}
          />
          {/* 会话区标题(对齐 RN MessageCenterScreen convSection.convTitle) */}
          {!loading && filtered.length ? (
            <Text className="block text-[length:26rpx] font-semibold text-muted-foreground mt-[16rpx] mb-[8rpx]">
              {t('messageCenter.conversations')}
            </Text>
          ) : null}
          {loading ? (
            <Text className="block text-center text-body text-muted-foreground py-[96rpx]">
              {t('common.loading')}
            </Text>
          ) : filtered.length ? (
            filtered.map((room) => {
              const unread = room.unreadCount ?? room.unread ?? 0
              return (
                <View
                  key={(room.id || room.name) as string}
                  className="flex flex-row items-center py-[24rpx] px-[20rpx] rounded-xl gap-[24rpx]"
                >
                  {/* 头像(首字母占位,对齐 RN convAvatar 44dp/radius 10dp) */}
                  <View className="relative shrink-0">
                    <View className="w-[88rpx] h-[88rpx] rounded-lg bg-muted flex items-center justify-center">
                      <Text className="text-title font-semibold text-foreground">
                        {(room.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    {unread > 0 && (
                      <View className="absolute -top-[8rpx] -right-[8rpx]">
                        <UnreadBadge count={unread} />
                      </View>
                    )}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-strong font-semibold text-foreground truncate">
                      {room.name || t('message.unnamedRoom')}
                    </Text>
                    <Text className="mt-[4rpx] text-[length:26rpx] text-muted-foreground truncate">
                      {room.lastMessage || t('message.empty')}
                    </Text>
                  </View>
                  {/* 标记已读:只在未读行出现(对齐 RN MessageCenterScreen 的
                      `onMarkRead && !item.read` 语义),与 ⋯ 菜单同一出口同一状态回写 */}
                  {unread > 0 && (
                    <Text
                      className="shrink-0 px-[12rpx] py-[8rpx] text-[length:24rpx] text-muted-foreground"
                      onClick={() => void onMarkRead(room)}
                    >
                      {t('messageCenter.markRead')}
                    </Text>
                  )}
                  <MessageActions
                    onMarkRead={() => void onMarkRead(room)}
                    onPin={() => Taro.showToast({ title: t('message.pinned'), icon: 'success' })}
                    onDelete={() => onDeleteConversation(room)}
                  />
                </View>
              )
            })
          ) : (
            <Text className="block text-center text-body text-muted-foreground py-[96rpx]">
              {keyword ? t('message.notFound') : t('message.empty')}
            </Text>
          )}
        </View>
      </ThemeRoot>
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
      <View className="min-h-screen bg-background">
        <NavBar
          title={t('messageCenter.title')}
          notification={notification}
          rightText={t('message.settings')}
          onRightClick={() => setShowSettings(true)}
        />
        <View style={{ height: `${headerOffset}px` }} />
        <MessageTabs tabs={tabs} active={activeTab} onChange={onTabChange} />
        <ScrollView scrollY style={{ height: 'calc(100vh - 200px)' }}>
          {renderTabContent()}
        </ScrollView>

        {showSettings && (
          <View
            className="fixed inset-0 z-[2000] bg-[rgba(0,0,0,0.4)]"
            onClick={() => setShowSettings(false)}
          >
            <View
              className="absolute bottom-0 left-0 right-0 bg-card ui-panel rounded-t-xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              hoverClass="opacity-60"
            >
              <View className="flex items-center justify-between px-4 py-3 mb-2">
                <Text className="text-sm font-medium text-foreground">
                  {t('message.notificationSettings')}
                </Text>
                <Text
                  className="text-sm text-muted-foreground"
                  onClick={() => setShowSettings(false)}
                >
                  {t('message.close')}
                </Text>
              </View>
              <NotificationSettings items={settings} onToggle={onToggleSetting} />
            </View>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
