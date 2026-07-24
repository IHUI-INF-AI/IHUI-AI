'use client'

import { GraduationCap, FileText, BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import type { LearnStatistics, ExamStatistics, ContentStatistics } from './types'

interface Props {
  learn?: LearnStatistics
  exam?: ExamStatistics
  content?: ContentStatistics
}

export function StatisticsDialog({ learn, exam, content }: Props) {
  const t = useTranslations('statistics')
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-primary" />
            {t('learnStats')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row label={t('lessonTotal')} value={learn?.lessonTotal ?? 0} />
          <Row label={t('lessonPublished')} value={learn?.lessonPublished ?? 0} />
          <Row label={t('signupTotal')} value={learn?.signupTotal ?? 0} />
          <Row label={t('viewSum')} value={learn?.viewSum ?? 0} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-purple-600" />
            {t('examStats')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row label={t('examTotal')} value={exam?.examTotal ?? 0} />
          <Row label={t('examPublished')} value={exam?.examPublished ?? 0} />
          <Row label={t('recordTotal')} value={exam?.recordTotal ?? 0} />
          <Row label={t('passTotal')} value={exam?.passTotal ?? 0} />
          <Row label={t('passRate')} value={`${((exam?.passRate ?? 0) * 100).toFixed(2)}%`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            {t('contentStats')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row label={t('members')} value={content?.memberTotal ?? 0} />
          <Row label={t('posts')} value={content?.postTotal ?? 0} />
          <Row label={t('announcements')} value={content?.announcementTotal ?? 0} />
          <Row label={t('articles')} value={content?.articleTotal ?? 0} />
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
