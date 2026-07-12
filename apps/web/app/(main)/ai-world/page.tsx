'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  Sparkles,
  Bot,
  Image,
  Video,
  Music,
  Code,
  Briefcase,
  GraduationCap,
  Megaphone,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ihui/ui'
import { UnifiedAIPanel } from '@/components/ai/unified-ai-panel'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AiCategory {
  id: string
  name: string
  description: string
  icon: string
  href: string
}

interface AiWorldData {
  categories: AiCategory[]
  hotApps: Array<{ id: string; name: string; href: string }>
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bot,
  Image,
  Video,
  Music,
  Code,
  Briefcase,
  GraduationCap,
  Megaphone,
  Sparkles,
}

async function fetchAiWorld(): Promise<AiWorldData> {
  const res = await fetchApi<AiWorldData>('/api/ai-world')
  if (!res.success) throw new Error(res.error)
  return res.data
}

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('hotApps')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {hotApps.map((app) => (
              <Button
                key={app.id}
                variant="secondary"
                size="sm"
                onClick={() => router.push(app.href)}
              >
                {app.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => {
            const Icon = ICON_MAP[cat.icon] ?? Sparkles
            return (
              <Card
                key={cat.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(cat.href)}
                className="cursor-pointer transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{cat.name}</CardTitle>
                  <CardDescription>{cat.description}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            统一 AI 面板
          </CardTitle>
          <CardDescription>整合 chat + agent + generation 的统一交互面板</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[480px] border-t">
            <UnifiedAIPanel
              messages={messages}
              onSend={handleSend}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              placeholder="输入消息体验统一 AI 面板..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
