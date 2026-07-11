import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getMessageRooms } from '@/api'
import './index.css'

export default function MessageIndex() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res: any = await getMessageRooms()
      setList(res?.list || [])
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
          list.map((room: any) => (
            <View key={room.id} className="message-item">
              <Text className="message-title">{room.name || '未命名会话'}</Text>
              <Text className="message-preview">{room.lastMessage || '暂无消息'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无消息</Text>
        )}
      </View>
    </View>
  )
}
