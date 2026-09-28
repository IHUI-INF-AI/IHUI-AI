// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

/** 课程筛选共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */

export type { CourseFilterScreenProps }

const PRICE_TABS = ['all', 'free', 'paid'] as const

/**
 * 难度档位取自服务端取值域(lessons.difficulty,迁移 20260928050000)。
 * 这张表**只是档位**,不是"当前有数据的档位" —— 现网全部行为 NULL 时选了照样是空列表,
 * 那由列表空态如实说明,不得在这里删档位去假装"这一根轴有货"。
 */
const DIFFICULTY_TABS = ['all', 'beginner', 'intermediate', 'advanced'] as const

const COURSE_PRICE_KEYS: Record<(typeof PRICE_TABS)[number], string> = {
  all: 'courseFilter.price_all',
  free: 'courseFilter.price_free',
  paid: 'courseFilter.price_paid',
}

const COURSE_DIFFICULTY_KEYS: Record<(typeof DIFFICULTY_TABS)[number], string> = {
  all: 'courseFilter.difficulty_all',
  beginner: 'courseFilter.difficulty_beginner',
  intermediate: 'courseFilter.difficulty_intermediate',
  advanced: 'courseFilter.difficulty_advanced',
}

/** 分类轴的"未选"哨兵(与 usePaginatedList 的 categoryId:undefined 由调用方互转)。 */
const ALL_CATEGORIES = 'all'

export function CourseFilterScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  error,
  priceTab,
  onPriceTabChange,
  difficultyTab,
  onDifficultyTabChange,
  categories,
  categoryId,
  onCategoryChange,
  onLoadMore,
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
        <BackChevron
          onPress={onBack}
          label={t('common.back')}
          colorScheme={colorScheme}
          style={styles.backBtn}
        />
        <Text style={styles.title}>{t('courseFilter.title')}</Text>
        <Text style={styles.subtitle}>{t('courseFilter.subtitle')}</Text>
      </View>

      <View style={styles.filterSection}>
        {/* 分类轴:选项一律来自服务端真实分类(中文 name + UUID id),端内不得硬编码。 */}
        <Text style={styles.filterLabel}>{t('courseFilter.categoryRange')}</Text>
        {categories.length === 0 ? (
          <Text style={styles.axisNotice}>{t('courseFilter.noCategories')}</Text>
        ) : (
          <View style={styles.chipRow}>
            <TouchableOpacity
              onPress={() => onCategoryChange(ALL_CATEGORIES)}
              style={[styles.chip, categoryId === ALL_CATEGORIES && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, categoryId === ALL_CATEGORIES && styles.chipTextActive]}
              >
                {t('courseFilter.price_all')}
              </Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => onCategoryChange(c.id)}
                style={[styles.chip, categoryId === c.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.filterLabel}>{t('courseFilter.difficultyRange')}</Text>
        <View style={styles.chipRow}>
          {DIFFICULTY_TABS.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => onDifficultyTabChange(d)}
              style={[styles.chip, difficultyTab === d && styles.chipActive]}
            >
              <Text style={[styles.chipText, difficultyTab === d && styles.chipTextActive]}>
                {t(COURSE_DIFFICULTY_KEYS[d])}
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
          contentContainerStyle={{ padding: 10, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          // 分页由服务端取下一页:触底即取,不再"只拿第一页然后在端内过滤"
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.center}>
                <ActivityIndicator color={tk.brand.DEFAULT} />
                <Text style={styles.emptyText}>{t('courseFilter.loadingMore')}</Text>
              </View>
            ) : null
          }
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
              {/* NULL(未标注)就整行不渲染 —— 不得用任何默认档把"未标注"洗成"入门" */}
              {item.difficulty ? (
                <Text style={styles.cardMeta}>
                  {t('courseFilter.difficultyRange')}：{t(COURSE_DIFFICULTY_KEYS[item.difficulty])}
                </Text>
              ) : null}
              {item.categoryName ? (
                <Text style={styles.cardMeta}>
                  {t('courseFilter.categoryRange')}：{item.categoryName}
                </Text>
              ) : null}
              <View style={styles.cardMetaRow}>
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
    header: { paddingHorizontal: 10, paddingBottom: 8 },
    backBtn: { marginBottom: 8 },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    filterSection: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: tk.surface.muted,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.medium,
      marginTop: 8,
      marginBottom: 6,
    },
    // 某一轴在服务端当前没有可选值时的如实提示(不是错误态,故用 tertiary 而非 danger)
    axisNotice: { fontSize: 12, color: tk.text.tertiary, marginBottom: 6 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.card,
    },
    chipActive: { backgroundColor: tk.brand.cta },
    chipText: { fontSize: 12, color: tk.text.secondary },
    chipTextActive: { color: tk.surface.light },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionBtn: { flex: 1, paddingVertical: 8, borderRadius: rnRadius.sm, alignItems: 'center' },
    resetBtn: { backgroundColor: tk.surface.card },
    applyBtn: { backgroundColor: tk.brand.cta },
    resetText: { fontSize: 14, color: tk.text.secondary },
    applyText: { fontSize: 14, color: tk.surface.light },
    errorBar: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    retryText: { fontSize: 14, color: tk.brand.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    cardMeta: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    priceText: { fontSize: 18, fontWeight: '700', color: tk.brand.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
