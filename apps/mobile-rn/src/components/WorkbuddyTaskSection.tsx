// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkbuddyTaskSection —— App(RN)端「自动做任务」区块(2026-10-31 立,补端不一致)。
 *
 * 与 Web `apps/web/src/components/checkin/WorkbuddyTaskPanel.tsx` 同能力、同口径;页面只挂载,
 * 判据全在本文件。后端契约(apps/ai-service/app/routers/checkin.py):
 * - GET  /api/checkin/accounts/{id}/tasks    ⇒ {ok,kind:"list",tasks:[...],reason,unjudged}
 * - POST /api/checkin/accounts/{id}/task-run ⇒ {ok,kind,accepted[],claimed[],credit_delta,
 *                                               energy_delta,reason,unjudged}
 *   body {kind,dry_run};kind="all" = 按后端 SWEEP_ORDER 跑完全部族(顺序由后端单一真源决定,
 *   本端不得自行拆成多次请求)。
 * - GET  /api/checkin/scheduler/status ⇒ {...,wb_tasks:{enabled,tasks_enabled,cron_enabled,
 *   live_run,sweep_minutes,claim_path_configured,activity_path_configured,last_sweep}}
 *
 * 三条不可漂的写法:
 *  ① 只有 platform==='workbuddy' 的账号才挂这一区块;一个都没有 ⇒ 返回 null,零请求(不打空 id);
 *  ② 巡检态 `enabled` 只读 `wb_tasks.enabled`(任务门 ∧ 总闸,这条 job 真会被注册的唯一判据)——
 *     只看 tasks_enabled 会写出「已启用」却根本不会跑的假绿;
 *  ③ unjudged=true 不冒充成功:reason 原样摆出来;取不到巡检态写「状态未知」,不写成「未启用」。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ChevronDown, ListChecks } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { CheckinSchedulerStatusResponse, CheckinWbSweepSummary } from '@ihui/types'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'

/** 最小账号形态(只取本区块要用的字段,不耦合页面的完整账号类型)。 */
export interface WorkbuddyTaskAccount {
  id: number
  name: string
  platform?: string | null
}

export interface WorkbuddyTaskRow {
  task_code: string
  title: string | null
  status: string | null
  progress: number | null
  target: number | null
  reward_credit: number | null
}

export interface WorkbuddyTaskListResponse {
  ok: boolean
  kind: string
  tasks: WorkbuddyTaskRow[]
  reason: string | null
  unjudged: boolean
}

export interface WorkbuddyTaskRunResponse {
  ok: boolean
  kind: string
  accepted: string[]
  claimed: string[]
  credit_delta: number | null
  energy_delta?: number | null
  reason: string | null
  unjudged: boolean
}

/** 巡检态五档:已启用 / 演练模式 / 被总闸拦 / 未启用 / 状态未知。 */
export type SweepTone = 'on' | 'dry' | 'blocked' | 'off' | 'unknown'

export interface SweepView {
  tone: SweepTone
  text: string
  /** 领奖/上报路径缺一 ⇒ 只上报不领奖,必须单独说明 */
  pathsMissing: boolean
  /** 下次巡检时间(已截到分钟),仅已启用时有意义 */
  next: string | null
}

type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * 时间只做字符串截断(ISO 前 16 位),不走 toLocaleString:
 * 后者按设备时区/语言变体输出,同一份回执在不同机器上不可对账。
 */
