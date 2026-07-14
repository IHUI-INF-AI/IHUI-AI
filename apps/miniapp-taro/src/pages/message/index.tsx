import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getMessageRooms } from '@/api'
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

const TABS: MessageTabItem[] = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '系统通知', unread: 1 },
  { key: 'interaction', label: '互动', unread: 2 },
  { key: 'private', label: '私信', unread: 3 },
]

const MOCK_SYSTEM: SystemNoticeItem[] = [
  {
    id: 's1',
    title: '系统维护通知',
    content: '7月15日凌晨 2-4 点系统维护,期间无法访问。',
    type: 'system',
    createdAt: '2026-07-13 10:00',
    read: false,
  },
  {
    id: 's2',
    title: '7月活动:邀请有礼',
    content: '邀请好友注册得 30% 佣金,无上限。',
    type: 'activity',
    createdAt: '2026-07-10 09:00',
    read: true,
  },
]

const MOCK_INTERACTION: InteractionItem[] = [
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

const MOCK_PRIVATE: PrivateMessageItem[] = [
  {
    id: 'p1',
    userId: 'u1',
    userName: '张三',
    lastMessage: '请问课程可以退款吗?',
    lastTime: '14:30',
    unread: 2,
    online: true,
  },
  {
    id: 'p2',
    userId: 'u2',
    userName: '李四',
    lastMessage: '好的,谢谢!',
    lastTime: '昨天',
    unread: 1,
    online: false,
  },
]

const MOCK_SETTINGS: NotificationSettingItem[] = [
  { key: 'system', label: '系统通知', desc: '重要系统消息', enabled: true },
  { key: 'interaction', label: '互动消息', desc: '点赞、评论、关注', enabled: true },
  { key: 'private', label: '私信', desc: '一对一私信提醒', enabled: true },
  { key: 'marketing', label: '活动营销', desc: '优惠活动推送', enabled: false },
]

export default function MessageIndex() {
  const [list, setList] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [bannerClosed, setBannerClosed] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedPrivate, setSelectedPrivate] = useState<PrivateMessageItem | null>(null)
  const [detailInput, setDetailInput] = useState('')
  const [detailMessages, setDetailMessages] = useState<MessageDetailItem[]>([])
  const [settings, setSettings] = useState<NotificationSettingItem[]>(MOCK_SETTINGS)

  const load = useCallback(async () => {
    try {
      const res = (await getMessageRooms()) as Record<string, unknown>
      setList((res?.list as Room[]) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

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
        content: `您好,我是 ${item.userName}`,
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
      { id: `m${prev.length + 1}`, content: text, createdAt: '刚刚', self: true },
    ])
    setDetailInput('')
  }

  const onToggleSetting = (key: string, enabled: boolean) => {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, enabled } : s)))
  }

  const renderTabContent = () => {
    if (activeTab === 'system') {
      return (
        <SystemNotice
          list={MOCK_SYSTEM}
          onClick={(item) => Taro.showToast({ title: item.title, icon: 'none' })}
        />
      )
    }
    if (activeTab === 'interaction') {
      return (
        <InteractionMessage
          list={MOCK_INTERACTION}
          onClick={(item) =>
            Taro.showToast({ title: `${item.userName}:${item.content}`, icon: 'none' })
          }
        />
      )
    }
    if (activeTab === 'private') {
      return <PrivateMessageList list={MOCK_PRIVATE} onClick={onOpenPrivate} />
    }
    return (
      <View className="message-list">
        <SearchBar
          value={keyword}
          placeholder="搜索会话"
          onInput={setKeyword}
          onClear={() => setKeyword('')}
        />
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : filtered.length ? (
          filtered.map((room) => (
            <View key={(room.id || room.name) as string} className="message-item">
              <View className="flex-1 min-w-0">
                <View className="flex items-center">
                  <Text className="message-title">{room.name || '未命名会话'}</Text>
                  {(room.unreadCount ?? room.unread ?? 0) > 0 && (
                    <View className="ml-2">
                      <UnreadBadge count={room.unreadCount ?? room.unread ?? 0} />
                    </View>
                  )}
                </View>
                <Text className="message-preview">{room.lastMessage || '暂无消息'}</Text>
              </View>
              <MessageActions
                onMarkRead={() => Taro.showToast({ title: '已标记已读', icon: 'success' })}
                onPin={() => Taro.showToast({ title: '已置顶', icon: 'success' })}
                onDelete={() => Taro.showToast({ title: '已删除', icon: 'success' })}
              />
            </View>
          ))
        ) : (
          <Text className="empty-text">{keyword ? '未找到匹配会话' : '暂无消息'}</Text>
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
        title="消息中心"
        showBack={false}
        notification={notification}
        rightText="设置"
        onRightClick={() => setShowSettings(true)}
      />
      <View style={{ height: `${headerOffset}px` }} />
      <MessageTabs tabs={TABS} active={activeTab} onChange={onTabChange} />
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
              <Text className="text-sm font-medium text-gray-800">通知设置</Text>
              <Text className="text-sm text-gray-400" onClick={() => setShowSettings(false)}>
                关闭
              </Text>
            </View>
            <NotificationSettings items={settings} onToggle={onToggleSetting} />
          </View>
        </View>
      )}
    </View>
  )
}
