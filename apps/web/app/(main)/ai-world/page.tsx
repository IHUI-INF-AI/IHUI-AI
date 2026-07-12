'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'

import { HotAppsCard } from './HotAppsCard'
import { CategoryGrid } from './CategoryGrid'
import { UnifiedPanelCard } from './UnifiedPanelCard'
import { fetchAiWorld } from './helpers'
import type { AiWorldData, ChatMessage } from './types'

export default function AiWorldPage() {
  const t = useTranslations('common.aiWorld')
  const router = useRouter()
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-world'],
    queryFn: fetchAiWorld,
  })

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [streamingContent, setStreamingContent] = React.useState('')
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const handleSend = (text: string) => {
    if (!text) {
      setIsStreaming(false)
      return
    }
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)
    setStreamingContent('')
    const response = `已收到你的消息："${text}"。\n\n这是来自统一 AI 面板的示例回复。在实际场景中，这里会接入真实的 AI 模型流式输出。`
    let i = 0
    timerRef.current = setInterval(() => {
      i += 3
      setStreamingContent(response.slice(0, i))
      if (i >= response.length) {
        if (timerRef.current) clearInterval(timerRef.current)
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: response },
        ])
        setIsStreaming(false)
        setStreamingContent('')
      }
    }, 40)
  }

  React.useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
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
