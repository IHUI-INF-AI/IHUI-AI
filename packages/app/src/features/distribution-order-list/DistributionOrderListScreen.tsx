import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  type ListRenderItem,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { DistributionOrderListScreenProps } from '../../types'

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
  if (status === '2' || status === 'settled' || status === 'finished') return '#16a34a'
  return tk.text.tertiary
}

function formatYuan(cents: number): string {
  return (cents / 100).toFixed(2)
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
          <Text style={styles.amountText}>{'¥' + formatYuan(item.orderAmount)}</Text>
          <View style={styles.rateTag}>
            <Text style={styles.rateText}>{'佣金 ' + item.rate + '%'}</Text>
          </View>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.commissionLabel}>本单佣金</Text>
          <Text style={styles.commissionValue}>{'¥' + formatYuan(item.commissionAmount)}</Text>
        </View>
      </View>
      <Text style={styles.timeText}>{'下单时间:' + item.createdAt}</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>分销订单列表</Text>
      </View>
      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={onKeywordChange}
            placeholder="搜索订单号或买家"
            placeholderTextColor={tk.text.tertiary}
            returnKeyType="search"
            onSubmitEditing={onSearch}
          />
        </View>
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
          loading ? null : (
            <View style={styles.centerWrap}>
              <Text style={styles.emptyText}>暂无订单数据</Text>
            </View>
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
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    searchWrap: { padding: 14, paddingBottom: 8 },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 50,
    },
    searchInput: { flex: 1, fontSize: 16, color: tk.text.primary },
    tabsBar: {
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    tabsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: tk.brand.DEFAULT,
    },
    tabText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    tabTextActive: {
      color: tk.surface.light,
      fontWeight: '600',
    },
    listContent: { paddingHorizontal: 10, paddingBottom: 24, gap: 12 },
    orderCard: {
      backgroundColor: tk.surface.light,
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    orderLabel: { flex: 1, fontSize: 14, color: tk.text.primary },
    statusTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    statusText: { fontSize: 11, color: tk.surface.light, fontWeight: '500' },
    buyerText: { fontSize: 14, color: tk.text.secondary },
    orderFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    amountText: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    rateTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
    },
    rateText: { fontSize: 11, color: tk.text.secondary },
    footerRight: { alignItems: 'flex-end' },
    commissionLabel: { fontSize: 11, color: tk.text.secondary },
    commissionValue: { fontSize: 16, fontWeight: '600', color: tk.danger.DEFAULT },
    timeText: { fontSize: 14, color: tk.text.tertiary },
    footerLoading: { paddingVertical: 12, alignItems: 'center' },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    } as ViewStyle,
    emptyText: { fontSize: 16, color: tk.text.secondary },
  })
}
