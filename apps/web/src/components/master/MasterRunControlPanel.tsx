// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 运行控制面板（2026-11-28 立）。
 *
 * 只调用显式 HTTP 控制面 `/api/master/runs/{runId}/pause|resume|talk|stop`，
 * 不复制 agent_ops 的执行逻辑，也不在前端伪造运行状态。控制面只作用于当前
 * AI 服务进程内的 single run；这一点直接写在界面上，避免把“提交成功”误读成
 * “跨实例一定能暂停”。
 */
'use client'

import { useState, type FormEvent } from 'react'

interface RunControlResult {
  outcome?: string
  runStatus?: string
  checkpointId?: string | null
  detail?: string | null
  [key: string]: unknown
}

interface ControlReply {
  code?: number
  message?: string
  detail?: { code?: string; message?: string }
  data?: RunControlResult
}

type Action = 'pause' | 'resume' | 'stop'

const ACTION_LABELS: Record<Action, string> = {
  pause: '暂停',
  resume: '续跑',
  stop: '停止',
}

const ACTION_STYLES: Record<Action, string> = {
  pause: 'border-amber-300 text-amber-800 hover:bg-amber-50',
  resume: 'border-emerald-300 text-emerald-800 hover:bg-emerald-50',
  stop: 'border-red-300 text-red-700 hover:bg-red-50',
}

interface MasterRunControlPanelProps {
  masterName?: string
}

export function MasterRunControlPanel({ masterName = '总管' }: MasterRunControlPanelProps) {
  const [runId, setRunId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<Action | 'talk' | null>(null)
  const [result, setResult] = useState<RunControlResult | null>(null)
  const [error, setError] = useState('')

  async function call(action: Action | 'talk', body?: Record<string, unknown>) {
    const id = runId.trim()
    if (!id || busy) return
    setBusy(action)
    setError('')
    setResult(null)
    try {
      const response = await fetch(`/api/master/runs/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = (await response.json().catch(() => ({}))) as ControlReply
      if (!response.ok || payload.code !== 0 || !payload.data) {
        const code = payload.detail?.code || payload.message || `HTTP ${response.status}`
        const text = payload.detail?.message || payload.message || '控制请求失败'
        throw new Error(`${code}: ${text}`)
      }
      setResult(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '控制请求失败')
    } finally {
      setBusy(null)
    }
  }

  async function talk(event: FormEvent) {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    await call('talk', { message: text })
    setMessage('')
  }

  const summary = result
    ? [
        result.outcome ? `outcome=${result.outcome}` : '',
        result.runStatus ? `status=${result.runStatus}` : '',
        result.checkpointId ? `checkpoint=${result.checkpointId}` : '',
        result.detail ? result.detail : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <section className="rounded-2xl bg-white p-4 dark:bg-slate-900/60">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">
            Run control
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">运行控制</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            按 runId 暂停、续跑、注入中途提示、停止；只作用于{masterName}派发的当前进程内 single run。
            长任务可能在轮次边界前返回 pause_requested，需要继续查账本。
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800">
          显式 HTTP 控制面
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          value={runId}
          onChange={(event) => setRunId(event.target.value)}
          placeholder="粘贴 runId"
          aria-label="runId"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
        />
        {(Object.keys(ACTION_LABELS) as Action[]).map((action) => (
          <button
            key={action}
            type="button"
            disabled={!runId.trim() || busy !== null}
            onClick={() => void call(action)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-40 ${ACTION_STYLES[action]}`}
          >
            {busy === action ? '处理中' : ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <form onSubmit={talk} className="mt-3 flex flex-wrap gap-2">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="给运行中的 run 注入一条中途提示"
          aria-label="中途提示"
          maxLength={8000}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={!runId.trim() || !message.trim() || busy !== null}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-white dark:text-slate-900"
        >
          {busy === 'talk' ? '注入中' : '注入提示'}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
      )}
      {result && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <p data-testid="run-control-result" className="font-medium break-all">
            {summary || '控制请求已返回'}
          </p>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-500 dark:text-slate-400">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </section>
  )
}
