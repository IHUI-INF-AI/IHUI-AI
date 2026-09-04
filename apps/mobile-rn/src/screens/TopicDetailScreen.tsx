// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TopicDetailScreen 话题详情页(mobile-rn 端)
 *
 * 镜像 miniapp-taro pages/topic/detail(P1 社区链路补齐):
 * - 数据源:@ihui/api-client fetchApi GET /topics/:id(帖子随详情一次性返回,客户端分页 slice)
 * - 交互:关注/取关 POST /circles/topic/:id/follow(翻转 isFollowed ± followerCount,
 *   toast → Alert.alert(t('common.hint')))→ 发布入口跳 CircleCreate(topicId/topicName 透传)→
 *   帖子卡点击进 CircleDetail;时间相对化(刚刚/N 分钟前/N 小时前/YYYY-MM-DD)
 * - 样式:getRnTokens 语义 token(零 hex,过 check:rn-parity);图标 lucide-react-native(无 emoji)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Heart, MessageCircle, PenLine } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type Route = RouteProp<RootStackParamList, 'TopicDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 帖子结构(对齐 miniapp api Circle) */
interface TopicPost {
  id: string | number
  title?: string
  content: string
  images?: string[]
  author?: string
  avatar?: string
  createTime: string
  likes?: number
  comments?: number
}

/** /topics/:id 响应(对齐 miniapp TopicData) */
interface TopicData {
  id?: string
  name?: string
  description?: string
  followerCount?: number
  isFollowed?: boolean
  posts?: TopicPost[]
}

const PAGE_SIZE = 10

