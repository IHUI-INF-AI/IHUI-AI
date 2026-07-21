'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { UnifiedPanelCard } from './UnifiedPanelCard'
import { LlmConfigSelector, type SelectedLlmConfig } from './LlmConfigSelector'
import { streamAiChat } from './helpers'
import type { ChatMessage } from './types'

interface Props {
  open: boolean
  onToggle: () => void
}

export function AiChatSection({ open, onToggle }: Props) {
  const t = useTranslations('common.aiWorld')
  const isAuthenticated = useAuthStore((s) => !!s.token)

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [streamingContent, setStreamingContent] = React.useState('')
  const [selectedConfig, setSelectedConfig] = React.useState<SelectedLlmConfig | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const streamingContentRef = React.useRef('')
  const selectedConfigRef = React.useRef<SelectedLlmConfig | null>(null)

  React.useEffect(() => {
    streamingContentRef.current = streamingContent
  }, [streamingContent])
  React.useEffect(() => {
    selectedConfigRef.current = selectedConfig
  }, [selectedConfig])

  const handleSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return
    if (!isAuthenticated) {
      toast.error(t('loginRequiredTitle'), { description: t('loginRequiredDesc') })
      return
    }
    if (!selectedConfigRef.current) {
      toast.error(t('modelSelectorRequiredTitle'), { description: t('modelSelectorRequiredDesc') })
      return
    }
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    const assistantId = `a-${Date.now()}`
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setIsStreaming(true)
    setStreamingContent('')

    const history = messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: m.content }))

    abortRef.current = streamAiChat(
      [...history, { role: 'user', content: trimmed }],
      {
        onDelta: (delta) => setStreamingContent((prev) => prev + delta),
        onError: (message) => {
          setIsStreaming(false)
          setStreamingContent('')
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || `${t('aiErrorPrefix')}: ${message}` }
                : m,
            ),
          )
          toast.error(t('aiErrorTitle'), { description: message })
        },
        onDone: () => {
          const acc = streamingContentRef.current
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)),
          )
          setIsStreaming(false)
          setStreamingContent('')
          abortRef.current = null
        },
      },
      { model: selectedConfigRef.current.modelId || undefined },
    )
  }

  React.useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const handleStop = React.useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onToggle}>
          {open ? '收起 AI 面板' : '展开 AI 面板'}
        </Button>
      </div>
      {open && (
        <UnifiedPanelCard
          messages={messages}
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          toolbar={
            isAuthenticated ? (
              <LlmConfigSelector
                value={selectedConfig ? String(selectedConfig.id) : null}
                onChange={setSelectedConfig}
                disabled={isStreaming}
              />
            ) : null
          }
        />
      )}
    </div>
  )
}
