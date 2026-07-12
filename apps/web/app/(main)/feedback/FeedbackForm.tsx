'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { TYPES, selectClass } from './helpers'
import type { FeedbackType } from './types'

interface Props {
  type: FeedbackType
  setType: (v: FeedbackType) => void
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  contact: string
  setContact: (v: string) => void
  formError: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function FeedbackForm({
  type,
  setType,
  title,
  setTitle,
  content,
  setContent,
  contact,
  setContact,
  formError,
  isPending,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations('feedback')
  const tc = useTranslations('common')

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-type">{t('type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`type_${v}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-title">{t('field_title')}</Label>
            <Input
              id="fb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={128}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-content">{t('field_content')}</Label>
            <textarea
              id="fb-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('contentPlaceholder')}
              maxLength={5000}
              rows={6}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-contact">{t('field_contact')}</Label>
            <Input
              id="fb-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('contactPlaceholder')}
              maxLength={128}
            />
          </div>

          {formError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
