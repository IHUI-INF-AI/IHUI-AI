'use client'

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ListChecks, Loader2, PlayCircle, RefreshCw } from 'lucide-react'

import { Button, Label } from '@ihui/ui-react'

import { fetchAiServiceJson } from '@/lib/api'

/**
 * 「自动做任务」面板(WorkBuddy 任务中心六族)。
 *
 * 后端契约(apps/ai-service/app/routers/checkin.py):
 * - GET  /api/checkin/accounts/{id}/tasks    ⇒ {ok,kind:"list",tasks:[...],reason,unjudged}
 * - POST /api/checkin/accounts/{id}/task-run ⇒ {ok,kind,accepted[],claimed[],credit_delta,
 *                                               energy_delta,reason,unjudged,families?}
 *   body {kind, dry_run};kind="all" = 按后端 SWEEP_ORDER 顺序跑完六族
 *   (activity→growth→travel→blackcat→redeem→lottery,顺序由后端单一真源决定)。
 *
 * 判据纪律(与后端同口径):上游响应读不懂时后端回 unjudged=true,面板**不冒充成功**,
 * 原样把 reason 摆出来;dry-run 仅只读探针,零写侧调用。
 */

/** 最小账号形态(只取面板要用的字段,不耦合 api-client 的完整类型)。 */
export interface TaskPanelAccount {
  id: number
  name: string
  platform?: string | null
  enabled?: boolean
}

interface TaskRow {
  task_code: string
  title: string | null
  status: string | null
  progress: number | null
  target: number | null
  reward_credit: number | null
}

interface TaskListResponse {
  ok: boolean
  kind: string
  tasks: TaskRow[]
  reason: string | null
  unjudged: boolean
}

interface TaskRunResponse {
  ok: boolean
  kind: string
  accepted: string[]
  claimed: string[]
  credit_delta: number | null
  reason: string | null
  unjudged: boolean
}

const KIND_LABEL: Record<string, string> = {
  activity: 'activity',
  growth: 'growth',
  travel: 'travel',
  blackcat: 'blackcat',
  redeem: 'redeem',
  lottery: 'lottery',
}

export function WorkbuddyTaskPanel({ accounts }: { accounts: TaskPanelAccount[] }) {
  const t = useTranslations('checkin')
  const wbAccounts = React.useMemo(
    () => accounts.filter((a) => (a.platform ?? '') === 'workbuddy'),
    [accounts],
  )

  const [open, setOpen] = React.useState(false)
  const [accountId, setAccountId] = React.useState<number | null>(null)
  const [tasks, setTasks] = React.useState<TaskRow[] | null>(null)
  const [listReason, setListReason] = React.useState<string | null>(null)
  const [unjudged, setUnjudged] = React.useState(false)
  const [busy, setBusy] = React.useState<'list' | 'dry' | 'run' | null>(null)
  const [result, setResult] = React.useState<TaskRunResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // 账号上下线时纠偏选中项:当前选中已不在列表(被删/切平台)⇒ 落回第一个可用的。
  React.useEffect(() => {
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

  const loadTasks = React.useCallback(async () => {
    if (accountId === null) return
    setBusy('list')
    setError(null)
    try {
      const res = await fetchAiServiceJson<TaskListResponse>(
        `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/tasks`,
      )
      if (!res.success || res.data === undefined) throw new Error(res.error || 'request failed')
      const data = res.data
      setTasks(data.tasks ?? [])
      setListReason(data.reason ?? null)
      setUnjudged(Boolean(data.unjudged))
      if (!data.ok && data.reason) setError(data.reason)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }, [accountId])

  const runFamily = React.useCallback(
    async (mode: 'dry' | 'run') => {
      if (accountId === null) return
      setBusy(mode)
      setError(null)
      setResult(null)
      try {
        const res = await fetchAiServiceJson<TaskRunResponse>(
          `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/task-run`,
          {
            method: 'POST',
            body: JSON.stringify({ kind: 'all', dry_run: mode === 'dry' }),
          },
        )
        if (!res.success || res.data === undefined) throw new Error(res.error || 'request failed')
        setResult(res.data)
        // 实跑后刷一次列表:mutation 后的真实态以服务端为准,不用本地推测。
        if (mode === 'run') void loadTasks()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(null)
      }
    },
    [accountId, loadTasks],
  )

  if (wbAccounts.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-primary" />
          {t('taskPanelTitle')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('taskPanelNoAccount')}</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-primary" />
          {t('taskPanelTitle')}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">{t('taskPanelDesc')}</p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem]">
              <Label htmlFor="wb-task-account" className="text-xs text-muted-foreground">
                {t('taskPanelPick')}
              </Label>
              <select
                id="wb-task-account"
                className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                value={accountId ?? ''}
                onChange={(e) => {
                  setAccountId(Number(e.target.value))
                  setTasks(null)
                  setResult(null)
                  setListReason(null)
                  setError(null)
                }}
              >
                {wbAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void loadTasks()}
            >
              {busy === 'list' ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              {t('taskPanelList')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void runFamily('dry')}
            >
              {t('taskPanelDryRun')}
            </Button>
            <Button size="sm" disabled={busy !== null} onClick={() => void runFamily('run')}>
              {busy === 'run' ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <PlayCircle className="mr-1 h-3 w-3" />
              )}
              {busy === 'run' ? t('taskPanelRunning') : t('taskPanelRun')}
            </Button>
          </div>

          {error && (
            <p className="mt-3 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {error}
            </p>
          )}

          {tasks !== null && (
            <div className="mt-3">
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('taskPanelEmpty')}</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {tasks.map((task) => (
                    <li
                      key={task.task_code}
                      className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 text-xs"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{task.title ?? task.task_code}</span>
                        <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                          {task.task_code}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {task.progress !== null && task.target !== null && (
                          <span className="font-mono">
                            {task.progress}/{task.target}
                          </span>
                        )}
                        {task.reward_credit !== null && (
                          <span className="font-mono">+{task.reward_credit}</span>
                        )}
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          {task.status ?? '—'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(listReason || unjudged) && (
                <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-500">
                  {listReason ?? 'unjudged'}
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="mt-3 rounded-md border border-border px-2 py-1.5 text-xs">
              <p className="font-semibold">{t('taskPanelResult')}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span>ok={String(result.ok)}</span>
                <span>accepted={result.accepted.length}</span>
                <span>claimed={result.claimed.length}</span>
                <span>credits={result.credit_delta === null ? '—' : result.credit_delta}</span>
                <span>unjudged={String(result.unjudged)}</span>
              </p>
              {result.accepted.length > 0 && (
                <p className="mt-1 break-all text-[11px] text-muted-foreground">
                  +{result.accepted.join(', ')}
                </p>
              )}
              {result.claimed.length > 0 && (
                <p className="mt-0.5 break-all text-[11px] text-green-600 dark:text-green-500">
                  ✓{result.claimed.join(', ')}
                </p>
              )}
              {result.reason && (
                <p className="mt-1 break-all text-[11px] text-muted-foreground">{result.reason}</p>
              )}
            </div>
          )}

          <p className="mt-2 text-[11px] text-muted-foreground">
            {Object.values(KIND_LABEL).join(' · ')}
          </p>
        </div>
      )}
    </section>
  )
}
