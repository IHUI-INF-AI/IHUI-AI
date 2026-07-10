import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getTopicDetail } from '@/api'
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
  const [topic, setTopic] = useState<TopicData>({})
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await getTopicDetail(id) as TopicData
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

  const goCircle = useCallback((cid: string) => {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${cid}` })
  }, [])

  return (
    <View className="page">
      {topic.name ? (
        <View className="head">
          <Text className="title">#{topic.name}</Text>
          <Text className="count">{topic.posts?.length || 0}篇内容</Text>
        </View>
      ) : null}

      {topic.posts?.length ? (
        <View className="list">
          {topic.posts.map(p => (
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

      {!loading && !topic.posts?.length ? (
        <View className="empty"><Text>暂无内容</Text></View>
      ) : null}
    </View>
  )
}
