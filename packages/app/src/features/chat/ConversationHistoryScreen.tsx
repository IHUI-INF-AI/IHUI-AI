// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 会话历史共享屏 —— props 注入式跨端组件（RN / 小程序 / web 试点同源）。
 *
 * 平台无关：本文件**零平台 API**。路由跳转、分享、存储、返回、toast、鉴权全部由 wrapper
 * 通过 props 注入；本屏只做「拿到的行怎么排、怎么分组、怎么画」。
 *
 * 数据面契约：
 * - `groups` 由 wrapper 用共享 `groupConversationByDate` 切好传入（本屏不再自写日历制）；
 * - 排序出口 `orderHistoryRows` 是本模块导出的唯一一份（时间倒序打底 + 共享
 *   `sortPinnedFirst` 置顶优先稳定重排），页面/RN wrapper 直接复用它做分页切片，
 *   从而不在端内留第二处排序出口。
 */

import { useCallback, useMemo, useState } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { sortPinnedFirst } from '@ihui/shared/chat/conversation-org'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'
import type { TFunction } from '../../types'

type Scheme = 'light' | 'dark'

/** 排序/分桶只需这两列；页面与 RN wrapper 都按此形状喂行。 */
export interface ConversationHistoryOrderable {
  timestamp?: number
  time?: string
  pinned?: boolean
}

export function itemTimestamp(row: ConversationHistoryOrderable): number {
  if (row.timestamp) return row.timestamp
  const parsed = new Date(row.time ?? '').getTime()
  return isNaN(parsed) ? Date.now() : parsed
}

/**
 * 唯一排序出口：时间倒序打底，再走共享 sortPinnedFirst 做置顶优先稳定重排。
 * 与薄壳前的页面实现逐字等价（同一输入 ⇒ 同一顺序）。
 */
export function orderHistoryRows<T extends ConversationHistoryOrderable>(items: readonly T[]): T[] {
  return sortPinnedFirst([...items].sort((a, b) => itemTimestamp(b) - itemTimestamp(a)))
}

/** 一行会话的展示数据（wrapper 已把时间/条数/图标换成展示值）。 */
export interface ConversationHistoryRow {
  id: string
  title: string
  preview?: string
  timeLabel: string
  /** 原始条数；文案由本屏按 `ai.historyPage.msgCount` 取词（单一取词点） */
  messageCount: number
  /** 可选：无远程图标的端（如 RN）留空，本屏回落占位块 */
  iconSrc?: string
  pinned: boolean
}

export interface ConversationHistoryGroup {
  key: string
  /** wrapper 已按共享日历制取好词的分组标题 */
  label: string
  items: readonly ConversationHistoryRow[]
}

export interface ConversationHistoryFilter {
  key: string
  label: string
  iconSrc?: string
}

export interface ConversationHistoryScreenProps {
  t: TFunction
  tt: (key: string, fallback: string) => string
  groups: readonly ConversationHistoryGroup[]
  /** 当前已加载行数（决定空态/清空入口，不受分页切片影响） */
  itemCount: number
  loading: boolean
  isFiltered: boolean
  keyword: string
  onKeywordChange: (value: string) => void
  filters: readonly ConversationHistoryFilter[]
  activeFilter: string
  onFilterChange: (key: string) => void
  showClearAll: boolean
  onClearAll: () => void
  onImport: () => void
  degraded: boolean
  onRetry: () => void
  canPin: boolean
  onOpen: (row: ConversationHistoryRow) => void
  onTogglePin: (row: ConversationHistoryRow) => void
  /** 不传 ⇒ 行上没有长按删除（阴性对照：行为由 props 驱动） */
  onLongPress?: (row: ConversationHistoryRow) => void
  /** 空态顶部图（wrapper 按 isFiltered 传 ICONS.search / ICONS.message）；不传则只用字符图标 */
  emptyIconSrc?: string
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  refreshing: boolean
  onRefresh: () => void
  onStartNew: () => void
  colorScheme?: Scheme
}

