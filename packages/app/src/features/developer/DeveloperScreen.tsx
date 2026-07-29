import { useMemo } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  DeveloperFeature,
  DeveloperPlan,
  DeveloperPlanType,
  DeveloperScreenProps,
} from '../../types'

export type { DeveloperFeature, DeveloperPlan, DeveloperPlanType, DeveloperScreenProps }

/**
 * 开发者入口共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API)
 *
 * 平台无关:渲染标题 + Hero 卡(成为开发者 + 特性网格)+ 套餐选择(月/年)
 * + 提交按钮 + 协议提示。
 * 平台特定(API 价格拉取 / 下拉刷新 / 提交互调 / Alert)由 wrapper 通过 props 注入。
 */
export function DeveloperScreen({
  t,
  features,
  plans,
  selected,
  loading,
  refreshing,
  error,
  submitting,
  onSelectChange,
  onRefresh,
  onSubmit,
  colorScheme = 'light',
}: DeveloperScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('developer.title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{t('developer.becomeDeveloper')}</Text>
          <Text style={styles.heroSubtitle}>{t('developer.subtitle')}</Text>
          <View style={styles.featureGrid}>
            {features.map((f) => (
              <View key={f.title} style={styles.featureItem}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc} numberOfLines={2}>
                  {f.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('developer.selectService')}</Text>
        {error ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={tk.brand.DEFAULT} />
            <Text style={styles.stateText}>{t('common.loading')}</Text>
          </View>
        ) : (
          <View style={styles.planRow}>
            {plans.map((p) => {
              const active = selected === p.type
              return (
                <TouchableOpacity
                  key={p.type}
                  style={[styles.planCard, active && styles.planCardActive]}
                  onPress={() => onSelectChange(p.type)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.planLabel, active && styles.planLabelActive]}>
                    {p.label}
                  </Text>
                  <Text style={active ? styles.planPriceActive : styles.planPrice}>
                    <Text style={styles.planPriceNumber}>{p.price}</Text>
                    <Text style={styles.planPriceUnit}> / {p.unit}</Text>
                  </Text>
                  <View style={styles.perkList}>
                    {p.perks.map((perk) => (
                      <Text
                        key={perk}
                        style={[styles.perkText, active && styles.perkTextActive]}
                        numberOfLines={1}
                      >
                        · {perk}
                      </Text>
                    ))}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>
            {submitting ? t('developer.processing') : t('developer.openNow')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.agreementHint}>{t('developer.agreementHint')}</Text>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const primary = tk.purple.DEFAULT
  const primaryLight = tk.purple.light
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.card },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    scrollContent: { padding: 16, paddingBottom: 32 },
    heroCard: {
      backgroundColor: primaryLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    heroTitle: { fontSize: 20, fontWeight: '700', color: primary },
    heroSubtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    featureGrid: {
      marginTop: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    featureItem: {
      width: '47%',
      backgroundColor: tk.surface.card,
      borderRadius: 8,
      padding: 10,
    },
    featureTitle: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    featureDesc: { marginTop: 2, fontSize: 11, color: tk.text.tertiary },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.secondary,
      marginBottom: 12,
    },
    stateWrap: { paddingVertical: 32, alignItems: 'center' },
    stateText: { marginTop: 6, fontSize: 13, color: tk.text.tertiary },
    planRow: { flexDirection: 'row', gap: 12 },
    planCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 12,
      padding: 14,
      backgroundColor: tk.surface.card,
    },
    planCardActive: {
      borderColor: primary,
      backgroundColor: tk.surface.light,
    },
    planLabel: { fontSize: 14, fontWeight: '600', color: tk.text.secondary },
    planLabelActive: { color: primary },
    planPrice: { marginTop: 8 },
    planPriceActive: { marginTop: 8 },
    planPriceNumber: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    planPriceUnit: { fontSize: 12, color: tk.text.tertiary },
    perkList: { marginTop: 10, gap: 4 },
    perkText: { fontSize: 11, color: tk.text.tertiary },
    perkTextActive: { color: primary },
    submitBtn: {
      marginTop: 24,
      height: 46,
      borderRadius: 12,
      backgroundColor: primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { fontSize: 15, fontWeight: '600', color: tk.surface.light },
    agreementHint: {
      marginTop: 12,
      textAlign: 'center',
      fontSize: 11,
      color: tk.text.tertiary,
    },
  })
}
