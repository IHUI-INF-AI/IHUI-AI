// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 验证自愈驾驶舱(2-3 产品化第一批):任务描述 + 目标路径 → POST /api/self-healing/run
// → 展示 HealOutcome(attempts/run_history/patch_applied/suggestions)。
// 后端:ai-service routers/self_healing.py(AGENT_SELF_HEALING_ENABLED 门控,
// 未开启返回 HTTP 200 + code=1 + data.enabled=false,前端提示而非报错)。

'use client'

import * as React from 'react'
import {
  CircleX,
  FlaskConical,
  Loader2,
  Play,
  ShieldOff,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { runSelfHealing } from '@ihui/api-client'
import type { SelfHealingAttemptRecord, SelfHealingOutcome } from '@ihui/api-client'
import { cn } from '@/lib/utils'

export default function SelfHealingPage() {
  const t = useTranslations('selfHealing')
  const [task, setTask] = React.useState('')
  const [targetPath, setTargetPath] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [needLogin, setNeedLogin] = React.useState(false)
  const [disabled, setDisabled] = React.useState(false)
  const [outcome, setOutcome] = React.useState<SelfHealingOutcome | null>(null)

  const run = React.useCallback(async () => {
    if (!task.trim() || !targetPath.trim()) return
    setLoading(true)
    setError('')
    setNeedLogin(false)
    setDisabled(false)
    setOutcome(null)
    const res = await runSelfHealing({ task: task.trim(), targetPath: targetPath.trim() })
    setLoading(false)
    if (!res.success) {
      if (res.status === 401) setNeedLogin(true)
      else setError(res.error || t('loadFailed'))
      return
    }
    const body = res.data
    // 未开启门控:HTTP 200 + code=1 + data.enabled=false
    if (body.code !== 0) {
      if (body.data && typeof body.data === 'object' && 'enabled' in body.data) {
        setDisabled(true)
      } else {
        setError(body.message || t('loadFailed'))
      }
      return
    }
    if (body.data && typeof body.data === 'object' && 'ok' in body.data) {
      setOutcome(body.data as SelfHealingOutcome)
    }
  }, [task, targetPath, t])

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <div className="mb-6 flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('subtitle')}</p>

      {/* 输入表单 */}
      <div className="mb-4 space-y-3 rounded-xl border p-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="sh-task">
            {t('taskLabel')}
          </label>
          <textarea
            id="sh-task"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder={t('taskPlaceholder')}
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="sh-target">
            {t('targetLabel')}
          </label>
          <input
            id="sh-target"
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
            placeholder={t('targetPlaceholder')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{t('durationHint')}</p>
          <button
            onClick={() => void run()}
            disabled={loading || !task.trim() || !targetPath.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {loading ? t('running') : t('run')}
          </button>
        </div>
      </div>

      {needLogin && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CircleX className="h-4 w-4" /> {t('needLogin')}
        </p>
      )}
      {disabled && (
        <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('disabledHint')}</span>
        </div>
      )}
      {error && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {outcome && (
        <>
          {/* 结果概览 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-3">
              <div className="mb-1 text-xs text-muted-foreground">{t('attempts')}</div>
              <div className="text-xl font-bold">{outcome.attempts}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="mb-1 text-xs text-muted-foreground">{t('status')}</div>
              <div
                className={cn(
                  'text-lg font-bold',
                  outcome.final_passed ? 'text-emerald-600' : 'text-destructive',
                )}
              >
                {outcome.final_passed ? t('healed') : t('notHealed')}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="mb-1 text-xs text-muted-foreground">{t('lastRun')}</div>
              <div className="text-xl font-bold">
                <span className="text-emerald-600">{outcome.run_history.at(-1)?.passed ?? 0}</span>
                {' / '}
                <span className="text-destructive">{outcome.run_history.at(-1)?.failed ?? 0}</span>
              </div>
            </div>
          </div>

          {/* 尝试历史 */}
          <div className="mt-4 rounded-xl border p-3">
            <p className="mb-2 text-sm font-semibold">{t('history')}</p>
            {outcome.run_history.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('noHistory')}</p>
            ) : (
              <ul className="space-y-2">
                {outcome.run_history.map((rec: SelfHealingAttemptRecord) => (
                  <li key={rec.attempt} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        #{rec.attempt}
                      </span>
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                        {t('passedCount', { count: rec.passed })}
                      </span>
                      {rec.failed > 0 && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                          {t('failedCount', { count: rec.failed })}
                        </span>
                      )}
                      {rec.failed === 0 && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
                          {t('allGreen')}
                        </span>
                      )}
                    </div>
                    {rec.patch_applied !== null && rec.patch_applied !== undefined ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          <Wrench className="mr-1 inline h-3 w-3" />
                          {t('patchApplied')}
                        </summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
                          {JSON.stringify(rec.patch_applied, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">{t('noPatch')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 建议 */}
          {outcome.suggestions.length > 0 && (
            <div className="mt-3 rounded-xl border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-amber-500" /> {t('suggestions')}
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {outcome.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‌‍‍​‌​​‌​​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​​‌‍‍​‌​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍‌​‌‌​‌‌​‌‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍‌​‌‌​‌‌​‌‍‍‌‌​​‌‌​‌‌‌​‍‍‌‌​​‌‌​‌‍‍​‌‌​‌‌​‍‍‌​‌‌​‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‍‍‌​‌‌​‌‌​‌‍‍‌​‌‌​‌‌​‌‍‍​‌​​‌​‌‌​‌‍‍‌‌​​‌‌​‌‍‍​‌‌​‌​‌‌​‍‍‌​‌‌​‌​‌‍‍‌‌​‌‌​​‌‌‍‍‌​‌‌​‌‌​‍‍‌​‌‌​‌​‌‍‍‌‌​​‌​‌‌​‌‍‍‌​‌‌​‌​‍‍‌‌​‌‌​‌​‌‍‍‌‌​​‌‌​‍‍
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