export function formatIsoMinute(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

/**
 * 巡检态 → 呈现决策(纯函数,渲染与用例共用一份)。
 *
 * `sweep === undefined` = 还没取到(读取中);`null` 或没有 `wb_tasks` = 服务端没给这份
 * 视图 ⇒ 「状态未知」,**绝不**降级成「未启用」。
 */
export function deriveSweepView(
  sweep: CheckinSchedulerStatusResponse | null | undefined,
  sweepError: string | null,
  t: Translate,
): SweepView {
  if (sweep === undefined) {
    return { tone: 'unknown', text: t('checkinAssistant.taskAutoLoading'), pathsMissing: false, next: null }
  }
  const wt = sweep?.wb_tasks
  if (!wt) {
    return {
      tone: 'unknown',
      text: sweepError
        ? `${t('checkinAssistant.taskAutoUnknown')}: ${sweepError}`
        : t('checkinAssistant.taskAutoUnknown'),
      pathsMissing: false,
      next: null,
    }
  }
  const pathsMissing = !wt.claim_path_configured || !wt.activity_path_configured
  const iso = sweep?.next_run_wb_tasks
  const next = iso ? formatIsoMinute(iso) : null
  // 两门与 = 唯一可信判据。未启用时再按两门原值把「配了却没跑」的原因分开说。
  if (!wt.enabled) {
    if (wt.tasks_enabled && !wt.cron_enabled) {
      return { tone: 'blocked', text: t('checkinAssistant.taskAutoCronBlocked'), pathsMissing, next: null }
    }
    return { tone: 'off', text: t('checkinAssistant.taskAutoOff'), pathsMissing, next: null }
  }
  if (!wt.live_run) {
    return { tone: 'dry', text: t('checkinAssistant.taskAutoDry'), pathsMissing, next }
  }
  return {
    tone: 'on',
    text: t('checkinAssistant.taskAutoOn', { minutes: wt.sweep_minutes }),
    pathsMissing,
    next,
  }
}

/**
 * 上一轮回执文案。`last_sweep` 缺席 = 本进程还没跑过(写「尚未巡检」,不是「失败」);
 * `note` 非空 = 本轮没跑完,原样追加,不粉饰。
 */
export function deriveLastSweepText(last: CheckinWbSweepSummary | null | undefined, t: Translate): string {
  if (!last) return t('checkinAssistant.taskAutoLastNever')
  const at = typeof last.at === 'string' ? formatIsoMinute(last.at) : '—'
  const head = t('checkinAssistant.taskAutoLast', { time: at })
  const stats = t('checkinAssistant.taskAutoLastStats', {
    families: last.families,
    accepted: last.accepted,
    claimed: last.claimed,
  })
  return `${head} · ${stats}${last.note ? ` · ${last.note}` : ''}`
}

export function WorkbuddyTaskSection({
  accounts,
  busyAccountId = null,
}: {
  accounts: WorkbuddyTaskAccount[]
  /** 页面已有的账号级忙态(签到/启停/删除占着该账号);命中时本区块按钮一并禁用,不并发写同一账号 */
  busyAccountId?: number | null
}) {
  const { t } = useI18n()
  const wbAccounts = useMemo(
    () => accounts.filter((a) => (a.platform ?? '') === 'workbuddy'),
    [accounts],
  )

  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<WorkbuddyTaskRow[] | null>(null)
  const [listReason, setListReason] = useState<string | null>(null)
  const [listUnjudged, setListUnjudged] = useState(false)
  const [busy, setBusy] = useState<'list' | 'dry' | 'run' | null>(null)
  const [result, setResult] = useState<WorkbuddyTaskRunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  // undefined = 还没取到;null = 服务端版本较旧/请求失败 ⇒ 按「状态未知」呈现(§0.3)。
  const [sweep, setSweep] = useState<CheckinSchedulerStatusResponse | null | undefined>(undefined)
  const [sweepError, setSweepError] = useState<string | null>(null)

  const loadSweep = useCallback(async () => {
    setSweepError(null)
    try {
      const res = await fetchApi<CheckinSchedulerStatusResponse>('/api/checkin/scheduler/status')
      if (!res.success) {
        setSweep(null)
        setSweepError(res.error || null)
        return
      }
      setSweep(res.data)
    } catch (e) {
      setSweep(null)
      setSweepError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    // 折叠态不取巡检态:无 WorkBuddy 账号时零请求也由这里与下方 return null 双保险。
    if (!open || wbAccounts.length === 0) return
    void loadSweep()
  }, [open, wbAccounts.length, loadSweep])

  // 账号上下线时纠偏选中项:当前选中已不在列表(被删/改平台)⇒ 落回第一个可用的。
  useEffect(() => {
    if (wbAccounts.length === 0) {
      if (accountId !== null) setAccountId(null)
      return
    }
    if (accountId === null || !wbAccounts.some((a) => a.id === accountId)) {
      setAccountId(wbAccounts[0]?.id ?? null)
      setTasks(null)
      setResult(null)
      setListReason(null)
      setError(null)
    }
  }, [wbAccounts, accountId])

  const loadTasks = useCallback(async () => {
    if (accountId === null) return
    setBusy('list')
    setError(null)
    try {
      const res = await fetchApi<WorkbuddyTaskListResponse>(
        `/api/checkin/accounts/${accountId}/tasks`,
      )
      if (!res.success) throw new Error(res.error || 'request failed')
      setTasks(res.data?.tasks ?? [])
      setListReason(res.data?.reason ?? null)
      setListUnjudged(Boolean(res.data?.unjudged))
      if (!res.data?.ok && res.data?.reason) setError(res.data.reason)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }, [accountId])

  const runAll = useCallback(
    async (mode: 'dry' | 'run') => {
      if (accountId === null) return
      setBusy(mode)
      setError(null)
      setResult(null)
      try {
        const res = await fetchApi<WorkbuddyTaskRunResponse>(
          `/api/checkin/accounts/${accountId}/task-run`,
          { method: 'POST', body: JSON.stringify({ kind: 'all', dry_run: mode === 'dry' }) },
        )
        if (!res.success) throw new Error(res.error || 'request failed')
        setResult(res.data)
        // 实跑后刷一次列表:mutation 后的真实态以服务端为准,不做本地推测。
        if (mode === 'run') await loadTasks()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(null)
      }
    },
    [accountId, loadTasks],
  )

  const sweepView = useMemo(() => deriveSweepView(sweep, sweepError, t), [sweep, sweepError, t])
  const lastSweepText = useMemo(
    () => (sweep?.wb_tasks ? deriveLastSweepText(sweep.wb_tasks.last_sweep ?? null, t) : null),
    [sweep, t],
  )

  // 无 WorkBuddy 账号 ⇒ 整块不渲染(页面不需要在外层再判一次,也保证零请求)。
  if (wbAccounts.length === 0) return null

  const blocked = busy !== null || (accountId !== null && busyAccountId === accountId)
  const toneStyle =
    sweepView.tone === 'on'
      ? styles.sweepOn
      : sweepView.tone === 'dry' || sweepView.tone === 'blocked'
        ? styles.sweepWarn
        : styles.sweepIdle
  const toneTextStyle =
    sweepView.tone === 'on'
      ? styles.sweepOnText
      : sweepView.tone === 'dry' || sweepView.tone === 'blocked'
        ? styles.sweepWarnText
        : styles.sweepIdleText

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.head}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('checkinAssistant.taskTitle')}
      >
        <View style={styles.headLeft}>
          <ListChecks size={16} color={tokens.brand.DEFAULT ?? tokens.text.primary} />
          <Text style={styles.cardTitle}>{t('checkinAssistant.taskTitle')}</Text>
        </View>
        <ChevronDown
          size={16}
          color={tokens.text.secondary}
          style={open ? styles.chevronOpen : undefined}
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.body}>
          <Text style={styles.muted}>{t('checkinAssistant.taskDesc')}</Text>

          <View style={[styles.sweep, toneStyle]}>
            <Text style={[styles.sweepLine, toneTextStyle]}>
              <Text style={styles.sweepLabel}>{t('checkinAssistant.taskAutoTitle')}: </Text>
              {sweepView.text}
            </Text>
            {sweepView.next ? (
              <Text style={[styles.sweepLine, styles.mono, toneTextStyle]}>
                {t('checkinAssistant.taskAutoNext', { time: sweepView.next })}
              </Text>
            ) : null}
            {sweepView.pathsMissing ? (
              <Text style={[styles.sweepLine, toneTextStyle]}>
                {t('checkinAssistant.taskAutoPaths')}
              </Text>
            ) : null}
            {lastSweepText ? (
              <Text style={[styles.sweepLine, toneTextStyle]}>{lastSweepText}</Text>
            ) : null}
          </View>

          <Text style={styles.label}>{t('checkinAssistant.taskPick')}</Text>
          <View style={styles.chips}>
            {wbAccounts.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.chip, accountId === a.id && styles.chipOn]}
                onPress={() => {
                  setAccountId(a.id)
                  setTasks(null)
                  setResult(null)
                  setListReason(null)
                  setError(null)
                }}
              >
                <Text
                  style={[styles.chipText, accountId === a.id && styles.chipOnText]}
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.action, blocked && styles.actionOff]}
              disabled={blocked}
              onPress={() => void loadTasks()}
            >
              <Text style={styles.actionText}>{t('checkinAssistant.taskList')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, blocked && styles.actionOff]}
              disabled={blocked}
              onPress={() => void runAll('dry')}
            >
              <Text style={styles.actionText}>{t('checkinAssistant.taskDryRun')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, styles.actionPrimary, blocked && styles.actionOff]}
              disabled={blocked}
              onPress={() => void runAll('run')}
            >
              <Text style={styles.actionPrimaryText}>
                {busy === 'run'
                  ? t('checkinAssistant.taskRunning')
                  : t('checkinAssistant.taskRun')}
              </Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {tasks !== null ? (
            <View style={styles.list}>
              {tasks.length === 0 ? (
                <Text style={styles.muted}>{t('checkinAssistant.taskEmpty')}</Text>
              ) : (
                tasks.map((task) => (
                  <View key={task.task_code} style={styles.taskRow}>
                    <Text style={styles.taskTitle} numberOfLines={2}>
                      {task.title ?? task.task_code}
                      <Text style={styles.taskCode}> {task.task_code}</Text>
                    </Text>
                    <Text style={styles.taskMeta}>
                      {task.progress !== null && task.target !== null
                        ? `${task.progress}/${task.target} `
                        : ''}
                      {task.reward_credit !== null ? `+${task.reward_credit} ` : ''}
                      {task.status ?? '—'}
                    </Text>
                  </View>
                ))
              )}
              {listReason || listUnjudged ? (
                <Text style={styles.warn}>
                  {listReason ?? t('checkinAssistant.taskUnjudged')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {result ? (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>{t('checkinAssistant.taskResult')}</Text>
              <Text style={styles.mono}>
                {`ok=${String(result.ok)} · accepted=${result.accepted.length} · claimed=${result.claimed.length} · credits=${result.credit_delta === null ? '—' : result.credit_delta} · unjudged=${String(result.unjudged)}`}
              </Text>
              {result.accepted.length > 0 ? (
                <Text style={styles.mono}>{`+${result.accepted.join(', ')}`}</Text>
              ) : null}
              {result.claimed.length > 0 ? (
                <Text style={styles.claimed}>{`✓ ${result.claimed.join(', ')}`}</Text>
              ) : null}
              {result.reason ? <Text style={styles.muted}>{result.reason}</Text> : null}
              {/* unjudged 不冒充成功:单独一条警示,reason 原样摆出来(上面那条)。 */}
              {result.unjudged ? (
                <Text style={styles.warn}>{t('checkinAssistant.taskUnjudged')}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    padding: 14,
    gap: rnSpacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rnSpacing.sm,
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs, flexShrink: 1 },
  cardTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: { gap: rnSpacing.sm, paddingTop: rnSpacing['2xs'] },
  muted: { fontSize: rnType.label.size, color: tokens.text.secondary, lineHeight: 18 },
  mono: {
    fontSize: rnType.caption.size,
    color: tokens.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  warn: { fontSize: rnType.caption.size, color: tokens.warning.amberText },
  error: {
    fontSize: rnType.label.size,
    color: tokens.error.text,
    backgroundColor: tokens.error.bg,
    borderRadius: rnRadius.md,
    paddingHorizontal: rnSpacing['xs-loose'],
    paddingVertical: rnSpacing['2xs'],
  },
  sweep: {
    borderRadius: rnRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: rnSpacing['xs-loose'],
    paddingVertical: rnSpacing['xs-loose'],
    gap: rnSpacing['2xs'],
  },
  sweepOn: { backgroundColor: tokens.success.light, borderColor: tokens.success.DEFAULT },
  sweepWarn: { backgroundColor: tokens.warning.light, borderColor: tokens.warning.DEFAULT },
  sweepIdle: { backgroundColor: tokens.surface.muted, borderColor: tokens.border.light },
  sweepLine: { fontSize: rnType.caption.size, lineHeight: 16 },
  sweepLabel: { fontWeight: '600' },
  sweepOnText: { color: tokens.success.deepText },
  sweepWarnText: { color: tokens.warning.amberText },
  sweepIdleText: { color: tokens.text.secondary },
  label: { fontSize: rnType.label.size, color: tokens.text.secondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
  chip: {
    paddingHorizontal: rnSpacing['sm-loose'],
    paddingVertical: rnSpacing['xs-loose'],
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  chipOn: { backgroundColor: tokens.brand.cta },
  chipText: { fontSize: rnType.label.size, color: tokens.text.secondary },
  chipOnText: { color: tokens.brand.ctaForeground ?? tokens.surface.bg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
  action: {
    paddingHorizontal: rnSpacing['sm-loose'],
    paddingVertical: rnSpacing['xs-loose'],
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  actionOff: { opacity: 0.5 },
  actionText: { fontSize: rnType.label.size, color: tokens.text.primary },
  actionPrimary: { backgroundColor: tokens.brand.cta },
  actionPrimaryText: {
    fontSize: rnType.label.size,
    fontWeight: '600',
    color: tokens.brand.ctaForeground ?? tokens.surface.bg,
  },
  list: {
    borderRadius: rnRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    paddingHorizontal: rnSpacing['xs-loose'],
    paddingVertical: rnSpacing['2xs'],
    gap: rnSpacing.xs,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: rnSpacing.sm },
  taskTitle: { flexShrink: 1, fontSize: rnType.caption.size, color: tokens.text.primary },
  taskCode: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  taskMeta: { fontSize: rnType.caption.size, color: tokens.text.secondary },
  result: {
    borderRadius: rnRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    paddingHorizontal: rnSpacing['xs-loose'],
    paddingVertical: rnSpacing['xs-loose'],
    gap: rnSpacing['2xs'],
  },
  resultTitle: { fontSize: rnType.label.size, fontWeight: '600', color: tokens.text.primary },
  claimed: { fontSize: rnType.caption.size, color: tokens.success.deep },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
