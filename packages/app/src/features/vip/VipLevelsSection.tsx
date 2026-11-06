// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { EmptyState } from '../../components/ScreenStates'
import { getTokens, tokens as baseTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VipLevelItem2, VipMembershipInfo, VipScreenProps } from '../../types'

/** 与 VipScreen 同口径的 VIP 金色(模块级常量取静态 token,明暗同值) */
const VIP_GOLD = baseTokens.vip.gold
const VIP_GOLD_TEXT = baseTokens.gray['800']

export interface VipLevelsSectionProps {
  t: VipScreenProps['t']
  /** 套餐档位(price 按元) */
  levels: VipLevelItem2[]
  /** 当前会员;null ⇒ 不渲染"当前等级"徽标 */
  membership: VipMembershipInfo | null
  purchasingId: string | null
  /**
   * 购买回调(注入):传 ⇒ 可购买档位出按钮;不传 ⇒ 段退化为纯展示。
   * RN `VipScreen` 与小程序 `pkg-shop/vip/index` 两端都真传;会员中心已有自身 CTA,
   * 为避免同屏两个购买入口,会员中心不传。
   */
  onPurchase?: (level: VipLevelItem2) => void
  /**
   * 段标题(必填,无缺省回退):RN VipScreen 传 vip.levelsTitle,
   * 小程序会员中心传 vip.plans —— 两端传不同值,避免"传的值等于缺省"的空消费。
   */
  title: string
  colorScheme?: 'light' | 'dark'
}

/**
 * VIP 套餐档位段(从 VipScreen levelsSection 抽出做单源):
 * 等级名 + 时长(vip.duration) + 权益项数(vip.benefitsCount) + 价格;空态走 vip.empty。
 * 各端只提供数据与回调,渲染与样式由本段统一承担。
 */
export function VipLevelsSection({
  t,
  levels,
  membership,
  purchasingId,
  onPurchase,
  title,
  colorScheme = 'light',
}: VipLevelsSectionProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.levelsSection}>
      <Text style={styles.levelsTitle}>{title}</Text>
      {levels.length === 0 ? (
        <EmptyState title={t('vip.empty')} colorScheme={colorScheme} />
      ) : (
        levels.map((level) => {
          const isCurrent = membership?.level === level.levelValue
          const isPurchasing = purchasingId === level.id
          const canPurchase = Boolean(onPurchase) && !isCurrent && level.status === 1
          const benefitsCount = level.benefits?.length ?? 0
          return (
            <View key={level.id} style={styles.cardSpacing}>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardLevelName}>{level.levelName}</Text>
                  {isCurrent ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t('vip.currentLevel')}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.durationText}>
                    {t('vip.duration', { days: level.durationDays })}
                  </Text>
                  <Text style={styles.priceText}>¥ {level.price.toFixed(2)}</Text>
                </View>
                {benefitsCount > 0 ? (
                  <Text style={styles.benefitsText}>
                    {t('vip.benefitsCount', { count: benefitsCount })}
                  </Text>
                ) : null}
                {canPurchase ? (
                  <TouchableOpacity
                    style={[styles.purchaseBtn, isPurchasing && styles.purchaseBtnDisabled]}
                    onPress={() => onPurchase?.(level)}
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
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    levelsSection: {
      paddingHorizontal: rnSpacing['sm-loose'],
      marginTop: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
    },
    levelsTitle: {
      marginBottom: rnSpacing.md,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    cardSpacing: { marginBottom: rnSpacing.md },
    card: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardLevelName: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    currentBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: VIP_GOLD,
    },
    currentBadgeText: { fontSize: rnType.label.size, fontWeight: '600', color: VIP_GOLD_TEXT },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    durationText: { fontSize: rnType.label.size, color: tk.text.secondary },
    priceText: { fontSize: rnType.display.size, fontWeight: '700', color: VIP_GOLD },
    benefitsText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    purchaseBtn: {
      marginTop: rnSpacing.md,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: VIP_GOLD,
      alignItems: 'center',
      justifyContent: 'center',
    },
    purchaseBtnDisabled: { opacity: 0.6 },
    purchaseBtnText: { fontSize: rnType.title.size, fontWeight: '700', color: VIP_GOLD_TEXT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
