import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow, useReachBottom } from '@tarojs/taro'
import { getChatHistory } from '@/api'
import './history.css'

interface HistoryItem {
  id: string
  title: string
  time: string
  messages: Array<{ content: string }>
}

export default function HistoryPage() {
  const [list, setList] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (reset = false) => {
    if (loading) return
    let curPage = page
    if (reset) { curPage = 1; setHasMore(true); setList([]); setPage(1) }
    if (!hasMore && !reset) return
    setLoading(true)
    try {
      const res = await getChatHistory({ page: curPage, pageSize: 20 })
      setList(prev => reset ? (res.list || []) : [...prev, ...(res.list || [])])
      setHasMore((reset ? (res.list || []).length : list.length + (res.list || []).length) < res.total)
      setPage(curPage + 1)
    } finally {
      setLoading(false)
    }
  }, [loading, page, hasMore, list.length])

  const goChat = useCallback((h?: HistoryItem) => {
    Taro.navigateTo({ url: `/pages/ai/chat${h ? `?sessionId=${h.id}` : ''}` })
  }, [])

  useDidShow(() => load(true))
  useReachBottom(() => load())

  return (
    <View className="page">
      {list.length ? (
        <View className="list">
          {list.map(h => (
            <View key={h.id} className="item" onClick={() => goChat(h)}>
              <View className="item-body">
                <Text className="title">{h.title}</Text>
                <Text className="preview">{h.messages?.[h.messages.length - 1]?.content || '暂无消息'}</Text>
                <Text className="time">{h.time}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && !list.length ? (
        <View className="empty">
          <Text>暂无对话历史</Text>
          <Button className="btn" onClick={() => goChat()}>开始新对话</Button>
        </View>
      ) : null}
    </View>
  )
}
