// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { useMemo, type ReactNode } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
} from 'react-native'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

const NS = 'publishMonitor'

export type MonitorStatusTone = 'ok' | 'failed' | 'running' | 'neutral'

export interface PublishMonitorRowView {
  taskId: string
  title: string
  /** 薄壳按 web publish.platforms.* 键或原值注入的平台名 */
  platformText: string
  statusText: string
  statusTone: MonitorStatusTone
  /** web 只在 status='failed' 时展示(publish/monitor/MonitorCard.tsx:212-216) */
  lastError: string | null
  publishedUrl: string | null
  createdAtText: string
  finishedAtText: string
  /** null = 尚未核验(web `style_check === null`) */
  style: {
    passed: boolean
    verifyAtText: string
    contentLengthText: string
    imagesText: string
    issues: string[]
  } | null
  resubmitCount: number
  /** null = 无互动数据(web `metrics === null`) */
  metrics: {
    viewsText: string
    likesText: string
    commentsText: string
    sharesText: string
    collectedAtText: string
  } | null
}

export interface PublishMonitorScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(三条端点均要求登录,web 未登录时由 api 401 触发登录弹窗) */
  loginRequiredText: string
  loading: boolean
  refreshing: boolean
  error: string | null
  /** 动作结果横幅(web 用 toast 提示核验/采集结果,RN 落为页内横幅) */
  notice: string | null
  rows: PublishMonitorRowView[]
  summary: { success: number; failed: number; unverified: number }
  onRefresh: () => void
  /** 正在核验的 task_id(逐卡互斥,web 用单卡 verifying 态) */
  verifyingTaskId: string | null
  onVerify: (taskId: string) => void
  /** 正在采集指标的 task_id */
  metricsTaskId: string | null
  onRefreshMetrics: (taskId: string) => void
  /** 打开原文(web target=_blank);RN 由薄壳注入 Linking 实现 */
  onOpenUrl: (url: string) => void
  /** 空态「去新建发布」;web 跳 /publish/new */
  onGoCreate: () => void
}

type Styles = ReturnType<typeof createStyles>['styles']

/**
 * 发布监测共享屏 —— 承载 web /publish/monitor
 * (GET /api/publish/monitor/overview + POST .../verify + POST .../refresh-metrics)。
 *
 * 结构与 web 同序:概览三统计(成功/失败/核验未过)→ 刷新 → 逐篇卡片(发布状态 / 样式核验 /
 * 修复重提 / 互动数据四块)。平台无关:取数、逐项 Intl 时间、数字千分位、打开外链、路由跳转
 * 全部由薄壳注入;本文件只管渲染与 loading/error/empty 三态。
 * 状态色板照 web MonitorCard STATUS_STYLE(success=emerald / failed=rose / running=amber /
 * 其余 muted)落到同名 token 档,零硬编码色值。
 */
