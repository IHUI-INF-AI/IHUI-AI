// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 运行控制面板（2026-11-28 按本机 TRAE 宝实机改为浅色）。
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
  pause: 'border-[#e4c98f] bg-[#fbf4e3] text-[#8a6114] hover:bg-[#f7ecd3]',
  resume: 'border-[#b8d2b9] bg-[#eef5ec] text-[#3f7144] hover:bg-[#e4efe2]',
  stop: 'border-[#e4b8b1] bg-[#fbefed] text-[#a2483b] hover:bg-[#f7e4e1]',
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
    <section className="flex h-full min-h-0 flex-col bg-white">
      <header className="shrink-0 border-b border-[#eee9e1] px-7 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#a29a8e]">
              Task run
            </p>
            <h2 className="mt-1 text-[22px] font-semibold leading-8 text-[#23211c]">任务运行</h2>
          </div>
          <span className="rounded-full border border-[#e4ded3] px-2.5 py-1 text-[11px] text-[#8c8478]">
            single run · HTTP 控制面
          </span>
        </div>
        <p className="mt-3 max-w-[760px] text-[13px] leading-6 text-[#7d7569]">
          按 runId 暂停、续跑、注入中途提示、停止；只作用于{masterName}
          当前进程内派发的 run。长任务可能在轮次边界前返回 pause_requested，需要继续查账本。
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        <div className="w-full max-w-[820px]">
          <label
            htmlFor="master-run-id"
            className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-[#a29a8e]"
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
              className="min-w-0 flex-1 rounded-lg border border-[#e3ddd2] bg-[#faf9f6] px-3 py-2.5 font-mono text-[12px] text-[#3a352d] outline-none placeholder:text-[#b0a89d] focus:border-[#bdb5a8]"
            />
            {(Object.keys(ACTION_LABELS) as Action[]).map((action) => (
              <button
                key={action}
                type="button"
                disabled={!runId.trim() || busy !== null}
                onClick={() => void call(action)}
                className={`rounded-lg border px-3.5 py-2.5 text-[12px] font-medium transition disabled:opacity-25 ${ACTION_STYLES[action]}`}
              >
                {busy === action ? '处理中' : ACTION_LABELS[action]}
              </button>
            ))}
          </div>

          <form onSubmit={talk} className="mt-6">
            <label
              htmlFor="master-run-talk"
              className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-[#a29a8e]"
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
                className="min-w-0 flex-1 rounded-lg border border-[#e3ddd2] bg-[#faf9f6] px-3 py-2.5 text-[13px] text-[#3a352d] outline-none placeholder:text-[#b0a89d] focus:border-[#bdb5a8]"
              />
              <button
                type="submit"
                disabled={!runId.trim() || !message.trim() || busy !== null}
                className="rounded-lg border border-[#ded8ce] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#5e574d] transition hover:bg-[#f7f4ef] disabled:opacity-25"
              >
                {busy === 'talk' ? '注入中' : '注入提示'}
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-5 rounded-lg border border-[#e8c9b4] bg-[#fbf1e9] px-3.5 py-2.5 text-[12px] leading-5 text-[#9a5b2c]">
              {error}
            </p>
          )}
          {result && (
            <div className="mt-5 rounded-lg border border-[#e6e0d6] bg-[#faf9f6] px-3.5 py-3 text-[12px] text-[#6a6358]">
              <p data-testid="run-control-result" className="font-medium break-all text-[#332f28]">
                {summary || '控制请求已返回'}
              </p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-2.5 text-[11px] leading-5 text-[#928a7e]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <p className="mt-7 border-t border-[#f0ebe3] pt-3 text-[11px] leading-5 text-[#a49c90]">
            控制请求只影响当前 AI 服务进程内由{masterName}派发的 single run；跨实例或已终态 run
            会返回明确错误码，不会把“提交成功”当成“已经暂停”。
          </p>
        </div>
      </div>
    </section>
  )
}
