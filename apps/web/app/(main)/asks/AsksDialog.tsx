'use client'

import * as React from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

interface Props {
  open: boolean
  setOpen: (o: boolean) => void
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  formError: string | null
  pending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function AsksDialog({
  open,
  setOpen,
  title,
  setTitle,
  content,
  setContent,
  formError,
  pending,
  onSubmit,
}: Props) {
  const t = useTranslations('asks')
  const tc = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {t('askQuestion')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('askQuestion')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ask-title">{t('title')}</Label>
            <Input
              id="ask-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ask-content">{t('content')}</Label>
            <textarea
              id="ask-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('contentPlaceholder')}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('askQuestion')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
