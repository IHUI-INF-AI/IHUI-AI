/**
 * MoreCourseScreen 更多课程页(mobile-rn 端)
 *
 * 对齐历史 Uniapp pagesA/course/MoreCourse.vue(课程列表入口 / "查看更多" 跳转):
 * - 顶部 NavBar「更多课程」+ 返回
 * - FlatList 课程卡片(封面图 + 标题 + 讲师 + 价格 + 课时/学员)
 * - 下拉刷新 + 上拉分页(对齐 .vue scrolltolower)
 * - 空态(Default)+ 加载态(Loading)+ 错误重试
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
import { getCourses, type Course } from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import Default from '../components/common/Default'
import Loading from '../components/common/Loading'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10
const CARD_RADIUS = 12
const COVER_HEIGHT = 160

function formatPrice(price: number, isFree: boolean): string {
  if (isFree || price <= 0) return '免费'
  return `¥${price.toFixed(2)}`
}

export function MoreCourseScreen() {
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<Course[]>([])
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
        const res = await getCourses({ page: targetPage, pageSize: PAGE_SIZE })
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

  const showDetail = (item: Course) => {
    navigation.navigate('CourseDetail', { id: String(item.id) })
  }

  const initialLoading = loading && items.length === 0 && !refreshing

  const renderCard = ({ item }: { item: Course }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      onPress={() => showDetail(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {item.cover ? (
        <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Text style={styles.coverEmoji}>📚</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.instructor} numberOfLines={1}>
            讲师:{item.instructor || '匿名'}
          </Text>
          <Text style={styles.lessonCount}>{item.lessonCount} 课时</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.price}>{formatPrice(item.price, item.isFree)}</Text>
          <Text style={styles.studentCount}>{item.studentCount} 人学过</Text>
        </View>
      </View>
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <NavBar title="更多课程" onBack={() => navigation.goBack()} />
      {initialLoading ? (
        <View style={styles.centerWrap}>
          <Loading text="加载中..." />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
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
                  <Text style={styles.retryText}>重试</Text>
                </Pressable>
              </View>
            ) : (
              <Default text="暂无课程,敬请期待" icon="📚" />
            )
          }
          ListFooterComponent={loadingMore ? <Loading text="加载更多..." /> : null}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 } as ViewStyle,
  card: {
    backgroundColor: tk.surface.card,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  } as ViewStyle,
  cardPressed: { backgroundColor: tk.surface.muted } as ViewStyle,
  cover: { width: '100%', height: COVER_HEIGHT, backgroundColor: tk.surface.muted } as ImageStyle,
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  coverEmoji: { fontSize: 40 } as TextStyle,
  cardBody: { padding: 12, gap: 6 } as ViewStyle,
  cardTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary, lineHeight: 20 } as TextStyle,
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } as ViewStyle,
  instructor: { fontSize: 12, color: tk.text.medium, flex: 1 } as TextStyle,
  lessonCount: { fontSize: 12, color: tk.text.tertiary } as TextStyle,
  price: { fontSize: 14, fontWeight: '700', color: tk.warning.deep } as TextStyle,
  studentCount: { fontSize: 12, color: tk.text.tertiary } as TextStyle,
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  } as ViewStyle,
  errorText: { fontSize: 14, color: tk.error.text, textAlign: 'center' } as TextStyle,
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tk.brand.DEFAULT,
  } as ViewStyle,
  retryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light } as TextStyle,
})

export default MoreCourseScreen
