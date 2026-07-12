'use client'

import { StickyNote, Loader2, Globe, Lock, Edit, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { Note } from './types'

interface Props {
  list: Note[]
  isLoading: boolean
  error: Error | null
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
  deletePending: boolean
}

export function NotesList({ list, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('notes')
  const tc = useTranslations('student')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tc('loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    )
  }
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
        <StickyNote className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {list.map((note) => (
        <Card key={note.id} className="transition-colors hover:bg-accent">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{note.title || t('titleField')}</h3>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  note.isPublic
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {note.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {t('isPublic')}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{note.content}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(note.createdAt).toLocaleDateString('zh-CN')}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(note)}>
                  <Edit className="h-4 w-4" />
                  {t('edit')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={deletePending}
                  onClick={() => onDelete(note)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('delete')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
