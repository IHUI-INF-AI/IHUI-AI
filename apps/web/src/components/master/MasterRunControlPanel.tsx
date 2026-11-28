// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 运行控制面板（2026-11-28 Trae 式重做）。
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
  pause: 'border-amber-400/25 text-amber-200 hover:bg-amber-400/10',
  resume: 'border-emerald-400/25 text-emerald-200 hover:bg-emerald-400/10',
  stop: 'border-red-400/25 text-red-300 hover:bg-red-400/10',
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
    <section className="flex h-full min-h-0 flex-col bg-transparent">
      <header className="shrink-0 border-b border-white/[0.06] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-sky-300/60">
              Run control
            </p>
            <h2 className="mt-1.5 text-[16px] font-medium text-white/85">运行控制</h2>
          </div>
          <span className="rounded border border-white/[0.07] px-2 py-1 text-[10px] text-white/35">
            single run · HTTP 控制面
          </span>
        </div>
        <p className="mt-2 max-w-[760px] text-[11px] leading-5 text-white/35">
          按 runId 暂停、续跑、注入中途提示、停止；只作用于{masterName}
          当前进程内派发的 run。长任务可能在轮次边界前返回 pause_requested，需要继续查账本。
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="w-full max-w-[760px]">
          <label
            htmlFor="master-run-id"
            className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-white/25"
          >
            Run ID
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              placeholder="粘贴 runId"
              id="master-run-id"
              aria-label="runId"
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 font-mono text-[11px] text-white/75 outline-none placeholder:text-white/20 focus:border-sky-400/30"
            />
            {(Object.keys(ACTION_LABELS) as Action[]).map((action) => (
              <button
                key={action}
                type="button"
                disabled={!runId.trim() || busy !== null}
                onClick={() => void call(action)}
                className={`rounded-md border px-3 py-2 text-[11px] font-medium transition disabled:opacity-25 ${ACTION_STYLES[action]}`}
              >
                {busy === action ? '处理中' : ACTION_LABELS[action]}
              </button>
            ))}
          </div>

          <form onSubmit={talk} className="mt-5">
            <label
              htmlFor="master-run-talk"
              className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-white/25"
            >
              中途提示
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="给运行中的 run 注入一条中途提示"
                id="master-run-talk"
                aria-label="中途提示"
                maxLength={8000}
                className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[12px] text-white/75 outline-none placeholder:text-white/20 focus:border-emerald-400/30"
              />
              <button
                type="submit"
                disabled={!runId.trim() || !message.trim() || busy !== null}
                className="rounded-md bg-white/[0.06] px-3 py-2 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.1] disabled:opacity-25"
              >
                {busy === 'talk' ? '注入中' : '注入提示'}
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-4 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] leading-5 text-amber-200">
              {error}
            </p>
          )}
          {result && (
            <div className="mt-4 rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-[11px] text-white/60">
              <p data-testid="run-control-result" className="font-medium break-all text-white/75">
                {summary || '控制请求已返回'}
              </p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-[#0b0d11] p-2 text-[10px] leading-4 text-white/30">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <p className="mt-6 border-t border-white/[0.05] pt-3 text-[10px] leading-5 text-white/20">
            控制请求只影响当前 AI 服务进程内由{masterName}派发的 single run；跨实例或已终态 run
            会返回明确错误码，不会把“提交成功”当成“已经暂停”。
          </p>
        </div>
      </div>
    </section>
  )
}

