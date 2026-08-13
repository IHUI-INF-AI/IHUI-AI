/**
 * SquareScreen 广场页面(mobile-rn 端)
 *
 * 对齐历史项目 pages/table/square/index.vue(简化为资讯/文章动态流):
 * - 顶部 NavBar(标题「广场」+ 返回)
 * - 广场动态列表(资讯/文章卡片:分类 / 标题 / 摘要 / 作者 / 相对时间 / 阅读量)
 * - 数据加载走 fetchApi(@ihui/api-client),拉取 /api/knowledge 文章流
 * - 下拉刷新 / 错误态 / 空态(common/Empty);浅色优雅风;圆角守门;无分割线
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, type Knowledge } from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { formatRelativeTime } from '@ihui/shared'
import Empty from '../components/common/Empty'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** /api/knowledge 分页响应(对齐 PageData<Knowledge>) */
interface KnowledgePage {
  list: Knowledge[]
  total: number
}

const PAGE_SIZE = 20
const DEFAULT_AUTHOR = 'AI 智汇社'

export function SquareScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [items, setItems] = useState<Knowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<KnowledgePage>(
        `/api/knowledge?page=1&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success) throw new Error(res.error)
      setItems(res.data?.list ?? [])
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const onItemClick = (id: string) => navigation.navigate('ArticleDetail', { id })

  const renderItem = ({ item }: { item: Knowledge }) => {
    const author = item.authorName || DEFAULT_AUTHOR
    const time = formatRelativeTime(item.createdAt, locale)
    const views = item.viewCount ?? 0
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onItemClick(item.id)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.content}>
          {item.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText} numberOfLines={1} allowFontScaling={false}>
                {item.category}
              </Text>
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.authorBadge}>
              <Text style={styles.authorText} numberOfLines={1} allowFontScaling={false}>
                {author}
              </Text>
            </View>
            <Text style={styles.metaText} allowFontScaling={false}>
              {time}
            </Text>
            <Text style={styles.metaText} allowFontScaling={false}>
              {`${views} 阅读`}
            </Text>
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar title="广场" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="small" color={tk.text.secondary} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centerWrap}>
          <Empty text={error} actionText={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.itemGap} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tk.text.secondary} />
          }
          ListEmptyComponent={<Empty />}
        />
      )}
    </View>
  )
}

function createStyles(tk: RnThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    } as ViewStyle,
    listContent: {
      padding: 8,
    } as ViewStyle,
    itemGap: {
      height: 8,
    } as ViewStyle,

    // 卡片
    card: {
      borderRadius: 12,
      padding: 8,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    cardPressed: {
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    content: {
      gap: 6,
    } as ViewStyle,
    categoryBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tk.indigo.light,
    } as ViewStyle,
    categoryText: {
      fontSize: 11,
      lineHeight: 14,
      color: tk.indigo.DEFAULT,
      fontWeight: '600',
    } as TextStyle,
    title: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    summary: {
      fontSize: 13,
      lineHeight: 19,
      color: tk.text.secondary,
    } as TextStyle,
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    } as ViewStyle,
    authorBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tk.purple.light,
    } as ViewStyle,
    authorText: {
      fontSize: 11,
      lineHeight: 14,
      color: tk.purple.DEFAULT,
      fontWeight: '600',
    } as TextStyle,
    metaText: {
      fontSize: 11,
      lineHeight: 14,
      color: tk.text.tertiary,
    } as TextStyle,
  })
}

export default SquareScreen
