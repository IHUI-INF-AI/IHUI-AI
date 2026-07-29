import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PromotionCouponStatus, PromotionCoupon, PromotionScreenProps } from '../../types'

export type { PromotionCouponStatus, PromotionCoupon, PromotionScreenProps }

const STATUS_KEYS: Record<PromotionCouponStatus, string> = {
  available: 'promotion.status_available',
  used: 'promotion.status_used',
  expired: 'promotion.status_expired',
}

/**
 * 优惠券共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + 错误条 + 优惠券 FlatList(下拉刷新 + 空/加载态)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function PromotionScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onUse,
  onBack,
  colorScheme = 'light',
}: PromotionScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusColor = (status: PromotionCouponStatus): string => {
    if (status === 'available') return tk.success.DEFAULT
    if (status === 'used') return tk.text.tertiary
    return tk.danger.DEFAULT
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('promotion.title')}</Text>
      </View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList<PromotionCoupon>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color={tk.brand.DEFAULT} />
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('promotion.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.amountBox}>
                <Text style={styles.amountText}>¥{item.amount}</Text>
                <Text style={styles.minSpend}>
                  {t('promotion.minSpend')}: ¥{item.minSpend}
                </Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.expire}>
                  {t('promotion.expireDate')}: {item.expireDate}
                </Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.badgeText}>{t(STATUS_KEYS[item.status])}</Text>
                </View>
              </View>
              {item.status === 'available' ? (
                <TouchableOpacity style={styles.useBtn} onPress={() => onUse(item)}>
                  <Text style={styles.useText}>{t('promotion.useNow')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 12 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    amountBox: { width: 80, alignItems: 'center' },
    amountText: { fontSize: 18, fontWeight: '700', color: tk.success.DEFAULT },
    minSpend: { marginTop: 4, fontSize: 10, color: tk.text.tertiary },
    body: { flex: 1, marginLeft: 12 },
    itemName: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    expire: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    badge: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    badgeText: { fontSize: 10, color: tk.surface.light },
    useBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    useText: { fontSize: 12, color: tk.surface.light },
    emptyWrap: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
  })
}
