import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getTopicList } from '@/api'
import { TOPIC_EVENT } from '../circle/create'
import './list.css'

interface TopicItem {
  id: string
  name: string
  count: number
  coverUrl?: string
}

export default function TopicListPage() {
  const [list, setList] = useState<TopicItem[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (reset = false) => {
    if (loading) return
    let curPage = page
    if (reset) { curPage = 1; setHasMore(true); setList([]); setPage(1) }
    if (!hasMore && !reset) return
    setLoading(true)
    try {
      const res = await getTopicList({ page: curPage, pageSize: 20 })
      const newList = res.list || []
      setList(prev => reset ? newList : [...prev, ...newList])
      setHasMore((reset ? newList.length : list.length + newList.length) < res.total)
      setPage(curPage + 1)
    } finally {
      setLoading(false)
    }
  }, [loading, page, hasMore, list.length])

  const goDetail = useCallback((id: string) => {
    if (from === 'create') {
      const item = list.find(t => t.id === id)
      Taro.eventCenter.trigger(TOPIC_EVENT, item?.name || '')
      Taro.navigateBack()
    } else {
      Taro.navigateTo({ url: `/pages/topic/detail?id=${id}` })
    }
  }, [from, list])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const q = instance?.router?.params
    setFrom(q?.from || '')
    load(true)
  })

  useReachBottom(() => load())

  return (
    <View className="page">
      {list.length ? (
        <View className="list">
          {list.map(t => (
            <View key={t.id} className="item" onClick={() => goDetail(t.id)}>
              {t.coverUrl ? <Image className="cover" src={t.coverUrl} mode="aspectFill" /> : null}
              <View className="body">
                <Text className="name">#{t.name}</Text>
                <Text className="count">{t.count}篇内容</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !list.length ? (
        <View className="empty"><Text>暂无话题</Text></View>
      ) : null}

      {loading ? (
        <View className="loading"><Text>加载中...</Text></View>
      ) : null}
    </View>
  )
}