export function ConversationHistoryScreen({
  t,
  tt,
  groups,
  itemCount,
  loading,
  isFiltered,
  keyword,
  onKeywordChange,
  filters,
  activeFilter,
  onFilterChange,
  showClearAll,
  onClearAll,
  onImport,
  degraded,
  onRetry,
  canPin,
  onOpen,
  onTogglePin,
  onLongPress,
  hasMore,
  loadingMore,
  onLoadMore,
  refreshing,
  onRefresh,
  onStartNew,
  colorScheme = 'light',
  emptyIconSrc,
}: ConversationHistoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 搜索框聚焦态:只换描边颜色(§4 唯一例外位),1px 宽度不动 ⇒ 无布局跳动。
  // 与 HelpScreen 搜索框同一写法;此前这里是裸 TextInput,有 value 却没有任何聚焦处理
  // (2026-11-06 由 RN 裸 TextInput 普查锁 G-978007 点名)。
  const [searchFocused, setSearchFocused] = useState(false)

  const renderRow = useCallback(
    (row: ConversationHistoryRow) => (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onOpen(row)}
        onLongPress={onLongPress ? () => onLongPress(row) : undefined}
        delayLongPress={500}
        accessibilityRole="button"
        accessibilityLabel={row.title}
      >
        {row.iconSrc ? (
          <Image source={{ uri: row.iconSrc }} style={styles.rowIcon} resizeMode="contain" />
        ) : (
          <View style={[styles.rowIcon, styles.iconFallback]} />
        )}
        <View style={styles.rowBody}>
          <View style={styles.rowTitleLine}>
            {row.pinned ? <View style={styles.pinDot} /> : null}
            <Text style={styles.rowTitle} numberOfLines={1}>
              {row.title}
            </Text>
          </View>
          <View style={styles.rowMetaLine}>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {row.timeLabel}
            </Text>
            <Text style={styles.rowMeta}>
              {t('ai.historyPage.msgCount', { n: row.messageCount })}
            </Text>
          </View>
          {row.preview ? (
            <Text style={styles.rowPreview} numberOfLines={1}>
              {row.preview}
            </Text>
          ) : null}
        </View>
        {canPin ? (
          <TouchableOpacity
            style={styles.pinButton}
            onPress={() => onTogglePin(row)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              row.pinned ? tt('ai.historyPage.pinned', '已置顶') : tt('ai.historyPage.pin', '置顶')
            }
            testID={`history-pin-${row.id}`}
          >
            <View
              style={[styles.pinDot, styles.pinDotButton, row.pinned ? styles.pinDotOn : null]}
            />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    ),
    [canPin, onLongPress, onOpen, onTogglePin, styles, t, tk, tt],
  )

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchGrow}>
          <TextInput
            style={[styles.searchInput, searchFocused ? styles.searchInputFocused : null]}
            value={keyword}
            onChangeText={onKeywordChange}
            placeholder={tt('ai.historyPage.searchPlaceholder', '搜索对话历史')}
            placeholderTextColor={tk.text.tertiary}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        {showClearAll ? (
          <TouchableOpacity
            onPress={onClearAll}
            accessibilityRole="button"
            testID="history-clear-all"
          >
            <Text style={styles.clearAll}>{tt('ai.historyPage.clearAll', '清空全部')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity style={styles.importRow} onPress={onImport} accessibilityRole="button">
        <Text style={styles.importText}>{tt('conversationImport.pageTitle', '外部会话导入')}</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {degraded && !loading ? (
        <View style={styles.noticeRow}>
          <Text style={styles.noticeText}>
            {tt('ai.historyPage.fallbackNotice', '服务端会话加载失败,当前显示本机历史记录')}
          </Text>
          <TouchableOpacity style={styles.retry} onPress={onRetry} accessibilityRole="button">
            <Text style={styles.retryText}>{tt('common.retry', '重试')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {filters.length > 0 ? (
        <View style={styles.filterRow}>
          {filters.map((f) => {
            const active = activeFilter === f.key
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, active ? styles.chipActive : null]}
                onPress={() => onFilterChange(f.key)}
                accessibilityRole="button"
                testID={`history-filter-${f.key}`}
              >
                {f.iconSrc ? (
                  <Image source={{ uri: f.iconSrc }} style={styles.chipIcon} resizeMode="contain" />
                ) : null}
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ) : null}

      {loading ? (
        <ScreenSkeleton colorScheme={colorScheme} variant="list" count={4} />
      ) : itemCount === 0 ? (
        <EmptyState
          colorScheme={colorScheme}
          icon={
            emptyIconSrc ? (
              <Image source={{ uri: emptyIconSrc }} style={styles.emptyIcon} resizeMode="contain" />
            ) : undefined
          }
          title={
            isFiltered ? tt('ai.historyPage.noResult', '未找到相关对话') : t('ai.historyPage.empty')
          }
          actionLabel={isFiltered ? undefined : tt('ai.historyPage.startNew', '开始新对话')}
          onAction={isFiltered ? undefined : onStartNew}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View style={styles.groupWrap}>
              {/* 分组标题由 wrapper 取好词；空组已由共享日历制丢弃 */}
              {group.items.length > 0 ? <Text style={styles.groupLabel}>{group.label}</Text> : null}
              {group.items.map((row) => (
                <View key={row.id}>{renderRow(row)}</View>
              ))}
            </View>
          )}
          onEndReached={hasMore ? onLoadMore : undefined}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.tertiary}
            />
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {loadingMore ? (
                <Text style={styles.footerText}>{tt('common.loading', '加载中')}</Text>
              ) : null}
              {!hasMore ? (
                <Text style={styles.footerText}>{tt('ai.historyPage.noMore', '没有更多了')}</Text>
              ) : null}
            </View>
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing['3xl'],
      paddingBottom: rnSpacing.sm,
      backgroundColor: tk.surface.light,
    },
    searchGrow: { flex: 1 },
    searchInput: {
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    // 聚焦态只换颜色(§4 唯一例外位),不改宽度 —— 固定高度下加粗会顶起文字
    searchInputFocused: { borderColor: tk.brand.DEFAULT },
    clearAll: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    importRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      backgroundColor: tk.surface.light,
    },
    importText: { flex: 1, fontSize: rnType.label.size, color: tk.text.tertiary },
    chevron: { fontSize: 20, color: tk.text.tertiary },
    noticeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.md,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      backgroundColor: tk.surface.light,
    },
    noticeText: { flex: 1, fontSize: rnType.label.size, color: tk.text.tertiary },
    retry: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    retryText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      backgroundColor: tk.surface.light,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    chipActive: { backgroundColor: tk.brand.DEFAULT },
    chipIcon: { width: 14, height: 14 },
    chipText: { fontSize: rnType.label.size, color: tk.text.tertiary },
    chipTextActive: { color: tk.brand.ctaForeground },
    listContent: { paddingHorizontal: rnSpacing.lg, paddingVertical: rnSpacing.md },
    groupWrap: { marginBottom: rnSpacing.lg },
    groupLabel: {
      fontSize: rnType.label.size,
      color: tk.text.tertiary,
      marginBottom: rnSpacing.sm,
      paddingLeft: rnSpacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: rnSpacing.md,
      marginBottom: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    iconFallback: { borderWidth: 1, borderColor: tk.border.light },
    emptyIcon: { width: 60, height: 60 },
    rowBody: { flex: 1, gap: 2, paddingHorizontal: rnSpacing.sm },
    rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowTitle: {
      flexShrink: 1,
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    pinDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tk.text.tertiary },
    pinDotButton: { width: 10, height: 10, borderRadius: 5 },
    pinDotOn: { backgroundColor: tk.brand.DEFAULT },
    rowMetaLine: { flexDirection: 'row', gap: rnSpacing.sm },
    rowMeta: { fontSize: rnType.label.size, color: tk.text.tertiary },
    rowPreview: { fontSize: rnType.label.size, color: tk.text.secondary },
    pinButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    footer: { paddingVertical: rnSpacing.lg, alignItems: 'center', gap: rnSpacing.xs },
    footerText: { fontSize: rnType.label.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
