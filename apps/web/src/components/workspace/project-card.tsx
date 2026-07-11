'use client'

import * as React from 'react'
import Link from 'next/link'
import { FolderOpen, FileText, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from '@ihui/ui'

export interface ProjectCardData {
  id: string
  name: string
  description: string
  fileCount?: number
  updatedAt: string | Date
}

function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const t = useTranslations('workspace')
  const fileCount = Number(project.fileCount ?? 0)

  return (
    <Card className="flex h-full flex-col transition-colors hover:bg-accent hover:shadow-md">
      <CardHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderOpen className="h-5 w-5" />
        </div>
        <CardTitle className="text-base">{project.name}</CardTitle>
        <CardDescription className="min-h-[2.5rem]">
          {project.description || t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>{t('fileCount', { count: fileCount })}</span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{formatDate(project.updatedAt)}</span>
        <Button asChild size="sm">
          <Link href={`/workspace/${project.id}`}>
            {t('enterProject')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default ProjectCard
