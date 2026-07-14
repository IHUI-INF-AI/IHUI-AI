'use client'

import * as React from 'react'
import { Cpu, Brain, BookOpen } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Course {
  name: string
  duration: string
  isNew?: boolean
}

interface Phase {
  id: string
  tag: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  courses: Course[]
}

const PHASES: Phase[] = [
  {
    id: 'aiTools',
    tag: 'PHASE 01',
    icon: Cpu,
    title: 'AI新工具课程',
    description: '掌握主流AI工具与平台,理解AI技术发展脉络',
    courses: [
      { name: 'AI技术发展历程概述', duration: '1课时', isNew: true },
      { name: 'AI生产力工具的使用方法', duration: '1课时', isNew: true },
      { name: '主流AI工具与平台介绍', duration: '1课时', isNew: true },
      { name: '低/无代码智能体应用搭建', duration: '1课时', isNew: true },
      { name: '企业AI化结构化分析方法', duration: '1课时', isNew: true },
      { name: 'AI时代素养——批判性思维', duration: '1课时', isNew: true },
    ],
  },
  {
    id: 'thinking',
    tag: 'PHASE 02',
    icon: Brain,
    title: '思维类课程',
    description: '突破创新障碍,掌握结构化问题解决与组织变革方法',
    courses: [
      { name: '结构化问题解决与引导', duration: '1课时' },
      { name: '创新障碍突破', duration: '1课时' },
      { name: '创意学习方法', duration: '1课时' },
      { name: '组织变革心理', duration: '1课时' },
    ],
  },
  {
    id: 'culture',
    tag: 'PHASE 03',
    icon: BookOpen,
    title: '文化类课程',
    description: '从东西方哲学到企业文化管理,构建深层组织共识',
    courses: [
      { name: '企业文化管理', duration: '1课时' },
      { name: '使命、愿景与价值观', duration: '1课时' },
      { name: '中国传统哲学系列', duration: '系列' },
      { name: '西方哲学系列', duration: '系列' },
    ],
  },
]

export function CoursesSection() {
  const [activePhase, setActivePhase] = React.useState('aiTools')

  return (
    <section className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        课程体系
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">系统化AI认知与实践课程</h2>
        <p className="text-sm text-muted-foreground">帮助企业决策者全面理解AI时代的机遇与挑战</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PHASES.map((phase, i) => {
          const Icon = phase.icon
          const active = activePhase === phase.id
          return (
            <button
              key={phase.id}
              onClick={() => setActivePhase(phase.id)}
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

      {PHASES.filter((p) => p.id === activePhase).map((phase) => {
        const Icon = phase.icon
        return (
          <Card key={phase.id}>
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
        )
      })}
    </section>
  )
}
