'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
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

import { Card, CardHeader, CardTitle, CardDescription } from '@ihui/ui'
import type { AiCategory } from './types'

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

interface Props {
  isLoading: boolean
  error: unknown
  categories: AiCategory[]
  onNavigate: (href: string) => void
}

export function CategoryGrid({ isLoading, error, categories, onNavigate }: Props) {
  const t = useTranslations('common.aiWorld')
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((cat) => {
        const Icon = ICON_MAP[cat.icon] ?? Sparkles
        return (
          <Card
            key={cat.id}
            role="button"
            tabIndex={0}
            onClick={() => onNavigate(cat.href)}
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
  )
}
