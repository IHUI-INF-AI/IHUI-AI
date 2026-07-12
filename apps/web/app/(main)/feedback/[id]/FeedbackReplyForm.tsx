'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, MessageSquare } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { STATUSES, PRIORITIES, selectClass } from './helpers'
import type { FeedbackStatus, Priority } from './types'

interface Props {
  status: FeedbackStatus
  setStatus: (v: FeedbackStatus) => void
  priority: Priority
  setPriority: (v: Priority) => void
  reply: string
  setReply: (v: string) => void
  formError: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function FeedbackReplyForm({
  status,
  setStatus,
  priority,
  setPriority,
  reply,
  setReply,
  formError,
  isPending,
  onSubmit,
}: Props) {
  const t = useTranslations('feedback')
  const tc = useTranslations('comments')

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4" />
          {tc('replyTitle')}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fb-status">
                {t('field_status')}
              </label>
              <Select value={status} onValueChange={(v) => setStatus(v as FeedbackStatus)}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`status_${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fb-priority">
                {t('field_priority')}
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`priority_${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="fb-reply">
              {tc('replyContent')}
            </label>
            <textarea
              id="fb-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={tc('replyPlaceholder')}
              maxLength={5000}
              rows={5}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {formError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? tc('submitting') : tc('submitReply')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
