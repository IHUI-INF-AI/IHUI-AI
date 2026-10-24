// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CheckCircle2, Sparkles, X } from 'lucide-react-native'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * WrongQuestionsScreen — 跨端共享「错题本屏」(门 39 六屏共享化第二批)。
 *
 * 为什么进共享层:守门 39 的屏级共享维要求 RN 有 `@ihui/rn-app` import 的同时
 * `packages/app` 有同名共享屏 —— 本文件是
 * `apps/mobile-rn/src/screens/WrongQuestionsScreen.tsx` 的 UI 下沉(照
 * `features/points/PointsScreen.tsx` / `features/usage/UsageScreen.tsx` 的 props 注入式,
 * wrapper 只留 API 调用、导航、i18n 与主题注入)。**不准**靠"补一条 import"或塞白名单消红。
 *
 * 平台无关边界:
 *  - 统计卡 / 筛选 chip / 行卡 / AI 讲解弹层属 UI,全部下沉;
 *  - 数据:行与统计由平台按 apps/api `exam.ts` 契约取回,时间先由平台格式化成 `createdAtText`;
 *  - 筛选档切换后的查询串拼装属平台(API 射程),共享层只发 `onFilterChange(filter)`;
 *  - 「标记已掌握」后的 `appAlert` 属平台能力,共享层只发 `onResolve(item)`;
 *  - 遮罩色取 `tk.overlay.modal`(单一色值源),不再写死 rgba 字面量。
 */

/** 筛选档(与端点 `isResolved` 查询参数一一对应)。 */
export type WrongQuestionFilter = 'all' | 'unresolved' | 'resolved'

export const WRONG_QUESTION_FILTERS: readonly WrongQuestionFilter[] = [
  'all',
  'unresolved',
  'resolved',
] as const

/** 顶部统计卡(GET /api/exam/wrong-questions/stats 的 stats 子集)。 */
export interface WrongQuestionStats {
  total: number
  unresolved: number
  resolved: number
}

/** 错题行(平台注入;时间已格式化)。 */
export interface WrongQuestionItem {
  /** 列表 key */
  id: string
  /** 题目 id(resolve / explain 端点的路径段) */
  questionId: string
  questionTitle: string | null
  paperTitle: string | null
  wrongCount: number
  isMastered: boolean
  /** 平台格式化好的错答时间文本 */
  createdAtText: string
}

/** AI 讲解弹层载荷(平台取回后注入;null = 关闭)。 */
export interface WrongQuestionExplanation {
  title: string
  text: string
}

