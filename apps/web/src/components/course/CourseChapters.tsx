'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, PlayCircle, Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Section {
  id: string
  title: string
  duration?: string
  completed?: boolean
  videoUrl?: string
}
export interface Chapter {
  id: string
  title: string
  sections: Section[]
}

interface CourseChaptersProps {
  chapters: Chapter[]
  currentSectionId?: string
  onSelect?: (section: Section) => void
}

export function CourseChapters({ chapters, currentSectionId, onSelect }: CourseChaptersProps) {
  const t = useTranslations('course.chapters')
  const [openIds, setOpenIds] = React.useState<Set<string>>(
    () => new Set(chapters.map((c) => c.id)),
  )

  const toggle = (cid: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(cid)) next.delete(cid)
      else next.add(cid)
      return next
    })
  }

  if (chapters.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{t('empty')}</p>
  }

  return (
    <div className="space-y-2">
      {chapters.map((chapter, ci) => {
        const open = openIds.has(chapter.id)
        return (
          <div key={chapter.id} className="overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => toggle(chapter.id)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{ci + 1}.</span>
                <span className="line-clamp-1">{chapter.title}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t('sectionCount', { count: chapter.sections.length })}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
              </span>
            </button>
            {open && (
              <div className="border-t">
                {chapter.sections.map((sec) => {
                  const active = sec.id === currentSectionId
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => onSelect?.(sec)}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors',
                        active ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50',
                      )}
                    >
                      {sec.completed ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <PlayCircle
                          className={cn('h-3.5 w-3.5 shrink-0', active && 'fill-current')}
                        />
                      )}
                      <span className="line-clamp-1 flex-1">{sec.title}</span>
                      {sec.duration && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {sec.duration}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
