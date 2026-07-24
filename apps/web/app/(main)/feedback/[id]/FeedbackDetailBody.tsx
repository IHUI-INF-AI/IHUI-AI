'use client'

import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui-react'
import { MarkdownViewer } from '@/components/media'
import type { FeedbackItem } from './types'

interface Props {
  fb: FeedbackItem
}

export function FeedbackDetailBody({ fb }: Props) {
  const tc = useTranslations('comments')

  return (
    <>
      <Card>
        <CardContent className="p-4 md:p-6">
          <MarkdownViewer content={fb.content} />
        </CardContent>
      </Card>

      {fb.adminReply && (
        <Card>
          <CardContent className="p-4 md:p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tc('adminReply')}
            </p>
            <MarkdownViewer content={fb.adminReply} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
