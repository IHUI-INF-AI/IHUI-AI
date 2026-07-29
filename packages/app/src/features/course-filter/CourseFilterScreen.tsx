import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseFilterScreenProps } from '../../types'

/** 课程筛选共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */

export type { CourseFilterScreenProps }

const CATEGORIES = ['all', 'tech', 'design', 'business', 'language'] as const
const LEVELS = ['all', 'beginner', 'intermediate', 'advanced'] as const
const PRICE_TABS = ['all', 'free', 'paid'] as const

const COURSE_CAT_KEYS: Record<(typeof CATEGORIES)[number], string> = {
  all: 'courseFilter.cat_all',
  tech: 'courseFilter.cat_tech',
  design: 'courseFilter.cat_design',
  business: 'courseFilter.cat_business',
  language: 'courseFilter.cat_language',
}

const COURSE_LEVEL_KEYS: Record<(typeof LEVELS)[number], string> = {
  all: 'courseFilter.level_all',
  beginner: 'courseFilter.level_beginner',
  intermediate: 'courseFilter.level_intermediate',
  advanced: 'courseFilter.level_advanced',
}

const COURSE_PRICE_KEYS: Record<(typeof PRICE_TABS)[number], string> = {
  all: 'courseFilter.price_all',
  free: 'courseFilter.price_free',
  paid: 'courseFilter.price_paid',
}

export function CourseFilterScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  category,
  level,
  priceTab,
  onCategoryChange,
  onLevelChange,
  onPriceTabChange,
  onApply,
  onReset,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: CourseFilterScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('courseFilter.title')}</Text>
        <Text style={styles.subtitle}>{t('courseFilter.subtitle')}</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>{t('courseFilter.category')}</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => onCategoryChange(c)}
              style={[styles.chip, category === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                {t(COURSE_CAT_KEYS[c])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>{t('courseFilter.level')}</Text>
        <View style={styles.chipRow}>
          {LEVELS.map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => onLevelChange(l)}
              style={[styles.chip, level === l && styles.chipActive]}
            >
              <Text style={[styles.chipText, level === l && styles.chipTextActive]}>
                {t(COURSE_LEVEL_KEYS[l])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>{t('courseFilter.priceRange')}</Text>
        <View style={styles.chipRow}>
          {PRICE_TABS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => onPriceTabChange(p)}
              style={[styles.chip, priceTab === p && styles.chipActive]}
            >
              <Text style={[styles.chipText, priceTab === p && styles.chipTextActive]}>
                {t(COURSE_PRICE_KEYS[p])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.resetBtn]} onPress={onReset}>
            <Text style={styles.resetText}>{t('courseFilter.reset')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.applyBtn]} onPress={onApply}>
            <Text style={styles.applyText}>{t('courseFilter.apply')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>{t('courseFilter.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('courseFilter.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta}>
                {t('courseFilter.instructor')}：{item.instructor}
              </Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMetaText}>
                  {t('courseFilter.level_label')}：{t(COURSE_LEVEL_KEYS[item.level])}
                </Text>
                <Text style={styles.priceText}>
                  {item.price === 0 ? t('courseFilter.free') : `¥${item.price}`}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backBtn: { marginBottom: 4 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    filterSection: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: tk.surface.muted,
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: tk.text.medium,
      marginTop: 8,
      marginBottom: 6,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    chipActive: { backgroundColor: tk.success.DEFAULT },
    chipText: { fontSize: 12, color: tk.text.secondary },
    chipTextActive: { color: tk.surface.light },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    resetBtn: { backgroundColor: tk.surface.card },
    applyBtn: { backgroundColor: tk.success.DEFAULT },
    resetText: { fontSize: 13, color: tk.text.secondary },
    applyText: { fontSize: 13, color: tk.surface.light },
    errorBar: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    retryText: { fontSize: 12, color: tk.success.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 12, color: tk.text.tertiary, marginTop: 8 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    cardMeta: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    cardMetaText: { fontSize: 12, color: tk.text.secondary },
    priceText: { fontSize: 14, fontWeight: '600', color: tk.success.DEFAULT },
  })
}
