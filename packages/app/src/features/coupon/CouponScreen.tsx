import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CouponItem, CouponScreenProps, CouponStatus } from '../../types'

/** 优惠券/Props 类型 re-export(单一来源 @ihui/types) */
export type { CouponItem, CouponScreenProps, CouponStatus }

const TABS: CouponStatus[] = ['available', 'used', 'expired']

const TAB_KEYS: Record<CouponStatus, string> = {
  available: 'coupon.tab_available',
  used: 'coupon.tab_used',
  expired: 'coupon.tab_expired',
}

/**
 * 优惠券列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + tab 切换栏 + 横向布局优惠券卡片 + 下拉刷新。
 * 平台特定(导航 / API 调用 / tab 切换拉取 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function CouponScreen({
  t,
  items,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: CouponScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusColor = (status: CouponStatus) => {
    if (status === 'available') return tk.brand.DEFAULT
    if (status === 'used') return tk.text.tertiary
    return tk.danger.DEFAULT
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('coupon.title')}</Text>
        <Text style={styles.subtitle}>{t('coupon.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((s) => {
          const active = s === activeTab
          return (
            <TouchableOpacity
              key={s}
              onPress={() => onSelectTab(s)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(TAB_KEYS[s]!)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>{t('coupon.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<CouponItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('coupon.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.amountText}>¥{item.amount}</Text>
                <Text style={styles.minText}>
                  {t('coupon.minSpend', { amount: item.minSpend })}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.validText}>
                  {t('coupon.validUntil')}: {item.validUntil}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.statusText}>{t(TAB_KEYS[item.status as CouponStatus]!)}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backBtn: { marginBottom: 4 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: tk.surface.card },
    tabActive: { backgroundColor: tk.success.DEFAULT },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    errorBar: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    retryText: { fontSize: 12, color: tk.success.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 12, color: tk.text.tertiary, marginTop: 8 },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 10 },
    card: {
      flexDirection: 'row',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      overflow: 'hidden',
      backgroundColor: tk.surface.bg,
    },
    cardLeft: {
      width: 96,
      padding: 12,
      backgroundColor: tk.success.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    amountText: { fontSize: 22, fontWeight: '700', color: tk.success.DEFAULT },
    minText: { marginTop: 4, fontSize: 11, color: tk.text.secondary, textAlign: 'center' },
    cardRight: { flex: 1, padding: 12 },
    cardName: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    validText: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    statusBadge: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    statusText: { fontSize: 11, color: tk.surface.light },
  })
}
