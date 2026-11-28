// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管对话面板（2026-11-28 Trae 式重做）。
 *
 * 对话是这个产品的主面：没有白卡片、没有大段说明，空态只给目标和建议词，
 * 输入框固定在底部。人格、三工具、审批边界仍在 ai-service 固定，前端不复制。
 */
'use client'

import { useState, type FormEvent } from 'react'
import { ArrowUp, Bot } from 'lucide-react'

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
  /** 父级“新建对话”时换 key 重挂载；组件本身不依赖。 */
  resetKey?: number
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
    <section className="flex h-full min-h-0 flex-1 flex-col bg-transparent">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-4 text-[10px] text-white/35">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          当前会话
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">固定人格 · 三工具</span>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="text-white/35 transition hover:text-white/70"
            >
              清空
            </button>
          )}
        </div>
      </header>

      {turns.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-5 py-8">
          <div className="mx-auto w-full max-w-[620px]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <Bot className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-[22px] font-semibold tracking-tight text-white/90">
              与{masterName}协作
            </h2>
            <p className="mt-2 max-w-[520px] text-[12px] leading-6 text-white/40">
              直接把目标交给它。{masterName}会拆步骤、调智能体、查运行账本并回报结果；
              删除与回滚必须走审批，模型不能直接执行。
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-white/45 transition hover:border-white/15 hover:bg-white/[0.05] hover:text-white/75"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-5 py-6">
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <div
                  key={`${turn.role}-${index}`}
                  className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-emerald-300/10 bg-[#173528] px-4 py-2.5 text-[13px] leading-6 text-[#dff7e8]"
                >
                  {turn.text}
                </div>
              ) : (
                <div key={`${turn.role}-${index}`} className="mr-auto max-w-[92%]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-white/30">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-400/15 text-emerald-300">
                      <Bot className="h-2.5 w-2.5" />
                    </span>
                    {masterName}
                  </div>
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-7 text-white/70">
                    {turn.text}
                  </div>
                </div>
              ),
            )}
            {sending && (
              <div className="flex items-center gap-2 text-[11px] text-white/35">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {masterName}正在处理…
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mx-auto mb-1 w-full max-w-[760px] px-5 text-[11px] leading-5 text-red-300/90">
          {error}
        </p>
      )}

      <div className="shrink-0 px-4 pb-4 pt-2">
        <form
          onSubmit={send}
          className="mx-auto w-full max-w-[760px] rounded-[14px] border border-white/[0.08] bg-[#12151a] transition focus-within:border-emerald-400/30"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder={`给${masterName}发消息，例如：列一下我名下的智能体，或把 writer 暂停`}
            maxLength={8000}
            rows={3}
            className="block max-h-40 min-h-[72px] w-full resize-none bg-transparent px-3.5 pt-3 text-[13px] leading-6 text-white/80 outline-none placeholder:text-white/25"
          />
          <div className="flex items-center justify-between px-2.5 pb-2">
            <div className="flex items-center gap-2 text-[10px] text-white/25">
              <span className="rounded border border-white/[0.06] px-1.5 py-0.5">Auto</span>
              <span className="hidden sm:inline">固定三工具 · single run</span>
            </div>
            <button
              type="submit"
              aria-label="发送"
              disabled={sending || !input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400 text-[#07110b] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
