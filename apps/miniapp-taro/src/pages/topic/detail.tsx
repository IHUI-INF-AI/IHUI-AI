import { logger } from '@/utils/logger'
import { View, Text, Image, Button, ScrollView } from '@tarojs/components'
import Taro, {
  useDidShow,
  useShareAppMessage,
  useShareTimeline,
  usePullDownRefresh,
  useReachBottom,
} from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { getTopicDetail, post, type Circle } from '@/api'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'
import './detail.css'

interface TopicData {
  id?: string
  name?: string
  description?: string
  followerCount?: number
  isFollowed?: boolean
  posts?: Circle[]
}

const PAGE_SIZE = 10

export default function TopicDetailPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }
  const [topic, setTopic] = useState<TopicData>({})
  const [displayPosts, setDisplayPosts] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [id, setId] = useState('')
  const [following, setFollowing] = useState(false)
  const pageRef = useRef(1)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = (await getTopicDetail(id)) as TopicData
      setTopic(res)
      const allPosts = res.posts || []
      pageRef.current = 1
      const firstPage = allPosts.slice(0, PAGE_SIZE)
      setDisplayPosts(firstPage)
      setHasMore(allPosts.length > PAGE_SIZE)
    } catch (e) {
      logger.error('topic/detail', '加载话题', e)
      Taro.showToast({ title: tt('topic.detail.loadFailed', '加载失败'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [id, tt])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !topic.posts) return
    setLoadingMore(true)
    const nextPage = pageRef.current + 1
    const end = nextPage * PAGE_SIZE
    const nextPosts = topic.posts.slice(0, end)
    setDisplayPosts(nextPosts)
    pageRef.current = nextPage
    setHasMore(nextPosts.length < topic.posts.length)
    setLoadingMore(false)
  }, [loadingMore, hasMore, topic.posts])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const q = instance?.router?.params
    if (q?.id) {
      setId(q.id)
    }
  })

  useEffect(() => {
    if (id) load()
  }, [id, load])

  usePullDownRefresh(() => {
    load().then(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    loadMore()
  })

  useShareAppMessage(() => ({
    title: topic.name ? `#${topic.name}` : tt('share.appTitle', '智汇 AI'),
    path: `/pages/topic/detail?id=${id}`,
  }))
  useShareTimeline(() => ({
    title: topic.name ? `#${topic.name}` : tt('share.timelineTitle', '智汇 AI'),
    query: `id=${id}`,
  }))

  const onFollow = useCallback(async () => {
    if (!id || following) return
    setFollowing(true)
    try {
      await post(`/circles/topic/${id}/follow`, {})
      setTopic((prev) => ({
        ...prev,
        isFollowed: !prev.isFollowed,
        followerCount: (prev.followerCount || 0) + (prev.isFollowed ? -1 : 1),
      }))
      Taro.showToast({
        title: topic.isFollowed
          ? tt('topic.detail.unfollowed', '已取消关注')
          : tt('topic.detail.followSuccess', '关注成功'),
        icon: 'none',
      })
    } catch (e) {
      logger.error('topic/detail', '关注话题', e)
      Taro.showToast({ title: tt('topic.detail.followFailed', '操作失败'), icon: 'none' })
    } finally {
      setFollowing(false)
    }
  }, [id, following, topic.isFollowed, tt])

  const goCircle = useCallback((cid: string) => {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${cid}` })
  }, [])

  const goPublish = useCallback(() => {
    Taro.navigateTo({ url: `/pages/circle/create?topicId=${id}&topicName=${encodeURIComponent(topic.name || '')}` })
  }, [id, topic.name])

  const formatTime = (v: string): string => {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return v
    const now = Date.now()
    const diff = now - d.getTime()
    if (diff < 60000) return tt('topic.detail.justNow', '刚刚')
    if (diff < 3600000) return tt('topic.detail.minutesAgo', '{n} 分钟前', { n: Math.floor(diff / 60000) })
    if (diff < 86400000) return tt('topic.detail.hoursAgo', '{n} 小时前', { n: Math.floor(diff / 3600000) })
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return (
    <View className="topic-detail-page">
      <NavBar title={tt('topic.detail.pageTitle', '话题详情')} showBack />
      <ScrollView scrollY className="topic-detail-body">
        {/* 话题头部 */}
        {topic.name ? (
          <View className="topic-detail-header">
            <View className="topic-detail-info">
              <Text className="topic-detail-name">#{topic.name}</Text>
              {topic.description ? (
                <Text className="topic-detail-desc">{topic.description}</Text>
              ) : null}
              <Text className="topic-detail-followers">
                {tt('topic.detail.followers', '{n} 人关注', {
                  n: topic.followerCount || 0,
                })}
              </Text>
            </View>
            <Button
              className={`topic-detail-follow-btn${topic.isFollowed ? ' followed' : ''}`}
              disabled={following}
              onClick={onFollow}
            >
              {topic.isFollowed
                ? tt('topic.detail.following', '已关注')
                : tt('topic.detail.follow', '关注')}
            </Button>
          </View>
        ) : null}

        {/* 发布入口 */}
        {topic.name ? (
          <View className="topic-detail-publish" onClick={goPublish}>
            <Text className="topic-detail-publish-icon">✎</Text>
            <Text className="topic-detail-publish-text">
              {tt('topic.detail.publishPlaceholder', '分享你对这个话题的看法…')}
            </Text>
            <Text className="topic-detail-publish-btn">{tt('topic.detail.publish', '发帖')}</Text>
          </View>
        ) : null}

        {/* 帖子列表 */}
        {loading ? (
          <View className="topic-detail-state">
            <Text>{tt('topic.detail.loading', '加载中…')}</Text>
          </View>
        ) : null}

        {!loading && displayPosts.length > 0 ? (
          <View className="topic-detail-list">
            {displayPosts.map((p) => (
              <View
                key={p.id}
                className="topic-detail-post"
                onClick={() => goCircle(String(p.id))}
              >
                <View className="topic-detail-post-user">
                  <Image
                    className="topic-detail-avatar"
                    src={p.avatar || '/static/default-avatar.png'}
                    mode="aspectFill"
                  />
                  <View className="topic-detail-user-info">
                    <Text className="topic-detail-author">{p.author || tt('topic.detail.anonymous', '匿名用户')}</Text>
                    <Text className="topic-detail-time">{formatTime(p.createTime)}</Text>
                  </View>
                </View>
                <Text className="topic-detail-post-title">{p.title}</Text>
                <Text className="topic-detail-post-content">{p.content}</Text>
                {p.images && p.images.length > 0 ? (
                  <View className="topic-detail-post-images">
                    {p.images.slice(0, 3).map((img, i) => (
                      <Image
                        key={i}
                        className="topic-detail-post-img"
                        src={img}
                        mode="aspectFill"
                      />
                    ))}
                    {p.images.length > 3 ? (
                      <View className="topic-detail-post-img-more">
                        <Text>+{p.images.length - 3}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View className="topic-detail-post-footer">
                  <View className="topic-detail-post-stat">
                    <Text className="topic-detail-post-stat-icon">♡</Text>
                    <Text className="topic-detail-post-stat-num">{p.likes || 0}</Text>
                  </View>
                  <View className="topic-detail-post-stat">
                    <Text className="topic-detail-post-stat-icon">💬</Text>
                    <Text className="topic-detail-post-stat-num">{p.comments || 0}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {!loading && displayPosts.length === 0 ? (
          <View className="topic-detail-state">
            <Text>{tt('topic.detail.empty', '暂无帖子,快来发布第一条吧')}</Text>
          </View>
        ) : null}

        {!loading && loadingMore ? (
          <View className="topic-detail-state">
            <Text>{tt('topic.detail.loadingMore', '加载中…')}</Text>
          </View>
        ) : null}

        {!loading && !hasMore && displayPosts.length > 0 ? (
          <View className="topic-detail-state">
            <Text>{tt('topic.detail.noMore', '没有更多了')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
