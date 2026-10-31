// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「自动做任务」区块(WorkBuddy 任务中心六族)—— 与 web 端
 * apps/web/src/components/checkin/WorkbuddyTaskPanel.tsx 同能力、同口径。
 *
 * 后端契约(已上线,端内不改):
 * - GET  /api/checkin/accounts/{id}/tasks    ⇒ {ok,kind:"list",tasks:[...],reason,unjudged}
 * - POST /api/checkin/accounts/{id}/task-run ⇒ {ok,kind,accepted[],claimed[],credit_delta,
 *                                               energy_delta,reason,unjudged}  body {kind:"all",dry_run}
 * - GET  /api/checkin/scheduler/status       ⇒ 顶层 next_run_wb_tasks + wb_tasks{...,last_sweep}
 *
 * 判据纪律(与后端同口径):
 * - 巡检态判定**不在本文件**:唯一实现 = `@ihui/shared/utils/workbuddy-sweep-view`(三端同一份,
 *   2026-10-31 收三抄漂移),本端只留「档位 → i18n 键」与「档位 → 样式类名」两张映射表。
 * - `enabled` 自 2026-10-31 起是**观测态**(这条 job 真注册在进程里),不再是"两门与";
 *   未运行原因读 `not_running_reason`,旧服务端没给该字段时按判序落「状态未知」而非编原因。
 * - 取不到状态 ≠ 未启用:一律按「状态未知」呈现,不冒充。
 * - 上游响应读不懂时后端回 unjudged=true,面板**不冒充成功**,原样把 reason 摆出来。
 * - 仅当账号池里存在 platform==='workbuddy' 的账号才挂载;否则整块不渲染、零请求。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { rnRadius } from '@ihui/design-tokens'
import type { CheckinSchedulerStatusResponse } from '@ihui/types'
import {
  composeWbSweepText,
  deriveWbSweepView,
  formatWbIsoMinute,
  joinWbSweepParts,
  type WbSweepMessageKey,
  type WbSweepTone,
} from '@ihui/shared/utils/workbuddy-sweep-view'
import * as api from '@/api'
import LineIcon from '@/components/LineIcon'

/** 最小账号形态(只取本区块要用的字段,不耦合页面完整类型)。 */
export interface TaskSectionAccount {
  id: number
  name: string
  platform?: string | null
}

interface TaskRow {
  task_code: string
  title: string | null
  status: string | null
  progress: number | null
  target: number | null
  reward_credit: number | null
}

export interface TaskListResponse {
  ok: boolean
  kind: string
  tasks: TaskRow[]
  reason: string | null
  unjudged: boolean
}

export interface TaskRunResponse {
  ok: boolean
  kind: string
  accepted: string[]
  claimed: string[]
  credit_delta: number | null
  energy_delta?: number | null
  reason: string | null
  unjudged: boolean
}

type Tx = (key: string, params?: Record<string, string | number>) => string

/** 三个动作共用的请求出口(端内不新起 fetch 层,一律走 @/api 既有封装)。 */
export function loadWorkbuddyTasks(accountId: number): Promise<TaskListResponse> {
  return api.get<TaskListResponse>(
    `/checkin/accounts/${encodeURIComponent(String(accountId))}/tasks`,
  )
}

export function loadWorkbuddySchedulerStatus(): Promise<CheckinSchedulerStatusResponse> {
  return api.get<CheckinSchedulerStatusResponse>('/checkin/scheduler/status')
}

/**
 * 一键做任务/预演的请求体。`dry_run:true` 时后端只走只读探针,零写侧调用。
 * kind 恒为 "all"(按后端 SWEEP_ORDER 跑完六族,顺序由后端单一真源决定,端内不排)。
 */
export function workbuddyTaskRunBody(dryRun: boolean): { kind: 'all'; dry_run: boolean } {
  return { kind: 'all', dry_run: dryRun }
}

export function runWorkbuddyTasks(accountId: number, dryRun: boolean): Promise<TaskRunResponse> {
  return api.post<TaskRunResponse>(
    `/checkin/accounts/${encodeURIComponent(String(accountId))}/task-run`,
    workbuddyTaskRunBody(dryRun),
  )
}

/**
 * 巡检态档位:判据在 `@ihui/shared/utils/workbuddy-sweep-view`(三端同一份),本端别名只用于
 * 导出面稳定。七档 = 五结论(on/dry/cron-blocked/tasks-off/not-registered)+ 两未判定态。
 */
export type SweepTone = WbSweepTone

export interface SweepView {
  tone: SweepTone
  text: string
  pathsMissing: boolean
  /** 下次巡检时间(ISO 前 16 位截断;截字符串而非 toLocaleString,避免端/服务端时区差) */
  next: string | null
}

