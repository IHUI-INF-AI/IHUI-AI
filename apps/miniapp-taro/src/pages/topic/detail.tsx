import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getTopicDetail } from '@/api'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'
import './detail.css'

interface TopicPost {
  id: string
  title: string
  content: string
  author?: string
  avatar?: string
  createTime: string
}

interface TopicData {
  id?: string
  name?: string
  posts?: TopicPost[]
}

export default function TopicDetailPage() {
  const { t } = useI18n()
  const [topic, setTopic] = useState<TopicData>({})
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = (await getTopicDetail(id)) as TopicData
      setTopic(res)
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
    title: topic.name ? `#${topic.name}` : t('share.appTitle'),
    path: `/pages/topic/detail?id=${id}`,
  }))
  useShareTimeline(() => ({
    title: topic.name ? `#${topic.name}` : t('share.timelineTitle'),
    query: `id=${id}`,
  }))

  const goCircle = useCallback((cid: string) => {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${cid}` })
  }, [])

  const postsLen = topic.posts?.length || 0

  return (
    <View className="page">
      <NavBar showBack />

      {topic.name ? (
        <View className="head">
          <Text className="title">#{topic.name}</Text>
          <Text className="count">{t('topic.count', { n: postsLen })}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="empty"><Text>{t('common.loading')}</Text></View>
      ) : null}

      {!loading && postsLen ? (
        <View className="list">
          {topic.posts?.map((p) => (
            <View key={p.id} className="item" onClick={() => goCircle(p.id)}>
              <View className="user">
                <Image className="avatar" src={p.avatar || '/static/default-avatar.png'} mode="aspectFill" />
                <Text className="name">{p.author}</Text>
                <Text className="time">{p.createTime}</Text>
              </View>
              <Text className="post-title">{p.title}</Text>
              <Text className="content">{p.content}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !postsLen ? (
        <View className="empty"><Text>{t('common.empty')}</Text></View>
      ) : null}
    </View>
  )
}
