/**
 * StudyIndexScreen AI 视频页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/studyindex/index.vue(AI 视频 / 学习视频列表):
 * - 顶部 NavBar(标题「AI 视频」+ 返回)+ 右侧搜索开关
 * - 单列视频卡片(封面 / 标题 / 时长徽章 / 讲师 / 相对时间)
 * - 数据加载:fetchApi 拉取 /api/study/videos(分页 + 搜索)
 * - 下拉刷新 + 上拉分页 + 空态(Empty)+ 加载态(Loading)+ 错误重试
 * - 悬浮发布按钮(对齐 .vue floating-publish-btn → /pagesA/study/publish)
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { formatRelativeTime } from '@ihui/shared'
import { NavBar } from '../components/NavBar'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10
const API_PATH = '/api/study/videos'
const COVER_HEIGHT = 120
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

interface StudyVideoItem {
  id: string | number
  courseId?: string | number
  title: string
  cover?: string
  duration?: number | string
  teacherName?: string
  createdAt?: string
}

interface StudyVideoResponse {
  list: StudyVideoItem[]
  total: number
}

function formatDuration(duration: number | string | undefined): string {
  if (duration === undefined || duration === null || duration === '') return ''
  if (typeof duration === 'number') {
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
  }
  return String(duration)
}

export function StudyIndexScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<StudyVideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const load = useCallback(
    async (opts: { reset?: boolean; nextPage?: number } = {}) => {
      const reset = opts.reset ?? false
      const targetPage = opts.nextPage ?? 1
      if (reset) {
        setLoading(true)
        setError('')
      }
      try {
        const res = await fetchApi<StudyVideoResponse>(API_PATH, {
          params: {
            page: targetPage,
            pageSize: PAGE_SIZE,
            search: search.trim() || undefined,
          },
        })
        if (!res.success) throw new Error(res.error)
        const list = res.data.list ?? []
        setItems((prev) => (reset ? list : [...prev, ...list]))
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch {
        setError('加载失败,请下拉刷新重试')
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [search],
  )

  useEffect(() => {
    void load({ reset: true })
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load({ reset: true })
  }

  const onEndReached = () => {
    if (loadingMore || loading || refreshing) return
    if (items.length >= total) return
    setLoadingMore(true)
    void load({ reset: false, nextPage: page + 1 })
  }

  const onSubmitSearch = () => {
    setSearch(searchInput)
    setShowSearch(false)
  }

  const onPublish = () => {
    navigation.navigate('StudyPublish')
  }

  const onVideoClick = (item: StudyVideoItem) => {
    navigation.navigate('VideoPlayer', {
      courseId: String(item.courseId ?? item.id),
      lessonId: String(item.id),
      title: item.title,
    })
  }

  const initialLoading = loading && items.length === 0 && !refreshing

  const renderItem = ({ item }: { item: StudyVideoItem }) => {
    const duration = formatDuration(item.duration)
    const time = item.createdAt ? formatRelativeTime(item.createdAt) : ''
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onVideoClick(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.coverWrap}>
          {item.cover ? (
            <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>▶</Text>
            </View>
          )}
          {duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.teacherName ? (
            <Text style={styles.teacher} numberOfLines={1}>
              讲师:{item.teacherName}
            </Text>
          ) : null}
          {time ? <Text style={styles.time}>{time}</Text> : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar
        title="AI 视频"
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable
            hitSlop={BACK_HIT_SLOP}
            onPress={() => setShowSearch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="搜索"
          >
            <Text style={styles.searchIcon}>{showSearch ? '✕' : '🔍'}</Text>
          </Pressable>
        }
      />
      {showSearch ? (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="搜索视频"
            placeholderTextColor={tk.text.tertiary}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
          />
        </View>
      ) : null}
      {initialLoading ? (
        <View style={styles.centerWrap}>
          <Loading text="加载中..." />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={resolvedTheme === 'dark' ? tk.text.tertiary : tk.text.secondary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            error ? (
              <View style={styles.centerWrap}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryBtn} onPress={() => void load({ reset: true })}>
                  <Text style={styles.retryText}>{t('common.ok')}</Text>
                </Pressable>
              </View>
            ) : (
              <Empty text="暂无学习视频" icon="🎬" />
            )
          }
          ListFooterComponent={loadingMore ? <Loading text="加载更多..." /> : null}
        />
      )}
      <Pressable
        style={styles.fab}
        onPress={onPublish}
        accessibilityRole="button"
        accessibilityLabel="发布视频"
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  searchIcon: { fontSize: 18, color: tk.text.primary } as TextStyle,
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: tk.surface.card,
  } as ViewStyle,
  searchInput: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tk.surface.muted,
    fontSize: 14,
    color: tk.text.primary,
  } as TextStyle,
  listContent: {
    padding: 16,
    paddingBottom: 96,
    gap: 12,
  } as ViewStyle,
  card: {
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  } as ViewStyle,
  cardPressed: {
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  coverWrap: {
    position: 'relative',
    height: COVER_HEIGHT,
  } as ViewStyle,
  cover: {
    width: '100%',
    height: COVER_HEIGHT,
    borderRadius: 8,
  } as ImageStyle,
  coverPlaceholder: {
    width: '100%',
    height: COVER_HEIGHT,
    borderRadius: 8,
    backgroundColor: tk.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  coverPlaceholderText: {
    fontSize: 28,
    color: tk.text.tertiary,
  } as TextStyle,
  durationBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  } as ViewStyle,
  durationText: {
    fontSize: 11,
    color: tk.surface.light,
    fontWeight: '500',
  } as TextStyle,
  content: {
    gap: 6,
  } as ViewStyle,
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: tk.text.primary,
    lineHeight: 20,
  } as TextStyle,
  teacher: {
    fontSize: 12,
    color: tk.text.secondary,
  } as TextStyle,
  time: {
    fontSize: 11,
    color: tk.text.tertiary,
  } as TextStyle,
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  } as ViewStyle,
  errorText: {
    fontSize: 14,
    color: tk.error.text,
    textAlign: 'center',
  } as TextStyle,
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tk.brand.DEFAULT,
  } as ViewStyle,
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: tk.surface.light,
  } as TextStyle,
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tk.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: tk.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  } as ViewStyle,
  fabIcon: {
    fontSize: 24,
    color: tk.surface.light,
    fontWeight: '600',
  } as TextStyle,
})

export default StudyIndexScreen
