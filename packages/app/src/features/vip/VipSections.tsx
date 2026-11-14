// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * VIP 页可独立复用的视图段(2026-11-14 从 VipScreen 内联实现抽出)。
 *
 * 为什么要有这个文件:权益卡与套餐选择原先写死在 `VipScreen` 的 return 里,
 * 只能整屏委托 ⇒ 任何"只要其中一段"的页面(小程序 pkg-shop/vip/details 的权益区 + 套餐区)
 * 只能手抄一份,样式/几何各飞各的。抽成导出段后,整屏与"只要一段"的页面消费同一份实现。
 *
 * 纪律:段组件只吃受控 props(文案/条目/回调),不碰平台 API、不做取数、不认识导航。
 * 观感零漂移:样式值逐值搬运自 VipScreen 原内联实现(含 vip.gold 金色档),不在此另立新档。
 */

import { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { getTokens, tokens as baseTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction, VipBenefitCardItem, VipPlansBlock } from '@ihui/types'

export interface VipBenefitsSectionProps {
  t: TFunction
  /** 权益条目;空数组 ⇒ 整段不渲染(调用方无需自己判空) */
  items: readonly VipBenefitCardItem[]
  colorScheme?: 'light' | 'dark'
  /** 段标题覆盖;缺省用词包 vip.details.benefitsTitle(单一源) */
  title?: string
}

/** 权益卡段:标题 + 逐条「图标 + 标题 + 副文案」 */
export function VipBenefitsSection({
  t,
  items,
  colorScheme = 'light',
  title,
}: VipBenefitsSectionProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  if (items.length === 0) return null
  return (
    <View style={styles.benefitsSection}>
      <Text style={styles.benefitsTitle}>{title ?? t('vip.details.benefitsTitle')}</Text>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <View key={item.key} style={styles.benefitCard}>
            <View style={styles.benefitIcon}>
              {Icon ? (
                <Icon size={16} color={baseTokens.vip.gold} />
              ) : (
                <Check size={16} color={tk.success.deepText} />
              )}
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitTitle}>{item.title}</Text>
              {item.desc ? <Text style={styles.benefitDesc}>{item.desc}</Text> : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

export interface VipPlansSectionProps {
  /** 套餐块;null/undefined ⇒ 整段不渲染 */
  plans: VipPlansBlock | null | undefined
  colorScheme?: 'light' | 'dark'
}

/** 套餐选择段:选项卡(名/价/周期[+角标+逐条权益]) + 自动续费勾选 + 管理入口 + 会员说明 */
export function VipPlansSection({ plans, colorScheme = 'light' }: VipPlansSectionProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  if (!plans) return null
  return (
    <View style={styles.plansCard}>
      <Text style={styles.plansTitle}>{plans.title}</Text>
      <View style={styles.planOptions}>
        {plans.options.map((option) => {
          const selected = option.id === plans.selectedId
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.planOption, selected && styles.planOptionActive]}
              onPress={() => plans.onSelect(option.id)}
              activeOpacity={0.7}
            >
              {option.badge ? <Text style={styles.planBadge}>{option.badge}</Text> : null}
              <Text style={[styles.planName, selected && styles.planNameActive]}>
                {option.name}
              </Text>
              <Text style={[styles.planPrice, selected && styles.planPriceActive]}>
                ¥{option.price}
              </Text>
              <Text style={styles.planPeriod}>{option.period}</Text>
              {option.features && option.features.length > 0 ? (
                <View style={styles.planFeatures}>
                  {option.features.map((f) => (
                    <View key={f} style={styles.planFeatureRow}>
                      <Check size={12} color={tk.text.secondary} />
                      <Text style={styles.planFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </TouchableOpacity>
          )
        })}
      </View>
      {plans.autoRenewLabel ? (
        <TouchableOpacity
          style={styles.autoRenewRow}
          onPress={plans.onToggleAutoRenew}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, plans.autoRenew && styles.checkboxChecked]}>
            {plans.autoRenew ? <Check size={12} color={tk.surface.light} /> : null}
          </View>
          <Text style={styles.autoRenewText}>{plans.autoRenewLabel}</Text>
        </TouchableOpacity>
      ) : null}
      {plans.manageLabel && plans.onManage ? (
        <TouchableOpacity onPress={plans.onManage} activeOpacity={0.7}>
          <Text style={styles.manageLink}>{plans.manageLabel}</Text>
        </TouchableOpacity>
      ) : null}
      {plans.memberDescTitle ? (
        <View style={styles.memberDesc}>
          <Text style={styles.memberDescTitle}>{plans.memberDescTitle}</Text>
          {plans.memberDescText ? (
            <Text style={styles.memberDescText}>{plans.memberDescText}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/**
 * 取一份样式表。
 *
 * 取值来源 = `VipScreen.tsx` 原内联段(2026-11-14 抽取前),逐值照搬:
 * 金色档用 `baseTokens.vip.gold`(模块级静态 token),与 VipScreen 的 VIP_GOLD_TEXT 同源;
 * 不在此改用 brand/cta —— 那会改变两端观感(抽取不得夹带视觉改动)。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    benefitsSection: { paddingHorizontal: rnSpacing['sm-loose'], marginTop: rnSpacing.lg },
    benefitsTitle: {
      marginBottom: rnSpacing.md,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    benefitCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      padding: rnSpacing['md-loose'],
      marginBottom: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    benefitIcon: { marginTop: rnSpacing['2xs'] },
    benefitTextWrap: { flex: 1, gap: rnSpacing.xs },
    benefitTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    benefitDesc: {
      fontSize: rnType.label.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },
    plansCard: {
      marginHorizontal: rnSpacing.lg,
      marginBottom: rnSpacing.lg,
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    plansTitle: {
      ...rnType.title,
      fontWeight: '700',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    planOptions: { flexDirection: 'row', gap: rnSpacing.sm },
    planOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    planOptionActive: {
      borderColor: baseTokens.vip.gold,
      backgroundColor: tk.surface.muted,
    },
    planBadge: {
      alignSelf: 'flex-end',
      marginBottom: rnSpacing['2xs'],
      paddingHorizontal: rnSpacing['2xs'],
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: baseTokens.vip.gold,
      color: baseTokens.gray['800'],
      fontSize: rnType.caption.size,
      fontWeight: '600',
      overflow: 'hidden',
    },
    planName: { fontSize: rnType.label.size, color: tk.text.secondary },
    planNameActive: { fontWeight: '700', color: tk.text.primary },
    planPrice: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    planPriceActive: { color: baseTokens.vip.gold },
    planPeriod: {
      marginTop: rnSpacing['2xs'],
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    planFeatures: { alignSelf: 'stretch', marginTop: rnSpacing.sm, gap: rnSpacing['2xs'] },
    planFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing['2xs'] },
    planFeatureText: {
      flex: 1,
      fontSize: rnType.label.size,
      color: tk.text.primary,
      lineHeight: rnType.label.lineHeight,
    },
    autoRenewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: baseTokens.vip.gold, borderColor: baseTokens.vip.gold },
    autoRenewText: { fontSize: rnType.label.size, color: tk.text.secondary },
    manageLink: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: baseTokens.vip.gold,
    },
    memberDesc: {
      marginTop: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
    },
    memberDescTitle: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.xs,
    },
    memberDescText: {
      fontSize: rnType.label.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
