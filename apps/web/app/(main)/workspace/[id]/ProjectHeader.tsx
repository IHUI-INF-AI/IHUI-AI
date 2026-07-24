'use client'

import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import type { ProjectDetail } from './types'

interface Props {
  onBack: () => void
  project?: ProjectDetail
  projectLoading: boolean
  projectError: boolean
  projectErr: unknown
}

export function ProjectHeader({
  onBack,
  project,
  projectLoading,
  projectError,
  projectErr,
}: Props) {
  const t = useTranslations('workspace')
  return (
    <div className="flex items-center gap-3">
      <Tooltip content={t('back')}>
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </Tooltip>
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold tracking-tight md:text-3xl">
          {projectError ? (
            <span className="text-destructive">{(projectErr as Error)?.message}</span>
          ) : projectLoading ? (
            t('loading')
          ) : (
            (project?.name ?? '')
          )}
        </h1>
        <p className="mt-0.5 break-words text-sm text-muted-foreground">
          {project?.description || t('description')}
        </p>
      </div>
    </div>
  )
}
