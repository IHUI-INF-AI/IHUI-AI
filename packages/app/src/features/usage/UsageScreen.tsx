// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { BarChart3, Gauge, Zap } from 'lucide-react-native'
import { rnRadius } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * UsageScreen — 跨端共享「Token 用量统计屏」(门 39 六屏共享化第一批)。
 *
 * 为什么进共享层:守门 39(`scripts/check-rn-app-migration.mjs`)的屏级共享维(V2)要求
 * RN 侧有 `@ihui/rn-app` import 的同时,`packages/app` 里有同名共享屏 —— 本文件就是
 * `apps/mobile-rn/src/screens/UsageScreen.tsx` 的 UI 下沉(与 `features/payment/PaymentScreen.tsx`
 * 同一型 props 注入式,wrapper 只留 API 调用 / 导航 / i18n 与主题注入)。
 *
 * 平台无关边界:
 *  - 导航:只收 `onBack`,不 import 任何 router;
 *  - 数据:`stats` / `quota` 由平台按 ai-service 契约取回后注入,共享层不依赖 `@ihui/api-client`;
 *  - 取数基址(WEB_BASE_URL → next rewrite → 8803)属平台差异,留 wrapper;
 *  - 文案:`usage.*` 业务键由共享层直接 `t()`(先例:PaymentScreen 的 `payment.*`)。
 */
export interface UsageBreakdownRow {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost: number
  calls?: number
}

/** GET /api/v1/ai/usage/stats?days=30 的响应载荷(app/routers/usage.py) */
export interface UsageStats {
  user_id: string
  days: number
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
  total_calls: number
  daily_breakdown: Record<string, UsageBreakdownRow>
  model_breakdown: Record<string, UsageBreakdownRow>
  provider_breakdown: Record<string, UsageBreakdownRow>
}

/** GET /api/v1/ai/usage/quota 的响应载荷 */
export interface UsageQuota {
  user_id: string
  used_tokens: number
  quota_limit: number
  remaining: number
  usage_percent: number
}

