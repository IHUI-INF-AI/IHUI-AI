// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import {
  BarChart3,
  Check,
  Film,
  MessageCircle,
  Palette,
  Radio,
  Sparkles,
} from 'lucide-react-native'
import { getTokens, tokens as baseTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AppIcon } from '@ihui/types'
import type { VipLevelItem2, VipMembershipInfo, VipScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType, rnCssLight } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { VipLevelsSection } from './VipLevelsSection'
import { assertRequiredPort } from '../../host/ports'

/** 特权 id → 图标(平台无关数据只带 id,图标由共享屏兜底) */
const FEATURE_ICONS: Record<string, AppIcon> = {
  ai_copywriting: Sparkles,
  ai_chat: MessageCircle,
  ai_analysis: BarChart3,
  ai_design: Palette,
  ai_video: Film,
  ai_live: Radio,
}

/** VIP/Props 类型 re-export(单一来源 @ihui/types) */
export type { VipLevelItem2, VipMembershipInfo, VipScreenProps }

/** VIP 金色主题(对齐 Uniapp vip/index.vue 行 152/214/258 的 #FFD700 金色 + 深字 #1F2937)
 *  模块级常量无法访问组件内主题 tk → 用基础静态 token(vip.gold / gray.800 明暗同值)
 *  档位段的金色已随 VipLevelsSection 搬走,此处只留会员卡深底 */
