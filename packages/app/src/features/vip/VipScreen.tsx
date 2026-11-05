// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ImageBackground,
  StyleSheet,
} from 'react-native'
import { Check } from 'lucide-react-native'
import { getTokens, tokens as baseTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  VipLevelItem2,
  VipMembershipInfo,
  VipPlanItem,
  VipPrivilegeItem,
  VipScreenProps,
} from '../../types'

import { rnRadius, rnSpacing, rnType, rnCssLight } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { assertRequiredPort } from '../../host/ports'

/** VIP/Props 类型 re-export(单一来源 @ihui/types) */
export type {
  VipLevelItem2,
  VipMembershipInfo,
  VipPlanItem,
  VipPrivilegeItem,
  VipScreenProps,
}

/** VIP 金色主题(对齐 Uniapp vip/index.vue 行 152/214/258 的 #FFD700 金色 + 深字 #1F2937)
 *  模块级常量无法访问组件内主题 tk → 用基础静态 token(vip.gold / gray.800 明暗同值) */
const VIP_GOLD = baseTokens.vip.gold
const VIP_GOLD_TEXT = baseTokens.gray['800']

/**
 * VIP 共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(可带背景图/价格盒) + 会员状态卡 + 特权清单 + 权益卡 + 等级列表
 * + 套餐选择/自动续费/管理入口 + 底部购买栏 + 下拉刷新。
 * 平台特定(导航 / API 调用 / 日期格式化 / toast / 支付分发 / 弹层 / 资源 URI)由 wrapper 注入;
 * 所有新增区块均为可选 props,缺省 undefined ⇒ 与旧版渲染一致(web/RN 零回归)。
 * 本屏不得直接调用任何 wx/Taro API。
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
  headerBackgroundUri,
  headerPrice,
  showBack = true,
  introduceLabel,
  onIntroduce,
  showInactiveMembership = false,
  privilegeItems,
  benefitsAfterLevels = false,
  onViewAllPrivileges,
  viewAllPrivilegesLabel,
  plans,
  selectedPlanId,
  onSelectPlan,
  autoRenew,
  onToggleAutoRenew,
  autoRenewLabel,
  onManage,
  manageLabel,
  purchasePrice,
  onUpgrade,
  purchaseLabel,
  retryLabel,
  inlineError = false,
}: VipScreenProps & { onRetry?: () => void }) {
  assertRequiredPort('onNavigate', onNavigate)
  assertRequiredPort('onToast', onToast)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }

  if (error && levels.length === 0 && !inlineError) {
    return (
      <ErrorState
        message={error}
        onRetry={onRetry}
        retryLabel={t('vip.retry')}
        colorScheme={colorScheme}
      />
    )
  }

  const showMembershipCard = !!membership && (membership.isActive || showInactiveMembership)
  const showBuyBar = purchasePrice !== undefined && !!onUpgrade
  const buyPrice = purchasePrice ?? 0

  const headerContent = (
    <>
      {showBack ? (
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      ) : null}
      <Text style={[styles.title, headerBackgroundUri ? styles.titleOnImage : null]}>
        {t('vip.title')}
      </Text>
      <Text style={[styles.subtitle, headerBackgroundUri ? styles.subtitleOnImage : null]}>
        {t('vip.subtitle')}
      </Text>
      {headerPrice !== undefined ? (
        <View style={styles.headerPriceBox}>
          <Text style={styles.headerPriceSymbol}>¥</Text>
          <Text style={styles.headerPriceValue}>{headerPrice}</Text>
        </View>
      ) : null}
    </>
  )

  const benefitsSection =
    benefitItems && benefitItems.length > 0 ? (
      <View style={styles.benefitsSection}>
        <Text style={styles.sectionTitle}>{t('vip.details.benefitsTitle')}</Text>
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
    ) : null

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={showBuyBar ? styles.bodyWithBuyBar : styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {headerBackgroundUri ? (
          <ImageBackground
            source={{ uri: headerBackgroundUri }}
            resizeMode="cover"
            style={[styles.header, styles.headerHero]}
          >
            {headerContent}
          </ImageBackground>
        ) : (
          <View style={styles.header}>{headerContent}</View>
        )}

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
            {retryLabel && onRetry ? (
              <TouchableOpacity onPress={onRetry} activeOpacity={0.7}>
                <Text style={styles.retryText}>{retryLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {toast ? (
          <View style={styles.toastBar}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        {showMembershipCard && membership ? (
          <View style={styles.membershipCard}>
            <Text style={styles.membershipLabel}>{t('vip.currentLevel')}</Text>
            <Text style={styles.membershipLevel}>
              {membership.isActive ? membership.levelName : t('vip.notOpened')}
            </Text>
            {membership.isActive || membership.expireTime ? (
              <View style={styles.membershipMeta}>
                <Text style={styles.membershipMetaText}>
                  {t('vip.expireAt')}:{membership.expireTime}
                </Text>
                <Text style={styles.membershipMetaText}>
                  {t('vip.daysRemaining', { count: membership.daysRemaining })}
                </Text>
              </View>
            ) : null}
            {introduceLabel && onIntroduce ? (
              <TouchableOpacity
                style={styles.introduceBtn}
                onPress={onIntroduce}
                activeOpacity={0.7}
              >
                <Text style={styles.introduceText}>{introduceLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* 特权清单(平台注入 privilegeItems 时渲染;icon 由平台图标体系提供) */}
        {privilegeItems && privilegeItems.length > 0 ? (
          <View style={styles.privilegesSection}>
            <Text style={styles.sectionTitle}>{t('vip.privileges')}</Text>
            {privilegeItems.map((item) => (
              <View key={item.id} style={styles.privilegeCard}>
                {item.icon ? <View style={styles.privilegeIcon}>{item.icon}</View> : null}
                <View style={styles.privilegeTextWrap}>
                  <Text style={styles.privilegeTitle}>{item.title}</Text>
                  {item.desc ? <Text style={styles.privilegeDesc}>{item.desc}</Text> : null}
                </View>
                {item.badge ? (
                  <View style={styles.privilegeBadge}>
                    <Text style={styles.privilegeBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            {onViewAllPrivileges ? (
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={onViewAllPrivileges}
                activeOpacity={0.7}
              >
                <Text style={styles.moreBtnText}>
                  {viewAllPrivilegesLabel ?? t('vip.viewAllBenefits')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* 权益卡(平台注入 benefitItems 时渲染;默认在等级目录之前,RN 现状) */}
        {!benefitsAfterLevels ? benefitsSection : null}

        <View style={styles.levelsSection}>
          <Text style={styles.sectionTitle}>{t('vip.levelsTitle')}</Text>
          {levels.length === 0 ? (
            <EmptyState title={t('vip.empty')} colorScheme={colorScheme} />
          ) : (
            levels.map((level) => {
              const isCurrent = membership?.level === level.levelValue
              const isPurchasing = purchasingId === level.id
              const canPurchase = !isCurrent && level.status === 1
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

        {/* 权益卡后置(宿主传 benefitsAfterLevels 时;小程序原顺序) */}
        {benefitsAfterLevels ? benefitsSection : null}

        {/* 套餐选择 + 自动续费 + 管理入口(平台注入 plans 时渲染) */}
        {plans && plans.length > 0 ? (
          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>{t('vip.plans')}</Text>
            <View style={styles.planRow}>
              {plans.map((plan) => {
                const selected = plan.id === selectedPlanId
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[styles.planCard, selected ? styles.planCardSelected : null]}
                    onPress={() => onSelectPlan?.(plan)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.planName, selected ? styles.planSelectedText : null]}>
                      {plan.name}
                    </Text>
                    <View style={styles.planPriceRow}>
                      <Text style={[styles.planPrice, selected ? styles.planSelectedText : null]}>
                        ¥ {plan.price.toFixed(2)}
                      </Text>
                      {plan.originalPrice ? (
                        <Text style={styles.planOriginalPrice}>
                          ¥ {plan.originalPrice.toFixed(2)}
                        </Text>
                      ) : null}
                    </View>
                    {plan.period ? <Text style={styles.planPeriod}>{plan.period}</Text> : null}
                  </TouchableOpacity>
                )
              })}
            </View>

            {autoRenew !== undefined && onToggleAutoRenew ? (
              <TouchableOpacity
                style={styles.autoRenewRow}
                onPress={onToggleAutoRenew}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, autoRenew ? styles.checkboxChecked : null]}>
                  {autoRenew ? <Check size={12} color={VIP_GOLD_TEXT} /> : null}
                </View>
                <Text style={styles.autoRenewText}>
                  {autoRenewLabel ?? t('vip.index.autoRenew')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {onManage ? (
              <TouchableOpacity onPress={onManage} activeOpacity={0.7}>
                <Text style={styles.manageText}>
                  {manageLabel ?? t('vip.index.manageAutoRenew')}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.memberDesc}>
              <Text style={styles.memberDescTitle}>{t('vip.memberDesc')}</Text>
              <Text style={styles.memberDescText}>{t('vip.memberDescText')}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* 底部固定购买栏(与 onUpgrade 同时提供才渲染;RN 不传 ⇒ 零变化) */}
      {showBuyBar ? (
        <View style={styles.buyBar}>
          <View style={styles.buyPriceWrap}>
            <Text style={styles.buyPriceSymbol}>¥</Text>
            <Text style={styles.buyPriceValue}>{buyPrice}</Text>
          </View>
          <TouchableOpacity
            style={styles.buyBtn}
            onPress={() => onUpgrade?.()}
            activeOpacity={0.7}
          >
            <Text style={styles.buyBtnText}>{purchaseLabel ?? t('vip.subscribe')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tk.surface.bg },
    container: { flex: 1, backgroundColor: tk.surface.bg },
    body: { paddingBottom: rnSpacing['3xl'] },
    bodyWithBuyBar: { paddingBottom: rnSpacing['3xl'] + 96 },
    header: { paddingHorizontal: rnSpacing.lg, paddingBottom: rnSpacing.sm },
    headerHero: {
      height: 200,
      justifyContent: 'flex-end',
      paddingTop: rnSpacing['3xl'],
    },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    subtitle: { marginTop: rnSpacing.xs, fontSize: rnType.body.size, color: tk.text.secondary },
    titleOnImage: { color: tk.surface.light, marginTop: 0 },
    subtitleOnImage: { color: rnCssLight.white70 },
    headerPriceBox: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
      backgroundColor: VIP_GOLD,
    },
    headerPriceSymbol: { fontSize: rnType.label.size, fontWeight: '600', color: VIP_GOLD_TEXT },
    headerPriceValue: { fontSize: rnType.heading.size, fontWeight: '700', color: VIP_GOLD_TEXT },
    errorBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
    },
    errorText: { flex: 1, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    retryText: {
      marginLeft: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.danger.DEFAULT,
      fontWeight: '600',
    },
    toastBar: { paddingHorizontal: rnSpacing.lg, paddingVertical: rnSpacing.sm },
    toastText: { fontSize: rnType.label.size, color: tk.success.deepText },
    membershipCard: {
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.lg,
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      // 对齐 uniapp vip/index.vue 深色会员卡:用基础 token gray.800(#262626)作纯色近似
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
    introduceBtn: { marginTop: rnSpacing.sm, alignSelf: 'flex-start' },
    introduceText: { fontSize: rnType.label.size, color: VIP_GOLD, fontWeight: '600' },
    privilegesSection: { paddingHorizontal: rnSpacing['sm-loose'], marginTop: rnSpacing.lg },
    sectionTitle: {
      marginBottom: rnSpacing.md,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    privilegeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      padding: rnSpacing['md-loose'],
      marginBottom: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    privilegeIcon: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    privilegeTextWrap: { flex: 1, gap: rnSpacing.xs },
    privilegeTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    privilegeDesc: { fontSize: rnType.label.size, lineHeight: 20, color: tk.text.secondary },
    privilegeBadge: {
      paddingHorizontal: rnSpacing['2xs'],
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: VIP_GOLD,
    },
    privilegeBadgeText: { fontSize: rnType.label.size, fontWeight: '600', color: VIP_GOLD_TEXT },
    moreBtn: {
      height: 36,
      marginTop: rnSpacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: VIP_GOLD,
    },
    moreBtnText: { fontSize: rnType.label.size, fontWeight: '600', color: VIP_GOLD },
    benefitsSection: { paddingHorizontal: rnSpacing['sm-loose'], marginTop: rnSpacing.lg },
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
    benefitDesc: { fontSize: rnType.label.size, lineHeight: 20, color: tk.text.secondary },
    levelsSection: {
      paddingHorizontal: rnSpacing['sm-loose'],
      marginTop: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
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
    plansSection: {
      paddingHorizontal: rnSpacing['sm-loose'],
      marginTop: rnSpacing.lg,
      paddingBottom: rnSpacing.lg,
    },
    planRow: { flexDirection: 'row', gap: rnSpacing.sm },
    planCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
      paddingHorizontal: rnSpacing.xs,
      borderRadius: rnRadius.lg,
      borderWidth: 1.5,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    planCardSelected: { borderColor: VIP_GOLD, backgroundColor: tk.surface.card },
    planName: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.secondary },
    planSelectedText: { color: VIP_GOLD },
    planPriceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: rnSpacing['2xs'],
      marginTop: rnSpacing.xs,
    },
    planPrice: { fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
    planOriginalPrice: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
      textDecorationLine: 'line-through',
    },
    planPeriod: { marginTop: rnSpacing['2xs'], fontSize: rnType.label.size, color: tk.text.secondary },
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
    checkboxChecked: { backgroundColor: VIP_GOLD, borderColor: VIP_GOLD },
    autoRenewText: { flex: 1, fontSize: rnType.label.size, color: tk.text.secondary },
    manageText: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.label.size,
      color: VIP_GOLD,
      fontWeight: '600',
    },
    memberDesc: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    memberDescTitle: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing['2xs'],
    },
    memberDescText: { fontSize: rnType.label.size, lineHeight: 20, color: tk.text.secondary },
    buyBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      borderTopWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    buyPriceWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginRight: rnSpacing.md,
    },
    buyPriceSymbol: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: VIP_GOLD,
      marginBottom: rnSpacing['2xs'],
    },
    buyPriceValue: {
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: VIP_GOLD,
      marginLeft: rnSpacing['2xs'],
    },
    buyBtn: {
      flex: 1,
      height: 36,
      borderRadius: rnRadius.sm,
      backgroundColor: VIP_GOLD,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buyBtnText: { fontSize: rnType.label.size, fontWeight: '700', color: VIP_GOLD_TEXT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
