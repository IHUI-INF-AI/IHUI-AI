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
} from '@ihui/ui'

import { useZodForm } from '@/hooks/use-zod-form'
import { tagSchema, type TagFormValues } from '@/lib/form-schemas/tag'
import type { TagItem } from './types'

interface FormProps {
  open: boolean
  editing: TagItem | null
  defaultValues: TagFormValues
  savePending: boolean
  onValid: (values: TagFormValues) => void
  onClose: () => void
}

export function TagFormDialog({
  open,
  editing,
  defaultValues,
  savePending,
  onValid,
  onClose,
}: FormProps) {
  const t = useTranslations('admin.tags')
  const tc = useTranslations('common')
  const { form, tValidation } = useZodForm<TagFormValues>({
    schema: tagSchema,
    defaultValues,
  })
  // defaultValues 用 ref:避免加入 deps 后父组件传入新对象引用导致表单被反复重置
  const defaultValuesRef = React.useRef(defaultValues)
  defaultValuesRef.current = defaultValues
  // 每次 defaultValues 变更(切换 editing)时重置表单
  React.useEffect(() => {
    form.reset(defaultValuesRef.current)
  }, [editing?.id, open, form])

  const nameErr = form.formState.errors.name?.message

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onValid)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="tag-name">{t('name')}</Label>
            <Input
              id="tag-name"
              {...form.register('name')}
              placeholder={t('namePlaceholder')}
              maxLength={64}
              aria-invalid={!!nameErr}
            />
            {nameErr ? (
              <p className="text-xs text-destructive">
                {tValidation(nameErr as Parameters<typeof tValidation>[0])}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-desc">{t('description')}</Label>
            <Input
              id="tag-desc"
              {...form.register('description')}
              placeholder={t('descPlaceholder')}
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-color">{t('color')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tag-color"
                {...form.register('color')}
                placeholder="#3b82f6"
                className="flex-1"
              />
              {form.watch('color') ? (
                <span
                  className="h-9 w-9 shrink-0 rounded-md border"
                  style={{ backgroundColor: form.watch('color') }}
                />
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {editing ? tc('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteProps {
  delId: string | null
  delPending: boolean
  onConfirm: () => void
  onClose: () => void
}

export function TagDeleteDialog({ delId, delPending, onConfirm, onClose }: DeleteProps) {
  const t = useTranslations('admin.tags')
  const tc = useTranslations('common')
  return (
    <Dialog
      open={delId !== null}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteConfirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={delPending}>
            {tc('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={delPending} onClick={onConfirm}>
            {delPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {tc('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
