// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:Timeline 子面板从 file-explorer.tsx 抽出,自持 git log 拉取与渲染
import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { GitCommit, FileEdit, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { runCommand } from '@ihui/api-client'
import type { TimelineEntry } from '@ihui/types'

const TIMELINE_ICON: Record<string, typeof GitCommit> = {
  edit: FileEdit,
  save: Save,
  commit: GitCommit,
}

const TIMELINE_COLOR: Record<string, string> = {
  edit: 'text-blue-500',
  save: 'text-green-500',
  commit: 'text-purple-500',
}

interface TimelineTabProps {
  workspacePath: string | null
}

export function TimelineTab({ workspacePath }: TimelineTabProps) {
  const t = useTranslations('ide')
  const locale = useLocale()
  const [timeline, setTimeline] = React.useState<TimelineEntry[]>([])
  const [timelineLoading, setTimelineLoading] = React.useState(false)
  const [timelineError, setTimelineError] = React.useState<string | null>(null)

  // 时间线:git log 拉取最近提交,epoch 时间戳(毫秒)兼容 formatTime
  React.useEffect(() => {
    if (!workspacePath) {
      setTimeline([])
      return
    }
    let cancelled = false
    setTimelineLoading(true)
    setTimelineError(null)
    runCommand({
      command: 'git log -20 --pretty=format:%H%x00%an%x00%ct%x00%s',
      workspacePath,
    })
      .then((result) => {
        if (cancelled) return
        if (!result.success || !result.data.stdout.trim()) {
          setTimeline([])
          return
        }
        setTimeline(
          result.data.stdout
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((lineLine) => {
              const [id, author, ct, ...msgParts] = lineLine.split('\x00')
              return {
                id: id ?? '',
                label: msgParts.join(' ') || '暂无提交信息',
                type: 'commit' as const,
                author: author || '',
                timestamp: Number(ct) * 1000 || Date.now(),
              }
            }),
        )
      })
      .catch(() => {
        if (cancelled) return
        setTimelineError('Git 历史加载失败')
        setTimeline([])
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspacePath])

  const formatTime = (ts: number): string => {
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60000)
    if (m < 1) return t('fileExplorer.justNow')
    if (m < 60) return t('fileExplorer.minutesAgo', { count: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t('fileExplorer.hoursAgo', { count: h })
    return new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' }).format(ts)
  }

  if (timelineLoading) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">...</div>
  }
  if (timelineError) {
    return <div className="px-3 py-2 text-xs text-red-500">{timelineError}</div>
  }
  if (timeline.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">{t('fileExplorer.noMatch')}</div>
    )
  }
  return (
    <>
      {timeline.map((item) => {
        const TIcon = TIMELINE_ICON[item.type] ?? FileEdit
        return (
          <div
            key={item.id}
            className="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-xs hover:bg-muted/50"
          >
            <TIcon className={cn('h-3.5 w-3.5 shrink-0', TIMELINE_COLOR[item.type])} />
            <div className="flex flex-1 flex-col">
              <span className="truncate">{item.label}</span>
              <span className="text-muted-foreground">
                {item.author} · {formatTime(item.timestamp)}
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}