export function PublishMonitorScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  refreshing,
  error,
  notice,
  rows,
  summary,
  onRefresh,
  verifyingTaskId,
  onVerify,
  metricsTaskId,
  onRefreshMetrics,
  onOpenUrl,
  onGoCreate,
}: PublishMonitorScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles: s, badgeTone, fieldTone } = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={s.container}>
      <View style={s.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={s.titleBox}>
          <Text style={s.title}>{t(`${NS}.title`)}</Text>
          <Text style={s.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={onRefresh} disabled={loading || refreshing}>
          <RefreshCw size={14} color={tk.text.primary} />
          <Text style={s.refreshText}>
            {refreshing || loading ? t(`${NS}.refreshing`) : t(`${NS}.refresh`)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.summaryRow}>
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>{t(`${NS}.summarySuccess`)}</Text>
          <Text style={[s.summaryValue, s.summaryOk]}>{summary.success}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>{t(`${NS}.summaryFailed`)}</Text>
          <Text style={[s.summaryValue, s.summaryFailed]}>{summary.failed}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>{t(`${NS}.summaryUnverified`)}</Text>
          <Text style={[s.summaryValue, s.summaryWarn]}>{summary.unverified}</Text>
        </View>
      </View>

      {notice ? <Text style={s.noticeBox}>{notice}</Text> : null}

      {loginRequiredText ? (
        <Text style={s.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={s.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={s.muted}>{t(`${NS}.refreshing`)}</Text>
        </View>
      ) : error ? (
        <Text style={s.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <View style={s.centerBlock}>
          <BarChart3 size={30} color={tk.text.tertiary} />
          <Text style={s.emptyTitle}>{t(`${NS}.emptyTitle`)}</Text>
          <Text style={s.emptyHint}>{t(`${NS}.emptyHint`)}</Text>
          <TouchableOpacity style={s.createBtn} onPress={onGoCreate}>
            <Plus size={14} color={tk.text.primary} />
            <Text style={s.refreshText}>{t(`${NS}.goCreate`)}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {rows.map((row) => (
            <View key={`${row.taskId}:${row.platformText}`} style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.platformBadge} numberOfLines={1}>
                  {row.platformText}
                </Text>
                <Text style={s.cardTitle} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={[s.statusBadge, badgeTone[row.statusTone]]}>{row.statusText}</Text>
              </View>

              {row.statusTone === 'failed' && row.lastError ? (
                <Text style={s.errorBox}>{row.lastError}</Text>
              ) : null}

              {row.publishedUrl ? (
                <TouchableOpacity
                  style={s.linkRow}
                  onPress={() => onOpenUrl(row.publishedUrl ?? '')}
                >
                  <ExternalLink size={12} color={tk.brandAccent.deep} />
                  <Text style={s.linkText}>{t(`${NS}.openUrl`)}</Text>
                </TouchableOpacity>
              ) : null}

              <Block
                icon={<AlertTriangle size={13} color={tk.text.secondary} />}
                label={t(`${NS}.blockStatus`)}
                s={s}
              >
                <Field label={t(`${NS}.platform`)} value={row.platformText} s={s} />
                <Field label={t(`${NS}.status`)} value={row.statusText} s={s} />
                <Field label={t(`${NS}.publishedAt`)} value={row.createdAtText} s={s} />
                <Field label={t(`${NS}.finishedAt`)} value={row.finishedAtText} s={s} />
              </Block>

              <Block
                icon={
                  row.style?.passed ? (
                    <CheckCircle2 size={13} color={tk.success.deep} />
                  ) : row.style ? (
                    <XCircle size={13} color={tk.danger.DEFAULT} />
                  ) : (
                    <AlertTriangle size={13} color={tk.warning.amber} />
                  )
                }
                label={t(`${NS}.blockVerify`)}
                s={s}
              >
                <Field
                  label={t(`${NS}.verifyAt`)}
                  value={
                    row.style
                      ? row.style.passed
                        ? t(`${NS}.verifyPassed`)
                        : t(`${NS}.verifyFailed`)
                      : t(`${NS}.verifyPending`)
                  }
                  valueStyle={row.style ? (row.style.passed ? fieldTone.ok : fieldTone.failed) : fieldTone.muted}
                  s={s}
                />
                <Field
                  label={t(`${NS}.contentLength`)}
                  value={row.style ? row.style.contentLengthText : '-'}
                  s={s}
                />
                <Field
                  label={t(`${NS}.images`)}
                  value={row.style ? row.style.imagesText : '-'}
                  s={s}
                />
                {row.style && row.style.issues.length > 0 ? (
                  <View style={s.issuesBox}>
                    <Text style={s.fieldLabel}>{t(`${NS}.issues`)}</Text>
                    {row.style.issues.map((issue, index) => (
                      <Text key={`${row.taskId}-issue-${index}`} style={s.issueText}>
                        {`· ${issue}`}
                      </Text>
                    ))}
                  </View>
                ) : row.style ? (
                  <Text style={s.mutedSmall}>{t(`${NS}.noIssues`)}</Text>
                ) : null}
                <TouchableOpacity
                  style={s.blockBtn}
                  disabled={verifyingTaskId !== null}
                  onPress={() => onVerify(row.taskId)}
                >
                  {verifyingTaskId === row.taskId ? (
                    <ActivityIndicator size="small" color={tk.text.primary} />
                  ) : (
                    <Search size={12} color={tk.text.primary} />
                  )}
                  <Text style={s.blockBtnText}>
                    {verifyingTaskId === row.taskId
                      ? t(`${NS}.reVerifying`)
                      : t(`${NS}.reVerify`)}
                  </Text>
                </TouchableOpacity>
              </Block>

              <Block
                icon={<RotateCcw size={13} color={tk.text.secondary} />}
                label={t(`${NS}.blockResubmit`)}
                s={s}
              >
                <View style={s.resubmitRow}>
                  <Text style={s.resubmitValue}>{row.resubmitCount}</Text>
                  <Text style={s.mutedSmall}>{t(`${NS}.resubmitCount`)}</Text>
                </View>
              </Block>

              <Block
                icon={<BarChart3 size={13} color={tk.text.secondary} />}
                label={t(`${NS}.blockMetrics`)}
                s={s}
              >
                {row.metrics ? (
                  <>
                    <View style={s.metricsGrid}>
                      <Metric label={t(`${NS}.metricsViews`)} value={row.metrics.viewsText} s={s} />
                      <Metric label={t(`${NS}.metricsLikes`)} value={row.metrics.likesText} s={s} />
                      <Metric
                        label={t(`${NS}.metricsComments`)}
                        value={row.metrics.commentsText}
                        s={s}
                      />
                      <Metric
                        label={t(`${NS}.metricsShares`)}
                        value={row.metrics.sharesText}
                        s={s}
                      />
                    </View>
                    <Field
                      label={t(`${NS}.metricsCollectedAt`)}
                      value={row.metrics.collectedAtText}
                      s={s}
                    />
                  </>
                ) : (
                  <Text style={s.mutedSmall}>{t(`${NS}.noMetrics`)}</Text>
                )}
                <TouchableOpacity
                  style={s.blockBtn}
                  disabled={metricsTaskId !== null}
                  onPress={() => onRefreshMetrics(row.taskId)}
                >
                  {metricsTaskId === row.taskId ? (
                    <ActivityIndicator size="small" color={tk.text.primary} />
                  ) : (
                    <RotateCcw size={12} color={tk.text.primary} />
                  )}
                  <Text style={s.blockBtnText}>
                    {metricsTaskId === row.taskId
                      ? t(`${NS}.refreshMetricsLoading`)
                      : t(`${NS}.refreshMetrics`)}
                  </Text>
                </TouchableOpacity>
              </Block>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

function Block({
  icon,
  label,
  children,
  s,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
  s: Styles
}) {
  return (
    <View style={s.block}>
      <View style={s.blockHead}>
        {icon}
        <Text style={s.blockLabel}>{label}</Text>
      </View>
      <View style={s.blockBody}>{children}</View>
    </View>
  )
}

function Field({
  label,
  value,
  valueStyle,
  s,
}: {
  label: string
  value: string
  valueStyle?: TextStyle
  s: Styles
}) {
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={[s.fieldValue, valueStyle]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

function Metric({ label, value, s }: { label: string; value: string; s: Styles }) {
  return (
    <View style={s.metricItem}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.mutedSmall}>{label}</Text>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    title: { fontSize: rnType.subtitle.size, fontWeight: '700', color: tk.text.primary },
    subtitle: { fontSize: rnType.caption.size, color: tk.text.secondary },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    refreshText: { fontSize: rnType.label.size, color: tk.text.primary },
    summaryRow: { flexDirection: 'row', gap: rnSpacing.sm, marginTop: rnSpacing.md },
    summaryCard: {
      flex: 1,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    summaryLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    summaryValue: { marginTop: 2, fontSize: rnType.heading.size, fontWeight: '700' },
    summaryOk: { color: tk.success.deep },
    summaryFailed: { color: tk.danger.DEFAULT },
    summaryWarn: { color: tk.warning.amberText },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    emptyTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    emptyHint: { fontSize: rnType.caption.size, color: tk.text.secondary, textAlign: 'center' },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    noticeBox: {
      marginTop: rnSpacing.sm,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    mutedSmall: { fontSize: rnType.caption.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    platformBadge: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    cardTitle: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    statusBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
    },
    errorBox: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.danger.light,
      fontSize: rnType.caption.size,
      color: tk.danger.DEFAULT,
    },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    linkText: { fontSize: rnType.caption.size, color: tk.brandAccent.deep },
    block: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      gap: rnSpacing.xs,
    },
    blockHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    blockLabel: { fontSize: rnType.caption.size, fontWeight: '500', color: tk.text.secondary },
    blockBody: { gap: rnSpacing.xs },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    fieldValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    issuesBox: { gap: 2 },
    issueText: { fontSize: rnType.caption.size, color: tk.danger.DEFAULT },
    blockBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      marginTop: rnSpacing.xs,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    blockBtnText: { fontSize: rnType.caption.size, color: tk.text.primary },
    resubmitRow: { flexDirection: 'row', alignItems: 'baseline', gap: rnSpacing.xs },
    resubmitValue: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.md },
    metricItem: { minWidth: 64 },
    metricValue: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
  })

  const badgeTone: Record<MonitorStatusTone, TextStyle> = {
    ok: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    failed: { backgroundColor: tk.danger.light, color: tk.danger.DEFAULT },
    running: { backgroundColor: tk.warning.amberLight, color: tk.warning.amberText },
    neutral: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
  }

  const fieldTone = {
    ok: { color: tk.success.deep } as TextStyle,
    failed: { color: tk.danger.DEFAULT } as TextStyle,
    muted: { color: tk.text.secondary } as TextStyle,
  }

  return { styles, badgeTone, fieldTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
