// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 全栈原子回滚面板(P3 #42 阶段3,2026-09-17 立)。
 * 选工作区 → 快照列表 → 预演 diff(dry-run 零写入)→ 勾选确认后执行,
 * 逐 step 审计展示;迁移降级/依赖重装仅展示建议,不自动执行。
 */

import * as React from 'react'
import { Loader2, Play, ShieldCheck, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Badge, Input, Label } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface SnapshotMeta {
  id: string
  createdAt: string
  description: string
  fileCount: number
  skippedCount: number
}

interface RollbackPlan {
  restore: { path: string }[]
  remove: { path: string }[]
  unchanged: number
  uncovered: { path: string; reason: string }[]
  newMigrationFiles: string[]
  totals: { restoreBytes: number }
}

interface RollbackResult {
  ok: boolean
  steps: { step: string; path: string; status: string; output: string }[]
  suggestedFollowUps: string[]
}

interface SnapshotApiItem {
  id: string
  createdAt: string
  description: string
  files: { path: string }[]
  skipped: { path: string; reason: string }[]
}

export function AtomicRollbackPanel() {
  const t = useTranslations('atomicRollback')
  const toast = useToast()
  const [workspacePath, setWorkspacePath] = React.useState('')
  const [snapshots, setSnapshots] = React.useState<SnapshotMeta[]>([])
  const [loading, setLoading] = React.useState(false)
  const [planning, setPlanning] = React.useState(false)
  const [plan, setPlan] = React.useState<RollbackPlan | null>(null)
  const [planId, setPlanId] = React.useState<string | null>(null)
  const [executing, setExecuting] = React.useState(false)
  const [result, setResult] = React.useState<RollbackResult | null>(null)
  const [confirmed, setConfirmed] = React.useState(false)

  const loadSnapshots = React.useCallback(async () => {
    if (!workspacePath.trim()) return
    setLoading(true)
    setPlan(null)
    setResult(null)
    try {
      const res = await fetchApi<{ checkpoints: SnapshotApiItem[] }>(
        `/api/workspace/atomic-checkpoints?workspacePath=${encodeURIComponent(workspacePath.trim())}`,
      )
      const items = (res.success && res.data ? res.data.checkpoints : []).map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        description: c.description,
        fileCount: c.files.length,
        skippedCount: c.skipped.length,
      }))
      setSnapshots(items)
    } catch {
      setSnapshots([])
      toast.error(t('toastLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [workspacePath, t, toast])

  const runPlan = async (id: string) => {
    setPlanning(true)
    setPlan(null)
    setResult(null)
    try {
      const res = await fetchApi<RollbackPlan>('/api/workspace/atomic-rollback/plan', {
        method: 'POST',
        body: JSON.stringify({ workspacePath: workspacePath.trim(), checkpointId: id }),
      })
      setPlan(res.success && res.data ? res.data : null)
      setPlanId(id)
    } catch {
      toast.error(t('toastPlanFailed'))
    } finally {
      setPlanning(false)
    }
  }

  const runExecute = async () => {
    if (!planId || !confirmed) return
    setExecuting(true)
    try {
      const res = await fetchApi<RollbackResult>('/api/workspace/atomic-rollback/execute', {
        method: 'POST',
        body: JSON.stringify({
          workspacePath: workspacePath.trim(),
          checkpointId: planId,
          confirm: true,
        }),
      })
      const data = res.success && res.data ? res.data : null
      setResult(data)
      if (data?.ok) {
        toast.success(t('toastRunOk'))
        await loadSnapshots()
      } else {
        toast.error(t('toastRunFail'))
      }
    } catch {
      toast.error(t('toastRunFail'))
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="space-y-3 px-1 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="atomic-ws">{t('workspacePath')}</Label>
        <div className="flex gap-2">
          <Input
            id="atomic-ws"
            value={workspacePath}
            onChange={(e) => setWorkspacePath(e.target.value)}
            placeholder={t('workspacePlaceholder')}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSnapshots()}
            disabled={loading || !workspacePath.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {t('loadList')}
          </Button>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div className="rounded-md bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshots.map((s) => (
            <div key={s.id} className="rounded-md border border-border bg-card p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {s.id}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('fileCount', { count: s.fileCount })}
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  className="ml-auto"
                  onClick={() => void runPlan(s.id)}
                  disabled={planning}
                >
                  {planning && planId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                  {t('plan')}
                </Button>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      )}

      {plan && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="text-sm font-medium">{t('planTitle')}</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="border-transparent bg-primary/10 text-primary hover:bg-primary/10">
              {t('restoreCount', { count: plan.restore.length })}
            </Badge>
            <Badge className="border-transparent bg-destructive/15 text-destructive hover:bg-destructive/15">
              {t('removeCount', { count: plan.remove.length })}
            </Badge>
            <Badge className="border-transparent bg-muted text-muted-foreground hover:bg-muted">
              {t('unchangedCount', { count: plan.unchanged })}
            </Badge>
          </div>
          {plan.newMigrationFiles.length > 0 && (
            <p className="text-xs text-amber-600">
              {t('migrationWarn', { files: plan.newMigrationFiles.slice(0, 3).join(', ') })}
            </p>
          )}
          {plan.uncovered.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('uncoveredWarn', { count: plan.uncovered.length })}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              id="atomic-confirm"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <label htmlFor="atomic-confirm" className="text-xs text-muted-foreground">
              {t('confirmLabel')}
            </label>
            <Button
              size="xs"
              className="ml-auto"
              onClick={() => void runExecute()}
              disabled={!confirmed || executing}
            >
              {executing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {t('execute')}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-1.5 rounded-md border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Badge
              className={
                result.ok
                  ? 'border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15'
                  : 'border-transparent bg-destructive/15 text-destructive hover:bg-destructive/15'
              }
            >
              {result.ok ? t('runOk') : t('runFail')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t('stepCount', { count: result.steps.length })}
            </span>
          </div>
          {result.suggestedFollowUps.map((f, i) => (
            <p key={i} className="text-xs text-amber-600">
              {f}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
