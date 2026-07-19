'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { selectClass, textareaClass } from './helpers'
import { useZodForm } from '@/hooks/use-zod-form'
import { askSchema, type AskFormValues } from '@/lib/form-schemas/ask'
import type { AskItem } from './types'

interface Props {
  open: boolean
  editing: AskItem | null
  defaultValues: AskFormValues
  savePending: boolean
  onValid: (values: AskFormValues) => void
  onClose: () => void
}

export function AskDialog({
  open,
  editing,
  defaultValues,
  savePending,
  onValid,
  onClose,
}: Props) {
  const t = useTranslations('admin.asks')
  const { form } = useZodForm<AskFormValues>({
    schema: askSchema,
    defaultValues,
  })
  React.useEffect(() => {
    form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, open])

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{t('createDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ask-title">{t('fieldTitle')}</Label>
            <Input
              id="ask-title"
              {...form.register('title')}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ask-content">{t('fieldContent')}</Label>
            <textarea
              id="ask-content"
              {...form.register('content')}
              placeholder={t('contentPlaceholder')}
              rows={5}
              className={textareaClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ask-tags">{t('fieldTags')}</Label>
            <Input
              id="ask-tags"
              {...form.register('tags')}
              placeholder={t('tagsPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ask-status">{t('fieldStatus')}</Label>
              <Select
                value={String(form.watch('status'))}
                onValueChange={(v) => form.setValue('status', Number(v) as AskFormValues['status'], { shouldDirty: true })}
              >
                <SelectTrigger className={selectClass} id="ask-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('statusApproved')}</SelectItem>
                  <SelectItem value="0">{t('statusHidden')}</SelectItem>
                  <SelectItem value="-1">{t('statusDeleted')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch('isResolved')}
                  onChange={(e) => form.setValue('isResolved', e.target.checked, { shouldDirty: true })}
                  className="h-4 w-4 accent-primary"
                />
                {t('fieldResolved')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