/**
 * 档位 → 本端 i18n 键(判据不在本端,这里只登记"这一档说什么话";七档穷举,漏档编译期即红)。
 * `not-registered`(2026-10-31 新档)= 两门意图都开但观测态为假 ⇒ 出路只有一条:改完 .env
 * 必须重启 ai-service(进程内 start() 有 `if self._started: return` 短路,不会热加载)。
 */
const SWEEP_MESSAGE_KEYS: Record<WbSweepMessageKey, string> = {
  loading: 'checkinAssistant.taskAutoLoading',
  on: 'checkinAssistant.taskAutoOn',
  dry: 'checkinAssistant.taskAutoDry',
  'cron-blocked': 'checkinAssistant.taskAutoCronBlocked',
  'tasks-off': 'checkinAssistant.taskAutoOff',
  'not-registered': 'checkinAssistant.taskAutoNotStarted',
  unknown: 'checkinAssistant.taskAutoUnknown',
}

/**
 * 巡检态渲染决策(纯函数,便于单测):判定整段交给共享判据,本端只做「档位 → 文案」的翻译适配。
 * 取不到状态 ⇒ 「状态未知」,绝不冒充「未启用」。
 */
export function deriveSweepView(
  sweep: CheckinSchedulerStatusResponse | null | undefined,
  sweepError: string | null,
  t: Tx,
): SweepView {
  const decision = deriveWbSweepView(sweep, sweepError)
  return {
    tone: decision.tone,
    text: composeWbSweepText(decision, SWEEP_MESSAGE_KEYS, t),
    pathsMissing: decision.pathsMissing,
    next: decision.next,
  }
}

const TONE_CLASS: Record<SweepTone, string> = {
  on: 'bg-[var(--color-success-light)] text-[var(--color-success-text)]',
  dry: 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]',
  'cron-blocked': 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]',
  // 配置已开却没跑起来:与"被总闸拦"同族(都得动服务端配置并重启),同走告警档。
  'not-registered': 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]',
  'tasks-off': 'bg-muted text-muted-foreground',
  loading: 'bg-muted text-muted-foreground',
  unknown: 'bg-muted text-muted-foreground',
}

/** 六族机器码(与后端 SWEEP_ORDER 同族;此处只作说明行,不参与执行顺序)。 */
const FAMILY_CODES = ['activity', 'growth', 'travel', 'blackcat', 'redeem', 'lottery'] as const

export interface WorkbuddyTaskSectionProps {
  accounts: TaskSectionAccount[]
  t: Tx
}

