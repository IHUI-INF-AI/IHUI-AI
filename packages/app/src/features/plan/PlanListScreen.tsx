// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { FileText, Plus } from 'lucide-react-native'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { PlanDocument, PlanProgressStats } from '@ihui/shared/plan'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createPlanStyles, PLAN_PALETTE } from './plan-styles'

/** 状态筛选值(与 web 端 plan/page.tsx FILTERS 同集合:全部 + 四状态)。 */
export type PlanFilterValue = 'all' | PlanDocument['status']

export interface PlanListRow {
  plan: PlanDocument
  stats: PlanProgressStats
}

export interface PlanListScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  rows: PlanListRow[]
  filter: PlanFilterValue
  onFilterChange: (filter: PlanFilterValue) => void
  onOpenPlan: (id: string) => void
  onCreate: () => void
  loading?: boolean
}

const FILTER_OPTIONS: Array<{ value: PlanFilterValue; labelKey: string }> = [
  { value: 'all', labelKey: 'planPage.filterAll' },
  { value: 'draft', labelKey: 'planPage.filterDraft' },
  { value: 'active', labelKey: 'planPage.filterActive' },
  { value: 'completed', labelKey: 'planPage.filterCompleted' },
  { value: 'archived', labelKey: 'planPage.filterArchived' },
]

const PLAN_STATUS_LABEL_KEYS: Record<PlanDocument['status'], string> = {
  draft: 'planPage.statusDraft',
  active: 'planPage.statusActive',
  completed: 'planPage.statusCompleted',
  archived: 'planPage.statusArchived',
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 进度条 + 数字明细(对齐 web ProgressStats;卡片与详情共用同一渲染)。 */
export function PlanProgressBlock({
  stats,
  t,
  styles,
}: {
  stats: PlanProgressStats
  t: TFunction
  styles: ReturnType<typeof createPlanStyles>
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, Math.max(0, stats.completionPercent))}%` },
            ]}
          />
        </View>
        <Text style={styles.progressPct}>{stats.completionPercent}%</Text>
      </View>
      <View style={styles.statRow}>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: PLAN_PALETTE.completed.dot }]} />
          <Text style={styles.statLabel}>{t('planPage.statCompleted')}</Text>
          <Text style={styles.statValue}>{stats.completed}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: PLAN_PALETTE.in_progress.dot }]} />
          <Text style={styles.statLabel}>{t('planPage.statInProgress')}</Text>
          <Text style={styles.statValue}>{stats.inProgress}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: PLAN_PALETTE.blocked.dot }]} />
          <Text style={styles.statLabel}>{t('planPage.statBlocked')}</Text>
          <Text style={styles.statValue}>{stats.blocked}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: PLAN_PALETTE.pending.dot }]} />
          <Text style={styles.statLabel}>{t('planPage.statPending')}</Text>
          <Text style={styles.statValue}>{stats.pending}</Text>
        </View>
        <Text style={styles.statTotal}>{t('planPage.statTotal', { count: stats.total })}</Text>
      </View>
    </View>
  )
}

export function PlanStatusBadge({
  status,
  t,
  styles,
}: {
  status: PlanDocument['status']
  t: TFunction
  styles: ReturnType<typeof createPlanStyles>
}) {
  const palette = PLAN_PALETTE[status]
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>
        {t(PLAN_STATUS_LABEL_KEYS[status])}
      </Text>
    </View>
  )
}

export function PlanListScreen({
  t,
  onBack,
  colorScheme = 'light',
  rows,
  filter,
  onFilterChange,
  onOpenPlan,
  onCreate,
  loading = false,
}: PlanListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createPlanStyles(tk), [tk])

  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.plan.status === filter)),
    [rows, filter],
  )

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('planPage.title')}</Text>
      <View style={styles.headerSpacer} />
      <TouchableOpacity
        style={[styles.primaryBtn, { paddingVertical: 6, paddingHorizontal: 12 }]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('planPage.create')}
        onPress={onCreate}
      >
        <Plus size={14} color={tk.brand.ctaForeground} strokeWidth={2.4} />
        <Text style={[styles.primaryBtnText, { fontSize: 13 }]}>{t('planPage.create')}</Text>
      </TouchableOpacity>
    </View>
  )

  if (loading && rows.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.skeletonTitle} />
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
          </View>
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('planPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('planPage.subtitle')}</Text>
        </View>

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((f) => {
            const count =
              f.value === 'all' ? rows.length : rows.filter((r) => r.plan.status === f.value).length
            const active = filter === f.value
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => onFilterChange(f.value)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {t(f.labelKey)}
                </Text>
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                    { fontSize: 11 },
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {filtered.length > 0 ? (
          filtered.map(({ plan, stats }) => (
            <TouchableOpacity
              key={plan.id}
              style={styles.card}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={plan.title}
              onPress={() => onOpenPlan(plan.id)}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {plan.title}
                </Text>
                <PlanStatusBadge status={plan.status} t={t} styles={styles} />
              </View>
              <Text style={styles.goalText} numberOfLines={2}>
                {plan.goal.length > 0 ? plan.goal : t('planPage.noGoal')}
              </Text>
              <PlanProgressBlock stats={stats} t={t} styles={styles} />
              {plan.tags && plan.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {plan.tags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.cardFoot}>
                <Text style={styles.footDate}>{formatDate(plan.createdAt)}</Text>
                <Text style={styles.linkBtnText}>{t('planPage.viewDetail')}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.card}>
            <View style={styles.emptyBox}>
              <FileText size={28} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.emptyTitle}>
                {rows.length === 0 ? t('planPage.emptyTitle') : t('planPage.filterEmptyTitle')}
              </Text>
              <Text style={styles.emptyDesc}>
                {rows.length === 0 ? t('planPage.emptyDesc') : t('planPage.filterEmptyDesc')}
              </Text>
              {rows.length === 0 ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t('planPage.create')}
                  onPress={onCreate}
                >
                  <Plus size={14} color={tk.brand.ctaForeground} strokeWidth={2.4} />
                  <Text style={styles.primaryBtnText}>{t('planPage.create')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