export function TopicDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const { id } = route.params
  const [topic, setTopic] = useState<TopicData>({})
  const [displayPosts, setDisplayPosts] = useState<TopicPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [following, setFollowing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetchApi<TopicData>(`/topics/${encodeURIComponent(id)}`)
      if (res.success && res.data) {
        setTopic(res.data)
        const allPosts = res.data.posts ?? []
        setPage(1)
        setDisplayPosts(allPosts.slice(0, PAGE_SIZE))
        setHasMore(allPosts.length > PAGE_SIZE)
      } else {
        Alert.alert(t('common.hint'), t('topic.detail.loadFailed'))
      }
    } catch {
      Alert.alert(t('common.hint'), t('topic.detail.loadFailed'))
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
        Alert.alert(
          t('common.hint'),
          topic.isFollowed ? t('topic.detail.unfollowed') : t('topic.detail.followSuccess'),
        )
      } else {
        Alert.alert(t('common.hint'), t('topic.detail.followFailed'))
      }
    } catch {
      Alert.alert(t('common.hint'), t('topic.detail.followFailed'))
    } finally {
      setFollowing(false)
    }
  }, [id, following, topic.isFollowed, t])

  const goPublish = useCallback(() => {
    navigation.navigate('CircleCreate', { topicId: id, topicName: topic.name ?? '' })
  }, [navigation, id, topic.name])

  const formatTime = useCallback(
    (v: string): string => {
      if (!v) return ''
      const d = new Date(v)
      if (isNaN(d.getTime())) return v
      const diff = Date.now() - d.getTime()
      if (diff < 60000) return t('topic.detail.justNow')
      if (diff < 3600000) return t('topic.detail.minutesAgo', { n: Math.floor(diff / 60000) })
      if (diff < 86400000) return t('topic.detail.hoursAgo', { n: Math.floor(diff / 3600000) })
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    },
    [t],
  )

  const renderPost = ({ item }: { item: TopicPost }) => (
    <Pressable
      style={({ pressed }) => [styles.post, pressed ? styles.cardPressed : null]}
      onPress={() => navigation.navigate('CircleDetail', { id: String(item.id) })}
      accessibilityRole="button"
    >
      <View style={styles.postUser}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]} />
        )}
        <View style={styles.userInfo}>
          <Text style={styles.author}>{item.author || t('topic.detail.anonymous')}</Text>
          <Text style={styles.time}>{formatTime(item.createTime)}</Text>
        </View>
      </View>
      {item.title ? (
        <Text style={styles.postTitle} numberOfLines={2}>
          {item.title}
        </Text>
      ) : null}
      <Text style={styles.postContent} numberOfLines={3}>
        {item.content}
      </Text>
      {item.images && item.images.length > 0 ? (
        <View style={styles.imgRow}>
          {item.images.slice(0, 3).map((img, i) => (
            <Image key={i} source={{ uri: img }} style={styles.postImg} />
          ))}
          {item.images.length > 3 ? (
            <View style={[styles.postImg, styles.imgMore]}>
              <Text style={styles.imgMoreText}>{`+${item.images.length - 3}`}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.postFooter}>
        <View style={styles.stat}>
          <Heart size={14} color={tk.text.tertiary} />
          <Text style={styles.statNum}>{item.likes ?? 0}</Text>
        </View>
        <View style={styles.stat}>
          <MessageCircle size={14} color={tk.text.tertiary} />
          <Text style={styles.statNum}>{item.comments ?? 0}</Text>
        </View>
      </View>
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <NavBar title={t('topic.detail.pageTitle')} onBack={() => navigation.goBack()} />
      {topic.name ? (
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.topicName}>
              {'#'}
              {topic.name}
            </Text>
            {topic.description ? (
              <Text style={styles.topicDesc}>{topic.description}</Text>
            ) : null}
            <Text style={styles.followers}>
              {t('topic.detail.followers', { n: topic.followerCount ?? 0 })}
            </Text>
          </View>
          <Pressable
            style={[styles.followBtn, topic.isFollowed ? styles.followBtnActive : null]}
            disabled={following}
            onPress={() => void onFollow()}
            accessibilityRole="button"
          >
            <Text style={[styles.followBtnText, topic.isFollowed ? styles.followBtnTextActive : null]}>
              {topic.isFollowed ? t('topic.detail.following') : t('topic.detail.follow')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {topic.name ? (
        <Pressable
          style={({ pressed }) => [styles.publishBar, pressed ? styles.cardPressed : null]}
          onPress={goPublish}
          accessibilityRole="button"
        >
          <PenLine size={15} color={tk.text.tertiary} />
          <Text style={styles.publishText} numberOfLines={1}>
            {t('topic.detail.publishPlaceholder')}
          </Text>
          <Text style={styles.publishBtn}>{t('topic.detail.publish')}</Text>
        </Pressable>
      ) : null}
      <FlatList
        data={displayPosts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tk.text.secondary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={tk.text.secondary} />
              <Text style={styles.stateText}>{t('topic.detail.loading')}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.stateText}>{t('topic.detail.empty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          !loading && displayPosts.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.stateText}>
                {loadingMore || hasMore ? t('topic.detail.loadingMore') : t('topic.detail.noMore')}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const createStyles = (tk: RnThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(24),
      padding: rpx(24),
      backgroundColor: tk.surface.card,
    },
    headerInfo: {
      flex: 1,
      gap: rpx(8),
    },
    topicName: {
      fontSize: 17,
      fontWeight: '600',
      color: tk.text.primary,
    },
    topicDesc: {
      fontSize: 13,
      lineHeight: 18,
      color: tk.text.secondary,
    },
    followers: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    followBtn: {
      paddingHorizontal: rpx(32),
      paddingVertical: rpx(12),
      borderRadius: rpx(32),
      backgroundColor: tk.brand.DEFAULT,
    },
    followBtnActive: {
      backgroundColor: tk.surface.muted,
    },
    followBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.surface.card,
    },
    followBtnTextActive: {
      color: tk.text.secondary,
    },
    publishBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(16),
      paddingHorizontal: rpx(24),
      paddingVertical: rpx(20),
      backgroundColor: tk.surface.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tk.border.light,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tk.border.light,
    },
    publishText: {
      flex: 1,
      fontSize: 13,
      color: tk.text.tertiary,
    },
    publishBtn: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    },
    listContent: {
      padding: rpx(24),
      paddingBottom: rpx(40),
      gap: rpx(16),
    },
    post: {
      gap: rpx(12),
      padding: rpx(24),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
    },
    cardPressed: {
      opacity: 0.85,
    },
    postUser: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(16),
    },
    avatar: {
      width: rpx(64),
      height: rpx(64),
      borderRadius: rpx(32),
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: {},
    userInfo: {
      flex: 1,
      gap: rpx(4),
    },
    author: {
      fontSize: 13,
      fontWeight: '500',
      color: tk.text.primary,
    },
    time: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
    postTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    },
    postContent: {
      fontSize: 13,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    imgRow: {
      flexDirection: 'row',
      gap: rpx(12),
    },
    postImg: {
      width: rpx(200),
      height: rpx(200),
      borderRadius: rpx(12),
      backgroundColor: tk.surface.muted,
    },
    imgMore: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    imgMoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    postFooter: {
      flexDirection: 'row',
      gap: rpx(32),
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(8),
    },
    statNum: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rpx(120),
      gap: rpx(16),
    },
    stateText: {
      fontSize: 13,
      color: tk.text.tertiary,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: rpx(24),
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
// ⁠​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
