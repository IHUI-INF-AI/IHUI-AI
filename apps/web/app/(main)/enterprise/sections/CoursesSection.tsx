'use client'

import * as React from 'react'
import { Cpu, Brain, BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Course {
  name: string
  duration: string
  isNew: boolean
}

interface Phase {
  tag: string
  title: string
  description: string
  courses: Course[]
}

const PHASE_IDS = ['aiTools', 'thinking', 'culture']
const PHASE_ICONS = [Cpu, Brain, BookOpen]

export function CoursesSection() {
  const t = useTranslations('enterprise')
  const [activePhase, setActivePhase] = React.useState('aiTools')

  const phases = t.raw('courses.phases') as Phase[]
  const phaseList = phases.map((phase, i) => ({
    phase,
    id: PHASE_IDS[i] ?? '',
    icon: PHASE_ICONS[i] ?? Cpu,
  }))

  return (
    <section className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('courses.label')}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">{t('courses.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('courses.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {phaseList.map(({ phase, id, icon: Icon }, i) => {
          const active = activePhase === id
          return (
            <button
              key={id}
              onClick={() => setActivePhase(id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                active ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-accent',
              )}
            >
              <span className="text-xs font-bold text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Icon className="h-4 w-4" />
              <span className="font-medium">{phase.title}</span>
            </button>
          )
        })}
      </div>

      {phaseList
        .filter((p) => p.id === activePhase)
        .map(({ phase, id, icon: Icon }) => (
          <Card key={id}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">{phase.tag}</span>
                  <h3 className="text-base font-semibold tracking-tight">{phase.title}</h3>
                  <p className="text-sm text-muted-foreground">{phase.description}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {phase.courses.map((course) => (
                  <div
                    key={course.name}
                    className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {course.duration}
                    </span>
                    <span className="flex-1 text-sm">{course.name}</span>
                    {course.isNew && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                        NEW
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
    </section>
  )
}
