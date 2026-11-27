// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ChevronRight, Hash, Search } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import {
  getRnTokens,
  type RnThemeTokens,
  rnRadius,
  rnType,
  rnSpacing,
  taroSpacing,
} from '@ihui/design-tokens'
import { CategoryInlineBar, EmptyState, TextField } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useUiTextField } from '../lib/use-ui-text-field'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'
import { NavChrome } from '../components/NavChrome'

type Route = RouteProp<RootStackParamList, 'TopicList'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** /topics 列表项(对齐后端 topic-queries 的 title/coverImage；兼容旧 name/coverUrl) */
interface TopicItem {
  id: string | number
  title?: string
  coverImage?: string
  name?: string
  count?: number
  lessonCount?: number
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
  useUiTextField({
    label: t('topic.list.searchPlaceholder'),
    value: searchText,
    setValue: setSearchText,
  })
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
    const title = item.title ?? item.name ?? ''
    if (from === 'create') {
      // 对齐小程序 eventCenter.trigger(TOPIC_EVENT, name) + navigateBack:函数 params 直接回传
      onPickTopic?.(title)
      navigation.goBack()
      return
    }
    navigation.navigate('TopicDetail', { id: String(item.id) })
  }

  const topicTitle = (item: TopicItem) => item.title ?? item.name ?? ''
  const topicCover = (item: TopicItem) => item.coverImage ?? item.coverUrl

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'recommend', label: t('topic.list.recommend') },
    { key: 'hot', label: t('topic.list.hot') },
    { key: 'all', label: t('topic.list.all') },
  ]

  const renderItem = ({ item }: { item: TopicItem }) => (
    // 守门 131 改型:card 的 marginHorizontal/marginBottom 是列表行槽位属性,提到外层 cardSlot
    // (命中区止于 margin 外沿,与旧函数形态一致);行盒/底色/圆角/padding 原样留内层。
    <Pressable
      style={styles.cardSlot}
      onPress={() => goTopic(item)}
      accessibilityRole="button"
      accessibilityLabel={topicTitle(item)}
    >
      {({ pressed }) => (
        <View style={[styles.card, pressed ? styles.cardPressed : null]}>
          {topicCover(item) ? (
            <Image source={{ uri: topicCover(item) as string }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverFallback]}>
              <Text style={styles.coverHash}>{'#'}</Text>
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.name} numberOfLines={1}>
              {'#'}
              {topicTitle(item)}
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
              <Text style={styles.meta}>
                {t('topic.list.posts', { n: item.count ?? item.lessonCount ?? 0 })}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={tk.text.secondary} />
        </View>
      )}
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('topic.list.pageTitle')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <FlatList
        keyboardShouldPersistTaps="handled"
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
              <Search size={16} color={tk.text.secondary} />
              <TextField
                colorScheme={resolvedTheme}
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder={t('topic.list.searchPlaceholder')}
                placeholderTextColor={tk.text.secondary}
                returnKeyType="search"
                onSubmitEditing={onSubmitSearch}
              />
            </View>
            <CategoryInlineBar
              items={tabs.map((tab) => ({ id: tab.key, label: tab.label }))}
              selectedId={activeTab}
              onSelect={(id) => setActiveTab(id as TabKey)}
              colorScheme={resolvedTheme}
              contentPaddingHorizontal={0}
              itemGap={16}
              style={styles.tabRow}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={tk.text.secondary} />
              <Text style={styles.emptyText}>{t('topic.list.loading')}</Text>
            </View>
          ) : (
            // 2026-11-26:此前这里是裸 <Text> 一行灰字(实拍 topics 页只有「暂无话题」),
            // 而同端 circle 用的是图标+文案+按钮、「我的创作」是图标+灰字 —— 三种空态形态。
            // 改接共享 ScreenStates.EmptyState(它此前没从 @ihui/rn-app 出口导出,端内 import
            // 不进来,所以几乎没人用)。外层原 styles.center 随之去掉:该组件自带居中与最小高度。
            <EmptyState
              icon={<Hash size={18} color={tk.text.secondary} />}
              title={t('topic.list.empty')}
              colorScheme={resolvedTheme}
            />
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
      paddingHorizontal: rpx(taroSpacing['sm-loose']),
      height: rpx(72),
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    searchInput: {
      flex: 1,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      padding: rnSpacing.none,
    },
    tabRow: {
      flexDirection: 'row',
      gap: rpx(16),
      marginHorizontal: rpx(taroSpacing.md),
      marginBottom: rpx(20),
    },
    // 守门 131 改型:行槽位档(margin 数值逐字从 card 搬来,未改动任何数字),card 余档进内层。
    cardSlot: {
      marginHorizontal: rpx(taroSpacing.md),
      marginBottom: rpx(16),
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: rpx(24),
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    cardPressed: {
      opacity: 0.85,
    },
    cover: {
      width: rpx(100),
      height: rpx(100),
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverHash: {
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    cardBody: {
      flex: 1,
      marginLeft: rpx(taroSpacing.md),
      minWidth: 0,
      gap: rpx(8),
    },
    name: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    desc: {
      fontSize: rnType.label.size,
      color: tk.text.medium,
    },
    metaRow: {
      flexDirection: 'row',
      gap: rpx(16),
    },
    meta: {
      fontSize: rnType.caption.size,
      color: tk.text.medium,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rpx(120),
      gap: rpx(16),
    },
    emptyText: {
      fontSize: rnType.bodySm.size,
      color: tk.text.medium,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rpx(12),
      paddingVertical: rpx(24),
    },
    footerText: {
      fontSize: rnType.bodySm.size,
      color: tk.text.medium,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
