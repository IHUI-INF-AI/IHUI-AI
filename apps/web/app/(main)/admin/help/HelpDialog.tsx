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
import { selectClass, HELP_CATEGORIES } from './helpers'
import { slugify } from '@/lib/content'
import { useZodForm } from '@/hooks/use-zod-form'
import { helpSchema, type HelpFormValues } from '@/lib/form-schemas/help'
import type { HelpArticle } from './types'

interface Props {
  open: boolean
  editing: HelpArticle | null
  defaultValues: HelpFormValues
  savePending: boolean
  onValid: (values: HelpFormValues) => void
  onClose: () => void
}

export function HelpDialog({
  open,
  editing,
  defaultValues,
  savePending,
  onValid,
  onClose,
}: Props) {
  const t = useTranslations('admin.help')
  const tc = useTranslations('common')
  const { form } = useZodForm<HelpFormValues>({
    schema: helpSchema,
    defaultValues,
  })
  const [slugTouched, setSlugTouched] = React.useState(false)
  // defaultValues/editing 用 ref:避免加入 deps 后父组件传入新对象引用导致反复重置
  const defaultValuesRef = React.useRef(defaultValues)
  defaultValuesRef.current = defaultValues
  const editingRef = React.useRef(editing)
  editingRef.current = editing
  React.useEffect(() => {
    form.reset(defaultValuesRef.current)
    setSlugTouched(!!editingRef.current)
  }, [editing?.id, open, form])

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{t('createDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="h-title">{t('fieldTitle')}</Label>
            <Input
              id="h-title"
              {...form.register('title')}
              placeholder={t('titlePlaceholder')}
              onChange={(e) => {
                const title = e.target.value
                form.setValue('title', title)
                if (!slugTouched) {
                  form.setValue('slug', slugify(title))
                }
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="h-slug">{t('fieldSlug')}</Label>
              <Input
                id="h-slug"
                {...form.register('slug')}
                placeholder={t('slugPlaceholder')}
                className="font-mono text-xs"
                onChange={(e) => {
                  setSlugTouched(true)
                  form.setValue('slug', e.target.value)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-category">{t('fieldCategory')}</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(v) =>
                  form.setValue('category', v as HelpFormValues['category'], { shouldDirty: true })
                }
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HELP_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-content">{t('fieldContent')}</Label>
            <textarea
              id="h-content"
              {...form.register('content')}
              placeholder={t('contentPlaceholder')}
              rows={6}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.watch('isPublished')}
              onChange={(e) =>
                form.setValue('isPublished', e.target.checked, { shouldDirty: true })
              }
              className="h-4 w-4 accent-primary"
            />
            {t('fieldPublished')}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
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
