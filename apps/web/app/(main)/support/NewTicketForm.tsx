'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, MessageSquare } from 'lucide-react'

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
} from '@ihui/ui-react'
import { api, PRIORITIES, textareaClass } from './helpers'
import type { Ticket, TicketPriority, Category } from './types'

export function NewTicketForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const t = useTranslations('supportNewTicketForm')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('')
  const [priority, setPriority] = React.useState<TicketPriority>('medium')
  const [err, setErr] = React.useState<string | null>(null)

  const { data: categoriesData } = useQuery({
    queryKey: ['cs-categories'],
    queryFn: () => api<{ list: Category[] }>(`/api/customer-service/categories`),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<{ ticket: Ticket }>(`/api/customer-service/tickets`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          categoryId: categoryId || null,
          priority,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-tickets'] })
      setTitle('')
      setDescription('')
      setCategoryId('')
      setPriority('medium')
      setErr(null)
      onDone()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const categories = categoriesData?.list ?? []

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setErr(null)
            if (title.trim().length < 2) {
              setErr(t('errTitleMin'))
              return
            }
            if (description.trim().length < 10) {
              setErr(t('errDescMin'))
              return
            }
            createMut.mutate()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="t-title">{t('titleLabel')}</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={200}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="t-category">{t('categoryLabel')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="t-category" className="h-9 w-full">
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
              <Label htmlFor="t-priority">{t('priorityLabel')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger id="t-priority" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`priority.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-desc">{t('descLabel')}</Label>
            <textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descPlaceholder')}
              maxLength={5000}
              rows={6}
              className={textareaClass}
            />
          </div>

          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onDone} disabled={createMut.isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <MessageSquare className="mr-1 h-4 w-4" />
              {t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
