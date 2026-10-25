// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端「话题详情」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/topic-detail/TopicDetailScreen.tsx`,本文件只管平台侧:
 * 路由取参、取数与分页游标、关注翻转与提示(appAlert 平台特有:依赖本端 BottomPops)、
 * 导航落点(CircleCreate / CircleDetail)与主题接线。
 *
 * 数据源与端语义(与收敛前保持一致):
 * - GET /topics/:id(帖子随详情一次性返回,客户端分页 slice,PAGE_SIZE=10)
 * - 关注 POST /circles/topic/:id/follow(翻转 isFollowed ± followerCount,toast 走 appAlert)
 * - 此前本屏自带一份 478 行实现并挂 RN 独占白名单;本轮立共享屏后白名单由发起人统一摘除。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  TopicDetailScreen as SharedTopicDetailScreen,
  type TopicDetailPostView,
  type TopicDetailView,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'TopicDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** /topics/:id 响应(对齐 miniapp TopicData;posts 只作分页源,不上屏由共享屏渲染) */
interface TopicApiData extends TopicDetailView {
  posts?: TopicDetailPostView[]
}

const PAGE_SIZE = 10

export function TopicDetailScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()

  const { id } = route.params
  const [topic, setTopic] = useState<TopicApiData>({})
  const [displayPosts, setDisplayPosts] = useState<TopicDetailPostView[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [following, setFollowing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetchApi<TopicApiData>(`/topics/${encodeURIComponent(id)}`)
      if (res.success && res.data) {
        setTopic(res.data)
        const allPosts = res.data.posts ?? []
        setPage(1)
        setDisplayPosts(allPosts.slice(0, PAGE_SIZE))
        setHasMore(allPosts.length > PAGE_SIZE)
      } else {
        appAlert(t('common.hint'), t('topic.detail.loadFailed'))
      }
    } catch {
      appAlert(t('common.hint'), t('topic.detail.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const onLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const allPosts = topic.posts ?? []
    setDisplayPosts(allPosts.slice(0, nextPage * PAGE_SIZE))
    setPage(nextPage)
    setHasMore(nextPage * PAGE_SIZE < allPosts.length)
    setLoadingMore(false)
  }, [loadingMore, hasMore, page, topic.posts])

  const onFollow = useCallback(async () => {
    if (!id || following) return
    setFollowing(true)
    try {
      const res = await fetchApi(`/circles/topic/${encodeURIComponent(id)}/follow`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (res.success) {
        setTopic((prev) => ({
          ...prev,
          isFollowed: !prev.isFollowed,
          followerCount: (prev.followerCount ?? 0) + (prev.isFollowed ? -1 : 1),
        }))
        appAlert(
          t('common.hint'),
          topic.isFollowed ? t('topic.detail.unfollowed') : t('topic.detail.followSuccess'),
        )
      } else {
        appAlert(t('common.hint'), t('topic.detail.followFailed'))
      }
    } catch {
      appAlert(t('common.hint'), t('topic.detail.followFailed'))
    } finally {
      setFollowing(false)
    }
  }, [id, following, topic.isFollowed, t])

  const goPublish = useCallback(() => {
    navigation.navigate('CircleCreate', { topicId: id, topicName: topic.name ?? '' })
  }, [navigation, id, topic.name])

  const goPost = useCallback(
    (postId: string) => navigation.navigate('CircleDetail', { id: postId }),
    [navigation],
  )

  return (
    <SharedTopicDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      locale={locale}
      topic={topic}
      posts={displayPosts}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      hasMore={hasMore}
      followBusy={following}
      onBack={() => navigation.goBack()}
      onFollow={() => void onFollow()}
      onPublish={goPublish}
      onPostPress={goPost}
      onLoadMore={onLoadMore}
      onRefresh={onRefresh}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
