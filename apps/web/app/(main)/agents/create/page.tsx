'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Switch } from '@ihui/ui'

interface Category {
  categoryId: string
  name: string
  description: string | null
  icon: string | null
  sort: number
  status: string
  isPaid: boolean
  createdAt: string
}

interface CategoriesData {
  list: Category[]
  total: number
  page: number
  pageSize: number
}

interface AgentForm {
  name: string
  description: string
  avatar: string
  cover: string
  categoryId: string
  status: string
  price: string
  isFree: boolean
  sort: string
  remark: string
}

const EMPTY_FORM: AgentForm = {
  name: '',
  description: '',
  avatar: '',
  cover: '',
  categoryId: '',
  status: 'pending',
  price: '0',
  isFree: true,
  sort: '0',
  remark: '',
}

const STATUS_OPTIONS = ['pending', 'published', 'rejected', 'offline']

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function CreateAgentPage() {
  const t = useTranslations('agents')
  const tc = useTranslations('common')
  const router = useRouter()

  const [form, setForm] = React.useState<AgentForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: catData } = useQuery({
    queryKey: ['agents', 'categories'],
    queryFn: () => api<CategoriesData>(`/api/categories/list?page=1&pageSize=100`),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        avatar: form.avatar.trim() || undefined,
        cover: form.cover.trim() || undefined,
        categoryId: form.categoryId || undefined,
        status: form.status,
        price: Number(form.price) || 0,
        isFree: form.isFree,
        sort: Number(form.sort) || 0,
        remark: form.remark.trim() || undefined,
      }
      return api<unknown>('/api/agents/create', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      router.push('/agents')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function update<K extends keyof AgentForm>(key: K, value: AgentForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    createMut.mutate()
  }

  const categories = catData?.list ?? []

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/agents')}>
          <ArrowLeft className="h-4 w-4" />
          {tc('back')}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('createTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('createSubtitle')}</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border p-6">
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
            autoFocus
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
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/agents')}
            disabled={createMut.isPending}
          >
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {createMut.isPending ? t('submitting') : tc('submit')}
          </Button>
        </div>
      </form>
    </div>
  )
}
