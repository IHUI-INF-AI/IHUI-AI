// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Check, ChevronUp, Gem, Radio, Star } from 'lucide-react-native'
import { getTokens, tokens as baseTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AppIcon } from '@ihui/types'
import type { VipBenefitItem, VipBenefitScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { VipMatrix } from '../vip-compare/VipMatrix'
import { TIERS } from './vip-benefit-tier-catalog'

/** VIP 金色主题(与 VipScreen 同值) */
const VIP_GOLD = baseTokens.vip.gold

/** 入口 id → 图标(平台无关数据只带 id,图标由共享屏兜底) */
const ENTRY_ICONS: Record<string, AppIcon> = {
  level: Gem,
  trader: ChevronUp,
  privateAdvisory: Radio,
}

export type { VipBenefitItem, VipBenefitScreenProps }

/**
 * VIP 权益共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + 权益卡片列表(ScrollView)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function VipBenefitScreen({
  t,
  items,
  loading,
  error,
  onBack,
  onRetry,
  colorScheme = 'light',
  header,
  entries,
  popup,
  upgrade,
}: VipBenefitScreenProps & { onRetry?: () => void }) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={onRetry}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{header?.title ?? t('vipBenefit.title')}</Text>
        </View>
        {header ? (
          <View style={styles.levelHeader}>
            <View style={styles.levelRow}>
              <Star size={24} color={VIP_GOLD} />
              <View style={[styles.levelPill, !header.isOpened && styles.levelBadgeClosed]}>
                <Text style={styles.levelBadgeText}>{header.levelName}</Text>
              </View>
            </View>
            {header.isOpened && header.expireText ? (
              <Text style={styles.levelHint}>{header.expireText}</Text>
            ) : header.activateHint ? (
              <Text style={styles.levelHint}>{header.activateHint}</Text>
            ) : null}
          </View>
        ) : null}
        {entries && entries.length > 0 ? (
          <View style={styles.entries}>
            {entries.map((entry) => {
              const EntryIcon = entry.icon ?? ENTRY_ICONS[entry.id] ?? Gem
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.entry}
                  onPress={entry.onPress}
                  activeOpacity={0.7}
                >
                  <EntryIcon size={28} color={VIP_GOLD} />
                  <Text style={styles.entryLabel}>{entry.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : null}
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>{t('member.benefits.myBenefits')}</Text>
          {items.length === 0 ? (
            <EmptyState
              title={t('member.benefits.empty')}
              actionLabel={t('common.back')}
              onAction={onBack}
              colorScheme={colorScheme}
            />
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.card}>
                {item.iconUri ? (
                  <Image
                    source={{ uri: item.iconUri }}
                    style={styles.cardIconImage}
                    resizeMode="contain"
                  />
                ) : item.icon ? (
                  <Text style={styles.cardIcon}>{item.icon}</Text>
                ) : null}
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {item.level ? (
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelText}>{item.level}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardDesc}>{item.desc}</Text>
              </View>
            ))
          )}
          {/* 等级权益目录:与端内 pages/member/benefits 同一面(列表空态时也渲染,对齐端内阶梯目录常在) */}
          <Text style={[styles.sectionTitle, styles.sectionGap]}>
            {t('member.benefits.tierCatalog')}
          </Text>
          {TIERS.map((tier) => (
            <View key={tier.nameKey} style={styles.tierCard}>
              <View style={styles.tierHead}>
                <tier.icon size={20} color={tk.text.primary} />
                <Text style={styles.tierName}>{t(tier.nameKey)}</Text>
              </View>
              {tier.benefits.map((benefit) => (
                <View key={benefit.descKey} style={styles.benefitRow}>
                  <benefit.icon size={16} color={tk.text.secondary} />
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>{t(benefit.titleKey)}</Text>
                    <Text style={styles.benefitDesc}>{t(benefit.descKey)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {upgrade ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.upgradeBtn} onPress={upgrade.onPress} activeOpacity={0.7}>
            <Text style={styles.upgradeText}>{upgrade.label}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {popup ? (
        <View style={styles.overlay}>
          <View style={styles.mask} />
          <View style={styles.popupCard}>
            <View style={styles.popupHead}>
              <Text style={styles.popupTitle}>{popup.title}</Text>
              <TouchableOpacity onPress={popup.onClose}>
                <Text style={styles.popupClose}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.popupBody} contentContainerStyle={styles.popupBodyInner}>
              {popup.kind === 'matrix' ? (
                <>
                  <VipMatrix
                    columns={popup.columns}
                    rows={popup.rows}
                    highlightColumn={popup.highlightColumn}
                    colorScheme={colorScheme}
                  />
                  {popup.desc ? <Text style={styles.popupDesc}>{popup.desc}</Text> : null}
                </>
              ) : (
                <>
                  {popup.intro ? <Text style={styles.popupIntro}>{popup.intro}</Text> : null}
                  {popup.items.map((item) => (
                    <View key={item} style={styles.popupBenefitRow}>
                      <Check size={16} color={VIP_GOLD} />
                      <Text style={styles.popupBenefitText}>{item}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.popupAction} onPress={popup.onPrimary}>
              <Text style={styles.popupActionText}>{popup.primaryLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    scroll: { flex: 1 },
    scrollBody: { paddingBottom: rnSpacing['3xl'] },
    body: { padding: rnSpacing.lg },
    title: { ...rnType.heading, color: tk.text.primary },
    levelHeader: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
    },
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    levelPill: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: VIP_GOLD,
    },
    levelBadgeClosed: { backgroundColor: tk.surface.muted },
    levelBadgeText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    levelHint: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    entries: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing.sm,
    },
    entry: {
      flex: 1,
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    entryLabel: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    bottomBar: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    upgradeBtn: {
      height: 48,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: VIP_GOLD,
    },
    upgradeText: { fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'flex-end',
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
    popupCard: {
      maxHeight: '82%',
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tk.surface.light,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.lg,
      paddingBottom: rnSpacing.lg,
    },
    popupHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.md,
    },
    popupTitle: { ...rnType.title, fontWeight: '700', color: tk.text.primary },
    popupClose: { fontSize: rnType.display.size, color: tk.text.secondary },
    popupBody: { flexGrow: 0 },
    popupBodyInner: { paddingBottom: rnSpacing.md },
    popupDesc: {
      marginTop: rnSpacing.md,
      fontSize: rnType.caption.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },
    popupIntro: {
      marginBottom: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    popupBenefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    popupBenefitText: { flex: 1, fontSize: rnType.body.size, color: tk.text.primary },
    popupAction: {
      marginTop: rnSpacing.md,
      height: 48,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: VIP_GOLD,
    },
    popupActionText: { fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.md,
      backgroundColor: tk.surface.light,
    },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardIcon: {
      fontSize: rnType.display.size,
      textAlign: 'center',
      marginBottom: rnSpacing.xs,
      color: tk.text.primary,
    },
    cardIconImage: { width: 48, height: 48, alignSelf: 'center', marginBottom: rnSpacing.xs },
    cardTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
    levelBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    levelText: { fontSize: rnType.label.size, color: tk.text.primary },
    cardDesc: { marginTop: rnSpacing.sm, ...rnType.body, color: tk.text.secondary },
    sectionTitle: {
      ...rnType.title,
      fontWeight: '700',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    sectionGap: { marginTop: rnSpacing.lg },
    tierCard: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: rnSpacing.md,
      overflow: 'hidden',
    },
    tierHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      backgroundColor: tk.surface.muted,
    },
    tierName: { ...rnType.title, fontWeight: '700', color: tk.text.primary },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    benefitText: { flex: 1, gap: rnSpacing['2xs'] },
    benefitTitle: { ...rnType.body, fontWeight: '500', color: tk.text.primary },
    benefitDesc: { ...rnType.caption, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
