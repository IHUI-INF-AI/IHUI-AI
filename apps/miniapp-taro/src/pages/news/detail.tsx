import { View, Text, RichText } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getNewsDetail, type News } from '@/api'
import './detail.css'

export default function NewsDetailPage() {
  const [news, setNews] = useState<News>({} as News)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try {
      setNews(await getNewsDetail(id))
    } finally {
      setLoading(false)
    }
  }, [id])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const q = instance?.router?.params
    if (q?.id) {
      setId(q.id)
      setLoading(true)
      load()
    }
  })

  useEffect(() => {
    if (id) load()
  }, [id, load])

  return (
    <View className="page">
      {news.title ? (
        <View className="head">
          <Text className="title">{news.title}</Text>
          <View className="meta">
            <Text>{news.createTime}</Text>
            <Text>{news.views || 0}阅读</Text>
          </View>
        </View>
      ) : null}

      {news.content ? (
        <View className="content">
          <RichText nodes={news.content} />
        </View>
      ) : null}

      {loading ? (
        <View className="loading"><Text>加载中...</Text></View>
      ) : null}
    </View>
  )
}
