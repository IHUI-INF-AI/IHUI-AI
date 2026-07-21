'use client'

import { Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { selectClass, type KBCategory, type KBForm } from './helpers'
import { TagInput } from './TagInput'

interface Props {
  form: KBForm
  categories: KBCategory[]
  tagInput: string
  err: string | null
  submitting: boolean
  submitLabel?: string
  onFormChange: (form: KBForm) => void
  onTagInputChange: (v: string) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function KBArticleForm({
  form,
  categories,
  tagInput,
  err,
  submitting,
  submitLabel,
  onFormChange,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations('kbArticleForm')
  const finalSubmitLabel = submitLabel ?? t('publish')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('articleInfo')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="kb-title">{t('titleLabel')}</Label>
            <Input
              id="kb-title"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder={t('titlePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-summary">{t('summaryLabel')}</Label>
            <Input
              id="kb-summary"
              value={form.summary}
              onChange={(e) => onFormChange({ ...form, summary: e.target.value })}
              placeholder={t('summaryPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-category">{t('categoryLabel')}</Label>
            <Select
              value={form.categoryId}
              onValueChange={(v) => onFormChange({ ...form, categoryId: v })}
            >
              <SelectTrigger className={selectClass} id="kb-category">
                <SelectValue placeholder={t('categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-tags">{t('tagsLabel')}</Label>
            <TagInput
              tags={form.tags}
              value={tagInput}
              onChange={onTagInputChange}
              onAdd={onAddTag}
              onRemove={onRemoveTag}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-content">{t('contentLabel')}</Label>
            <textarea
              id="kb-content"
              value={form.content}
              onChange={(e) => onFormChange({ ...form, content: e.target.value })}
              rows={14}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t('contentPlaceholder')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              {finalSubmitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
