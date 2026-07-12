import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getMessageRooms } from '@/api'
import './index.css'

export default function MessageIndex() {
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getMessageRooms()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="message-page">
      <View className="page-header">
        <Text className="page-title">消息中心</Text>
      </View>
      <View className="message-list">
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : list.length ? (
          list.map((room) => (
            <View key={room.id as string} className="message-item">
              <Text className="message-title">{(room.name as string) || '未命名会话'}</Text>
              <Text className="message-preview">{(room.lastMessage as string) || '暂无消息'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无消息</Text>
        )}
      </View>
    </View>
  )
}
