// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Agent Plan 任务进度(Plan Mode 审批门控闭环可视化,对标 Claude Code Plan Mode)。
// 后端未提供 plan 列表端点(GET /api/agent-plan/{id} 需已知 plan_id),故本页以
// "最近查看(浏览器 localStorage)"作伪列表 + 手动输入 plan_id 打开:
//   GET /api/agent-plan/{id}                      计划详情(状态/内容/结果)
//   GET /api/agent-plan/{id}/versions             版本历史(可切换版本)
//   GET /api/agent-plan/{id}/tasks                任务勾选态 + done/total 进度摘要
//   GET /api/agent-plan/{id}/versions/diff        版本差异
// 后端:ai-service routers/agent_plan.py。

'use client'

import * as React from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  CircleX,
  FileText,
  Layers,
  Loader2,
  ListChecks,
  Search,
} from 'lucide-react'

import {
  fetchPlanDetail,
  fetchPlanTasks,
  fetchPlanVersionDiff,
  fetchPlanVersions,
  type PlanDetail,
  type PlanTasksResult,
  type PlanVersionsResult,
} from '@/api/agent-plan-api'

const RECENT_KEY = 'agentPlan.recent.v1'

interface RecentPlan {
  plan_id: string
  goal: string
  status: string
  done: number
  total: number
  at: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  executing: '执行中',
  done: '已完成',
  failed: '失败',
}

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: '待办',
  done: '已完成',
  blocked: '阻塞',
}

function loadRecent(): RecentPlan[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const arr = raw ? (JSON.parse(raw) as RecentPlan[]) : []
    return Array.isArray(arr) ? arr.slice(0, 20) : []
  } catch {
    return []
  }
}

