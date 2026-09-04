// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TopicListScreen 话题列表页(mobile-rn 端)
 *
 * 镜像 miniapp-taro pages/topic/list(P1 社区链路补齐):
 * - 复用共享层:@ihui/api-client fetchApi(端点 /topics),
 *   分页状态复用 packages/shared usePaginatedList(经 ../hooks re-export),端内不重造业务逻辑
 * - 交互:关键词搜索(提交触发重查)+ 推荐/热门/全部三 tab → FlatList 分页 →
 *   from==='create' 时点选话题经 onPickTopic 回调回传并 goBack(对齐小程序 TOPIC_EVENT + navigateBack),
 *   否则进话题详情
 * - 样式:getRnTokens 语义 token(零 hex,过 check:rn-parity);图标 lucide-react-native(无 emoji)
 */
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ChevronRight, Search } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type Route = RouteProp<RootStackParamList, 'TopicList'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** /topics 列表项(对齐 miniapp topic/list TopicItem) */
interface TopicItem {
  id: string | number
  name: string
  count: number
  coverUrl?: string
  description?: string
  participantCount?: number
}

/** /topics 响应结构 */
interface TopicPage {
  list: TopicItem[]
  total: number
}

type TabKey = 'recommend' | 'hot' | 'all'

const PAGE_SIZE = 20

export function TopicListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const from = route.params?.from ?? ''
  const onPickTopic = route.params?.onPickTopic

  const [searchText, setSearchText] = useState('')
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('recommend')

  // tab/关键词变化 → fetcher 重建 → usePaginatedList 自动重拉第 1 页
  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await fetchApi<TopicPage>('/topics', {
        params: {
          page,
          pageSize,
          keyword: keyword || undefined,
          ...(activeTab === 'hot' ? { sort: 'hot' } : {}),
        },
      })
      if (!res.success) return { success: false as const, error: t('common.failed') }
      return {
        success: true as const,
        data: { list: res.data?.list ?? [], total: res.data?.total ?? 0 },
      }
    },
    [keyword, activeTab, t],
  )

  const { items, loading, refreshing, loadingMore, refresh, loadMore } = usePaginatedList(
    fetcher,
    PAGE_SIZE,
  )

  const onSubmitSearch = () => setKeyword(searchText.trim())

  const goTopic = (item: TopicItem) => {
    if (from === 'create') {
      // 对齐小程序 eventCenter.trigger(TOPIC_EVENT, name) + navigateBack:函数 params 直接回传
      onPickTopic?.(item.name ?? '')
      navigation.goBack()
      return
    }
    navigation.navigate('TopicDetail', { id: String(item.id) })
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'recommend', label: t('topic.list.recommend') },
    { key: 'hot', label: t('topic.list.hot') },
    { key: 'all', label: t('topic.list.all') },
  ]

  const renderItem = ({ item }: { item: TopicItem }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      onPress={() => goTopic(item)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Text style={styles.coverHash}>{'#'}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>
          {'#'}
          {item.name}
        </Text>
        {item.description ? (
          <Text style={styles.desc} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {t('topic.list.participants', { n: item.participantCount ?? 0 })}
          </Text>
          <Text style={styles.meta}>{t('topic.list.posts', { n: item.count ?? 0 })}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={tk.text.tertiary} />
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <NavBar title={t('topic.list.pageTitle')} onBack={() => navigation.goBack()} />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={tk.text.secondary}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.searchWrap}>
              <Search size={16} color={tk.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder={t('topic.list.searchPlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                returnKeyType="search"
                onSubmitEditing={onSubmitSearch}
              />
            </View>
            <View style={styles.tabRow}>
              {tabs.map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key ? styles.tabActive : null]}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === tab.key }}
                >
                  <Text
                    style={[styles.tabText, activeTab === tab.key ? styles.tabTextActive : null]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={tk.text.secondary} />
              <Text style={styles.emptyText}>{t('topic.list.loading')}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('topic.list.empty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={tk.text.secondary} />
              <Text style={styles.footerText}>{t('topic.list.loadingMore')}</Text>
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
    listContent: {
      paddingBottom: rpx(40),
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(16),
      margin: rpx(24),
      marginBottom: rpx(20),
      paddingHorizontal: rpx(20),
      height: rpx(72),
      borderRadius: rpx(24),
      backgroundColor: tk.surface.card,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: tk.text.primary,
      padding: 0,
    },
    tabRow: {
      flexDirection: 'row',
      gap: rpx(16),
      marginHorizontal: rpx(24),
      marginBottom: rpx(20),
    },
    tab: {
      flex: 1,
      height: rpx(64),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rpx(20),
      backgroundColor: tk.surface.card,
    },
    tabActive: {
      backgroundColor: tk.surface.muted,
    },
    tabText: {
      fontSize: 13,
      color: tk.text.tertiary,
    },
    tabTextActive: {
      color: tk.text.primary,
      fontWeight: '600',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: rpx(24),
      marginBottom: rpx(16),
      padding: rpx(24),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
    },
    cardPressed: {
      opacity: 0.85,
    },
    cover: {
      width: rpx(100),
      height: rpx(100),
      borderRadius: rpx(12),
      backgroundColor: tk.surface.muted,
    },
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverHash: {
      fontSize: 20,
      fontWeight: '700',
      color: tk.text.primary,
    },
    cardBody: {
      flex: 1,
      marginLeft: rpx(24),
      minWidth: 0,
      gap: rpx(8),
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    },
    desc: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    metaRow: {
      flexDirection: 'row',
      gap: rpx(16),
    },
    meta: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rpx(120),
      gap: rpx(16),
    },
    emptyText: {
      fontSize: 13,
      color: tk.text.tertiary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rpx(12),
      paddingVertical: rpx(24),
    },
    footerText: {
      fontSize: 13,
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
// ⁠​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
