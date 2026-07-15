'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { HotAppsCard } from './HotAppsCard'
import { CategoryGrid } from './CategoryGrid'
import { UnifiedPanelCard } from './UnifiedPanelCard'
import { fetchAiWorld, streamAiChat } from './helpers'
import { useAuthStore } from '@/stores/auth'
import type { AiWorldData, ChatMessage } from './types'

export default function AiWorldPage() {
  const t = useTranslations('common.aiWorld')
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => !!s.token)

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-world'],
    queryFn: fetchAiWorld,
  })

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [streamingContent, setStreamingContent] = React.useState('')
  const abortRef = React.useRef<AbortController | null>(null)
  // 用 ref 保存最新 streamingContent,供 onDone 闭包读取(避免闭包过期)
  const streamingContentRef = React.useRef('')
  React.useEffect(() => {
    streamingContentRef.current = streamingContent
  }, [streamingContent])

  const handleSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    if (!isAuthenticated) {
      toast.error(t('loginRequiredTitle'), { description: t('loginRequiredDesc') })
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

    abortRef.current = streamAiChat([...history, { role: 'user', content: trimmed }], {
      onDelta: (delta) => {
        setStreamingContent((prev) => prev + delta)
      },
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
        // 将流式累积内容固化到 assistant 消息(用 ref 避免闭包过期)
        const acc = streamingContentRef.current
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)))
        setIsStreaming(false)
        setStreamingContent('')
        abortRef.current = null
      },
    })
  }

  // 组件卸载时中止进行中的流式请求
  React.useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const fallbackData = React.useMemo<AiWorldData>(
    () => ({
      categories: [
        {
          id: 'chat',
          name: t('categoryChat'),
          description: t('categoryChatDesc'),
          icon: 'Bot',
          href: '/chat',
        },
        {
          id: 'image',
          name: t('categoryImage'),
          description: t('categoryImageDesc'),
          icon: 'Image',
          href: '/tools',
        },
        {
          id: 'video',
          name: t('categoryVideo'),
          description: t('categoryVideoDesc'),
          icon: 'Video',
          href: '/tools',
        },
        {
          id: 'music',
          name: t('categoryMusic'),
          description: t('categoryMusicDesc'),
          icon: 'Music',
          href: '/tools',
        },
        {
          id: 'code',
          name: t('categoryCode'),
          description: t('categoryCodeDesc'),
          icon: 'Code',
          href: '/tools',
        },
        {
          id: 'office',
          name: t('categoryOffice'),
          description: t('categoryOfficeDesc'),
          icon: 'Briefcase',
          href: '/workspace',
        },
        {
          id: 'education',
          name: t('categoryEducation'),
          description: t('categoryEducationDesc'),
          icon: 'GraduationCap',
          href: '/learn',
        },
        {
          id: 'marketing',
          name: t('categoryMarketing'),
          description: t('categoryMarketingDesc'),
          icon: 'Megaphone',
          href: '/tools',
        },
      ],
      hotApps: [
        { id: 'h1', name: t('hotAppNameH1'), href: '/tools' },
        { id: 'h2', name: t('hotAppNameH2'), href: '/tools' },
        { id: 'h3', name: t('hotAppNameH3'), href: '/tools' },
        { id: 'h4', name: t('hotAppNameH4'), href: '/tools' },
      ],
    }),
    [t],
  )

  const { categories, hotApps } = data ?? fallbackData

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <HotAppsCard hotApps={hotApps} onNavigate={(href) => router.push(href)} />

      <CategoryGrid
        isLoading={isLoading}
        error={error}
        categories={categories}
        onNavigate={(href) => router.push(href)}
      />

      <UnifiedPanelCard
        messages={messages}
        onSend={handleSend}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
      />
    </div>
  )
}
