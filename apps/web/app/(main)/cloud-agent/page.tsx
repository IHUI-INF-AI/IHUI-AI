// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 云托管 Agent 会话(Cloud Agent Sessions,对标 OpenAI Codex Cloud)。
// 流程:加载 GET /api/cloud-runs 历史列表(run_id/任务/状态/时间/输出摘要),
// 点条目进详情 GET /api/cloud-runs/{run_id}(含完整最终输出/状态/起止时间)。
// 后端:ai-service router/cloud_runs.py(持久化 data/cloud_runs.json)。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Clock, Loader2, RefreshCw, Cloud, FileText } from 'lucide-react'

import { fetchApi } from '@/lib/api'

interface CloudRun {
  run_id: string
  task: string
  status: 'running' | 'done' | 'error'
  agent_type?: string
  output_summary?: string
  output?: string
  error?: string
  session_alias?: string
  user_id?: string
  started_at?: string
  ended_at?: string
}

interface RunListData {
  list: CloudRun[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

export default function CloudAgentPage() {
  const t = useTranslations('cloudRuns')
  const [data, setData] = React.useState<RunListData | null>(null)
  const [selected, setSelected] = React.useState<CloudRun | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  // 加载历史列表(供列表页/刷新用)
  const loadList = React.useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    const res = await fetchApi<RunListData>(`/api/cloud-runs?page=${page}&page_size=${PAGE_SIZE}`)
    setLoading(false)
    if (res.success && res.data) {
      setData(res.data)
    } else {
      setError((res as { message?: string }).message || t('loadFailed'))
    }
  }, [t])

  // 打开某条运行详情
  const openDetail = React.useCallback(async (run: CloudRun) => {
    setLoading(true)
    setError('')
    const res = await fetchApi<CloudRun>(`/api/cloud-runs/${run.run_id}`)
    setLoading(false)
    if (res.success && res.data) {
      setSelected(res.data)
    } else {
      setError((res as { message?: string }).message || t('loadFailed'))
    }
  }, [t])

  React.useEffect(() => {
    void loadList(1)
  }, [loadList])

  const statusLabel = (s: CloudRun['status']) =>
    s === 'running' ? t('running') : s === 'done' ? t('done') : t('error')
  const statusDot = (s: CloudRun['status']) =>
    s === 'error'
      ? 'bg-destructive'
      : s === 'running'
        ? 'animate-pulse bg-primary'
        : 'bg-emerald-500'

  // 详情视图
  if (selected) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={() => setSelected(null)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> {t('back')}
        </button>
        <div className="mb-6 flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('detailTitle')}</h1>
        </div>

        <div className="rounded-xl border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{t('runId')}</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <span className={`h-2 w-2 rounded-full ${statusDot(selected.status)}`} />
              {statusLabel(selected.status)}
            </span>
          </div>
          <p className="mb-3 text-sm">
            <code className="rounded bg-muted px-1">{selected.run_id}</code>
          </p>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">{t('agentType')}</dt>
              <dd className="font-medium">{selected.agent_type || 'loop_v2'}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">{t('sessionAlias')}</dt>
              <dd className="break-all">{selected.session_alias || '-'}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">{t('startTime')}</dt>
              <dd>{selected.started_at || '-'}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">{t('endTime')}</dt>
              <dd>{selected.ended_at || '-'}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" /> {t('task')}
          </h2>
          <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{selected.task || '-'}</p>
        </div>

        <div className="mt-4 rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" /> {t('output')}
          </h2>
          {selected.output ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{selected.output}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">{selected.status === 'running' ? t('runningHint') : t('noOutput')}</p>
          )}
          {selected.error && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{selected.error}</p>}
        </div>
      </div>
    )
  }

  // 列表视图
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <button
          onClick={() => void loadList(data?.page ?? 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t('refresh')}
        </button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{t('subtitle')}</p>

      {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
        </div>
      ) : !data || data.list.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
          <Cloud className="h-5 w-5" /> {t('empty')}
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {data.list.map((run) => (
              <li key={run.run_id}>
                <button
                  onClick={() => void openDetail(run)}
                  className="w-full rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-muted/30"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <code className="truncate rounded bg-muted px-1 text-xs text-muted-foreground">
                      {run.run_id.slice(0, 18)}
                    </code>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className={`h-2 w-2 rounded-full ${statusDot(run.status)}`} />
                      {statusLabel(run.status)}
                    </span>
                  </div>
                  <p className="mb-1 line-clamp-2 text-sm font-medium">
                    {run.task ? run.task : t('noTask')}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {run.started_at || '-'}
                    </span>
                    {run.output_summary && (
                      <span className="line-clamp-1 text-muted-foreground">{run.output_summary}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() => void loadList(Math.max(1, (data.page ?? 1) - 1))}
                disabled={(data.page ?? 1) <= 1}
                className="rounded-lg border px-3 py-1 transition hover:bg-muted disabled:opacity-40"
              >
                {t('prev')}
              </button>
              <span className="text-muted-foreground">
                {t('pagination', { page: data.page, totalPages, total: data.total })}
              </span>
              <button
                onClick={() => void loadList(Math.min(totalPages, (data.page ?? 1) + 1))}
                disabled={(data.page ?? 1) >= totalPages}
                className="rounded-lg border px-3 py-1 transition hover:bg-muted disabled:opacity-40"
              >
                {t('next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
