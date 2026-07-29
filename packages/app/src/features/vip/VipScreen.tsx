import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VipLevelItem2, VipMembershipInfo, VipScreenProps } from '../../types'

/** VIP/Props 类型 re-export(单一来源 @ihui/types) */
export type { VipLevelItem2, VipMembershipInfo, VipScreenProps }

/**
 * VIP 共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 当前会员卡(emerald bg) + VIP 等级列表(购买按钮 loading/disabled 状态)
 * + 下拉刷新。
 * 平台特定(导航 / API 调用 / 日期格式化 / toast 提示)由 wrapper 通过 props 注入。
 */
export function VipScreen({
  t,
  levels,
  membership,
  loading,
  refreshing,
  error,
  toast,
  purchasingId,
  onRefresh,
  onPurchase,
  onBack,
  colorScheme = 'light',
}: VipScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && levels.length === 0) {
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryBtnText}>{t('vip.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('vip.title')}</Text>
        <Text style={styles.subtitle}>{t('vip.subtitle')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {toast ? (
        <View style={styles.toastBar}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {membership && membership.isActive ? (
        <View style={styles.membershipCard}>
          <Text style={styles.membershipLabel}>
            {t('vip.currentLevel')}
          </Text>
          <Text style={styles.membershipLevel}>
            {membership.levelName}
          </Text>
          <View style={styles.membershipMeta}>
            <Text style={styles.membershipMetaText}>
              {t('vip.expireAt')}:{membership.expireTime}
            </Text>
            <Text style={styles.membershipMetaText}>
              {t('vip.daysRemaining', { count: membership.daysRemaining })}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.levelsSection}>
        <Text style={styles.levelsTitle}>
          {t('vip.levelsTitle')}
        </Text>
        {levels.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>{t('vip.empty')}</Text>
          </View>
        ) : (
          levels.map((level) => {
            const isCurrent = membership?.level === level.levelValue
            const isPurchasing = purchasingId === level.id
            const canPurchase = !isCurrent && level.status === 1
            const benefitsCount = level.benefits ? Object.keys(level.benefits).length : 0
            return (
              <View key={level.id} style={styles.cardSpacing}>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardLevelName}>
                      {level.levelName}
                    </Text>
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>{t('vip.currentBadge')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.durationText}>
                      {t('vip.duration', { days: level.durationDays })}
                    </Text>
                    <Text style={styles.priceText}>
                      ¥ {level.price.toFixed(2)}
                    </Text>
                  </View>
                  {benefitsCount > 0 ? (
                    <Text style={styles.benefitsText}>
                      {t('vip.benefitsCount', { count: benefitsCount })}
                    </Text>
                  ) : null}
                  {canPurchase ? (
                    <TouchableOpacity
                      style={[styles.purchaseBtn, isPurchasing && styles.purchaseBtnDisabled]}
                      onPress={() => onPurchase(level)}
                      disabled={isPurchasing}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.purchaseBtnText}>
                        {isPurchasing ? t('common.loading') : t('vip.purchase')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )
          })
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    body: { paddingBottom: 32 },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    toastBar: { paddingHorizontal: 16, paddingVertical: 8 },
    toastText: { fontSize: 12, color: tk.success.deepText },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    retryBtnText: { fontSize: 14, color: tk.text.primary },
    membershipCard: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 8,
      backgroundColor: tk.success.light,
    },
    membershipLabel: { fontSize: 12, color: tk.success.deepText },
    membershipLevel: { marginTop: 4, fontSize: 20, fontWeight: '600', color: tk.success.deepText },
    membershipMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    membershipMetaText: { fontSize: 11, color: tk.success.deepText },
    levelsSection: { paddingHorizontal: 16, marginTop: 16, paddingBottom: 32 },
    levelsTitle: {
      marginBottom: 12,
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
    },
    cardSpacing: { marginBottom: 12 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardLevelName: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    currentBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: tk.success.lighter,
    },
    currentBadgeText: { fontSize: 11, color: tk.success.deepText },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    durationText: { fontSize: 11, color: tk.text.secondary },
    priceText: { fontSize: 18, fontWeight: '600', color: tk.success.DEFAULT },
    benefitsText: { marginTop: 8, fontSize: 11, color: tk.text.secondary },
    purchaseBtn: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    purchaseBtnDisabled: { opacity: 0.6 },
    purchaseBtnText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    emptyText: { fontSize: 12, color: tk.text.secondary },
  })
}
