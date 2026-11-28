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
  display_name?: string
  trace?: unknown[]
}

interface MasterChatPanelProps {
  masterName?: string
}

const SUGGESTIONS = [
  '列一下我名下的智能体',
  '看最近一次运行的状态',
  '把 writer 暂停，并告诉我 checkpoint',
]

export function MasterChatPanel({ masterName = '总管' }: MasterChatPanelProps) {
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function clearConversation() {
    setTurns([])
    setSessionId(undefined)
    setError('')
  }

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
        body: JSON.stringify({
          message,
          session_id: sessionId,
          max_iterations: 6,
          master_name: masterName,
        }),
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
        {
          role: 'master',
          text: payload.data?.final_response || `（${masterName}没有返回文本）`,
        },
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
    <section className="rounded-2xl bg-white p-4 dark:bg-slate-900/60">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
            Conversation
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
            和{masterName}聊一句
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {masterName}只会调度、查看、暂停；删除与回滚必须走审批，模型不能直接执行。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800">
            固定人格 · 三工具
          </span>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="text-[11px] text-slate-400 underline-offset-4 hover:text-slate-700 hover:underline"
            >
              清空
            </button>
          )}
        </div>
      </header>

      {turns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            直接说目标，{masterName}会自己拆步骤、调工具、回报结果。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setInput(suggestion)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-3 max-h-[420px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/40">
          {turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={
                turn.role === 'user'
                  ? 'ml-6 rounded-2xl bg-slate-900 px-3.5 py-2.5 text-sm text-white shadow-sm'
                  : 'mr-6 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
              }
            >
              <div className="mb-1 text-[10px] opacity-70">
                {turn.role === 'user' ? '你' : masterName}
              </div>
              <div className="whitespace-pre-wrap break-words leading-6">{turn.text}</div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {masterName}正在处理…
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>
      )}

      <form
        onSubmit={send}
        className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="例如：列一下我名下的智能体；把 writer 暂停；看最近一次运行"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
          maxLength={8000}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40"
        >
          {sending ? '处理中' : '发送'}
        </button>
      </form>
    </section>
  )
}
