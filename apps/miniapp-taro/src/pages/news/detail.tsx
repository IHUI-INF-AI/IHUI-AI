import { View, Text, RichText } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getNewsDetail, type News } from '@/api'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'
import './detail.css'

export default function NewsDetailPage() {
  const { t } = useI18n()
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

  useShareAppMessage(() => ({
    title: news.title || t('share.appTitle'),
    path: `/pages/news/detail?id=${id}`,
    imageUrl: news.coverUrl || '',
  }))
  useShareTimeline(() => ({
    title: news.title || t('share.timelineTitle'),
    query: `id=${id}`,
  }))

  return (
    <View className="page">
      <NavBar showBack />
      {loading ? (
        <View className="loading">
          <Text>{t('common.loading')}</Text>
        </View>
      ) : null}

      {!loading && news.title ? (
        <View className="head">
          <Text className="title">{news.title}</Text>
          <View className="meta">
            <Text>{news.createTime}</Text>
            <Text>{t('news.readCount', { n: news.views || 0 })}</Text>
          </View>
        </View>
      ) : null}

      {!loading && news.content ? (
        <View className="content">
          <RichText nodes={news.content} />
        </View>
      ) : null}

      {!loading && !news.title ? (
        <View className="loading">
          <Text>{t('common.empty')}</Text>
        </View>
      ) : null}
    </View>
  )
}
