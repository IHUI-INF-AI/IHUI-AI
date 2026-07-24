'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Input, Textarea } from '@/components/form'

interface Props {
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  tagsText: string
  setTagsText: (v: string) => void
  formError: string | null
  pending: boolean
  onSubmit: () => void
  onCancel: () => void
  isEdit: boolean
}

export function AskEditForm({
  title,
  setTitle,
  content,
  setContent,
  tagsText,
  setTagsText,
  formError,
  pending,
  onSubmit,
  onCancel,
  isEdit,
}: Props) {
  const t = useTranslations('asksEditFormPage')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{isEdit ? t('editTitle') : t('publishTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          label={t('titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          maxLength={200}
        />
        <Textarea
          label={t('contentLabel')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('contentPlaceholder')}
          rows={6}
        />
        <Input
          label={t('tagsLabel')}
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder={t('tagsPlaceholder')}
        />
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isEdit ? t('saveButton') : t('publishButton')}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
