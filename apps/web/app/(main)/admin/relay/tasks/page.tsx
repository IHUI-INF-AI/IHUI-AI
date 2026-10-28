// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 号池任务中心(2026-10-27 立,号池对标缺口清单第 4 项,机主定案「观测面+手动触发」)。
 *
 * 数据源 GET /api/admin/relay/account-pool/tasks(四载体聚合:bullmq×3/guardian×2/
 * schtasks×1/apscheduler×1);不新造调度器、不落执行历史表(服务端 relay-task-center.ts
 * 边界定案)。每行:任务名/载体徽章/频率/上次执行(成败色)/下次执行/触发按钮;
 * 状态源读不到 ⇒ 黄条如实显示未判定原因(§0.3 不冒绿)。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Play, RefreshCw, Zap } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { BackButton } from '@/components/common'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import {
  WORKBUDDY_TASK_KINDS,
  fetchWorkbuddyAccounts,
  fetchWorkbuddyTasks,
  runWorkbuddyTask,
  type WorkbuddyTaskKind,
  type WorkbuddyTaskRunView,
} from '@/lib/relay-task-center'

interface RelayTask {
  id: string
  name: string
  carrier: 'bullmq' | 'guardian' | 'schtasks' | 'apscheduler'
  schedule: string
  cron?: string
  triggerable: boolean
  note?: string
  schedulable: boolean
  sourceOk: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunOk: boolean | null
  lastRunDetail: string | null
  indeterminateReason: string | null
}

