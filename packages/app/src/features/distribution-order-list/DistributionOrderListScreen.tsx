// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItem,
  type ViewStyle,
} from 'react-native'
import { SearchInput } from '../../components/SearchInput'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { DistributionOrderListScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { formatPrice } from '@ihui/shared/utils'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'

/** DistributionOrderListScreen props re-export(单一来源 @ihui/types) */
export type { DistributionOrderListScreenProps }

const TABS = [
  { key: 'all', label: '全部' },
  { key: '0', label: '待结算' },
  { key: '1', label: '退单' },
  { key: '2', label: '已完成' },
] as const

function statusText(status: string): string {
  switch (status) {
    case '0':
    case 'pending':
      return '待结算'
    case '1':
    case 'refunded':
      return '退单'
    case '2':
    case 'settled':
    case 'finished':
      return '已完成'
    default:
      return status || '未知'
  }
}

function statusColor(status: string, tk: AppThemeTokens): string {
  if (status === '1' || status === 'refunded') return tk.danger.DEFAULT
  if (status === '2' || status === 'settled' || status === 'finished') return tk.success.DEFAULT
  return tk.text.tertiary
}

export function DistributionOrderListScreen({
  t,
  orders,
  keyword,
  activeTab,
  loading,
  loadingMore,
  onSearch,
  onKeywordChange,
  onTabChange,
  onEndReached,
  onBack,
  colorScheme = 'light',
}: DistributionOrderListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const filtered = keyword.trim()
    ? orders.filter(
        (o) =>
          o.orderId.toLowerCase().includes(keyword.toLowerCase()) ||
          o.userNickname.toLowerCase().includes(keyword.toLowerCase()),
      )
    : orders

  const renderItem: ListRenderItem<(typeof orders)[number]> = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderLabel} numberOfLines={1}>
          {'订单号:' + item.orderId}
        </Text>
        <View style={[styles.statusTag, { backgroundColor: statusColor(item.status, tk) }]}>
          <Text style={styles.statusText}>{statusText(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.buyerText}>{'买家:' + item.userNickname}</Text>
      <View style={styles.orderFooter}>
        <View style={styles.footerLeft}>
          <Text style={styles.amountText}>{'¥' + formatPrice(item.orderAmount)}</Text>
          <View style={styles.rateTag}>
            <Text style={styles.rateText}>{'佣金 ' + item.rate + '%'}</Text>
          </View>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.commissionLabel}>本单佣金</Text>
          <Text style={styles.commissionValue}>{'¥' + formatPrice(item.commissionAmount)}</Text>
        </View>
      </View>
      <Text style={styles.timeText}>{'下单时间:' + item.createdAt}</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>分销订单列表</Text>
      </View>
      <View style={styles.searchWrap}>
        <SearchInput
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder="搜索订单号或买家"
          onSubmit={onSearch}
          colorScheme={colorScheme}
        />
      </View>
      <View style={styles.tabsBar}>
        <View style={styles.tabsRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => onTabChange(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
          ) : (
            <EmptyState title="暂无订单数据" colorScheme={colorScheme} />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={tk.brand.DEFAULT} />
            </View>
          ) : null
        }
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    searchWrap: { padding: 14, paddingBottom: rnSpacing.sm },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.xl,
      paddingHorizontal: rnSpacing.md,
      height: 50,
    },
    searchInput: { flex: 1, fontSize: rnType.title.size, color: tk.text.primary },
    tabsBar: {
      paddingHorizontal: rnSpacing.md,
      paddingBottom: rnSpacing.md,
    },
    tabsRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
    },
    tab: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: tk.brand.cta,
    },
    tabText: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    tabTextActive: {
      color: tk.surface.light,
      fontWeight: '600',
    },
    listContent: { paddingHorizontal: 10, paddingBottom: rnSpacing['2xl'], gap: rnSpacing.md },
    orderCard: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      padding: 14,
      gap: rnSpacing.sm,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    orderLabel: { flex: 1, fontSize: rnType.body.size, color: tk.text.primary },
    statusTag: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
    },
    statusText: { fontSize: rnType.caption.size, color: tk.surface.light, fontWeight: '500' },
    buyerText: { fontSize: rnType.body.size, color: tk.text.secondary },
    orderFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    amountText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    rateTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    rateText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    footerRight: { alignItems: 'flex-end' },
    commissionLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    commissionValue: { fontSize: rnType.title.size, fontWeight: '600', color: tk.danger.DEFAULT },
    timeText: { fontSize: rnType.body.size, color: tk.text.tertiary },
    footerLoading: { paddingVertical: rnSpacing.md, alignItems: 'center' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