const VIP_GOLD_TEXT = baseTokens.gray['800']

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
  benefitItems,
  onRetry,
  colorScheme = 'light',
  onNavigate,
  onToast,
  headerPrice,
  introduce,
  features,
  viewBenefits,
  plans,
  buyBar,
  overlay,
}: VipScreenProps & { onRetry?: () => void }) {
  assertRequiredPort('onNavigate', onNavigate)
  assertRequiredPort('onToast', onToast)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }

  if (error && levels.length === 0) {
    return (
      <ErrorState
        message={error}
        onRetry={onRetry}
        retryLabel={t('vip.retry')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('vip.title')}</Text>
          <Text style={styles.subtitle}>{t('vip.subtitle')}</Text>
          {headerPrice !== undefined ? (
            <Text style={styles.headerPrice}>¥{headerPrice}</Text>
          ) : null}
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
            <View style={styles.membershipHead}>
              <View style={styles.membershipHeadMain}>
                <Text style={styles.membershipLabel}>{t('vip.currentLevel')}</Text>
                <Text style={styles.membershipLevel}>{membership.levelName}</Text>
              </View>
              {introduce ? (
                <TouchableOpacity onPress={introduce.onPress} activeOpacity={0.7}>
                  <Text style={styles.introduceLink}>{introduce.label}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
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

        {features && features.length > 0 ? (
          <View style={styles.featuresSection}>
            <Text style={styles.featuresTitle}>{t('vip.privileges')}</Text>
            {features.map((feature) => {
              const FeatureIcon = feature.icon ?? FEATURE_ICONS[feature.id] ?? Sparkles
              return (
                <View key={feature.id} style={styles.featureRow}>
                  <FeatureIcon size={24} color={tk.text.secondary} />
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDesc}>{feature.desc}</Text>
                  </View>
                  {feature.tag ? <Text style={styles.featureTag}>{feature.tag}</Text> : null}
                </View>
              )
            })}
            {viewBenefits ? (
              <TouchableOpacity
                style={styles.viewBenefits}
                onPress={viewBenefits.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.viewBenefitsText}>{viewBenefits.label}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* 权益卡(平台注入 benefitItems 时渲染;无则不出现,不影响原有等级列表) */}
        {benefitItems && benefitItems.length > 0 ? (
          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>{t('vip.details.benefitsTitle')}</Text>
            {benefitItems.map((item) => (
              <View key={item.key} style={styles.benefitCard}>
                <Check size={16} color={tk.success.DEFAULT} style={styles.benefitIcon} />
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitTitle}>{item.title}</Text>
                  {item.desc ? <Text style={styles.benefitDesc}>{item.desc}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <VipLevelsSection
          t={t}
          levels={levels}
          membership={membership}
          purchasingId={purchasingId}
          onPurchase={onPurchase}
          title={t('vip.levelsTitle')}
          colorScheme={colorScheme}
        />

        {plans ? (
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
                    <Text style={[styles.planName, selected && styles.planNameActive]}>
                      {option.name}
                    </Text>
                    <Text style={[styles.planPrice, selected && styles.planPriceActive]}>
                      ¥{option.price}
                    </Text>
                    <Text style={styles.planPeriod}>{option.period}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
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
        ) : null}
      </ScrollView>

      {buyBar ? (
        <View style={styles.buyBar}>
          <View style={styles.buyPrice}>
            <Text style={styles.buyPriceSymbol}>¥</Text>
            <Text style={styles.buyPriceNumber}>{buyBar.price}</Text>
          </View>
          <TouchableOpacity style={styles.buyBtn} onPress={buyBar.onPress} activeOpacity={0.7}>
            <Text style={styles.buyBtnText}>{buyBar.label}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {overlay ? (
        <View style={styles.overlay}>
          <View style={styles.mask} />
          <View style={styles.overlayCard}>
            <View style={styles.overlayHead}>
              <Text style={styles.overlayTitle}>{overlay.title}</Text>
              {overlay.onClose ? (
                <TouchableOpacity onPress={overlay.onClose}>
                  <Text style={styles.overlayClose}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {overlay.kind === 'success' ? (
              <View style={styles.successIcon}>
                <Check size={40} color={tk.success.DEFAULT} />
              </View>
            ) : null}
            {overlay.lines?.map((line) => (
              <Text key={line} style={styles.overlayLine}>
                {line}
              </Text>
            ))}
            {overlay.plan ? (
              <View style={styles.overlayPlan}>
                <View style={styles.overlayPlanRow}>
                  <Text style={styles.overlayPlanName}>{overlay.plan.name}</Text>
                  <Text style={styles.overlayPlanPrice}>¥{overlay.plan.price}</Text>
                </View>
                {overlay.plan.originalPrice ? (
                  <View style={styles.overlayPlanRow}>
                    <Text style={styles.overlayPlanMeta}>{t('pay.originalPrice')}</Text>
                    <Text style={styles.overlayPlanStrike}>¥{overlay.plan.originalPrice}</Text>
                  </View>
                ) : null}
                {overlay.plan.period ? (
                  <Text style={styles.overlayPlanMeta}>{overlay.plan.period}</Text>
                ) : null}
              </View>
            ) : null}
            {overlay.benefits?.map((benefit) => (
              <View key={benefit.key} style={styles.overlayBenefitRow}>
                <Check size={16} color={tk.success.DEFAULT} />
                <View style={styles.overlayBenefitTextWrap}>
                  <Text style={styles.overlayBenefitTitle}>{benefit.title}</Text>
                  {benefit.desc ? (
                    <Text style={styles.overlayBenefitDesc}>{benefit.desc}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            {overlay.agree ? (
              <TouchableOpacity
                style={styles.agreeRow}
                onPress={overlay.agree.onToggle}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, overlay.agree.checked && styles.checkboxChecked]}>
                  {overlay.agree.checked ? <Check size={12} color={tk.surface.light} /> : null}
                </View>
                <Text style={styles.agreeText}>{overlay.agree.label}</Text>
              </TouchableOpacity>
            ) : null}
            {overlay.methods && overlay.methods.length > 0 ? (
              <View style={styles.methods}>
                {overlay.methods.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.methodCard, method.active && styles.methodCardActive]}
                    onPress={method.onPress}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.methodBadge, method.active && styles.methodBadgeActive]}>
                      {method.badge}
                    </Text>
                    <Text style={styles.methodLabel}>{method.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.overlayPrimary}
              onPress={overlay.onPrimary}
              activeOpacity={0.7}
            >
              <Text style={styles.overlayPrimaryText}>{overlay.primaryLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    container: { flex: 1, backgroundColor: tk.surface.bg },
    headerPrice: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.display.size,
      fontWeight: '700',
      color: baseTokens.vip.gold,
    },
    membershipHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    membershipHeadMain: { flex: 1 },
    introduceLink: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: baseTokens.vip.gold,
    },
    featuresSection: {
      marginHorizontal: rnSpacing.lg,
      marginBottom: rnSpacing.lg,
      padding: rnSpacing.lg,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    featuresTitle: {
      ...rnType.title,
      fontWeight: '700',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    featureTextWrap: { flex: 1 },
    featureTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    featureDesc: {
      marginTop: rnSpacing['2xs'],
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    featureTag: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
      backgroundColor: baseTokens.vip.gold,
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    viewBenefits: { alignItems: 'center', paddingTop: rnSpacing.md },
    viewBenefitsText: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: baseTokens.vip.gold,
    },
    plansCard: {
      marginHorizontal: rnSpacing.lg,
      marginBottom: rnSpacing.lg,
      padding: rnSpacing.lg,
      borderRadius: rnRadius.xl,
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
    buyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    buyPrice: { flexDirection: 'row', alignItems: 'flex-end' },
    buyPriceSymbol: {
      fontSize: rnType.label.size,
      fontWeight: '700',
      color: baseTokens.vip.gold,
      marginBottom: rnSpacing.xs,
    },
    buyPriceNumber: {
      fontSize: rnType.display.size,
      fontWeight: '700',
      color: baseTokens.vip.gold,
    },
    buyBtn: {
      minWidth: 140,
      height: 46,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: baseTokens.vip.gold,
      paddingHorizontal: rnSpacing.lg,
    },
    buyBtnText: { fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'center',
      padding: rnSpacing.lg,
      zIndex: 1000,
    },
    mask: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    overlayCard: {
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.light,
      padding: rnSpacing.lg,
      maxHeight: '85%',
    },
    overlayHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.md,
    },
    overlayTitle: { ...rnType.title, fontWeight: '700', color: tk.text.primary },
    overlayClose: { fontSize: rnType.display.size, color: tk.text.secondary },
    overlayLine: {
      marginBottom: rnSpacing.sm,
      fontSize: rnType.body.size,
      lineHeight: rnType.strong.lineHeight,
      color: tk.text.secondary,
    },
    successIcon: { alignItems: 'center', paddingVertical: rnSpacing.lg },
    overlayPlan: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
      marginBottom: rnSpacing.md,
    },
    overlayPlanRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    overlayPlanName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    overlayPlanPrice: {
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: baseTokens.vip.gold,
    },
    overlayPlanMeta: { fontSize: rnType.label.size, color: tk.text.secondary },
    overlayPlanStrike: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
      textDecorationLine: 'line-through',
    },
    overlayBenefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    overlayBenefitTextWrap: { flex: 1 },
    overlayBenefitTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    overlayBenefitDesc: {
      marginTop: rnSpacing['2xs'],
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    agreeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    agreeText: { fontSize: rnType.label.size, color: tk.text.secondary },
    methods: { gap: rnSpacing.sm, marginTop: rnSpacing.md },
    methodCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    methodCardActive: { borderColor: baseTokens.vip.gold, backgroundColor: tk.surface.muted },
    methodBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      textAlign: 'center',
      lineHeight: rnType.subtitle.lineHeight,
      overflow: 'hidden',
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    methodBadgeActive: { backgroundColor: baseTokens.vip.gold, color: tk.text.primary },
    methodLabel: { fontSize: rnType.body.size, color: tk.text.primary },
    overlayPrimary: {
      marginTop: rnSpacing.md,
      height: 46,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: baseTokens.vip.gold,
    },
    overlayPrimaryText: { fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
    body: { paddingBottom: rnSpacing['3xl'] },
    header: { paddingHorizontal: rnSpacing.lg, paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    subtitle: { marginTop: rnSpacing.xs, fontSize: rnType.body.size, color: tk.text.secondary },
    errorBar: { paddingHorizontal: rnSpacing.lg, paddingVertical: rnSpacing.sm },
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    toastBar: { paddingHorizontal: rnSpacing.lg, paddingVertical: rnSpacing.sm },
    toastText: { fontSize: rnType.label.size, color: tk.success.deepText },
    membershipCard: {
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.lg,
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      // 对齐 uniapp vip/index.vue .vip-page 深色渐变(#0F1623→#1F2937),用纯色 #1F2937 近似
      backgroundColor: VIP_GOLD_TEXT,
    },
    membershipLabel: { fontSize: rnType.body.size, color: rnCssLight.white80 },
    membershipLevel: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.surface.light,
    },
    membershipMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    membershipMetaText: { fontSize: rnType.label.size, color: rnCssLight.white70 },
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
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
