'use client'
import { Trash2, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isNotFound } from '@/lib/api-error'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import type { Member } from './types'

interface Props {
  rows: Member[]
  isLoading: boolean
  error: unknown
  classId: string
  onRemove: (m: Member) => void
  removePending: boolean
}

export function MemberTable({ rows, isLoading, error, classId, onRemove, removePending }: Props) {
  const t = useTranslations('admin.eduClassMembers')
  const noEndpoint = isNotFound(error)

  if (!classId) {
    return (
      <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
        <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
        {t('enterClassId')}
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (noEndpoint) {
    return (
      <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
        <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
        {t('endpointNotConfigured')}
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
        <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
        {t('noMembers')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colStudent')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRole')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colJoinedAt')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {rows.map((m) => (
            <TableRow key={m.id} className="hover:bg-muted/30">
              <TableCell className="px-4 py-2.5 font-medium">
                {m.userName ?? m.userId.slice(0, 8)}
              </TableCell>
              <TableCell className="px-4 py-2.5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    m.role === 'teacher'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
                  )}
                >
                  {m.role === 'teacher' ? t('roleTeacher') : t('roleStudent')}
                </span>
              </TableCell>
              <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                {m.joinedAt}
              </TableCell>
              <TableCell className="px-4 py-2.5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    m.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {m.status === 'active' ? t('statusActive') : t('statusLeft')}
                </span>
              </TableCell>
              <TableCell className="px-4 py-2.5 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(m)}
                  title={t('remove')}
                  className="text-destructive hover:text-destructive"
                  disabled={removePending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
