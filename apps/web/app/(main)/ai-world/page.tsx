'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
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

const FALLBACK_DATA: AiWorldData = {
  categories: [
    { id: 'chat', name: 'AI 对话', description: '智能对话助手，解答各类问题', icon: 'Bot', href: '/chat' },
    { id: 'image', name: 'AI 绘画', description: '文本生成图像，释放创意', icon: 'Image', href: '/tools' },
    { id: 'video', name: 'AI 视频', description: '一键生成创意短视频', icon: 'Video', href: '/tools' },
    { id: 'music', name: 'AI 音乐', description: 'AI 作曲编曲，灵感无限', icon: 'Music', href: '/tools' },
    { id: 'code', name: 'AI 代码', description: '代码生成与补全，提升效率', icon: 'Code', href: '/tools' },
    { id: 'office', name: 'AI 办公', description: '文档、表格、PPT 智能生成', icon: 'Briefcase', href: '/workspace' },
    { id: 'education', name: 'AI 教育', description: '个性化学习与智能辅导', icon: 'GraduationCap', href: '/learn' },
    { id: 'marketing', name: 'AI 营销', description: '文案、海报、投放一站式', icon: 'Megaphone', href: '/tools' },
  ],
  hotApps: [
    { id: 'h1', name: '智能写作', href: '/tools' },
    { id: 'h2', name: 'AI 绘图', href: '/tools' },
    { id: 'h3', name: '语音转文字', href: '/tools' },
    { id: 'h4', name: '代码助手', href: '/tools' },
  ],
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
  const router = useRouter()
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-world'],
    queryFn: fetchAiWorld,
  })

  const { categories, hotApps } = data ?? FALLBACK_DATA

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI 世界</h1>
        <p className="mt-1 text-sm text-muted-foreground">探索 AI 应用，开启智能创作之旅</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            热门 AI 应用
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
          加载中...
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
    </div>
  )
}
