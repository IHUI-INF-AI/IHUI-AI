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
  markMessageRead,
  markPrivateRead,
  deleteMessage,
  deletePrivateMessage,
  type AggregateMessages,
  type NotificationPreferences,
} from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
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
import { onToast } from '@/host/on-toast'

interface Room {
  id?: string
  name?: string
  lastMessage?: string
  unreadCount?: number
  unread?: number
  isUnread?: boolean
  /**
   * 聚合行的数据源类别(loadAggregate 三条轨道逐条标):'private' 走行室兼容端点,
   * 'announcement'/'system' 走 edu_messages 主端点 —— 已读/删除按真实归属选出口,
   * 不做"一个端点打天下"的猜测(§0.3:拿不准就不给动作)。
   */
  kind?: 'announcement' | 'system' | 'private'
}

const { menuButton } = getTopBarMetrics()

/** 行可动作判据:'private'/'announcement'/'system' 三类各自有真实端点才给入口(§0.3 拿不准就不给) */
const canActRoom = (room: Room): boolean => Boolean(room.id) && Boolean(room.kind)
/** 未读判据:与渲染红点同一取值序,不给"标了已读但红点还在"的错账 */
const roomHasUnread = (room: Room): boolean =>
  (room.unreadCount ?? room.unread ?? 0) > 0 || room.isUnread === true

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
      const rooms: Room[] = []
      for (const ann of res.announcements || []) {
        rooms.push({
          id: ann.id,
          name: ann.title,
          lastMessage: ann.content || '',
          unreadCount: 0,
          kind: 'announcement',
        })
      }
      for (const priv of res.privateMessages || []) {
        rooms.push({
          id: String(priv.id),
          name: priv.senderId,
          lastMessage: priv.content,
          unreadCount: priv.isRead ? 0 : 1,
          isUnread: !priv.isRead,
          kind: 'private',
        })
      }
      for (const sys of res.systemNotices || []) {
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
      const res = await getSystemNotices({ page: 1, pageSize: 20 })
      const items: SystemNoticeItem[] = (res.list || []).map((s) => ({
        id: s.id,
        title: s.title,
        content: s.content || '',
        type: (s.type === 'activity' || s.type === 'upgrade' ? s.type : 'system') as
          'system' | 'activity' | 'upgrade',
        createdAt: s.createdAt,
        read: false,
      }))
      setSystemList(items)
    } catch {
      // ignore
    }
  }, [])

  const loadPrivateMessages = useCallback(async () => {
    try {
      const res = await getPrivateMessages({ page: 1, pageSize: 20 })
      const items: PrivateMessageItem[] = (res.list || []).map((p) => ({
        id: String(p.id),
        userId: p.senderId,
        userName: p.senderId,
        lastMessage: p.content,
        lastTime: p.createdAt,
        unread: p.isRead ? 0 : 1,
        online: false,
      }))
      setPrivateList(items)
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
   * 标记会话行已读(对齐 RN/spec handleMarkRead):成功只回写真行,失败显式喊出
   * (common.failed),**不做「先翻 UI 再补请求」的假成功**。出口按行来源分轨:
   * 私信 = POST /messages/private/:pid/read;公告/系统 = PUT /messages/:id/read。
   */
  const onRoomMarkRead = (room: Required<Pick<Room, 'id'>> & Room) => {
    const call = room.kind === 'private' ? markPrivateRead(room.id) : markMessageRead(room.id)
    void call
      .then(() => {
        setList((prev) =>
          prev.map((r) =>
            r.id === room.id ? { ...r, unreadCount: 0, unread: 0, isUnread: false } : r,
          ),
        )
      })
      .catch(() => {
        onToast(t('common.failed'), { kind: 'error' })
      })
  }

  /**
   * 删除会话行(对齐 RN/spec handleDeleteConversation):破坏性动作先经端内确认层
   * (Taro.showModal 为小程序标准模态,非 Web 原生提示窗),确认后才发请求;
   * 成功摘除本行,失败显式喊出。与 markRead 同源分轨。
   */
  const onRoomDelete = (room: Required<Pick<Room, 'id'>> & Room) => {
    void Taro.showModal({
      // 端内无现成「删除确认」共享键(搜遍 shared 五语言 0 命中),新键按 §19 须与词包同批
      // 落地会撞 scope 门 R2 ⇒ 弹窗以行名为正文:确认语义由 title(删除会话)+
      // 系统 destructive 按钮承载,零新增措辞、不借无关键冒充正文(宁缺毋滥)。
      title: t('messageCenter.deleteConv'),
      content: room.name || t('messageCenter.conversations'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
    }).then((res) => {
      if (!res.confirm) return
      const call = room.kind === 'private' ? deletePrivateMessage(room.id) : deleteMessage(room.id)
      void call
        .then(() => {
          setList((prev) => prev.filter((r) => r.id !== room.id))
        })
        .catch(() => {
          onToast(t('common.failed'), { kind: 'error' })
        })
    })
  }

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
            onClick={(item) => onToast(item.title, { kind: 'info' })}
          />
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
      return <PrivateMessageList list={privateList} onClick={onOpenPrivate} />
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
            <Text className="block text-body-sm leading-[normal] font-semibold text-muted-foreground mt-[16rpx] mb-[8rpx]">
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
                    <Text className="mt-[4rpx] text-body-sm leading-[normal] text-muted-foreground truncate">
                      {room.lastMessage || t('message.empty')}
                    </Text>
                  </View>
                  {/* 操作区(对齐共享屏 spec):「标记已读」只在未读行出现(onMarkRead 不传整块不渲染);
                      置顶需真实会话身份(本聚合行是公告/私信,无置顶语义)⇒ 不给假入口 */}
                  {canActRoom(room) ? (
                    <MessageActions
                      onMarkRead={
                        roomHasUnread(room)
                          ? () => onRoomMarkRead(room as { id: string } & Room)
                          : undefined
                      }
                      onDelete={() => onRoomDelete(room as { id: string } & Room)}
                      markReadLabel={t('messageCenter.markRead')}
                      deleteLabel={t('messageCenter.deleteConv')}
                    />
                  ) : null}
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
