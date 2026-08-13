/**
 * PlazaScreen 动态广场页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/plaza/index.vue(AI 需求广场 / 动态列表):
 * - 顶部 NavBar(标题「动态」+ 返回)+ 右侧搜索开关
 * - 状态筛选 chips(全部 / 进行中 / 已完成,对齐 .vue Status 组件)
 * - 双列卡片(标题 / 描述 / 作者头像 + 昵称 / 相对时间,对齐 .vue CardContent)
 * - 下拉刷新 + 上拉分页(对齐 .vue scrolltolower)
 * - 空态(Default)+ 加载态(Loading)+ 错误重试
 * - 悬浮发布按钮(对齐 .vue floating-publish-btn)
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getPlazaList, type PlazaItem } from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { formatRelativeTime } from '@ihui/shared'
import { NavBar } from '../components/NavBar'
import Default from '../components/common/Default'
import Loading from '../components/common/Loading'
import { SearchInput } from '../components/SearchInput'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

interface StatusChip {
  label: string
  value: string
}

const STATUS_CHIPS: readonly StatusChip[] = [
  { label: '全部', value: '' },
  { label: '进行中', value: '2' },
  { label: '已完成', value: '3' },
]

const PLACEHOLDER_AVATAR = '🧑‍💻'
const AVATAR_SIZE = 24
const CARD_RADIUS = 12
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

function avatarText(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : PLACEHOLDER_AVATAR
}

export function PlazaScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<PlazaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('2')
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
        const res = await getPlazaList({
          page: targetPage,
          pageSize: PAGE_SIZE,
          status: status || undefined,
          search: search.trim() || undefined,
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
    [status, search],
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
    navigation.navigate('PostCreate', {})
  }

  const showDetail = (item: PlazaItem) => {
    navigation.navigate('PostDetail', { id: String(item.id) })
  }

  const initialLoading = loading && items.length === 0 && !refreshing

  const renderCard = ({ item }: { item: PlazaItem }) => {
    const author = item.creator || '匿名'
    const time = item.createdAt ? formatRelativeTime(item.createdAt) : ''
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => showDetail(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          <View style={styles.avatarWrap}>
            {item.creatorAvatar ? (
              <Image source={{ uri: item.creatorAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{avatarText(author)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          {time ? <Text style={styles.time}>{time}</Text> : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar
        title="动态"
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
          <SearchInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="搜索动态"
            onSubmit={onSubmitSearch}
          />
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {STATUS_CHIPS.map((chip) => {
          const active = chip.value === status
          return (
            <Pressable
              key={chip.value || 'all'}
              style={[styles.chip, active ? styles.chipActive : null]}
              onPress={() => setStatus(chip.value)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                {chip.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {initialLoading ? (
        <View style={styles.centerWrap}>
          <Loading text="加载中..." />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
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
              <Default text="暂无动态,快来抢占市场" icon="🌐" />
            )
          }
          ListFooterComponent={loadingMore ? <Loading text="加载更多..." /> : null}
        />
      )}
      <Pressable
        style={styles.fab}
        onPress={onPublish}
        accessibilityRole="button"
        accessibilityLabel="发布需求"
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
  chipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  } as ViewStyle,
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  chipActive: {
    backgroundColor: tk.brand.DEFAULT,
  } as ViewStyle,
  chipText: {
    fontSize: 13,
    color: tk.text.secondary,
  } as TextStyle,
  chipTextActive: {
    color: tk.surface.light,
    fontWeight: '600',
  } as TextStyle,
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 96,
  } as ViewStyle,
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  } as ViewStyle,
  card: {
    width: '48%',
    backgroundColor: tk.surface.card,
    borderRadius: CARD_RADIUS,
    padding: 12,
    gap: 8,
  } as ViewStyle,
  cardPressed: {
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tk.text.primary,
    lineHeight: 19,
  } as TextStyle,
  cardDesc: {
    fontSize: 12,
    color: tk.text.secondary,
    lineHeight: 17,
  } as TextStyle,
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  } as ViewStyle,
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  } as ViewStyle,
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 6,
  } as ImageStyle,
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 6,
    backgroundColor: tk.purple.light,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: tk.purple.DEFAULT,
  } as TextStyle,
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

export default PlazaScreen
