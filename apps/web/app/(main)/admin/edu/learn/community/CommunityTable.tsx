'use client'

import { Loader2, Edit, Trash2, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { STATUS_MAP } from './helpers'
import type { Topic } from './types'

const COLSPAN = 6

interface Props {
  rows: Topic[]
  isLoading: boolean
  noEndpoint: boolean
  onEdit: (t: Topic) => void
  onDelete: (id: string) => void
  deletePending: boolean
}

export function CommunityTable({
  rows,
  isLoading,
  noEndpoint,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.learn.community')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colAuthor')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colReplies')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colViews')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : noEndpoint ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('endpointNotConfigured')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((topic) => {
              const st = STATUS_MAP[topic.status] ?? {
                label: '',
                cls: 'bg-muted text-muted-foreground',
              }
              return (
                <TableRow key={topic.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {topic.isPinned && (
                        <span className="inline-flex items-center rounded bg-amber-500/10 px-1 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                          {t('pinned')}
                        </span>
                      )}
                      <span className="font-medium">{topic.title}</span>
                    </div>
                    {topic.lessonTitle && (
                      <div className="text-xs text-muted-foreground">{topic.lessonTitle}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {topic.userName ?? topic.userId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{topic.replyCount}</TableCell>
                  <TableCell className="px-4 py-2.5">{topic.viewCount}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        st.cls,
                      )}
                    >
                      {st.label ? t(st.label) : topic.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(topic)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(topic.id)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
