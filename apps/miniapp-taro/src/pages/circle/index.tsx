import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getCircleList, type Circle } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function CircleIndexPage() {
  const { t } = useI18n()
  const [list, setList] = useState<Circle[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('recommend')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(
    async (reset = false) => {
      if (loading) return
      let curPage = page
      if (reset) {
        curPage = 1
        setHasMore(true)
        setList([])
        setPage(1)
      }
      if (!hasMore && !reset) return
      setLoading(true)
      try {
        const res = await getCircleList({ page: curPage, pageSize: 10 })
        const newList = res.list || []
        setList((prev) => (reset ? newList : [...prev, ...newList]))
        setHasMore((reset ? newList.length : list.length + newList.length) < res.total)
        setPage(curPage + 1)
      } finally {
        setLoading(false)
      }
    },
    [loading, page, hasMore, list.length],
  )

  const switchTab = useCallback(
    (t: string) => {
      setTab(t)
      load(true)
    },
    [load],
  )

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${id}` })
  }, [])

  const goCreate = useCallback(() => {
    Taro.navigateTo({ url: '/pages/circle/create' })
  }, [])

  useReachBottom(() => load())

  useEffect(() => {
    load(true)
  }, [])

  return (
    <View className="page">
      <View className="tabs">
        <Text
          className={`tab${tab === 'recommend' ? ' active' : ''}`}
          onClick={() => switchTab('recommend')}
        >
          {t('circle.tabs.recommend')}
        </Text>
        <Text
          className={`tab${tab === 'follow' ? ' active' : ''}`}
          onClick={() => switchTab('follow')}
        >
          {t('circle.tabs.follow')}
        </Text>
        <Text className={`tab${tab === 'hot' ? ' active' : ''}`} onClick={() => switchTab('hot')}>
          {t('circle.tabs.hot')}
        </Text>
      </View>

      {list.length ? (
        <View className="list">
          {list.map((c) => (
            <View key={c.id} className="item" onClick={() => goDetail(c.id)}>
              <View className="user">
                <Image
                  className="avatar"
                  src={c.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
                <Text className="name">{c.author}</Text>
                <Text className="time">{c.createTime}</Text>
              </View>
              <Text className="title">{c.title}</Text>
              <Text className="content">{c.content}</Text>
              {c.images?.length ? (
                <View className="images">
                  {c.images.slice(0, 3).map((img, i) => (
                    <Image key={i} className="img" src={img} mode="aspectFill" />
                  ))}
                </View>
              ) : null}
              <View className="actions">
                <Text className="action">♡ {c.likes || 0}</Text>
                <Text className="action">💬 {c.comments || 0}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !list.length ? (
        <View className="empty">
          <Text>{t('circle.empty')}</Text>
        </View>
      ) : null}

      <View className="fab" onClick={goCreate}>
        +
      </View>
    </View>
  )
}
