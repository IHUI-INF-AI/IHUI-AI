// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
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
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'

/** 讲师列表条目(平台无关,由 wrapper 从各端数据源映射) */
export interface LecturerListItem {
  id: string
  name: string
  avatar: string | null
  title: string | null
  intro: string | null
  courses: number
  students: number
}

/** LecturerListScreen 讲师列表(共享层)props — 数据/回调/t 由 wrapper 注入 */
export interface LecturerListScreenProps {
  t: TFunction
  items: LecturerListItem[]
  /** 首屏加载中(列表为空时展示居中 Loading) */
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  onRefresh: () => void
  onLoadMore: () => void
  /** 提交搜索关键词(回车触发,已 trim) */
  onSearch: (keyword: string) => void
  onOpenLecturer: (lecturerId: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * LecturerListScreen 讲师列表(共享层)
 *
 * 2026-09-15 承接 mobile-rn TeacherListScreen 1:1 迁移,对齐 miniapp pages/teacher/list:
 * - 结构:顶部导航行 → 搜索框(ListHeader)→ 讲师卡列表(头像/姓名/头衔徽章/简介/统计)
 * - 分页:下拉刷新 + 上拉加载更多由 props 注入(onRefresh/onLoadMore)
 * - 平台无关:API(fetchApi /teacher/list)、分页 hook、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex);750 设计稿 rpx 值按 /2 转 dp
 * - i18n:沿用 teacher.list.* 与 common.failed(mobile-rn i18n 既有 key)
 */
export function LecturerListScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  onRefresh,
  onLoadMore,
  onSearch,
  onOpenLecturer,
  onBack,
  colorScheme = 'light',
}: LecturerListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 搜索框输入(纯 UI 状态,提交时经 onSearch 上抛,由 wrapper 触发重查) */
  const [searchText, setSearchText] = useState('')

  const renderItem = ({ item }: { item: LecturerListItem }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      onPress={() => onOpenLecturer(item.id)}
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
          {t('teacher.list.courseCount', { n: item.courses })} ·{' '}
          {t('teacher.list.studentCount', { n: item.students })}
        </Text>
      </View>
      <ChevronRight size={18} color={tk.text.tertiary} />
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <Header title={t('teacher.list.title')} onBack={onBack} styles={styles} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
              onSubmitEditing={() => onSearch(searchText.trim())}
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

// ── 私有:顶部导航行(返回箭头 + 标题,替代 RN 端 NavBar) ──

function Header({
  title,
  onBack,
  styles,
}: {
  title: string
  onBack: () => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        style={styles.headerBackBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="back"
      >
        <ChevronLeft size={22} color={styles.headerIcon.color} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSidePlaceholder} />
    </View>
  )
}

/**
 * 样式:750 设计稿 rpx 值 / 2 转 dp(共享层惯例,对齐 packages/app 其他迁移屏)。
 * 全部颜色走 AppThemeTokens 语义 token,零 hex。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    listContent: {
      paddingBottom: 20, // rpx(40)
    },
    pressed: {
      opacity: 0.85,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      paddingHorizontal: 10,
    },
    headerBackBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      color: tk.brand.DEFAULT,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      textAlign: 'center',
    },
    headerSidePlaceholder: {
      width: 32,
    },
    /* 搜索框(ListHeader) */
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8, // rpx(16)
      margin: 12, // rpx(24)
      paddingHorizontal: 12, // rpx(24)
      height: 36, // rpx(72)
      borderRadius: 36 / 2, // rpx(36) radius-exempt: 胶囊搜索框,半径=高度一半
      backgroundColor: tk.surface.card,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: tk.text.primary,
      padding: 0,
    },
    /* 讲师卡片 */
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12, // rpx(24)
      marginHorizontal: 12, // rpx(24)
      marginBottom: 12, // rpx(24)
      padding: 12, // rpx(24)
      borderRadius: rnRadius.lg, // rpx(16)
      backgroundColor: tk.surface.card,
    },
    avatar: {
      width: 60, // rpx(120)
      height: 60, // rpx(120)
      borderRadius: 60 / 2, // rpx(60) radius-exempt: 圆形讲师头像,半径=宽高一半
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
      gap: 4, // rpx(8)
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6, // rpx(12)
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 1,
    },
    titleBadge: {
      paddingHorizontal: 6, // rpx(12)
      paddingVertical: 2, // rpx(4)
      borderRadius: rnRadius.sm, // rpx(8)
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
    /* 空态 / 加载更多 */
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60, // rpx(120)
      gap: 8, // rpx(16)
    },
    emptyText: {
      fontSize: 14,
      color: tk.text.tertiary,
    },
    footer: {
      paddingVertical: 12, // rpx(24)
      alignItems: 'center',
    },
  } satisfies Record<string, ViewStyle | TextStyle | ImageStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
