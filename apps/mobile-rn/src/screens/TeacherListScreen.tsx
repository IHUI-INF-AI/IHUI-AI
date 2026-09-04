// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TeacherListScreen 讲师列表页(mobile-rn 端)
 *
 * 镜像 miniapp-taro pages/teacher/list(P0 课程交易链路):
 * - 复用共享层:@ihui/api-client fetchApi(端点 /teacher/list)+ Teacher 类型,
 *   分页状态复用 packages/shared usePaginatedList(经 ../hooks re-export),端内不重造业务逻辑
 * - 交互:关键词搜索(提交触发重查)→ FlatList 分页(上拉加载/下拉刷新)→ 点击卡片进讲师详情
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { ChevronRight, Search } from 'lucide-react-native'
import { fetchApi, type Teacher } from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** /teacher/list 响应结构(对齐 miniapp getTeacherList) */
interface TeacherPage {
  list: Teacher[]
  total: number
}

const PAGE_SIZE = 10

export function TeacherListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [searchText, setSearchText] = useState('')
  const [keyword, setKeyword] = useState('')

  // 关键词变化 → fetcher 重建 → usePaginatedList 自动重拉第 1 页
  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await fetchApi<TeacherPage>('/teacher/list', {
        params: { page, pageSize, keyword: keyword || undefined },
      })
      if (!res.success) return { success: false as const, error: t('common.failed') }
      return {
        success: true as const,
        data: { list: res.data?.list ?? [], total: res.data?.total ?? 0 },
      }
    },
    [keyword, t],
  )

  const { items, loading, refreshing, loadingMore, refresh, loadMore } = usePaginatedList(
    fetcher,
    PAGE_SIZE,
  )

  const onSubmitSearch = () => setKeyword(searchText.trim())

  const renderItem = ({ item }: { item: Teacher }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      onPress={() => navigation.navigate('TeacherDetail', { id: String(item.id) })}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{item.name.slice(0, 1)}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.title ? (
            <View style={styles.titleBadge}>
              <Text style={styles.titleBadgeText} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          ) : null}
        </View>
        {item.intro ? (
          <Text style={styles.intro} numberOfLines={2}>
            {item.intro}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {t('teacher.list.courseCount', { n: item.courses ?? 0 })} ·{' '}
          {t('teacher.list.studentCount', { n: item.students ?? 0 })}
        </Text>
      </View>
      <ChevronRight size={18} color={tk.text.tertiary} />
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <NavBar title={t('teacher.list.title')} onBack={() => navigation.goBack()} />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tk.text.secondary} />
        }
        ListHeaderComponent={
          <View style={styles.searchWrap}>
            <Search size={16} color={tk.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder={t('teacher.list.searchPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              returnKeyType="search"
              onSubmitEditing={onSubmitSearch}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={tk.text.secondary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('teacher.list.empty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={tk.text.secondary} />
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
      paddingHorizontal: rpx(24),
      height: rpx(72),
      borderRadius: rpx(36),
      backgroundColor: tk.surface.card,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: tk.text.primary,
      padding: 0,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(24),
      marginHorizontal: rpx(24),
      marginBottom: rpx(24),
      padding: rpx(24),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
    },
    cardPressed: {
      opacity: 0.85,
    },
    avatar: {
      width: rpx(120),
      height: rpx(120),
      borderRadius: rpx(60),
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    cardBody: {
      flex: 1,
      gap: rpx(8),
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(12),
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 1,
    },
    titleBadge: {
      paddingHorizontal: rpx(12),
      paddingVertical: rpx(4),
      borderRadius: rpx(8),
      backgroundColor: tk.surface.muted,
      flexShrink: 1,
    },
    titleBadgeText: {
      fontSize: 11,
      color: tk.text.secondary,
    },
    intro: {
      fontSize: 13,
      lineHeight: 18,
      color: tk.text.secondary,
    },
    meta: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rpx(120),
      gap: rpx(16),
    },
    emptyText: {
      fontSize: 14,
      color: tk.text.tertiary,
    },
    footer: {
      paddingVertical: rpx(24),
      alignItems: 'center',
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
