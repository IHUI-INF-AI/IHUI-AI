/**
 * LearnDevelopScreen 学习开发页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/learn_develop/index.vue(学习开发内容列表):
 * - 顶部 NavBar(标题「学习开发」+ 返回)
 * - 单列内容卡片(封面 / 标题 / 摘要 / 作者 / 相对时间)
 * - 数据加载:fetchApi 拉取 /api/learn-develop(分页)
 * - 下拉刷新 + 上拉分页 + 空态(Empty)+ 加载态(Loading)+ 错误重试
 * - 悬浮发布按钮(学习心得发布)
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
const API_PATH = '/api/learn-develop'
const COVER_WIDTH = 100
const COVER_HEIGHT = 80

interface LearnDevItem {
  id: string | number
  title: string
  summary?: string
  cover?: string
  author?: string
  createdAt?: string
}

interface LearnDevResponse {
  list: LearnDevItem[]
  total: number
}

export function LearnDevelopScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<LearnDevItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(
    async (opts: { reset?: boolean; nextPage?: number } = {}) => {
      const reset = opts.reset ?? false
      const targetPage = opts.nextPage ?? 1
      if (reset) {
        setLoading(true)
        setError('')
      }
      try {
        const res = await fetchApi<LearnDevResponse>(API_PATH, {
          params: { page: targetPage, pageSize: PAGE_SIZE },
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
    [],
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

  const onPublish = () => {
    navigation.navigate('StudyPublish')
  }

  const onItemClick = (item: LearnDevItem) => {
    navigation.navigate('ArticleDetail', { id: String(item.id) })
  }

  const initialLoading = loading && items.length === 0 && !refreshing

  const renderItem = ({ item }: { item: LearnDevItem }) => {
    const author = item.author || '匿名'
    const time = item.createdAt ? formatRelativeTime(item.createdAt) : ''
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onItemClick(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
        ) : null}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.author} numberOfLines={1}>
              {author}
            </Text>
            {time ? <Text style={styles.time}>{time}</Text> : null}
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar title="学习开发" onBack={() => navigation.goBack()} />
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
              <Empty text="暂无学习开发内容" icon="📖" />
            )
          }
          ListFooterComponent={loadingMore ? <Loading text="加载更多..." /> : null}
        />
      )}
      <Pressable
        style={styles.fab}
        onPress={onPublish}
        accessibilityRole="button"
        accessibilityLabel="发布学习心得"
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  listContent: {
    padding: 16,
    paddingBottom: 96,
    gap: 12,
  } as ViewStyle,
  card: {
    flexDirection: 'row',
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  } as ViewStyle,
  cardPressed: {
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  cover: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 8,
  } as ImageStyle,
  content: {
    flex: 1,
    gap: 6,
  } as ViewStyle,
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: tk.text.primary,
    lineHeight: 20,
  } as TextStyle,
  summary: {
    fontSize: 12,
    color: tk.text.secondary,
    lineHeight: 17,
  } as TextStyle,
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  } as ViewStyle,
  author: {
    flex: 1,
    fontSize: 11,
    color: tk.text.medium,
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

export default LearnDevelopScreen
