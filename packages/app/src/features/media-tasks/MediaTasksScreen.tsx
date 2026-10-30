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
  Ban,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  Eraser,
  PlayCircle,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

const NS = 'mediaTasksPage'

export type MediaTaskTone = 'running' | 'ok' | 'failed' | 'neutral'

export interface MediaTaskRowView {
  /** 稳定 key:优先上游 task_id,空则用本地 id */
  key: string
  kindText: string
  statusText: string
  statusTone: MediaTaskTone
  tool: string
  /** 薄壳按 web 同参 Intl(MM/DD HH:mm)格式化 */
  createdAtText: string
  message: string | null
  /** 空串表示尚未提交到 provider,web 此时不显示任务 ID 行 */
  taskId: string
  /** 产物可播放/下载时的直链(web resultUrl) */
  resultUrl: string | null
  /** 在途 = 可取消(与 web STATUS_IN_FLIGHT 同集合) */
  inFlight: boolean
}

export interface MediaTaskStatsView {
  total: number
  inflight: number
  succeeded: number
  failed: number
  cancelled: number
}

export interface MediaTasksScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(web 用 useAuthGate 挡在个性化数据区之前,page.tsx:70-71/283-285) */
  loginRequiredText: string
  loading: boolean
  refreshing: boolean
  error: string | null
  /** 动作结果横幅(web clearInfo 同口径,page.tsx:428-432) */
  notice: string | null
  stats: MediaTaskStatsView | null
  rows: MediaTaskRowView[]
  statusFilter: string
  kindFilter: string
  onStatusFilter: (value: string) => void
  onKindFilter: (value: string) => void
  page: number
  pages: number
  total: number
  onPrev: () => void
  onNext: () => void
  onRefresh: () => void
  cancellingTaskId: string | null
  deletingTaskId: string | null
  onCancel: (taskId: string) => void
  onDelete: (taskId: string) => void
  cancelAllBusy: boolean
  onCancelAll: () => void
  canCancelAll: boolean
  clearBusy: boolean
  onClear: () => void
  canClear: boolean
  /** 播放/下载外链(web <a download target=_blank>);RN 由薄壳注入 Linking */
  onOpenUrl: (url: string) => void
}

type Styles = ReturnType<typeof createStyles>['styles']

/** 与 web 同值集(page.tsx:213-226);statusProcessing 用后端在途集合的逗号串 */
const STATUS_FILTER_KEYS = [
  { value: '', label: 'statusAll' },
  { value: 'processing,accepted,submitted,pending', label: 'statusProcessing' },
  { value: 'succeeded', label: 'statusSucceeded' },
  { value: 'failed,cancelled', label: 'statusFailedCancelled' },
] as const

const KIND_FILTER_KEYS = [
  { value: '', label: 'kindAll' },
  { value: 'video', label: 'kindVideo' },
  { value: 'music', label: 'kindMusic' },
  { value: 'tts', label: 'kindTts' },
  { value: 'image', label: 'kindImage' },
] as const

/**
 * 媒体任务共享屏 —— 承载 web /media-tasks(GET /api/media/tasks + /stats + 取消/删除/清理)。
 *
 * 覆盖 web 主路径(列表视图 + 统计概览 + 状态/类型过滤 + 产物播放/下载 + 在途取消 + 删除 +
 * 批量取消在途 + 清理终态 + 分页)。web 的「看板」第二视图(TaskKanban)本屏不承载,
 * 已在 manifest note 如实登记。平台无关:取数、分页游标、Intl 时间、确认弹窗(Alert)、
 * 打开外链全部由薄壳注入;本文件只渲染 loading/error/empty 三态。
 * 徽章色照 web 同档(在途 blue / 成功 green / 失败 red / 取消 muted)落 token。
 */
