import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getMessageRooms } from '@/api'
import { NavBar } from '@/components'
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

export default function MessageIndex() {
  const [list, setList] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [bannerClosed, setBannerClosed] = useState(false)

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

  return (
    <View className="message-page">
      <NavBar title="消息中心" showBack={false} notification={notification} />
      <View style={{ height: `${headerOffset}px` }} />
      <View className="search-bar">
        <Input
          className="search-input"
          placeholder="搜索会话"
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
      </View>
      <View className="message-list">
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : filtered.length ? (
          filtered.map((room) => (
            <View key={(room.id || room.name) as string} className="message-item">
              <Text className="message-title">{room.name || '未命名会话'}</Text>
              <Text className="message-preview">{room.lastMessage || '暂无消息'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">{keyword ? '未找到匹配会话' : '暂无消息'}</Text>
        )}
      </View>
    </View>
  )
}