export function WorkbuddyTaskSection({ accounts, t }: WorkbuddyTaskSectionProps) {
  const wbAccounts = useMemo(
    () => accounts.filter((a) => (a.platform ?? '') === 'workbuddy'),
    [accounts],
  )

  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<TaskRow[] | null>(null)
  const [listReason, setListReason] = useState<string | null>(null)
  const [listUnjudged, setListUnjudged] = useState(false)
  const [busy, setBusy] = useState<'list' | 'dry' | 'run' | null>(null)
  const [result, setResult] = useState<TaskRunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 巡检态:undefined=还没取到;null=取不到(旧服务端/网络失败)⇒「状态未知」,绝不写成未启用。
  const [sweep, setSweep] = useState<CheckinSchedulerStatusResponse | null | undefined>(undefined)
  const [sweepError, setSweepError] = useState<string | null>(null)

  const loadSweep = useCallback(async () => {
    setSweepError(null)
    try {
      const data = await loadWorkbuddySchedulerStatus()
      setSweep(data ?? null)
    } catch (e) {
      setSweep(null)
      setSweepError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // 账号上下线时纠偏选中项:当前选中已不在列表(被删/切平台)⇒ 落回第一个可用的。
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

  // 只有"存在 workbuddy 账号 ∧ 展开"才拉巡检态 ⇒ 无账号时零请求。
  useEffect(() => {
    if (!open || wbAccounts.length === 0) return
    void loadSweep()
  }, [open, wbAccounts.length, loadSweep])

  const loadTasks = useCallback(async () => {
    if (accountId === null) return
    setBusy('list')
    setError(null)
    try {
      const data = await loadWorkbuddyTasks(accountId)
      setTasks(data.tasks ?? [])
      setListReason(data.reason ?? null)
      setListUnjudged(Boolean(data.unjudged))
      if (!data.ok && data.reason) setError(data.reason)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }, [accountId])

  const runAll = useCallback(
    async (dryRun: boolean) => {
      if (accountId === null) return
      setBusy(dryRun ? 'dry' : 'run')
      setError(null)
      setResult(null)
      try {
        const data = await runWorkbuddyTasks(accountId, dryRun)
        setResult(data)
        // 实跑后刷一次列表:写后真值以服务端为准,不用本地推测。
        if (!dryRun) void loadTasks()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(null)
      }
    },
    [accountId, loadTasks],
  )

  const sweepView = deriveSweepView(sweep, sweepError, t)

  // 无 workbuddy 账号 ⇒ 整块不挂载(零请求、零占位)。
  if (wbAccounts.length === 0) return null

  const disabled = busy !== null
  const actionBase = `rounded-lg px-[20rpx] py-[10rpx] text-[length:24rpx]`

  return (
    <View
      className="mt-[24rpx] rounded-lg border border-border bg-card"
      data-testid="wb-task-section"
    >
      <View
        className="flex items-center justify-between p-[24rpx]"
        onClick={() => setOpen((v) => !v)}
        hoverClass="opacity-80"
      >
        <Text className="text-[length:30rpx] font-semibold text-foreground">
          {t('checkinAssistant.taskTitle')}
        </Text>
        <LineIcon name={open ? 'chevron-down' : 'chevron-right'} size={28} />
      </View>

      {open && (
        <View className="border-t border-border p-[24rpx]">
          <Text className="block text-[length:24rpx] leading-[36rpx] text-muted-foreground">
            {t('checkinAssistant.taskDesc')}
          </Text>

          {/* 自动巡检态:让「有没有在自动跑、为什么没跑」直接可读,不必去翻服务端 .env。 */}
          <View
            className={`mt-[16rpx] px-[16rpx] py-[12rpx] ${TONE_CLASS[sweepView.tone]}`}
            style={{ borderRadius: `${rnRadius.md}px` }}
            data-testid="wb-task-sweep"
            data-tone={sweepView.tone}
          >
            <Text className="text-[length:22rpx] font-semibold">
              {t('checkinAssistant.taskAutoTitle')}：
            </Text>
            <Text className="text-[length:22rpx]">{sweepView.text}</Text>
            {sweepView.next ? (
              <Text className="text-[length:22rpx]">
                {' '}
                {t('checkinAssistant.taskAutoNext', { time: sweepView.next })}
              </Text>
            ) : null}
            {sweepView.pathsMissing ? (
              <Text className="mt-[6rpx] block text-[length:22rpx]">
                {t('checkinAssistant.taskAutoPaths')}
              </Text>
            ) : null}
            {/* 上一轮回执:自动跑完却没有回执,用户等于在盲飞。note 非空 = 本轮没跑完,
                原样追加不粉饰(出站暂停/无账号/中途中止)。 */}
            {sweep?.wb_tasks ? (
              <Text className="mt-[6rpx] block text-[length:22rpx]">
                {(() => {
                  const last = sweep.wb_tasks?.last_sweep
                  if (!last) return t('checkinAssistant.taskAutoLastNever')
                  // 分段连接符与 web/RN 同源(三端同一句同一长相,不再各写一份)。
                  return joinWbSweepParts([
                    t('checkinAssistant.taskAutoLast', { time: formatWbIsoMinute(last.at) ?? '—' }),
                    t('checkinAssistant.taskAutoLastStats', {
                      families: last.families,
                      accepted: last.accepted,
                      claimed: last.claimed,
                    }),
                    last.note,
                  ])
                })()}
              </Text>
            ) : null}
          </View>

          {/* 账号选择:小程序无 <select>,用横向 chip(与页面平台选择同一形态)。 */}
          <Text className="mt-[20rpx] block text-[length:24rpx] text-muted-foreground">
            {t('checkinAssistant.taskPick')}
          </Text>
          <View className="mt-[10rpx] flex flex-wrap gap-[12rpx]">
            {wbAccounts.map((a) => (
              <Text
                key={a.id}
                className={`${actionBase} ${
                  accountId === a.id
                    ? 'bg-[var(--color-cta)] text-[var(--color-cta-foreground)]'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => {
                  setAccountId(a.id)
                  setTasks(null)
                  setResult(null)
                  setListReason(null)
                  setListUnjudged(false)
                  setError(null)
                }}
              >
                {a.name}
              </Text>
            ))}
          </View>

          <View className="mt-[16rpx] flex flex-wrap gap-[12rpx]">
            <Text
              className={`${actionBase} ${disabled ? 'opacity-60' : ''} bg-muted text-foreground`}
              onClick={() => {
                if (disabled) return
                void loadTasks()
              }}
            >
              {busy === 'list'
                ? t('checkinAssistant.taskAutoLoading')
                : t('checkinAssistant.taskList')}
            </Text>
            <Text
              className={`${actionBase} ${disabled ? 'opacity-60' : ''} bg-muted text-foreground`}
              onClick={() => {
                if (disabled) return
                void runAll(true)
              }}
            >
              {t('checkinAssistant.taskDryRun')}
            </Text>
            <Text
              className={`${actionBase} bg-[var(--color-cta)] text-[var(--color-cta-foreground)] ${
                disabled ? 'opacity-60' : ''
              }`}
              onClick={() => {
                if (disabled) return
                void runAll(false)
              }}
            >
              {busy === 'run' ? t('checkinAssistant.taskRunning') : t('checkinAssistant.taskRun')}
            </Text>
          </View>

          {error ? (
            <Text className="mt-[16rpx] block rounded-md bg-muted px-[16rpx] py-[12rpx] text-[length:24rpx] text-[var(--color-destructive)]">
              {error}
            </Text>
          ) : null}

          {tasks !== null ? (
            <View className="mt-[16rpx]">
              {tasks.length === 0 ? (
                <Text className="block text-[length:24rpx] text-muted-foreground">
                  {t('checkinAssistant.taskEmpty')}
                </Text>
              ) : (
                tasks.map((task) => (
                  <View
                    key={task.task_code}
                    className="flex flex-wrap items-center justify-between gap-[10rpx] border-b border-border py-[10rpx]"
                  >
                    <View className="flex flex-wrap items-center gap-[10rpx]">
                      <Text className="text-[length:26rpx] font-medium text-foreground">
                        {task.title ?? task.task_code}
                      </Text>
                      <Text className="text-[length:22rpx] text-muted-foreground">
                        {task.task_code}
                      </Text>
                    </View>
                    <View className="flex flex-wrap items-center gap-[12rpx] text-[length:22rpx] text-muted-foreground">
                      {task.progress !== null && task.target !== null ? (
                        <Text className="text-[length:22rpx] text-muted-foreground">
                          {task.progress}/{task.target}
                        </Text>
                      ) : null}
                      {task.reward_credit !== null ? (
                        <Text className="text-[length:22rpx] text-muted-foreground">
                          +{task.reward_credit}
                        </Text>
                      ) : null}
                      <Text className="rounded-sm bg-muted px-[10rpx] py-[4rpx] text-[length:22rpx] text-muted-foreground">
                        {task.status ?? '—'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
              {listReason || listUnjudged ? (
                <Text className="mt-[10rpx] block text-[length:22rpx] text-[var(--color-warning-amber-text)]">
                  {listReason ?? t('checkinAssistant.taskUnjudged')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {result ? (
            <View
              className="mt-[16rpx] border border-border p-[16rpx]"
              style={{ borderRadius: `${rnRadius.md}px` }}
              data-testid="wb-task-result"
            >
              <Text className="block text-[length:26rpx] font-semibold text-foreground">
                {t('checkinAssistant.taskResult')}
              </Text>
              <Text className="mt-[8rpx] block text-[length:22rpx] text-muted-foreground">
                {`accepted=${result.accepted.length} · claimed=${result.claimed.length} · credit_delta=${
                  result.credit_delta === null ? '—' : result.credit_delta
                }${
                  typeof result.energy_delta === 'number'
                    ? ` · energy_delta=${result.energy_delta}`
                    : ''
                } · unjudged=${String(result.unjudged)}`}
              </Text>
              {result.accepted.length > 0 ? (
                <Text className="mt-[8rpx] block text-[length:22rpx] text-muted-foreground">
                  +{result.accepted.join(', ')}
                </Text>
              ) : null}
              {result.claimed.length > 0 ? (
                <Text className="mt-[6rpx] block text-[length:22rpx] text-[var(--color-success-text)]">
                  ✓{result.claimed.join(', ')}
                </Text>
              ) : null}
              {/* unjudged=true ⇒ 上游响应读不懂:把 reason 原样摆出来,**不显示成成功**。 */}
              {result.unjudged ? (
                <Text className="mt-[8rpx] block text-[length:22rpx] text-[var(--color-warning-amber-text)]">
                  {`${t('checkinAssistant.taskUnjudged')}${result.reason ? ` · ${result.reason}` : ''}`}
                </Text>
              ) : result.reason ? (
                <Text className="mt-[8rpx] block text-[length:22rpx] text-muted-foreground">
                  {result.reason}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text className="mt-[12rpx] block text-[length:22rpx] text-muted-foreground">
            {FAMILY_CODES.join(' · ')}
          </Text>
        </View>
      )}
    </View>
  )
}

export default WorkbuddyTaskSection
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
