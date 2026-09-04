// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CircleIndexScreen 圈子广场页(mobile-rn 端)
 *
 * 镜像 miniapp-taro pages/circle/index(P1 社区链路补齐):
 * - 数据源:@ihui/api-client fetchApi —— feed GET /circles(usePaginatedList 分页)、
 *   热话题 GET /circles/topics/hot、推荐用户 GET /circles/users/recommend(副榜静默失败不阻塞)
 * - 交互:4 tab(推荐/关注/最新/热门,feed 本地重排)→ 热话题 chip 跳 TopicDetail →
 *   关注用户乐观翻转 POST /circles/follow 失败回滚 → 图片 Modal 预览(对齐 previewImage)→
 *   FAB '+' 跳 CircleCreate;帖子卡点击进 CircleDetail
 * - 样式:getRnTokens 语义 token(零 hex,过 check:rn-parity);图标 lucide-react-native(无 emoji)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Heart, Inbox, MessageCircle, Plus, X } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** feed 帖子(对齐 miniapp api Circle) */
interface CirclePost {
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

interface CirclePage {
  list: CirclePost[]
  total: number
}

interface HotTopic {
  id: string | number
  name: string
  count: number
}

interface TopicListRes {
  list: HotTopic[]
  total?: number
}

interface RecommendUser {
  id: string | number
  nickname: string
  avatar?: string
  bio?: string
  followed?: boolean
}

interface UserListRes {
  list: RecommendUser[]
}

type TabKey = 'recommend' | 'follow' | 'latest' | 'hot'

const PAGE_SIZE = 10

export function CircleIndexScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [tab, setTab] = useState<TabKey>('recommend')
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([])
  const [recommendUsers, setRecommendUsers] = useState<RecommendUser[]>([])
  const [preview, setPreview] = useState<{ urls: string[]; index: number } | null>(null)

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await fetchApi<CirclePage>('/circles', { params: { page, pageSize } })
      if (!res.success) return { success: false as const, error: t('common.failed') }
      return {
        success: true as const,
        data: { list: res.data?.list ?? [], total: res.data?.total ?? 0 },
      }
    },
    [t],
  )

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore } = usePaginatedList(
    fetcher,
    PAGE_SIZE,
  )

  const loadSideBoards = useCallback(async () => {
    // 副榜静默失败,不阻塞主流程(对齐小程序 loadHotTopics/loadRecommendUsers)
    try {
      const topics = await fetchApi<TopicListRes>('/circles/topics/hot', {
        params: { page: 1, pageSize: 10 },
      })
      if (topics.success && topics.data) setHotTopics(topics.data.list ?? [])
    } catch {
      /* noop */
    }
    try {
      const users = await fetchApi<UserListRes>('/circles/users/recommend', {
        params: { page: 1, pageSize: 10 },
      })
      if (users.success && users.data) setRecommendUsers(users.data.list ?? [])
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    void loadSideBoards()
  }, [loadSideBoards])

  // tab 差异化:后端 feed 无排序参数先例 → 本地重排(hot=likes↓、latest=createTime↓)
  const feed = useMemo(() => {
    if (tab === 'hot') {
      return [...items].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    }
    if (tab === 'latest') {
      return [...items].sort(
        (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime(),
      )
    }
    return items
  }, [items, tab])

  const switchTab = (next: TabKey) => {
    if (next === tab) return
    setTab(next)
    void refresh()
  }

  const followUser = useCallback(async (u: RecommendUser) => {
    const prev = !!u.followed
    setRecommendUsers((list) => list.map((x) => (x.id === u.id ? { ...x, followed: !prev } : x)))
    try {
      const res = await fetchApi('/circles/follow', {
        method: 'POST',
        body: JSON.stringify({ userId: u.id }),
      })
      if (!res.success) {
        setRecommendUsers((list) => list.map((x) => (x.id === u.id ? { ...x, followed: prev } : x)))
      }
    } catch {
      setRecommendUsers((list) => list.map((x) => (x.id === u.id ? { ...x, followed: prev } : x)))
    }
  }, [])

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'recommend', label: t('circle.tabs.recommend') },
    { key: 'follow', label: t('circle.tabs.follow') },
    { key: 'latest', label: t('circle.tabs.latest') },
    { key: 'hot', label: t('circle.tabs.hot') },
  ]

  const renderItem = ({ item }: { item: CirclePost }) => {
    const imgs = item.images ?? []
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => navigation.navigate('CircleDetail', { id: String(item.id) })}
        accessibilityRole="button"
      >
        <View style={styles.itemHead}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]} />
          )}
          <Text style={styles.author} numberOfLines={1}>
            {item.author || t('circle.index.anonymous')}
          </Text>
          <Text style={styles.time}>{item.createTime}</Text>
        </View>
        {item.title ? (
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
        ) : null}
        <Text style={styles.content} numberOfLines={3}>
          {item.content}
        </Text>
        {imgs.length ? (
          <View style={styles.imgRow}>
            {imgs.slice(0, 3).map((img, i) => (
              <Pressable
                key={i}
                onPress={() => setPreview({ urls: imgs, index: i })}
                accessibilityRole="imagebutton"
              >
                <Image source={{ uri: img }} style={styles.img} />
              </Pressable>
            ))}
            {imgs.length > 3 ? (
              <Pressable
                style={[styles.img, styles.imgMore]}
                onPress={() => setPreview({ urls: imgs, index: 2 })}
              >
                <Text style={styles.imgMoreText}>{`+${imgs.length - 3}`}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.actions}>
          <View style={styles.stat}>
            <Heart size={13} color={tk.text.tertiary} />
            <Text style={styles.statNum}>{item.likes ?? 0}</Text>
          </View>
          <View style={styles.stat}>
            <MessageCircle size={13} color={tk.text.tertiary} />
            <Text style={styles.statNum}>{item.comments ?? 0}</Text>
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar title={t('circle.index.pageTitle')} onBack={() => navigation.goBack()} />
      <View style={styles.tabRow}>
        {tabs.map((tabItem) => (
          <Pressable
            key={tabItem.key}
            style={[styles.tab, tab === tabItem.key ? styles.tabActive : null]}
            onPress={() => switchTab(tabItem.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === tabItem.key }}
          >
            <Text style={[styles.tabText, tab === tabItem.key ? styles.tabTextActive : null]}>
              {tabItem.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={feed}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadSideBoards()
              refresh()
            }}
            tintColor={tk.text.secondary}
          />
        }
        ListHeaderComponent={
          <View>
            {hotTopics.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topicScroll}
              >
                {hotTopics.map((topic) => (
                  <Pressable
                    key={String(topic.id)}
                    style={styles.topicChip}
                    onPress={() => navigation.navigate('TopicDetail', { id: String(topic.id) })}
                    accessibilityRole="button"
                  >
                    <Text style={styles.topicHash}>{'#'}</Text>
                    <Text style={styles.topicName} numberOfLines={1}>
                      {topic.name}
                    </Text>
                    <Text style={styles.topicCount}>{topic.count}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {recommendUsers.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.userScroll}
              >
                {recommendUsers.map((u) => (
                  <View key={String(u.id)} style={styles.userCard}>
                    {u.avatar ? (
                      <Image source={{ uri: u.avatar }} style={styles.userAvatar} />
                    ) : (
                      <View style={[styles.userAvatar, styles.avatarFallback]} />
                    )}
                    <Text style={styles.userName} numberOfLines={1}>
                      {u.nickname}
                    </Text>
                    {u.bio ? (
                      <Text style={styles.userBio} numberOfLines={1}>
                        {u.bio}
                      </Text>
                    ) : null}
                    <Pressable
                      style={[styles.userFollow, u.followed ? styles.userFollowActive : null]}
                      onPress={() => void followUser(u)}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.userFollowText,
                          u.followed ? styles.userFollowTextActive : null,
                        ]}
                      >
                        {u.followed ? t('circle.index.followed') : t('circle.index.follow')}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={tk.text.secondary} />
              <Text style={styles.stateText}>{t('circle.index.loading')}</Text>
            </View>
          ) : error ? (
            <Pressable style={styles.center} onPress={refresh} accessibilityRole="button">
              <Text style={styles.errorText}>{t('circle.index.error')}</Text>
              <Text style={styles.retryText}>{t('circle.index.retry')}</Text>
            </Pressable>
          ) : (
            <View style={styles.center}>
              <Inbox size={40} color={tk.text.tertiary} />
              <Text style={styles.stateText}>{t('circle.empty')}</Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CircleCreate')}
                accessibilityRole="button"
              >
                <Text style={styles.emptyBtnText}>{t('circle.index.goPublish')}</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <Text style={styles.stateText}>{t('circle.index.loading')}</Text>
            </View>
          ) : null
        }
      />
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CircleCreate')}
        accessibilityRole="button"
        accessibilityLabel={t('circle.index.goPublish')}
      >
        <Plus size={24} color={tk.surface.card} />
      </TouchableOpacity>
      <Modal
        visible={preview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <View style={styles.previewMask}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreview(null)}>
            <X size={24} color={tk.surface.card} />
          </TouchableOpacity>
          {preview ? (
            <ScrollView
              pagingEnabled
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewScroll}
            >
              {preview.urls.map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={styles.previewImg}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

const createStyles = (tk: RnThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: rpx(24),
      paddingVertical: rpx(16),
      gap: rpx(16),
      backgroundColor: tk.surface.card,
    },
    tab: {
      flex: 1,
      height: rpx(64),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rpx(20),
      backgroundColor: tk.surface.muted,
    },
    tabActive: {
      backgroundColor: tk.brand.DEFAULT,
    },
    tabText: {
      fontSize: 13,
      color: tk.text.secondary,
    },
    tabTextActive: {
      color: tk.surface.card,
      fontWeight: '600',
    },
    topicScroll: {
      gap: rpx(16),
      paddingHorizontal: rpx(24),
      paddingVertical: rpx(20),
    },
    topicChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(6),
      paddingHorizontal: rpx(24),
      height: rpx(64),
      borderRadius: rpx(32),
      backgroundColor: tk.surface.card,
    },
    topicHash: {
      fontSize: 14,
      fontWeight: '700',
      color: tk.text.primary,
    },
    topicName: {
      fontSize: 13,
      color: tk.text.primary,
      maxWidth: rpx(240),
    },
    topicCount: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
    userScroll: {
      gap: rpx(16),
      paddingHorizontal: rpx(24),
      paddingBottom: rpx(20),
    },
    userCard: {
      width: rpx(220),
      alignItems: 'center',
      padding: rpx(20),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
      gap: rpx(8),
    },
    userAvatar: {
      width: rpx(96),
      height: rpx(96),
      borderRadius: rpx(48),
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: {},
    userName: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.primary,
      maxWidth: rpx(180),
    },
    userBio: {
      fontSize: 11,
      color: tk.text.tertiary,
      maxWidth: rpx(180),
    },
    userFollow: {
      marginTop: rpx(8),
      paddingHorizontal: rpx(28),
      paddingVertical: rpx(8),
      borderRadius: rpx(28),
      backgroundColor: tk.brand.DEFAULT,
    },
    userFollowActive: {
      backgroundColor: tk.surface.muted,
    },
    userFollowText: {
      fontSize: 12,
      fontWeight: '600',
      color: tk.surface.card,
    },
    userFollowTextActive: {
      color: tk.text.secondary,
    },
    listContent: {
      padding: rpx(24),
      paddingBottom: rpx(160),
      gap: rpx(16),
    },
    card: {
      gap: rpx(12),
      padding: rpx(24),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
    },
    cardPressed: {
      opacity: 0.85,
    },
    itemHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(16),
    },
    avatar: {
      width: rpx(56),
      height: rpx(56),
      borderRadius: rpx(28),
      backgroundColor: tk.surface.muted,
    },
    author: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: tk.text.primary,
    },
    time: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    },
    content: {
      fontSize: 13,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    imgRow: {
      flexDirection: 'row',
      gap: rpx(12),
    },
    img: {
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
    actions: {
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
    errorText: {
      fontSize: 13,
      color: tk.danger.DEFAULT,
    },
    retryText: {
      fontSize: 13,
      color: tk.text.primary,
    },
    emptyBtn: {
      paddingHorizontal: rpx(40),
      paddingVertical: rpx(16),
      borderRadius: rpx(32),
      backgroundColor: tk.brand.DEFAULT,
    },
    emptyBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.surface.card,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: rpx(24),
    },
    fab: {
      position: 'absolute',
      right: rpx(48),
      bottom: rpx(64),
      width: rpx(104),
      height: rpx(104),
      borderRadius: rpx(52),
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewMask: {
      flex: 1,
      backgroundColor: tk.overlay.modal,
      justifyContent: 'center',
    },
    previewClose: {
      position: 'absolute',
      top: rpx(100),
      right: rpx(40),
      zIndex: 10,
      padding: rpx(12),
    },
    previewScroll: {
      flexGrow: 1,
      alignItems: 'center',
    },
    previewImg: {
      width: 320,
      height: 420,
    },
  } as any)
// ⁠​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
