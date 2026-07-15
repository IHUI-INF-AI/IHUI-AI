'use client'

import { useTranslations } from 'next-intl'
import { Edit, Trash2, Loader2, Users, EyeOff } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { Circle } from './types'

const COLSPAN = 7

interface Props {
  list: Circle[]
  isLoading: boolean
  togglePending: boolean
  deletePending: boolean
  onEdit: (item: Circle) => void
  onToggle: (item: Circle) => void
  onDelete: (item: Circle) => void
}

export function CirclesTable({
  list,
  isLoading,
  togglePending,
  deletePending,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  const t = useTranslations('admin.circles')

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSlug')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreator')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colMembers')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPosts')}</TableHead>
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
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => {
              const creator = item.creator?.nickname ?? item.creatorName ?? '-'
              return (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2 font-medium">
                      {item.coverImage ? (
                        <img
                          src={item.coverImage}
                          alt={item.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : null}
                      <span className="max-w-xs truncate">{item.name}</span>
                    </div>
                    {item.description && (
                      <div className="max-w-xs truncate text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.slug}</code>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">{creator}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.memberCount}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.postCount}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        item.isPublished
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          item.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                        )}
                      />
                      {item.isPublished ? t('published') : t('draft')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(item)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggle(item)}
                        title={item.isPublished ? t('disable') : t('enable')}
                        disabled={togglePending}
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
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