export function MediaTasksScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  refreshing,
  error,
  notice,
  stats,
  rows,
  statusFilter,
  kindFilter,
  onStatusFilter,
  onKindFilter,
  page,
  pages,
  total,
  onPrev,
  onNext,
  onRefresh,
  cancellingTaskId,
  deletingTaskId,
  onCancel,
  onDelete,
  cancelAllBusy,
  onCancelAll,
  canCancelAll,
  clearBusy,
  onClear,
  canClear,
  onOpenUrl,
}: MediaTasksScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles: s, badgeTone } = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={s.container}>
      <View style={s.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={s.titleBox}>
          <View style={s.titleRow}>
            <Clapperboard size={20} color={tk.brand.DEFAULT} />
            <Text style={s.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={s.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={s.loginHint}>{loginRequiredText}</Text>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          <View style={s.actionRow}>
            <ActionPill
              label={cancelAllBusy ? t(`${NS}.cancellingAll`) : t(`${NS}.cancelAll`)}
              disabled={cancelAllBusy || !canCancelAll}
              busy={cancelAllBusy}
              icon={<Ban size={13} color={tk.text.primary} />}
              s={s}
              onPress={onCancelAll}
            />
            <ActionPill
              label={clearBusy ? t(`${NS}.clearing`) : t(`${NS}.clearDone`)}
              disabled={clearBusy || !canClear}
              busy={clearBusy}
              icon={<Eraser size={13} color={tk.text.primary} />}
              s={s}
              onPress={onClear}
            />
            <ActionPill
              label={refreshing || loading ? t(`${NS}.loading`) : t(`${NS}.refresh`)}
              disabled={refreshing || loading}
              busy={refreshing}
              icon={<RefreshCw size={13} color={tk.text.primary} />}
              s={s}
              onPress={onRefresh}
            />
          </View>

          <View style={s.statsRow}>
            <StatCard
              filter=""
              active={statusFilter === ''}
              label={t(`${NS}.statsTotal`)}
              value={stats?.total ?? 0}
              toneStyle={s.statPlain}
              onPress={() => onStatusFilter('')}
              s={s}
            />
            <StatCard
              filter={STATUS_FILTER_KEYS[1].value}
              active={statusFilter === STATUS_FILTER_KEYS[1].value}
              label={t(`${NS}.statsInflight`)}
              value={stats?.inflight ?? 0}
              toneStyle={s.statRunning}
              onPress={() => onStatusFilter(STATUS_FILTER_KEYS[1].value)}
              s={s}
            />
            <StatCard
              filter="succeeded"
              active={statusFilter === 'succeeded'}
              label={t(`${NS}.statsSucceeded`)}
              value={stats?.succeeded ?? 0}
              toneStyle={s.statOk}
              onPress={() => onStatusFilter('succeeded')}
              s={s}
            />
            <StatCard
              filter="failed"
              active={statusFilter === 'failed'}
              label={t(`${NS}.statsFailed`)}
              value={stats?.failed ?? 0}
              toneStyle={s.statFailed}
              onPress={() => onStatusFilter('failed')}
              s={s}
            />
            <StatCard
              filter="cancelled"
              active={statusFilter === 'cancelled'}
              label={t(`${NS}.statsCancelled`)}
              value={stats?.cancelled ?? 0}
              toneStyle={s.statMuted}
              onPress={() => onStatusFilter('cancelled')}
              s={s}
            />
          </View>

          <View style={s.chipRow}>
            {STATUS_FILTER_KEYS.map((f) => (
              <Chip
                key={`status-${f.value}`}
                active={statusFilter === f.value}
                label={t(`${NS}.${f.label}`)}
                onPress={() => onStatusFilter(f.value)}
                s={s}
              />
            ))}
          </View>
          <View style={s.chipRow}>
            {KIND_FILTER_KEYS.map((f) => (
              <Chip
                key={`kind-${f.value}`}
                active={kindFilter === f.value}
                label={t(`${NS}.${f.label}`)}
                onPress={() => onKindFilter(f.value)}
                s={s}
              />
            ))}
          </View>

          {notice ? <Text style={s.noticeBox}>{notice}</Text> : null}

          {loading ? (
            <View style={s.centerBlock}>
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              <Text style={s.muted}>{t(`${NS}.loading`)}</Text>
            </View>
          ) : error ? (
            <Text style={s.error}>{error}</Text>
          ) : rows.length === 0 ? (
            <View style={s.centerBlock}>
              <Clapperboard size={30} color={tk.text.tertiary} />
              <Text style={s.muted}>{t(`${NS}.empty`)}</Text>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.key} style={s.taskCard}>
                <View style={s.taskHead}>
                  <Text style={s.badge}>{row.kindText}</Text>
                  <Text style={[s.badge, badgeTone[row.statusTone]]}>{row.statusText}</Text>
                  <Text style={s.mono}>{row.tool}</Text>
                  <Text style={s.mutedSmall}>{row.createdAtText}</Text>
                </View>

                <View style={s.taskActions}>
                  {row.resultUrl ? (
                    <>
                      <Text style={s.playable}>
                        <PlayCircle size={11} color={tk.success.deep} /> {t(`${NS}.playable`)}
                      </Text>
                      <ActionPill
                        label={t(`${NS}.download`)}
                        disabled={false}
                        busy={false}
                        icon={<Download size={12} color={tk.text.primary} />}
                        s={s}
                        onPress={() => onOpenUrl(row.resultUrl ?? '')}
                      />
                    </>
                  ) : null}
                  {row.inFlight && row.taskId ? (
                    <ActionPill
                      label={
                        cancellingTaskId === row.taskId ? t(`${NS}.cancelling`) : t(`${NS}.cancel`)
                      }
                      disabled={cancellingTaskId !== null}
                      busy={cancellingTaskId === row.taskId}
                      icon={<XCircle size={12} color={tk.text.primary} />}
                      s={s}
                      onPress={() => onCancel(row.taskId)}
                    />
                  ) : null}
                  {row.taskId ? (
                    <ActionPill
                      label={deletingTaskId === row.taskId ? t(`${NS}.deleting`) : t(`${NS}.delete`)}
                      disabled={deletingTaskId !== null}
                      busy={deletingTaskId === row.taskId}
                      icon={<Trash2 size={12} color={tk.danger.DEFAULT} />}
                      s={s}
                      onPress={() => onDelete(row.taskId)}
                    />
                  ) : null}
                </View>

                {row.message ? <Text style={s.message}>{row.message}</Text> : null}
                {row.taskId ? (
                  <Text style={s.monoBlock}>{`${t(`${NS}.taskId`)}: ${row.taskId}`}</Text>
                ) : null}
              </View>
            ))
          )}

          {!loading && !error && pages > 1 ? (
            <View style={s.pager}>
              <Text style={s.mutedSmall}>{t(`${NS}.total`, { total })}</Text>
              <View style={s.pagerBtns}>
                <ActionPill
                  label={t(`${NS}.prev`)}
                  disabled={page <= 1}
                  busy={false}
                  icon={<ChevronLeft size={11} color={tk.text.primary} />}
                  s={s}
                  onPress={onPrev}
                />
                <Text style={s.mutedSmall}>{t(`${NS}.pageInfo`, { page, pages })}</Text>
                <ActionPill
                  label={t(`${NS}.next`)}
                  disabled={page >= pages}
                  busy={false}
                  icon={<ChevronRight size={11} color={tk.text.primary} />}
                  s={s}
                  onPress={onNext}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

function ActionPill({
  label,
  disabled,
  busy,
  icon,
  s,
  onPress,
}: {
  label: string
  disabled: boolean
  busy: boolean
  icon: ReactNode
  s: Styles
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[s.pill, disabled && s.pillDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      {busy ? <ActivityIndicator size="small" color={s.pillText.color} /> : icon}
      <Text style={s.pillText}>{label}</Text>
    </TouchableOpacity>
  )
}

function Chip({
  active,
  label,
  onPress,
  s,
}: {
  active: boolean
  label: string
  onPress: () => void
  s: Styles
}) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

function StatCard({
  active,
  label,
  value,
  toneStyle,
  onPress,
  s,
}: {
  filter: string
  active: boolean
  label: string
  value: number
  toneStyle: TextStyle
  onPress: () => void
  s: Styles
}) {
  return (
    <TouchableOpacity style={[s.statCard, active && s.statCardActive]} onPress={onPress}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, toneStyle]}>{value}</Text>
    </TouchableOpacity>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: rnType.subtitle.size, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { gap: rnSpacing.sm, paddingBottom: rnSpacing['2xl'] },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    statCard: {
      flexGrow: 1,
      minWidth: 96,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    statCardActive: { borderColor: tk.brand.DEFAULT },
    statLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    statValue: { marginTop: 2, fontSize: rnType.heading.size, fontWeight: '700' },
    statPlain: { color: tk.text.primary },
    statRunning: { color: tk.brandAccent.deep },
    statOk: { color: tk.success.deep },
    statFailed: { color: tk.danger.DEFAULT },
    statMuted: { color: tk.text.secondary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    chip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.card },
    chipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    chipTextActive: { color: tk.text.primary, fontWeight: '600' },
    noticeBox: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary, textAlign: 'center' },
    mutedSmall: { fontSize: rnType.caption.size, color: tk.text.secondary },
    error: { paddingVertical: rnSpacing.lg, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    taskCard: {
      gap: rnSpacing.xs,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    taskHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: rnSpacing.xs },
    badge: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    mono: { fontSize: rnType.caption.size, color: tk.text.secondary },
    monoBlock: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    playable: { fontSize: rnType.caption.size, color: tk.success.deep },
    taskActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    message: { fontSize: rnType.caption.size, color: tk.text.secondary },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    pillDisabled: { opacity: 0.45 },
    pillText: { fontSize: rnType.caption.size, color: tk.text.primary },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    pagerBtns: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
  })

  const badgeTone: Record<MediaTaskTone, TextStyle> = {
    running: { backgroundColor: tk.brandAccent.light, color: tk.brandAccent.deep },
    ok: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    failed: { backgroundColor: tk.danger.light, color: tk.danger.DEFAULT },
    neutral: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
  }

  return { styles, badgeTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