export interface WrongQuestionsScreenProps {
  t: TFunction
  stats: WrongQuestionStats | null
  filter: WrongQuestionFilter
  items: WrongQuestionItem[]
  total: number
  loading: boolean
  /** 列表加载失败(渲染空态位上的错误块 + 重试) */
  failed: boolean
  /** 正在标记已掌握的 questionId;null = 无 */
  resolvingId: string | null
  /** 正在请求 AI 讲解的 questionId;null = 无 */
  explainingId: string | null
  explanation: WrongQuestionExplanation | null
  onFilterChange: (filter: WrongQuestionFilter) => void
  onRetry: () => void
  onLoadMore: () => void
  onResolve: (item: WrongQuestionItem) => void
  onExplain: (item: WrongQuestionItem) => void
  onCloseExplanation: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 筛选档 → 文案键(三档一处取词,两端共用)。 */
export function wrongQuestionFilterLabel(t: TFunction, filter: WrongQuestionFilter): string {
  if (filter === 'unresolved') return t('wrongQuestions.filterUnresolved')
  if (filter === 'resolved') return t('wrongQuestions.filterResolved')
  return t('wrongQuestions.filterAll')
}

export function WrongQuestionsScreen({
  t,
  stats,
  filter,
  items,
  total,
  loading,
  failed,
  resolvingId,
  explainingId,
  explanation,
  onFilterChange,
  onRetry,
  onLoadMore,
  onResolve,
  onExplain,
  onCloseExplanation,
  onBack,
  colorScheme = 'light',
}: WrongQuestionsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statCards = [
    { key: 'total', label: t('wrongQuestions.statsTotal'), value: stats?.total ?? 0 },
    {
      key: 'unresolved',
      label: t('wrongQuestions.statsUnresolved'),
      value: stats?.unresolved ?? 0,
    },
    { key: 'resolved', label: t('wrongQuestions.statsResolved'), value: stats?.resolved ?? 0 },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('wrongQuestions.title')}</Text>
      </View>

      <View style={styles.filterZone}>
        <View style={styles.statRow}>
          {statCards.map((c) => (
            <View key={c.key} style={styles.statCard}>
              <Text style={styles.statLabel}>{c.label}</Text>
              <Text style={styles.statValue}>{c.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.filterRow}>
          {WRONG_QUESTION_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipOn]}
              onPress={() => onFilterChange(f)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={wrongQuestionFilterLabel(t, f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipOnText]}>
                {wrongQuestionFilterLabel(t, f)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ListEmptyComponent={
          loading ? (
            <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
          ) : failed ? (
            <ErrorState
              message={t('wrongQuestions.loadFailed')}
              onRetry={onRetry}
              retryLabel={t('common.retry')}
              colorScheme={colorScheme}
            />
          ) : (
            <EmptyState title={t('wrongQuestions.empty')} colorScheme={colorScheme} />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.itemHead}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.questionTitle || item.questionId.slice(0, 8)}
              </Text>
              <View style={styles.badge}>
                <Text style={[styles.badgeText, item.isMastered && styles.badgeTextOk]}>
                  {item.isMastered
                    ? t('wrongQuestions.filterResolved')
                    : t('wrongQuestions.filterUnresolved')}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {item.paperTitle ?? '—'} ·{' '}
              {t('wrongQuestions.wrongCount', { count: item.wrongCount })} ·{' '}
              {t('wrongQuestions.time')}: {item.createdAtText}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onExplain(item)}
                disabled={explainingId !== null}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('wrongQuestions.aiExplain')}
              >
                {explainingId === item.questionId ? (
                  <ActivityIndicator size="small" color={tk.text.secondary} />
                ) : (
                  <Sparkles size={14} color={tk.text.secondary} />
                )}
                <Text style={styles.actionText}>{t('wrongQuestions.aiExplain')}</Text>
              </TouchableOpacity>
              {!item.isMastered ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onResolve(item)}
                  disabled={resolvingId !== null}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('wrongQuestions.markAsResolved')}
                >
                  {resolvingId === item.questionId ? (
                    <ActivityIndicator size="small" color={tk.text.secondary} />
                  ) : (
                    <CheckCircle2 size={14} color={tk.text.secondary} />
                  )}
                  <Text style={styles.actionText}>{t('wrongQuestions.markAsResolved')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
        ListFooterComponent={
          !loading && items.length < total ? (
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={onLoadMore}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('wrongQuestions.loadMore')}
            >
              <Text style={styles.moreText}>
                {t('wrongQuestions.loadMore')} ({items.length}/{total})
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <Modal
        visible={explanation !== null}
        transparent
        animationType="slide"
        onRequestClose={onCloseExplanation}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.mask} onPress={onCloseExplanation} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Sparkles size={16} color={tk.text.primary} />
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {t('wrongQuestions.aiExplain')} · {explanation?.title}
              </Text>
              <Pressable onPress={onCloseExplanation} hitSlop={8}>
                <X size={18} color={tk.text.secondary} />
              </Pressable>
            </View>
            <Text style={styles.explainText}>{explanation?.text}</Text>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    filterZone: { paddingHorizontal: rnSpacing.md, paddingTop: rnSpacing.sm, gap: rnSpacing.sm },
    statRow: { flexDirection: 'row', gap: rnSpacing.sm },
    statCard: {
      flex: 1,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: 2,
    },
    statLabel: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    statValue: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    filterRow: { flexDirection: 'row', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      height: 30,
      justifyContent: 'center',
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    chipOn: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipOnText: { color: tk.brand.ctaForeground, fontWeight: '600' },
    listBody: { padding: rnSpacing.md, gap: 10, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: 6,
    },
    itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    itemTitle: {
      flex: 1,
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
      lineHeight: 20,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    badgeText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    badgeTextOk: { color: tk.success.DEFAULT },
    meta: { fontSize: rnType.label.size, color: tk.text.secondary, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: rnSpacing.lg, paddingTop: rnSpacing.xs },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing.xs,
    },
    actionText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.secondary },
    moreBtn: {
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.xs,
    },
    moreText: { fontSize: 13, color: tk.text.primary },
    overlay: { flex: 1, justifyContent: 'flex-end' },
    mask: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: tk.overlay.modal,
    },
    sheet: {
      maxHeight: '70%',
      padding: rnSpacing.lg,
      gap: 10,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sheetTitle: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    explainText: { fontSize: rnType.body.size, lineHeight: 22, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
