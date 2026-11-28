// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管对话面板（2026-11-28 按本机 TRAE 宝实机重做）。
 *
 * 实机是纯白聊天面：没有深色卡片、没有会话标题栏，进来先看到三句浅灰气泡
 * 欢迎语，输入框固定在底部。人格、三工具、审批边界仍在 ai-service 固定，
 * 前端只负责传话和展示真实结果。
 */
'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'

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

export function MasterChatPanel({ masterName = '总管' }: MasterChatPanelProps) {
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
    <section className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3 lg:px-[84px]">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-3">
          {turns.length === 0 ? (
            <>
              <Bubble>嗨，我是{masterName}！</Bubble>
              <Bubble>
                想做什么事，直接跟我说！拆步骤、派角色、查运行账本，这些我都接得住。你专心做你的，有进展或需要你拿主意的事，我会回来找你。
              </Bubble>
              <Bubble>
                我现在叫{masterName}，你也可以给我换个别的名字，以后随时能改。
              </Bubble>
            </>
          ) : (
            turns.map((turn, index) =>
              turn.role === 'user' ? (
                <div
                  key={`${turn.role}-${index}`}
                  className="ml-auto max-w-[76%] whitespace-pre-wrap break-words rounded-[16px] rounded-br-[7px] bg-[#e8f1e6] px-4 py-2.5 text-[16px] leading-7 text-[#26352a]"
                >
                  {turn.text}
                </div>
              ) : (
                <div
                  key={`${turn.role}-${index}`}
                  className="mr-auto max-w-full whitespace-pre-wrap break-words rounded-[16px] rounded-bl-[7px] bg-[#f2f1ee] px-4 py-2.5 text-[16px] leading-7 text-[#29261f]"
                >
                  {turn.text}
                </div>
              ),
            )
          )}
          {sending && (
            <div className="flex items-center gap-2 rounded-[16px] bg-[#f2f1ee] px-4 py-2.5 text-[13px] text-[#8a8378]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6e9f76]" />
              {masterName}正在处理…
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mx-auto w-full max-w-[1100px] px-6 text-[12px] lg:px-[84px] leading-5 text-red-600">
          {error}
        </p>
      )}

      <div className="shrink-0 px-6 pb-5 pt-2 lg:px-[84px]">
        <form
          onSubmit={send}
          className="mx-auto w-full max-w-[1100px] rounded-[18px] border border-[#e8e3da] bg-[#faf9f6] px-4 pb-2.5 pt-3 shadow-[0_1px_3px_rgba(34,28,18,0.03)] transition focus-within:border-[#cbc4b8]"
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
            placeholder={`给${masterName}发消息，或者说说你今天想完成什么`}
            maxLength={8000}
            rows={2}
            className="block max-h-40 min-h-[46px] w-full resize-none bg-transparent text-[16px] leading-7 text-[#2b2821] outline-none placeholder:text-[#a8a198]"
          />
          <div className="flex items-center justify-end">
            <button
              type="submit"
              aria-label="发送"
              disabled={sending || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#23211d] text-white transition hover:bg-[#3a372f] disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-full whitespace-pre-wrap break-words rounded-[16px] rounded-bl-[7px] bg-[#f2f1ee] px-4 py-2.5 text-[16px] leading-7 text-[#29261f]">
      {children}
    </div>
  )
}
