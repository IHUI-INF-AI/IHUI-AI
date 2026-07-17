'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare, Edit, Trash2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { TYPE_ICON, TYPE_BADGE, STATUS_BADGE, PRIORITY_BADGE } from '@/lib/feedback'
import type { AdminFeedbackItem } from './types'

interface FeedbackTableProps {
  list: AdminFeedbackItem[]
  isLoading: boolean
  error: Error | null
  onEdit: (fb: AdminFeedbackItem) => void
  onDelete: (fb: AdminFeedbackItem) => void
}

export function FeedbackTable({ list, isLoading, error, onEdit, onDelete }: FeedbackTableProps) {
  const t = useTranslations('admin.feedbacks')
  const tf = useTranslations('feedback')
  const locale = useLocale()
  const router = useRouter()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('user')}</th>
            <th className="px-4 py-2.5 font-medium">{t('type')}</th>
            <th className="px-4 py-2.5 font-medium">{t('title_col')}</th>
            <th className="px-4 py-2.5 font-medium">{t('image')}</th>
            <th className="px-4 py-2.5 font-medium">{t('status')}</th>
            <th className="px-4 py-2.5 font-medium">{t('priority')}</th>
            <th className="px-4 py-2.5 font-medium">{t('feedback')}</th>
            <th className="px-4 py-2.5 font-medium">{t('feedbackImage')}</th>
            <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((fb) => {
              const TypeIcon = TYPE_ICON[fb.type]
              return (
                <tr
                  key={fb.id}
                  onClick={() => router.push(`/feedback/${fb.id}`)}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-2.5 font-medium">{fb.user ?? fb.creator ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        TYPE_BADGE[fb.type],
                      )}
                    >
                      <TypeIcon className="h-3 w-3" />
                      {tf(`type_${fb.type}`)}
                    </span>
                  </td>
                  <td className="max-w-xs break-words px-4 py-2.5">{fb.title}</td>
                  <td className="px-4 py-2.5">
                    {fb.filePath ? (
                      <img
                        src={fb.filePath}
                        alt="反馈图片"
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_BADGE[fb.status],
                      )}
                    >
                      {tf(`status_${fb.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        PRIORITY_BADGE[fb.priority],
                      )}
                    >
                      {tf(`priority_${fb.priority}`)}
                    </span>
                  </td>
                  <td className="max-w-xs break-words px-4 py-2.5">{fb.feedback ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    {fb.feedbackPath ? (
                      <img
                        src={fb.feedbackPath}
                        alt={fb.feedback?.slice(0, 30) || '反馈附件'}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {dateFmt.format(new Date(fb.createdAt))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(fb)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        {t('edit')}
                      </Button>
                      <HasPermi code="ai:userfeedback:remove">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(fb)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
