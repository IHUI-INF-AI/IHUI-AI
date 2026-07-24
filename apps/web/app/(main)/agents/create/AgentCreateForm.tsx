'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import { selectClass, STATUS_OPTIONS } from './helpers'
import type { AgentForm, Category } from './types'

interface Props {
  form: AgentForm
  update: <K extends keyof AgentForm>(key: K, value: AgentForm[K]) => void
  categories: Category[]
  err: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function AgentCreateForm({
  form,
  update,
  categories,
  err,
  isPending,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations('agents')
  const tc = useTranslations('common')

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-6">
      <div className="space-y-2">
        <Label htmlFor="ag-name">
          {t('fieldName')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ag-name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder={t('fieldNamePlaceholder')}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ag-desc">{t('fieldDescription')}</Label>
        <textarea
          id="ag-desc"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder={t('fieldDescriptionPlaceholder')}
          rows={4}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ag-avatar">{t('fieldAvatar')}</Label>
          <Input
            id="ag-avatar"
            value={form.avatar}
            onChange={(e) => update('avatar', e.target.value)}
            placeholder={t('fieldAvatarPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ag-cover">{t('fieldCover')}</Label>
          <Input
            id="ag-cover"
            value={form.cover}
            onChange={(e) => update('cover', e.target.value)}
            placeholder={t('fieldCoverPlaceholder')}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ag-cat">{t('fieldCategory')}</Label>
          <Select value={form.categoryId} onValueChange={(v) => update('categoryId', v)}>
            <SelectTrigger className={selectClass} id="ag-cat">
              <SelectValue placeholder={t('fieldCategoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ag-status">{t('fieldStatus')}</Label>
          <Select value={form.status} onValueChange={(v) => update('status', v)}>
            <SelectTrigger className={selectClass} id="ag-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ag-price">{t('fieldPrice')}</Label>
          <Input
            id="ag-price"
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
            disabled={form.isFree}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ag-sort">{t('fieldSort')}</Label>
          <Input
            id="ag-sort"
            type="number"
            min={0}
            value={form.sort}
            onChange={(e) => update('sort', e.target.value)}
          />
        </div>
        <div className="flex items-end space-y-2">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Switch
              id="ag-free"
              checked={form.isFree}
              onCheckedChange={(v) => update('isFree', v)}
            />
            <Label htmlFor="ag-free" className="cursor-pointer">
              {t('fieldIsFree')}
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ag-remark">{tc('remark')}</Label>
        <textarea
          id="ag-remark"
          value={form.remark}
          onChange={(e) => update('remark', e.target.value)}
          rows={2}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {err && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? t('submitting') : tc('submit')}
        </Button>
      </div>
    </form>
  )
}
