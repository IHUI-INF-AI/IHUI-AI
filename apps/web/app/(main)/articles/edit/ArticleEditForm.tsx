'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Send } from 'lucide-react'
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
} from '@ihui/ui-react'
import type { ArticleForm, ArticleCategoryOption } from './types'

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface Props {
  form: ArticleForm
  categories: ArticleCategoryOption[]
  isEdit: boolean
  isPending: boolean
  err: string | null
  onFormChange: (form: ArticleForm) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function ArticleEditForm({
  form,
  categories,
  isEdit,
  isPending,
  err,
  onFormChange,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations('articles')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('editFormTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="a-title">{t('titleField')}</Label>
            <Input
              id="a-title"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder={t('titlePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a-summary">{t('summaryField')}</Label>
            <Input
              id="a-summary"
              value={form.summary}
              onChange={(e) => onFormChange({ ...form, summary: e.target.value })}
              placeholder={t('summaryPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a-cover">{t('coverField')}</Label>
            <Input
              id="a-cover"
              value={form.coverImage}
              onChange={(e) => onFormChange({ ...form, coverImage: e.target.value })}
              placeholder={t('coverPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a-category">{t('categoryField')}</Label>
            <Select
              value={form.categoryId}
              onValueChange={(v) => onFormChange({ ...form, categoryId: v })}
            >
              <SelectTrigger className={selectClass} id="a-category">
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
            <Label htmlFor="a-content">{t('contentField')}</Label>
            <textarea
              id="a-content"
              value={form.content}
              onChange={(e) => onFormChange({ ...form, content: e.target.value })}
              rows={12}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t('contentPlaceholder')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              {isEdit ? t('save', { default: '保存' }) : t('publish')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