export interface UsageScreenProps {
  t: TFunction
  stats: UsageStats | null
  quota: UsageQuota | null
  loading: boolean
  /** 错误态文案(非空则渲染错误态 + 重试钮) */
  error: string | null
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Token 数量的人类可读形态(1.2M / 12.3K / 原值);两端共用同一档位。 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** 进度条宽度百分比:钳到 2%~100%(0 也留 2% 让人看见轨道里有东西)。 */
export function usageBarWidth(value: number, max: number): `${number}%` {
  const v = max > 0 ? Math.round((value / max) * 100) : 0
  return `${Math.max(2, Math.min(100, v))}%`
}

export function UsageScreen({
  t,
  stats,
  quota,
  loading,
  error,
  onRetry,
  onBack,
  colorScheme = 'light',
}: UsageScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const dailyEntries = stats ? Object.entries(stats.daily_breakdown).slice(-14) : []
  const modelEntries = stats
    ? Object.entries(stats.model_breakdown)
        .sort((a, b) => b[1].total_tokens - a[1].total_tokens)
        .slice(0, 10)
    : []
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v.total_tokens), 1)
  const maxModel = Math.max(...modelEntries.map(([, v]) => v.total_tokens), 1)
  const hasData = !!stats && (stats.total_calls > 0 || (quota?.used_tokens ?? 0) > 0)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('usage.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={onRetry}
            retryLabel={t('usage.retry')}
            colorScheme={colorScheme}
          />
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Gauge size={16} color={tk.text.secondary} />
                <Text style={styles.cardTitle}>{t('usage.quotaTitle')}</Text>
              </View>
              <Text style={styles.meta}>{t('usage.periodMonth')}</Text>
              <View style={styles.quotaRow}>
                <View style={styles.quotaCell}>
                  <Text style={styles.metric}>{formatTokens(quota?.used_tokens ?? 0)}</Text>
                  <Text style={styles.meta}>{t('usage.used')}</Text>
                </View>
                <View style={styles.quotaCell}>
                  <Text style={styles.metric}>{formatTokens(quota?.quota_limit ?? 0)}</Text>
                  <Text style={styles.meta}>{t('usage.limit')}</Text>
                </View>
                <View style={styles.quotaCell}>
                  <Text style={styles.metric}>{formatTokens(quota?.remaining ?? 0)}</Text>
                  <Text style={styles.meta}>{t('usage.remaining')}</Text>
                </View>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.trackFill,
                    {
                      width: usageBarWidth(quota?.usage_percent ?? 0, 100),
                      backgroundColor:
                        (quota?.usage_percent ?? 0) > 80 ? tk.danger.DEFAULT : tk.brandAccent.deep,
                    },
                  ]}
                />
              </View>
              <Text style={styles.meta}>
                {t('usage.usagePercent')}: {(quota?.usage_percent ?? 0).toFixed(1)}%
              </Text>
            </View>

            {!hasData ? (
              <View style={styles.card}>
                <Text style={styles.muted}>{t('usage.noData')}</Text>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <Zap size={16} color={tk.text.secondary} />
                    <Text style={styles.cardTitle}>{t('usage.statsTitle')}</Text>
                  </View>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCell}>
                      <Text style={styles.metric}>{formatTokens(stats?.total_tokens ?? 0)}</Text>
                      <Text style={styles.meta}>{t('usage.totalTokens')}</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.metric}>${(stats?.total_cost ?? 0).toFixed(4)}</Text>
                      <Text style={styles.meta}>{t('usage.totalCost')}</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.metric}>{stats?.total_calls ?? 0}</Text>
                      <Text style={styles.meta}>{t('usage.totalCalls')}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {t('usage.inputTokens')}: {formatTokens(stats?.total_input_tokens ?? 0)} /{' '}
                    {t('usage.outputTokens')}: {formatTokens(stats?.total_output_tokens ?? 0)}
                  </Text>
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <BarChart3 size={16} color={tk.text.secondary} />
                    <Text style={styles.cardTitle}>{t('usage.dailyTitle')}</Text>
                  </View>
                  {dailyEntries.length === 0 ? (
                    <Text style={styles.muted}>{t('usage.noData')}</Text>
                  ) : (
                    dailyEntries.map(([day, row]) => (
                      <View key={day} style={styles.barRow}>
                        <Text style={styles.barLabel}>{day.slice(5)}</Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: usageBarWidth(row.total_tokens, maxDaily) },
                            ]}
                          />
                        </View>
                        <Text style={styles.barValue}>
                          {formatTokens(row.total_tokens)} · ${row.cost.toFixed(4)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <BarChart3 size={16} color={tk.text.secondary} />
                    <Text style={styles.cardTitle}>{t('usage.modelTitle')}</Text>
                  </View>
                  {modelEntries.length === 0 ? (
                    <Text style={styles.muted}>{t('usage.noData')}</Text>
                  ) : (
                    modelEntries.map(([model, row]) => (
                      <View key={model} style={styles.modelRow}>
                        <View style={styles.modelHead}>
                          <Text style={styles.modelName} numberOfLines={1}>
                            {model}
                          </Text>
                          <Text style={styles.meta}>
                            {formatTokens(row.total_tokens)} · ${row.cost.toFixed(4)}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: usageBarWidth(row.total_tokens, maxModel) },
                            ]}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: 8 },
    title: { marginTop: 8, fontSize: 24, fontWeight: '600', color: tk.text.primary },
    body: { padding: 12, gap: 12, paddingBottom: 32 },
    card: {
      padding: 16,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: 8,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    meta: { fontSize: 12, color: tk.text.tertiary },
    muted: { fontSize: 13, color: tk.text.secondary, lineHeight: 19 },
    quotaRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    quotaCell: { flex: 1, gap: 2 },
    metric: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    track: {
      height: 6,
      borderRadius: rnRadius.xs,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
      marginTop: 4,
    },
    trackFill: { height: '100%', borderRadius: rnRadius.xs },
    statsGrid: { flexDirection: 'row', gap: 8, marginTop: 4 },
    statCell: { flex: 1, gap: 2 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabel: { width: 38, fontSize: 11, color: tk.text.tertiary },
    barTrack: {
      flex: 1,
      height: 6,
      borderRadius: rnRadius.xs,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: rnRadius.xs,
      backgroundColor: tk.brandAccent.deep,
    },
    barValue: { width: 116, textAlign: 'right', fontSize: 11, color: tk.text.secondary },
    modelRow: { gap: 3 },
    modelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    modelName: { flex: 1, fontSize: 12, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
