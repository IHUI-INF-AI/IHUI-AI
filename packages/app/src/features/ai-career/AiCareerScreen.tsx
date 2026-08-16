import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AiCareerScreenProps, AiCareerTrend, TFunction } from '../../types'

/** AI 职业规划共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AiCareerScreenProps }

function trendLabel(
  trend: AiCareerTrend,
  t: TFunction,
  tk: AppThemeTokens,
): { text: string; color: string; bg: string } {
  if (trend === 'up')
    return { text: t('aiCareer.trendUp'), color: tk.brand.DEFAULT, bg: tk.success.light }
  if (trend === 'new')
    return { text: t('aiCareer.trendNew'), color: tk.text.primary, bg: tk.surface.muted }
  return { text: t('aiCareer.trendStable'), color: tk.text.secondary, bg: tk.surface.card }
}

function scoreColor(score: number, tk: AppThemeTokens): string {
  if (score >= 85) return tk.brand.DEFAULT
  if (score >= 70) return tk.text.primary
  return tk.warning.DEFAULT
}

export function AiCareerScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  selectedId,
  onToggleItem,
  onRefresh,
  onPlan,
  onBack,
  colorScheme = 'light',
}: AiCareerScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('aiCareer.title')}</Text>
        <Text style={styles.headerSub}>{t('aiCareer.subtitle')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      ) : null}

      <Text style={styles.sectionTitle}>{t('aiCareer.sectionTitle')}</Text>
      {items.map((c) => {
        const tl = trendLabel(c.trend, t, tk)
        const expanded = selectedId === c.id
        return (
          <TouchableOpacity
            key={c.id}
            style={[styles.careerCard, expanded && styles.careerCardActive]}
            onPress={() => onToggleItem(c.id)}
            activeOpacity={0.85}
          >
            <View style={styles.careerHead}>
              <View style={styles.careerMain}>
                <View style={styles.careerNameRow}>
                  <Text style={styles.careerTitle}>{c.title}</Text>
                  <View style={[styles.trendBadge, { backgroundColor: tl.bg }]}>
                    <Text style={[styles.trendText, { color: tl.color }]}>{tl.text}</Text>
                  </View>
                </View>
                {c.salary ? <Text style={styles.careerSalary}>{c.salary}</Text> : null}
              </View>
              <View style={styles.matchRing}>
                <Text style={[styles.matchScore, { color: scoreColor(c.match, tk) }]}>
                  {c.match}
                </Text>
                <Text style={styles.matchLabel}>{t('aiCareer.matchLabel')}</Text>
              </View>
            </View>
            {expanded ? (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonTitle}>{t('aiCareer.reasonTitle')}</Text>
                {c.reasons.length > 0 ? (
                  c.reasons.map((r) => (
                    <Text key={r} style={styles.reasonItem}>
                      · {r}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.reasonItem}>{t('aiCareer.noReason')}</Text>
                )}
                <TouchableOpacity
                  style={styles.planBtn}
                  onPress={() => onPlan(c)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.planBtnText}>{t('aiCareer.planBtn')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    backBtn: { paddingBottom: 4 },
    back: { fontSize: 16, color: tk.text.secondary },
    header: { paddingTop: 4, paddingBottom: 12 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    headerSub: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    errorText: { color: tk.danger.DEFAULT, fontSize: 14, marginBottom: 8 },
    loadingText: { color: tk.text.tertiary, fontSize: 14, marginBottom: 8 },
    sectionTitle: {
      marginTop: 12,
      marginBottom: 10,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    careerCard: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 10,
      backgroundColor: tk.surface.light,
    },
    careerCardActive: { borderColor: tk.brand.DEFAULT },
    careerHead: { flexDirection: 'row' },
    careerMain: { flex: 1 },
    careerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    careerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    trendBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    trendText: { fontSize: 11, fontWeight: '600' },
    careerSalary: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    matchRing: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matchScore: { fontSize: 20, fontWeight: '700' },
    matchLabel: { marginTop: 8, fontSize: 10, color: tk.text.tertiary },
    reasonBox: { marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: tk.surface.muted },
    reasonTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary, marginBottom: 8 },
    reasonItem: { fontSize: 14, color: tk.gray[600], lineHeight: 20 },
    planBtn: {
      marginTop: 10,
      height: 44,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planBtnText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
  })
}
