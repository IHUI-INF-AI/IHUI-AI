'use client'

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Agent 智能体联调面板：选择社区已同步的 Agent Bot，展示公开能力，并通过 WS 流式对话。
// 设计边界：
// - 只消费公开能力 agentPublic，不请求 prompt / 模型参数 / 变量值；
// - botId 不落到前端，WS 只带 agent_id，由 API 服务端解析；
// - 对话走 /ws/agent/chat，OAuth JWT 优先，PAT 仅兜底。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  Bot,
  Command,
  Loader2,
  Plug,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Workflow,
} from 'lucide-react'
import type { AgentPublicCapabilities } from '@ihui/types'
import { fetchWsTicket } from '@ihui/api-client'
import { fetchApi, getStreamBaseUrl } from '@/lib/api'
import { buildWsUrl } from '@/lib/ws-url'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

interface AgentRow {
  agentId: string
  name: string
  description?: string | null
  avatar?: string | null
  cover?: string | null
  botId?: string | null
  botName?: string | null
  status?: string
}

interface AgentDetail extends AgentRow {
  agentPublic?: AgentPublicCapabilities | null
}

type ChatLine = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

type ConnectionStatus = 'idle' | 'connecting' | 'ready' | 'failed' | 'closed' | 'login'

const EMPTY_AGENT_PUBLIC: AgentPublicCapabilities = {
  prologue: null,
  suggestedQuestions: [],
  plugins: [],
  workflows: [],
  knowledge: [],
  shortcutCommands: [],
  defaultUserInputType: null,
  botMode: null,
  voiceCallClosed: null,
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function payloadText(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
}

export function AgentPanel() {
  const t = useTranslations('aiToolsPanel.Agent')
  const token = useAuthStore((s) => s.token)
  const [agents, setAgents] = React.useState<AgentRow[]>([])
  const [loadingAgents, setLoadingAgents] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [keyword, setKeyword] = React.useState('')
  const [selected, setSelected] = React.useState<AgentRow | null>(null)
  const [detail, setDetail] = React.useState<AgentDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)
  const [showPicker, setShowPicker] = React.useState(true)
  const [lines, setLines] = React.useState<ChatLine[]>([])
  const [input, setInput] = React.useState('')
  const [status, setStatus] = React.useState<ConnectionStatus>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const socketRef = React.useRef<WebSocket | null>(null)
  const readyRef = React.useRef(false)
  const listRef = React.useRef<HTMLDivElement | null>(null)

  const loadAgents = React.useCallback(async () => {
    setLoadingAgents(true)
    setLoadError(null)
    try {
      const all: AgentRow[] = []
      for (let page = 1; page <= 3; page += 1) {
        const res = await fetchApi<{ list: AgentRow[]; total?: number }>(
          `/api/agents?status=published&page=${page}&pageSize=100`,
        )
        if (!res.success || !res.data) throw new Error('agent list failed')
        all.push(...res.data.list)
        if (res.data.list.length < 100 || all.length >= (res.data.total ?? all.length)) break
      }
      // botId 是服务端提供给登录用户的内部字段；游客接口会脱敏，故这里自然为空。
      setAgents(all.filter((agent) => Boolean(agent.botId)))
    } catch {
      setLoadError(t('loadFailed'))
    } finally {
      setLoadingAgents(false)
    }
  }, [t])

  React.useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  React.useEffect(() => {
    if (!selected) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    void (async () => {
      try {
        const res = await fetchApi<AgentDetail>(
          `/api/agents/${encodeURIComponent(selected.agentId)}`,
        )
        if (!cancelled && res.success && res.data) setDetail(res.data)
      } catch {
        if (!cancelled) setDetail(null)
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  const tRef = React.useRef(t)
  tRef.current = t

  React.useEffect(() => {
    if (!selected) return
    setLines([])
    setError(null)
    setStatus('connecting')
    readyRef.current = false
    if (!token) {
      setStatus('login')
      return
    }

    let cancelled = false
    let socket: WebSocket | null = null

    const appendDelta = (content: string) => {
      if (!content) return
      setLines((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && last.streaming) {
          return [...prev.slice(0, -1), { ...last, content: last.content + content }]
        }
        return [
          ...prev,
          { id: newId('assistant'), role: 'assistant', content, streaming: true },
        ]
      })
    }

    void (async () => {
      // 短期 WS 票：access token 只走 Authorization 头，不落进 URL/访问日志。
      // 换票失败按既有约定降级直连 access（服务端 wsAuth 兼容双 token）。
      const ticket = await fetchWsTicket(getStreamBaseUrl(), token)
      if (cancelled) return
      const ws = new WebSocket(
        buildWsUrl(
          `/ws/agent/chat?agent_id=${encodeURIComponent(selected.agentId)}`,
          ticket ?? token,
        ),
      )
      socket = ws
      socketRef.current = ws

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(String(event.data)) as Record<string, unknown>
        } catch {
          return
        }
        const eventName = typeof msg.event === 'string' ? msg.event : ''
        const payload = asRecord(msg.data)

        if (eventName === 'ready') {
          readyRef.current = true
          setStatus('ready')
          ws.send(JSON.stringify({ type: 'chat.start' }))
          return
        }
        if (eventName === 'conversation.message.delta') {
          // 服务端 3s 心跳伪装成 delta，不能拼进回答。
          if (payloadText(payload, 'id').startsWith('heartbeat_')) return
          const type = payloadText(payload, 'type')
          if (type && type !== 'answer') return
          appendDelta(payloadText(payload, 'content'))
          return
        }
        if (eventName === 'conversation.message.completed') {
          const type = payloadText(payload, 'type')
          if (type && type !== 'answer') return
          const content = payloadText(payload, 'content')
          if (content) appendDelta(content)
          setLines((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, streaming: false }]
          })
          return
        }
        if (eventName === 'conversation.chat.completed') {
          setLines((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, streaming: false }]
          })
          return
        }
        if (eventName === 'conversation.chat.failed' || eventName === 'error') {
          const message =
            payloadText(msg, 'message') ||
            payloadText(msg, 'msg') ||
            tRef.current('upstreamFailed')
          setError(message)
          setStatus('failed')
          setLines((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, streaming: false }]
          })
        }
      }

      ws.onerror = () => {
        setStatus('failed')
        setError(tRef.current('connectFailed'))
      }
      ws.onclose = () => {
        readyRef.current = false
        setStatus((prev) => (prev === 'failed' ? prev : 'closed'))
      }
    })()

    return () => {
      cancelled = true
      readyRef.current = false
      const ws = socket ?? socketRef.current
      if (ws) {
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      }
      socketRef.current = null
    }
  }, [selected, token])

  React.useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const filteredAgents = React.useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return agents
    return agents.filter((agent) =>
      `${agent.name} ${agent.botName ?? ''} ${agent.description ?? ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [agents, keyword])

  const capabilities = detail?.agentPublic ?? EMPTY_AGENT_PUBLIC

  const handleSend = React.useCallback(() => {
    const text = input.trim()
    const ws = socketRef.current
    if (!text || !ws || ws.readyState !== WebSocket.OPEN || !readyRef.current) {
      setError(t('notConnected'))
      return
    }
    setError(null)
    setInput('')
    setLines((prev) => [
      ...prev,
      { id: newId('user'), role: 'user', content: text },
      { id: newId('assistant'), role: 'assistant', content: '', streaming: true },
    ])
    ws.send(JSON.stringify({ type: 'chat.message', content: text }))
  }, [input, t])

  const handleClear = React.useCallback(() => {
    setLines([])
    setError(null)
    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN && readyRef.current) {
      ws.send(JSON.stringify({ type: 'chat.clear' }))
    }
  }, [])

  const selectAgent = (agent: AgentRow) => {
    setSelected(agent)
    setShowPicker(false)
  }

  const capabilityChips = [
    { key: 'plugins', icon: Plug, count: capabilities.plugins.length },
    { key: 'workflows', icon: Workflow, count: capabilities.workflows.length },
    { key: 'knowledge', icon: BookOpen, count: capabilities.knowledge.length },
    { key: 'shortcuts', icon: Command, count: capabilities.shortcutCommands.length },
  ] as const

  return (
    <div className="space-y-2" data-testid="Agent-agent-panel">
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-label font-medium text-foreground">{t('title')}</p>
          <p className="text-[11px] leading-4 text-muted-foreground">{t('hint')}</p>
        </div>
      </div>

      {showPicker || !selected ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-label text-foreground outline-none placeholder:text-muted-foreground"
              data-testid="Agent-agent-search"
            />
          </div>
          <div className="max-h-32 overflow-y-auto rounded-md border border-border">
            {loadingAgents ? (
              <div className="flex items-center gap-2 px-3 py-3 text-label text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('loading')}
              </div>
            ) : loadError ? (
              <p className="px-3 py-3 text-label text-destructive">{loadError}</p>
            ) : filteredAgents.length === 0 ? (
              <p className="px-3 py-3 text-label text-muted-foreground">{t('empty')}</p>
            ) : (
              filteredAgents.map((agent) => (
                <button
                  key={agent.agentId}
                  type="button"
                  onClick={() => selectAgent(agent)}
                  className="flex w-full items-start gap-2 border-b border-border/60 px-2.5 py-2 text-left last:border-b-0 hover:bg-accent/50"
                  data-testid={`Agent-agent-option-${agent.agentId}`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-label font-medium text-foreground">
                      {agent.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {agent.description || agent.botName || agent.agentId}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2">
            <div className="min-w-0">
              <p className="truncate text-label font-medium text-foreground">{selected.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {selected.description || selected.botName || selected.agentId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t('switch')}
            </button>
          </div>

          {loadingDetail ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('loadingCapabilities')}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {capabilityChips.map(({ key, icon: Icon, count }) => (
                  <span
                    key={key}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px]',
                      count > 0 ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {t(key)} {count}
                  </span>
                ))}
              </div>
              {capabilities.prologue ? (
                <blockquote className="line-clamp-3 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">
                  {capabilities.prologue}
                </blockquote>
              ) : null}
              {capabilities.suggestedQuestions.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {capabilities.suggestedQuestions.slice(0, 4).map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => setInput(question)}
                      className="rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="overflow-hidden rounded-md border border-border">
            <div
              ref={listRef}
              className="h-40 space-y-2 overflow-y-auto bg-background px-2 py-2"
              data-testid="Agent-chat-lines"
            >
              {lines.length === 0 ? (
                <p className="pt-6 text-center text-[11px] text-muted-foreground">
                  {t('chatEmpty')}
                </p>
              ) : (
                lines.map((line) => (
                  <div
                    key={line.id}
                    className={cn('flex', line.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[92%] whitespace-pre-wrap rounded-lg px-2 py-1.5 text-[11px] leading-4',
                        line.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      {line.content || (line.streaming ? t('streaming') : '')}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-border bg-background p-1.5">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={t('inputPlaceholder')}
                rows={2}
                className="w-full resize-none bg-transparent px-1 text-label text-foreground outline-none placeholder:text-muted-foreground"
                data-testid="Agent-chat-input"
              />
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px]',
                    status === 'ready'
                      ? 'text-emerald-600'
                      : status === 'failed'
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      status === 'ready'
                        ? 'bg-emerald-500'
                        : status === 'failed'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground',
                    )}
                  />
                  {status === 'ready'
                    ? t('ready')
                    : status === 'connecting'
                      ? t('connecting')
                      : status === 'login'
                        ? t('loginRequired')
                        : status === 'failed'
                          ? t('failed')
                          : t('closed')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={lines.length === 0}
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground disabled:opacity-40 hover:text-foreground"
                    title={t('clear')}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={status !== 'ready' || input.trim().length === 0}
                    className="inline-flex h-6 items-center gap-1 rounded bg-primary px-2 text-[11px] text-primary-foreground disabled:opacity-40"
                  >
                    <Send className="h-3 w-3" />
                    {t('send')}
                  </button>
                </div>
              </div>
              {error ? <p className="mt-1 text-[10px] text-destructive">{error}</p> : null}
            </div>
          </div>
        </div>
      )}

      {selected && detail?.agentPublic ? (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Sparkles className="h-2.5 w-2.5" />
          {t('publicOnly')}
        </p>
      ) : null}
    </div>
  )
}
