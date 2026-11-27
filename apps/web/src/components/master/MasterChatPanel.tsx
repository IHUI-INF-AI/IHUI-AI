// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管对话面板（2026-11-28 立）。
 *
 * 只做一件事：把 `/api/master/chat` 的回复显示出来。人格、三工具、审批边界都在
 * ai-service 的 `master.md` 与服务端固定，前端不复制、不覆盖、不“替模型决定”调什么工具。
 */
'use client'

import { useState, type FormEvent } from 'react'

interface ChatTurn {
  role: 'user' | 'master'
  text: string
}

interface MasterReply {
  final_response?: string
  session_id?: string
  trace?: unknown[]
}

export function MasterChatPanel() {
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function send(event: FormEvent) {
    event.preventDefault()
    const message = input.trim()
    if (!message || sending) return
    setInput('')
    setError('')
    setTurns((prev) => [...prev, { role: 'user', text: message }])
    setSending(true)
    try {
      const response = await fetch('/api/master/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session_id: sessionId, max_iterations: 6 }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        code?: number
        message?: string
        errorCode?: string
        data?: MasterReply
      }
      if (!response.ok || payload.code !== 0 || !payload.data) {
        throw new Error(payload.errorCode || payload.message || `HTTP ${response.status}`)
      }
      if (payload.data.session_id) setSessionId(payload.data.session_id)
      setTurns((prev) => [
        ...prev,
        { role: 'master', text: payload.data?.final_response || '（总管没有返回文本）' },
      ])
    } catch (err) {
      const text = err instanceof Error ? err.message : '发送失败'
      setError(text)
      setTurns((prev) => [...prev, { role: 'master', text: `调用失败：${text}` }])
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">和总管说一句</h2>
          <p className="mt-1 text-xs text-slate-500">
            总管只会调度、查看、暂停；删除与回滚必须走审批，模型不能直接执行。
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
          固定人格 · 三工具
        </span>
      </header>

      {turns.length > 0 && (
        <div className="mb-3 max-h-80 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
          {turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={
                turn.role === 'user'
                  ? 'ml-8 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white'
                  : 'mr-8 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800'
              }
            >
              <div className="mb-1 text-[10px] opacity-70">
                {turn.role === 'user' ? '你' : '总管'}
              </div>
              <div className="whitespace-pre-wrap break-words">{turn.text}</div>
            </div>
          ))}
          {sending && <div className="text-xs text-slate-500">总管正在处理…</div>}
        </div>
      )}

      {error && (
        <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="例如：列一下我名下的智能体；把 writer 暂停；看最近一次运行"
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
          maxLength={8000}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {sending ? '处理中' : '发送'}
        </button>
      </form>
    </section>
  )
}
