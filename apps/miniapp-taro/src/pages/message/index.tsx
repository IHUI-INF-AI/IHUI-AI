import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import {
  getMessageRooms,
  getSystemNotices,
  getPrivateMessages,
  getNotificationPreferences,
  updateNotificationPreferences,
  type AggregateMessages,
  type NotificationPreferences,
} from '@/api'
import {
  NavBar,
  MessageTabs,
  SystemNotice,
  InteractionMessage,
  PrivateMessageList,
  MessageDetail,
  UnreadBadge,
  MessageActions,
  NotificationSettings,
  SearchBar,
  type MessageTabItem,
  type SystemNoticeItem,
  type InteractionItem,
  type PrivateMessageItem,
  type MessageDetailItem,
  type NotificationSettingItem,
} from '@/components'
import { useI18n } from '@/i18n'
import './index.css'

interface Room {
  id?: string
  name?: string
  lastMessage?: string
  unreadCount?: number
  unread?: number
  isUnread?: boolean
}

const menuButton = Taro.getMenuButtonBoundingClientRect?.() || { top: 26, height: 32 }

const DEFAULT_SYSTEM: SystemNoticeItem[] = []
const DEFAULT_INTERACTION: InteractionItem[] = [
  {
    id: 'i1',
    type: 'like',
    userName: '张三',
    content: '赞了你的课程笔记',
    targetTitle: 'React 入门第 3 节',
    createdAt: '2026-07-13 14:20',
    read: false,
  },
  {
    id: 'i2',
    type: 'comment',
    userName: '李四',
    content: '回复了你的评论:讲得真清楚!',
    targetTitle: 'AI 大模型实战',
    createdAt: '2026-07-13 11:00',
    read: false,
  },
  {
    id: 'i3',
    type: 'follow',
    userName: '王五',
    content: '关注了你',
    createdAt: '2026-07-12 16:30',
    read: true,
  },
]
const DEFAULT_PRIVATE: PrivateMessageItem[] = []

export default function MessageIndex() {
  const { t } = useI18n()
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
        })
      }
      for (const priv of res.privateMessages || []) {
        rooms.push({
          id: String(priv.id),
          name: priv.senderId,
          lastMessage: priv.content,
          unreadCount: priv.isRead ? 0 : 1,
          isUnread: !priv.isRead,
        })
      }
      for (const sys of res.systemNotices || []) {
        rooms.push({
          id: sys.id,
          name: sys.title,
          lastMessage: sys.content || '',
          unreadCount: 0,
        })
      }
      setList(rooms)
      setTabs([
        { key: 'all', label: t('message.tabs.all') },
        { key: 'system', label: t('message.tabs.system'), unread: res.unreadCount?.system || 0 },
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

  useDidShow(load)

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

  const onOpenPrivate = (item: PrivateMessageItem) => {
    setSelectedPrivate(item)
    setDetailMessages([
      {
        id: 'm1',
        content: t('message.hello', { name: item.userName }),
        createdAt: item.lastTime,
        self: false,
      },
    ])
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
    if (activeTab === 'system') {
      return (
        <SystemNotice
          list={systemList}
          onClick={(item) => Taro.showToast({ title: item.title, icon: 'none' })}
        />
      )
    }
    if (activeTab === 'interaction') {
      return (
        <InteractionMessage
          list={DEFAULT_INTERACTION}
          onClick={(item) =>
            Taro.showToast({ title: `${item.userName}:${item.content}`, icon: 'none' })
          }
        />
      )
    }
    if (activeTab === 'private') {
      return <PrivateMessageList list={privateList} onClick={onOpenPrivate} />
    }
    return (
      <View className="message-list">
        <SearchBar
          value={keyword}
          placeholder={t('message.search')}
          onInput={setKeyword}
          onClear={() => setKeyword('')}
        />
        {loading ? (
          <Text className="loading-text">{t('common.loading')}</Text>
        ) : filtered.length ? (
          filtered.map((room) => (
            <View key={(room.id || room.name) as string} className="message-item">
              <View className="flex-1 min-w-0">
                <View className="flex items-center">
                  <Text className="message-title">{room.name || t('message.unnamedRoom')}</Text>
                  {(room.unreadCount ?? room.unread ?? 0) > 0 && (
                    <View className="ml-2">
                      <UnreadBadge count={room.unreadCount ?? room.unread ?? 0} />
                    </View>
                  )}
                </View>
                <Text className="message-preview">{room.lastMessage || t('message.empty')}</Text>
              </View>
              <MessageActions
                onMarkRead={() =>
                  Taro.showToast({ title: t('message.markedRead'), icon: 'success' })
                }
                onPin={() => Taro.showToast({ title: t('message.pinned'), icon: 'success' })}
                onDelete={() => Taro.showToast({ title: t('message.deleted'), icon: 'success' })}
              />
            </View>
          ))
        ) : (
          <Text className="empty-text">{keyword ? t('message.notFound') : t('message.empty')}</Text>
        )}
      </View>
    )
  }

  if (selectedPrivate) {
    return (
      <View className="message-page">
        <NavBar title={selectedPrivate.userName} showBack onBack={() => setSelectedPrivate(null)} />
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
    )
  }

  return (
    <View className="message-page">
      <NavBar
        title={t('message.center')}
        showBack={false}
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
        <View className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowSettings(false)}>
          <View
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <Text className="text-sm font-medium text-gray-800">
                {t('message.notificationSettings')}
              </Text>
              <Text className="text-sm text-gray-400" onClick={() => setShowSettings(false)}>
                {t('message.close')}
              </Text>
            </View>
            <NotificationSettings items={settings} onToggle={onToggleSetting} />
          </View>
        </View>
      )}
    </View>
  )
}
