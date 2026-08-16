'use client'

import * as React from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
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
import { listAiSkills } from '@ihui/api-client/endpoints/ai-skills'
import { selectClass, STATUS_OPTIONS, STATUS_KEY } from './helpers'
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
  const t = useTranslations('agent')
  const tc = useTranslations('common')

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4 min-[768px]:p-6">
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

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
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
                  {t(STATUS_KEY[s] ?? 'statusUnknown')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-3">
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

      {/* 绑定技能 */}
      <div className="space-y-2">
        <Label>{t('fieldSkills')}</Label>
        <SkillCheckboxList selected={form.skillIds} onChange={(ids) => update('skillIds', ids)} />
      </div>

      {err && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
      )}

      <div className="flex justify-end gap-2 mt-4 pt-4">
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

interface SkillCheckboxListProps {
  selected: string[]
  onChange: (ids: string[]) => void
}

function SkillCheckboxList({ selected, onChange }: SkillCheckboxListProps) {
  const t = useTranslations('agent')
  const ta = useTranslations('aiSkillsPage')

  const { data, isLoading } = useQuery({
    queryKey: ['ai-skills', 'list'],
    queryFn: () => listAiSkills({ category: 'all' }),
  })

  const skills = React.useMemo(() => {
    if (!data?.success || !data.data) return []
    return data.data.filter((s) => s.available)
  }, [data])

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    onChange(next)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (skills.length === 0) {
    return <p className="text-xs text-muted-foreground">{ta('recommendEmpty')}</p>
  }

  return (
    <div className="grid grid-cols-1 gap-1.5 min-[480px]:grid-cols-2">
      {skills.map((skill) => {
        const checked = selected.includes(skill.id)
        return (
          <label
            key={skill.id}
            className="flex cursor-pointer items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent/50 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(skill.id)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                <span className="text-xs font-medium">{skill.name}</span>
              </div>
              {skill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {skill.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </label>
        )
      })}
    </div>
  )
}
