import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getCircleList, get, post, type Circle } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

type TabKey = 'recommend' | 'follow' | 'latest' | 'hot'

interface HotTopic {
  id: string
  name: string
  count: number
  coverUrl?: string
}

interface RecommendUser {
  id: string
  nickname: string
  avatar?: string
  bio?: string
  followed?: boolean
}

interface TopicListRes {
  list: HotTopic[]
  total: number
}

interface UserListRes {
  list: RecommendUser[]
}

const TABS: Array<{ key: TabKey; i18nKey: string; fallback: string }> = [
  { key: 'recommend', i18nKey: 'circle.tabs.recommend', fallback: '推荐' },
  { key: 'follow', i18nKey: 'circle.tabs.follow', fallback: '关注' },
  { key: 'latest', i18nKey: 'circle.tabs.latest', fallback: '最新' },
  { key: 'hot', i18nKey: 'circle.tabs.hot', fallback: '热门' },
]

const PAGE_SIZE = 10
const defaultAvatar = '/static/default-avatar.png'

export default function CircleIndexPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [list, setList] = useState<Circle[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [tab, setTab] = useState<TabKey>('recommend')
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([])
  const [recommendUsers, setRecommendUsers] = useState<RecommendUser[]>([])
  const [error, setError] = useState(false)

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const tabRef = useRef<TabKey>('recommend')
  tabRef.current = tab

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setHasMore(true)
      setError(false)
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getCircleList({ page: pageRef.current, pageSize: PAGE_SIZE })
      const newList = res.list || []
      setList((prev) => (reset ? newList : [...prev, ...newList]))
      const total = res.total ?? 0
      const more = pageRef.current * PAGE_SIZE < total
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch {
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const loadHotTopics = useCallback(async () => {
    try {
      const res = await get<TopicListRes>('/circles/topics/hot', { page: 1, pageSize: 10 })
      setHotTopics(res.list || [])
    } catch {
      // 静默失败,不阻塞主流程
    }
  }, [])

  const loadRecommendUsers = useCallback(async () => {
    try {
      const res = await get<UserListRes>('/circles/users/recommend', { page: 1, pageSize: 10 })
      setRecommendUsers(res.list || [])
    } catch {
      // 静默失败
    }
  }, [])

  useDidShow(() => {
    load(true)
    loadHotTopics()
    loadRecommendUsers()
  })

  usePullDownRefresh(() => {
    Promise.all([load(true), loadHotTopics(), loadRecommendUsers()]).finally(() => {
      Taro.stopPullDownRefresh()
    })
  })

  useReachBottom(() => {
    load()
  })

  const switchTab = useCallback(
    (next: TabKey) => {
      if (next === tabRef.current) return
      setTab(next)
      setList([])
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

  const goTopic = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/topic/detail?id=${id}` })
  }, [])

  const followUser = useCallback(async (u: RecommendUser) => {
    const prev = !!u.followed
    setRecommendUsers((list) =>
      list.map((x) => (x.id === u.id ? { ...x, followed: !prev } : x)),
    )
    try {
      await post('/circles/follow', { userId: u.id })
    } catch {
      setRecommendUsers((list) =>
        list.map((x) => (x.id === u.id ? { ...x, followed: prev } : x)),
      )
    }
  }, [])

  const previewImgs = useCallback((urls: string[], i: number) => {
    Taro.previewImage({ urls, current: urls[i] })
  }, [])

  return (
    <View className="ci-page">
      <View className="ci-tabs">
        {TABS.map((tabItem) => (
          <View
            key={tabItem.key}
            className={`ci-tab${tab === tabItem.key ? ' active' : ''}`}
            onClick={() => switchTab(tabItem.key)}
          >
            <Text className="ci-tab-text">{tt(tabItem.i18nKey, tabItem.fallback)}</Text>
          </View>
        ))}
      </View>

      {hotTopics.length ? (
        <ScrollView scrollX enhanced showScrollbar={false} className="ci-hottopic-scroll">
          <View className="ci-hottopic-list">
            {hotTopics.map((topic) => (
              <View key={topic.id} className="ci-hottopic-chip" onClick={() => goTopic(topic.id)}>
                <Text className="ci-hottopic-hash">#</Text>
                <Text className="ci-hottopic-name">{topic.name}</Text>
                <Text className="ci-hottopic-count">{topic.count}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {recommendUsers.length ? (
        <ScrollView scrollX enhanced showScrollbar={false} className="ci-users-scroll">
          <View className="ci-users-list">
            {recommendUsers.map((u) => (
              <View key={u.id} className="ci-user-card">
                <Image className="ci-user-avatar" src={u.avatar || defaultAvatar} mode="aspectFill" />
                <Text className="ci-user-name">{u.nickname}</Text>
                {u.bio ? <Text className="ci-user-bio">{u.bio}</Text> : null}
                <View
                  className={`ci-user-follow${u.followed ? ' followed' : ''}`}
                  onClick={() => followUser(u)}
                >
                  <Text>
                    {u.followed
                      ? tt('circle.index.followed', '已关注')
                      : tt('circle.index.follow', '关注')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {list.length ? (
        <View className="ci-list">
          {list.map((c) => {
            const imgs = c.images || []
            return (
              <View key={c.id} className="ci-item" onClick={() => goDetail(c.id)}>
                <View className="ci-item-head">
                  <Image
                    className="ci-avatar"
                    src={c.avatar || defaultAvatar}
                    mode="aspectFill"
                  />
                  <Text className="ci-author">
                    {c.author || tt('circle.index.anonymous', '匿名用户')}
                  </Text>
                  <Text className="ci-time">{c.createTime}</Text>
                </View>
                {c.title ? <Text className="ci-title">{c.title}</Text> : null}
                <Text className="ci-content">{c.content}</Text>
                {imgs.length ? (
                  <View className="ci-images">
                    {imgs.slice(0, 3).map((img, i) => (
                      <Image
                        key={i}
                        className="ci-img"
                        src={img}
                        mode="aspectFill"
                        onClick={(e) => {
                          e.stopPropagation()
                          previewImgs(imgs, i)
                        }}
                      />
                    ))}
                    {imgs.length > 3 ? (
                      <View className="ci-img ci-img-more">
                        <Text className="ci-img-more-text">+{imgs.length - 3}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View className="ci-item-actions">
                  <Text className="ci-item-action">♡ {c.likes || 0}</Text>
                  <Text className="ci-item-action">💬 {c.comments || 0}</Text>
                </View>
              </View>
            )
          })}
        </View>
      ) : null}

      {!loading && !list.length && !error ? (
        <View className="ci-empty">
          <Text className="ci-empty-icon">📝</Text>
          <Text className="ci-empty-text">{tt('circle.empty', '暂无内容')}</Text>
          <View className="ci-empty-btn" onClick={goCreate}>
            <Text>{tt('circle.index.goPublish', '去发布')}</Text>
          </View>
        </View>
      ) : null}

      {error && !loading ? (
        <View className="ci-error" onClick={() => load(true)}>
          <Text className="ci-error-text">{tt('circle.index.error', '加载失败')}</Text>
          <Text className="ci-error-retry">{tt('circle.index.retry', '点击重试')}</Text>
        </View>
      ) : null}

      {loading ? (
        <Text className="ci-status">{tt('circle.index.loading', '加载中...')}</Text>
      ) : null}

      {!loading && !hasMore && list.length > 0 ? (
        <Text className="ci-status">{tt('circle.index.noMore', '没有更多了')}</Text>
      ) : null}

      <View className="ci-fab" onClick={goCreate}>
        <Text className="ci-fab-icon">+</Text>
      </View>
    </View>
  )
}