export default function AgentPlanProgressPage() {
  const [planId, setPlanId] = React.useState('')
  const [recent, setRecent] = React.useState<RecentPlan[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const [detail, setDetail] = React.useState<PlanDetail | null>(null)
  const [tasksData, setTasksData] = React.useState<PlanTasksResult | null>(null)
  const [versionsData, setVersionsData] = React.useState<PlanVersionsResult | null>(null)
  const [selectedVersion, setSelectedVersion] = React.useState(1)
  const [diff, setDiff] = React.useState('')
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [diffError, setDiffError] = React.useState('')

  React.useEffect(() => {
    setRecent(loadRecent())
  }, [])

  const updateRecent = (d: PlanDetail, s: PlanTasksResult) => {
    setRecent((prev) => {
      const next: RecentPlan[] = [
        {
          plan_id: d.plan_id,
          goal: d.goal,
          status: d.status,
          done: s.summary?.done ?? 0,
          total: s.summary?.total ?? 0,
          at: new Date().toISOString(),
        },
        ...prev.filter((p) => p.plan_id !== d.plan_id),
      ].slice(0, 20)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* 忽略存储失败 */
      }
      return next
    })
  }

  const loadPlan = React.useCallback(async (id: string) => {
    if (!id.trim()) return
    setLoading(true)
    setError('')
    setDiff('')
    setDiffError('')
    const pid = id.trim()
    try {
      const [d, t, v] = await Promise.all([
        fetchPlanDetail(pid),
        fetchPlanTasks(pid),
        fetchPlanVersions(pid),
      ])
      setDetail(d)
      setTasksData(t)
      setVersionsData(v)
      setSelectedVersion(v.current_version ?? 1)
      updateRecent(d, t)
    } catch (e) {
      setDetail(null)
      setTasksData(null)
      setVersionsData(null)
      setError(e instanceof Error ? e.message : '加载计划失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const openRecent = (p: RecentPlan) => {
    setPlanId(p.plan_id)
    void loadPlan(p.plan_id)
  }

  const selectVersion = async (v: number) => {
    if (!detail || v === selectedVersion) return
    setSelectedVersion(v)
    setDiff('')
    setDiffError('')
    setDiffLoading(true)
    try {
      const d = await fetchPlanVersionDiff(detail.plan_id, 1, v)
      setDiff(d.diff || '(两版本内容一致)')
    } catch (e) {
      setDiff('')
      setDiffError(e instanceof Error ? e.message : '加载版本差异失败')
    } finally {
      setDiffLoading(false)
    }
  }

  const backToList = () => {
    setDetail(null)
    setTasksData(null)
    setVersionsData(null)
    setDiff('')
    setDiffError('')
    setError('')
  }

  const done = tasksData?.summary?.done ?? 0
  const total = tasksData?.summary?.total ?? 0
  const blocked = tasksData?.summary?.blocked ?? 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // 详情视图
  if (detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={backToList}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> 返回列表
        </button>
        <div className="mb-6 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Plan 任务进度</h1>
        </div>

        {error && (
          <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <CircleX className="h-4 w-4" /> {error}
          </p>
        )}

        {/* 计划元信息 */}
        <div className="rounded-xl border p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{detail.goal}</span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              <span
                className={`h-2 w-2 rounded-full ${
                  detail.status === 'failed' || detail.status === 'rejected'
                    ? 'bg-destructive'
                    : detail.status === 'executing'
                      ? 'animate-pulse bg-primary'
                      : detail.status === 'done'
                        ? 'bg-emerald-500'
                        : 'bg-muted-foreground'
                }`}
              />
              {STATUS_LABEL[detail.status] || detail.status}
            </span>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">plan_id</dt>
              <dd className="break-all">
                <code className="rounded bg-muted px-1">{detail.plan_id}</code>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">当前版本</dt>
              <dd>v{detail.version}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">创建时间</dt>
              <dd>{detail.created_at || '-'}</dd>
            </div>
            {detail.updated_at && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 text-muted-foreground">更新时间</dt>
                <dd>{detail.updated_at}</dd>
              </div>
            )}
            {detail.result && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 text-muted-foreground">执行结果</dt>
                <dd className="whitespace-pre-wrap break-all text-muted-foreground">
                  {JSON.stringify(detail.result, null, 2)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* 任务进度 */}
        <div className="mt-4 rounded-xl border p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="h-4 w-4" /> 任务进度
          </h2>
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span className="font-medium">
              {done}/{total}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
          {total > 0 && blocked > 0 && (
            <p className="mb-2 text-xs text-muted-foreground">其中阻塞 {blocked}</p>
          )}
          {tasksData && tasksData.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无任务,可稍后在“计划工作台”生成任务后刷新查看。
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tasksData?.tasks.map((t) => (
                <li
                  key={t.task_id}
                  className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      t.status === 'done'
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-muted-foreground/40 text-transparent'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  <span className={t.status === 'done' ? 'text-muted-foreground line-through' : ''}>
                    {t.order}. {t.title}
                  </span>
                  <span
                    className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs ${
                      t.status === 'done'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : t.status === 'blocked'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {TASK_STATUS_LABEL[t.status] || t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 版本历史 */}
        <div className="mt-4 rounded-xl border p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4" /> 版本历史(点击切换查看差异)
          </h2>
          {versionsData && versionsData.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无版本记录</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {versionsData?.versions.map((v) => (
                <button
                  key={v.version}
                  onClick={() => void selectVersion(v.version)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted ${
                    v.version === selectedVersion ? 'border-primary bg-primary/10' : ''
                  }`}
                >
                  v{v.version}
                  {v.version === versionsData.current_version && (
                    <span className="rounded bg-primary/10 px-1 text-[10px] text-primary">
                      当前
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {versionsData && versionsData.versions.length > 0 && (
            <div className="mt-3 border-t pt-2 text-xs">
              <p className="mb-1 text-muted-foreground">
                当前查看 v{selectedVersion} 与 v1 的差异
                {selectedVersion === 1 ? '(与自身比较, 无差异)' : ''}:
              </p>
              {diffLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 加载差异…
                </div>
              ) : diffError ? (
                <p className="text-destructive">{diffError}</p>
              ) : diff ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 leading-relaxed">
                  {diff}
                </pre>
              ) : (
                <p className="text-muted-foreground">选择非当前版本查看差异。</p>
              )}
            </div>
          )}
          {versionsData && (
            <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
              {versionsData.versions.map((v) => (
                <li key={v.version}>
                  v{v.version} · {v.channel} · {v.reason || '-'} · {v.created_at}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  // 列表/输入视图
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Plan 任务进度</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        查看计划任务勾选态与版本演进。输入 plan_id 打开某份计划,或点击下方最近查看。
      </p>

      <div className="mb-6 flex items-center gap-2">
        <input
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void loadPlan(planId)}
          placeholder="输入 plan_id 打开计划"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={() => void loadPlan(planId)}
          disabled={loading || !planId.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          打开
        </button>
      </div>

      {error && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CircleX className="h-4 w-4" /> {error}
        </p>
      )}

      <div className="rounded-xl border p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4" /> 最近查看({recent.length})
        </h2>
        {recent.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <FileText className="h-5 w-5" /> 尚无记录,输入 plan_id 打开后会自动保存到这里
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((p) => (
              <li key={p.plan_id}>
                <button
                  onClick={() => openRecent(p)}
                  className="w-full rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-muted/30"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <code className="truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {p.plan_id.slice(0, 24)}
                    </code>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">
                      <span
                        className={`h-2 w-2 rounded-full ${p.status === 'done' ? 'bg-emerald-500' : p.status === 'executing' ? 'animate-pulse bg-primary' : 'bg-muted-foreground'}`}
                      />
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-sm font-medium">{p.goal || '(无目标描述)'}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {p.total > 0 && (
                      <span>
                        任务 {p.done}/{p.total}
                      </span>
                    )}
                    <span>{p.at}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
