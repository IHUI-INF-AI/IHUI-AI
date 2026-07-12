'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { textareaClass } from './helpers'

interface DeveloperKeyDialogProps {
  open: boolean
  name: string
  isPending: boolean
  onNameChange: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}

export function DeveloperKeyDialog({
  open,
  name,
  isPending,
  onNameChange,
  onClose,
  onSubmit,
}: DeveloperKeyDialogProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : !isPending && onClose())}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) {
              toast.error(t('developer.nameRequired'))
              return
            }
            onSubmit()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t('developer.createKeyTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="k-name">{t('developer.fieldName')}</Label>
            <Input
              id="k-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('developer.namePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeveloperWebhookDialogProps {
  open: boolean
  url: string
  events: string
  isPending: boolean
  onUrlChange: (v: string) => void
  onEventsChange: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}

export function DeveloperWebhookDialog({
  open,
  url,
  events,
  isPending,
  onUrlChange,
  onEventsChange,
  onClose,
  onSubmit,
}: DeveloperWebhookDialogProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : !isPending && onClose())}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!url.trim()) {
              toast.error(t('developer.urlRequired'))
              return
            }
            onSubmit()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t('developer.createWebhookTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="w-url">URL</Label>
            <Input
              id="w-url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/hooks/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-events">{t('developer.fieldEvents')}</Label>
            <textarea
              id="w-events"
              value={events}
              onChange={(e) => onEventsChange(e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder="order.created,order.paid"
            />
            <p className="text-xs text-muted-foreground">{t('developer.eventsHint')}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