const CARRIER_LABEL: Record<RelayTask['carrier'], string> = {
  bullmq: 'BullMQ',
  guardian: 'guardian 守护',
  schtasks: '计划任务',
  apscheduler: 'ai-service',
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

export default function RelayTasksPage() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['relay-task-center'],
    queryFn: async () => {
      return apiOrThrow<{ tasks: RelayTask[] }>('/api/admin/relay/account-pool/tasks').then(
        (d) => d.tasks,
      )
    },
    refetchInterval: 60_000,
  })

  const runMut = useMutation({
    mutationFn: async (id: string) => {
      return apiOrThrow<{ id: string; detail: string }>(
        `/api/admin/relay/account-pool/tasks/${id}/run`,
        { method: 'POST' },
      )
    },
    onSuccess: (r) => toast.success(`已触发:${r.detail}`),
    onError: (e: Error) => toast.error(`触发失败:${e.message}`),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['relay-task-center'] }),
  })

  const tasks = query.data ?? []

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">号池任务中心</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            四类载体的周期任务一张表:上次执行/下次执行/成败。调度仍由各载体自己承载,此处只观测与手动触发。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BackButton />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            刷新
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
          <Loader2 className="size-4 animate-spin" /> 加载中…
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="px-3 py-2 font-medium">任务</th>
                <th className="px-3 py-2 font-medium">载体</th>
                <th className="px-3 py-2 font-medium">频率</th>
                <th className="px-3 py-2 font-medium">上次执行</th>
                <th className="px-3 py-2 font-medium">下次执行</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.name}</div>
                    {t.indeterminateReason && (
                      <div className="mt-1 text-xs text-amber-600">
                        ⚠ 未判定:{t.indeterminateReason}
                      </div>
                    )}
                    {!t.indeterminateReason && t.lastRunDetail && (
                      <div className="text-muted-foreground mt-1 text-xs">{t.lastRunDetail}</div>
                    )}
                    {t.note && (
                      <div className="text-muted-foreground mt-1 text-xs">出路:{t.note}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {CARRIER_LABEL[t.carrier]}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">{t.schedule}</td>
                  <td className="px-3 py-2">
                    <div>{fmtTime(t.lastRunAt)}</div>
                    {t.lastRunOk === false && (
                      <div className="text-xs text-red-600">失败:{t.lastRunDetail}</div>
                    )}
                    {t.lastRunOk === true && !t.indeterminateReason && (
                      <div className="text-xs text-emerald-600">正常</div>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {fmtTime(t.nextRunAt)}
                  </td>
                  <td className="px-3 py-2">
                    {t.triggerable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={runMut.isPending}
                        onClick={() => runMut.mutate(t.id)}
                      >
                        {runMut.isPending && runMut.variables === t.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Play className="size-4" />
                        )}
                        触发
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WorkbuddyAutomation />
    </div>
  )
}

/**
 * WorkBuddy 任务自动化(O68,2026-10-29 立):账号下拉 + 任务清单观测 + 按 kind 手动触发。
 * 定案不变(观测面+手动触发,无新调度器);触发默认预览(干跑开关常开),正式执行需显式关断。
 * unjudged 显式渲染为「未判定」徽章,绝不与"无任务/0 增量"混同;失败(reason/HTTP 错误)标红。
 */
function WorkbuddyAutomation() {
  const t = useTranslations('admin.relayTasks')
  // kind → 文案(逐键显式,不拿模板串过 typed next-intl)
  const kindLabel = React.useCallback(
    (kind: WorkbuddyTaskKind): string =>
      kind === 'growth'
        ? t('wbKindGrowth')
        : kind === 'travel'
          ? t('wbKindTravel')
          : kind === 'activity'
            ? t('wbKindActivity')
            : t('wbKindBlackcat'),
    [t],
  )
  const qc = useQueryClient()
  const [accountId, setAccountId] = React.useState('')
  const [dryRun, setDryRun] = React.useState(true)
  const [lastRun, setLastRun] = React.useState<WorkbuddyTaskRunView | null>(null)

  const accounts = useQuery({
    queryKey: ['relay-workbuddy-accounts'],
    queryFn: fetchWorkbuddyAccounts,
    staleTime: 60_000,
  })
  React.useEffect(() => {
    if (!accountId && accounts.data && accounts.data.length > 0) {
      setAccountId(accounts.data[0]!.id)
    }
  }, [accountId, accounts.data])

  const tasks = useQuery({
    queryKey: ['relay-workbuddy-tasks', accountId],
    queryFn: () => fetchWorkbuddyTasks(accountId),
    enabled: Boolean(accountId),
  })

  const runMut = useMutation({
    mutationFn: (kind: WorkbuddyTaskKind) => runWorkbuddyTask(accountId, kind, dryRun),
    onSuccess: (r) => {
      setLastRun(r)
      if (r.ok && !r.unjudged) toast.success(t('wbRunOk'))
      else if (!r.unjudged) toast.error(`${t('wbRunFailed')}:${r.reason ?? ''}`)
      void qc.invalidateQueries({ queryKey: ['relay-workbuddy-tasks', accountId] })
    },
    onError: (e: Error) => toast.error(`${t('wbRunFailed')}:${e.message}`),
  })

  const view = tasks.data
  const taskRows = view?.tasks ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('wbTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-sm">{t('wbAccount')}</span>
          <Select value={accountId} onValueChange={setAccountId} disabled={accounts.isPending}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t('wbAccountEmpty')} />
            </SelectTrigger>
            <SelectContent>
              {(accounts.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={dryRun} onCheckedChange={(v) => setDryRun(v === true)} />
            {t('wbDryRun')}
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void tasks.refetch()}
            disabled={!accountId || tasks.isFetching}
          >
            {tasks.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t('wbRefresh')}
          </Button>
        </div>

        {/* 清单三态:未判定(琥珀)/失败读取(红)/判过(绿底数据,空表如实说空) */}
        {!accountId ? (
          <p className="text-muted-foreground text-sm">{t('wbNoAccount')}</p>
        ) : tasks.isPending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t('wbLoading')}
          </p>
        ) : tasks.isError ? (
          <p className="text-sm text-red-600">
            {t('wbReadFailed')}:{tasks.error.message}
          </p>
        ) : view?.unjudged ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-amber-500/15 px-1 text-[10px] font-semibold leading-none text-amber-600 tabular-nums">
              {t('wbUnjudged')}
            </span>
            <span className="text-muted-foreground text-xs">{view.reason ?? ''}</span>
          </div>
        ) : taskRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('wbNoTasks')}</p>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="px-3 py-2 font-medium">{t('wbColTask')}</th>
                  <th className="px-3 py-2 font-medium">{t('wbColProgress')}</th>
                  <th className="px-3 py-2 font-medium">{t('wbColStatus')}</th>
                  <th className="px-3 py-2 font-medium">{t('wbColReward')}</th>
                </tr>
              </thead>
              <tbody>
                {taskRows.map((tk) => (
                  <tr key={tk.taskCode} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <span className="font-medium">{tk.title}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{tk.taskCode}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {tk.progress !== null && tk.target !== null
                        ? `${tk.progress}/${tk.target}`
                        : t('wbUnjudged')}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {[tk.status, tk.acceptStatus].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      <span
                        className={
                          tk.rewardCredit !== null && tk.rewardCredit > 0
                            ? 'text-emerald-600'
                            : undefined
                        }
                      >
                        {tk.rewardCredit !== null ? `+${tk.rewardCredit}` : t('wbUnjudged')}
                      </span>
                      {tk.rewardEnergy !== null && (
                        <span className="text-muted-foreground ml-2 inline-flex items-center gap-0.5">
                          <Zap className="size-3" />
                          {tk.rewardEnergy}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 按 kind 手动触发 + 最近一次结果 */}
        <div className="flex flex-wrap items-center gap-2">
          {WORKBUDDY_TASK_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="outline"
              disabled={!accountId || runMut.isPending}
              onClick={() => runMut.mutate(kind)}
            >
              {runMut.isPending && runMut.variables === kind ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {kindLabel(kind)}
            </Button>
          ))}
        </div>
        <div className="text-sm">
          {!lastRun ? (
            <span className="text-muted-foreground">{t('wbNeverRun')}</span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{kindLabel(lastRun.kind)}:</span>
              {lastRun.unjudged ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-amber-500/15 px-1 text-[10px] font-semibold leading-none text-amber-600 tabular-nums">
                  {t('wbUnjudged')}
                </span>
              ) : lastRun.ok ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-emerald-500/15 px-1 text-[10px] font-semibold leading-none text-emerald-600 tabular-nums">
                  {t('wbRunOk')}
                </span>
              ) : (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-red-500/15 px-1 text-[10px] font-semibold leading-none text-red-600 tabular-nums">
                  {t('wbRunFailed')}
                </span>
              )}
              <span className="text-muted-foreground text-xs">
                {t('wbAccepted')} {lastRun.accepted.length} · {t('wbClaimed')}{' '}
                {lastRun.claimed.length}
              </span>
              <span className="text-xs tabular-nums">
                {t('wbCreditDelta')}:{' '}
                <span
                  className={
                    lastRun.creditDelta === null
                      ? 'text-amber-600'
                      : lastRun.creditDelta >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                  }
                >
                  {lastRun.creditDelta === null ? t('wbUnjudged') : lastRun.creditDelta}
                </span>
              </span>
              <span className="text-xs tabular-nums">
                {t('wbEnergyDelta')}:{' '}
                <span
                  className={lastRun.energyDelta === null ? 'text-amber-600' : 'text-emerald-600'}
                >
                  {lastRun.energyDelta === null ? t('wbUnjudged') : lastRun.energyDelta}
                </span>
              </span>
              {lastRun.reason && (
                <span className="text-muted-foreground text-xs">{lastRun.reason}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
