import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PointsMallItem, PointsMallScreenProps } from '../../types'

/** 积分商城/Props 类型 re-export(单一来源 @ihui/types) */
export type { PointsMallItem, PointsMallScreenProps }

/**
 * 积分商城共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 余额卡片 + 2 列商品网格(cover emoji + 商品名 + 描述 + 积分价 + 库存 + 兑换按钮)
 * + 下拉刷新。兑换按钮禁用条件:balance < pointsCost 或 stock=0 或正在兑换中(redeemingId 匹配)。
 * 平台特定(导航 / API 调用 / Alert 兑换成功失败提示)由 wrapper 通过 props 注入。
 */
export function PointsMallScreen({
  t,
  items,
  balance,
  redeemingId,
  loading,
  refreshing,
  error,
  onRefresh,
  onRedeem,
  onBack,
  colorScheme = 'light',
}: PointsMallScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('pointsMall.title')}</Text>
        <Text style={styles.subtitle}>{t('pointsMall.subtitle')}</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('pointsMall.balance')}</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>{t('pointsMall.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<PointsMallItem>
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listBody}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('pointsMall.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const canRedeem = balance >= item.pointsCost && item.stock > 0
            const isRedeeming = redeemingId === item.id
            return (
              <View style={styles.card}>
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.coverEmoji}>🎁</Text>
                </View>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productDesc} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.pointsCost}>{item.pointsCost} {t('pointsMall.pointsUnit')}</Text>
                <Text style={styles.stockText}>
                  {t('pointsMall.stock', { count: item.stock })}
                </Text>
                <TouchableOpacity
                  style={[styles.redeemBtn, !canRedeem && styles.redeemBtnDisabled]}
                  onPress={() => onRedeem(item)}
                  disabled={!canRedeem || isRedeeming}
                  activeOpacity={0.7}
                >
                  <Text style={styles.redeemBtnText}>
                    {isRedeeming ? t('common.loading') : t('pointsMall.redeem')}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backBtn: { marginBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    balanceCard: {
      marginHorizontal: 10,
      marginBottom: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.success.light,
      alignItems: 'center',
    },
    balanceLabel: { fontSize: 14, color: tk.success.deepText },
    balanceValue: { marginTop: 8, fontSize: 30, fontWeight: '700', color: tk.success.DEFAULT },
    errorBar: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    retryText: { fontSize: 14, color: tk.success.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    listBody: { padding: 14, paddingBottom: 32 },
    columnWrapper: { justifyContent: 'space-between', marginBottom: 10 },
    card: {
      width: '48%',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    coverPlaceholder: {
      height: 80,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverEmoji: { fontSize: 32 },
    productName: { marginTop: 8, fontSize: 14, fontWeight: '600', color: tk.text.primary, minHeight: 36 },
    productDesc: { fontSize: 11, color: tk.text.tertiary, marginTop: 8 },
    pointsCost: { marginTop: 8, fontSize: 16, fontWeight: '700', color: tk.success.DEFAULT },
    stockText: { fontSize: 10, color: tk.text.tertiary, marginTop: 8 },
    redeemBtn: {
      marginTop: 8,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    redeemBtnDisabled: { backgroundColor: tk.border.light },
    redeemBtnText: { fontSize: 14, color: tk.surface.light },
  })
}
