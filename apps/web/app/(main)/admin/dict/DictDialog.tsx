'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
} from '@ihui/ui'
import { textareaClass, LIST_CLASS_OPTIONS } from './helpers'
import { useZodForm } from '@/hooks/use-zod-form'
import {
  dictTypeSchema,
  dictItemSchema,
  type DictTypeFormValues,
  type DictItemFormValues,
} from '@/lib/form-schemas/dict'
import type { DictType, DictItem } from './types'

interface DictTypeDialogProps {
  open: boolean
  editing: DictType | null
  defaultValues: DictTypeFormValues
  isPending: boolean
  onValid: (values: DictTypeFormValues) => void
  onClose: () => void
}

export function DictTypeDialog({
  open,
  editing,
  defaultValues,
  isPending,
  onValid,
  onClose,
}: DictTypeDialogProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const { form, tValidation } = useZodForm<DictTypeFormValues>({
    schema: dictTypeSchema,
    defaultValues,
  })
  React.useEffect(() => {
    form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, open])

  const nameErr = form.formState.errors.name?.message
  const codeErr = form.formState.errors.code?.message

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('dict.editTypeTitle') : t('dict.createTypeTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dt-name">{t('dict.fieldName')}</Label>
            <Input
              id="dt-name"
              {...form.register('name')}
              placeholder={t('dict.namePlaceholder')}
              aria-invalid={!!nameErr}
            />
            {nameErr ? (
              <p className="text-xs text-destructive">
                {tValidation(nameErr as Parameters<typeof tValidation>[0])}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dt-code">{t('dict.fieldCode')}</Label>
            <Input
              id="dt-code"
              {...form.register('code')}
              placeholder="order_status"
              aria-invalid={!!codeErr}
            />
            {codeErr ? (
              <p className="text-xs text-destructive">
                {tValidation(codeErr as Parameters<typeof tValidation>[0])}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dt-desc">{t('dict.fieldDescription')}</Label>
            <textarea
              id="dt-desc"
              {...form.register('description')}
              rows={2}
              className={textareaClass}
              placeholder={t('dict.descriptionPlaceholder')}
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

interface DictItemDialogProps {
  open: boolean
  editing: DictItem | null
  parent: DictType | null
  defaultValues: DictItemFormValues
  isPending: boolean
  onValid: (values: DictItemFormValues) => void
  onClose: () => void
}

export function DictItemDialog({
  open,
  editing,
  parent,
  defaultValues,
  isPending,
  onValid,
  onClose,
}: DictItemDialogProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const { form } = useZodForm<DictItemFormValues>({
    schema: dictItemSchema,
    defaultValues,
  })
  React.useEffect(() => {
    form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, open])

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('dict.editItemTitle') : t('dict.createItemTitle')}
              {parent && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({parent.name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="di-label">{t('dict.fieldLabel')}</Label>
            <Input
              id="di-label"
              {...form.register('label')}
              placeholder={t('dict.labelPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="di-value">{t('dict.fieldValue')}</Label>
            <Input
              id="di-value"
              {...form.register('value')}
              placeholder="pending"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="di-sort">{t('dict.fieldSort')}</Label>
            <Input
              id="di-sort"
              type="number"
              {...form.register('sort', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="di-dictType">{t('dict.fieldDictType')}</Label>
            <Input
              id="di-dictType"
              {...form.register('dictType')}
              placeholder="order_status"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="di-listClass">{t('dict.fieldListClass')}</Label>
              <Select
                value={form.watch('listClass')}
                onValueChange={(v) =>
                  form.setValue('listClass', v as DictItemFormValues['listClass'], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="di-listClass">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIST_CLASS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t(`dict.listClass_${opt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="di-status">{t('dict.fieldStatus')}</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  id="di-status"
                  checked={form.watch('status') === 1}
                  onCheckedChange={(checked) =>
                    form.setValue('status', checked ? 1 : 0, { shouldDirty: true })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {form.watch('status') === 1
                    ? t('dict.statusEnabled')
                    : t('dict.statusDisabled')}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="di-cssClass">{t('dict.fieldCssClass')}</Label>
            <Input
              id="di-cssClass"
              {...form.register('cssClass')}
              placeholder="custom-class"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="di-remark">{t('dict.fieldRemark')}</Label>
            <textarea
              id="di-remark"
              {...form.register('remark')}
              rows={2}
              className={textareaClass}
              placeholder={t('dict.remarkPlaceholder')}
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
