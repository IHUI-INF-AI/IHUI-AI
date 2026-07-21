'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { cn } from '@/lib/utils'
import type { HotCreator, AiTool } from './community-feed-panel'

interface AiToolsSidebarProps {
  creators: HotCreator[]
  tags: string[]
  tools: AiTool[]
}

// 数字简写
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

// AI 工具图标(纯字符避免外部 svg 依赖)
const TOOL_ICON: Record<string, string> = {
  midjourney: 'MJ',
  suno: 'SU',
  sora: 'SO',
  claude: 'CL',
}

/**
 * AiToolsSidebar - 右侧栏
 * 3 个 Card 区:热门创作者 / 热门标签 / AI 工具推荐
 * 关注按钮点击切换状态 + toast 提示
 * 标签点击切换选中状态
 * AI 工具点击新窗口打开
 */
export function AiToolsSidebar({ creators, tags, tools }: AiToolsSidebarProps) {
  const t = useTranslations('aiCommunity')
  const [creatorList, setCreatorList] = React.useState<HotCreator[]>(creators)
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])

  React.useEffect(() => {
    setCreatorList(creators)
  }, [creators])

  const handleFollow = (id: string) => {
    setCreatorList((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              isFollowing: !c.isFollowing,
              followers: c.isFollowing ? Math.max(0, c.followers - 1) : c.followers + 1,
            }
          : c,
      ),
    )
    const target = creatorList.find((c) => c.id === id)
    toast.success(target?.isFollowing ? t('sidebar.unfollowSuccess') : t('sidebar.followSuccess'))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const openTool = (url: string) => {
    if (!/^https?:\/\//i.test(url)) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 热门创作者 */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">{t('sidebar.hotCreators')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 p-4 pt-2">
          {creatorList.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
            >
              <Avatar src={c.avatar} name={c.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber(c.followers)} {t('sidebar.followers')}
                </div>
              </div>
              <Button
                size="sm"
                variant={c.isFollowing ? 'secondary' : 'outline'}
                onClick={() => handleFollow(c.id)}
              >
                <span>{c.isFollowing ? t('sidebar.following') : t('sidebar.follow')}</span>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 热门标签 */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">{t('sidebar.hotTags')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 p-4 pt-2">
          {tags.map((tag) => {
            const active = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span>#{tag}</span>
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* AI 工具推荐 */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">{t('tools.hotTools')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-4 pt-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => openTool(tool.href)}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold text-muted-foreground">
                {TOOL_ICON[tool.icon] ?? tool.icon.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{tool.nameKey}</div>
                <div className="text-xs text-muted-foreground">{t(`tools.${tool.icon}`)}</div>
              </div>
              <span className="text-muted-foreground">→</span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
