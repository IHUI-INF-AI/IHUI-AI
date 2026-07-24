'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CreditCard, Loader2, Save, User } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui-react'

interface BusinessCard {
  id: string
  name: string
  title?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
  wechat?: string | null
  address?: string | null
  avatar?: string | null
  bio?: string | null
  template?: string
}

interface CardForm {
  name: string
  title: string
  company: string
  phone: string
  email: string
  wechat: string
  address: string
  avatar: string
  bio: string
  template: string
}

const TEMPLATES = [
  { value: 'minimal', labelKey: 'templates.minimal' },
  { value: 'business', labelKey: 'templates.business' },
  { value: 'creative', labelKey: 'templates.creative' },
]

const FIELDS: { key: keyof CardForm; labelKey: string; placeholderKey: string; type?: string }[] = [
  { key: 'name', labelKey: 'fields.name.label', placeholderKey: 'fields.name.placeholder' },
  { key: 'title', labelKey: 'fields.title.label', placeholderKey: 'fields.title.placeholder' },
  { key: 'company', labelKey: 'fields.company.label', placeholderKey: 'fields.company.placeholder' },
  { key: 'phone', labelKey: 'fields.phone.label', placeholderKey: 'fields.phone.placeholder' },
  { key: 'email', labelKey: 'fields.email.label', placeholderKey: 'fields.email.placeholder', type: 'email' },
  { key: 'wechat', labelKey: 'fields.wechat.label', placeholderKey: 'fields.wechat.placeholder' },
  { key: 'address', labelKey: 'fields.address.label', placeholderKey: 'fields.address.placeholder' },
  { key: 'avatar', labelKey: 'fields.avatar.label', placeholderKey: 'fields.avatar.placeholder' },
]

const EMPTY_FORM: CardForm = {
  name: '',
  title: '',
  company: '',
  phone: '',
  email: '',
  wechat: '',
  address: '',
  avatar: '',
  bio: '',
  template: 'minimal',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function BusinessCardEditPage() {
  const t = useTranslations('businessCardEditPage')
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const qc = useQueryClient()

  const [form, setForm] = React.useState<CardForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['business-card', editId],
    queryFn: () => api<BusinessCard>(`/api/business-card/${editId}`),
    enabled: !!editId,
  })

  React.useEffect(() => {
    if (data && !loaded) {
      setForm({
        name: data.name,
        title: data.title ?? '',
        company: data.company ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        wechat: data.wechat ?? '',
        address: data.address ?? '',
        avatar: data.avatar ?? '',
        bio: data.bio ?? '',
        template: data.template ?? 'minimal',
      })
      setLoaded(true)
    }
  }, [data, loaded])

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { template: form.template }
      for (const f of FIELDS) {
        const v = form[f.key].trim()
        body[f.key] = v || undefined
      }
      const url = editId ? `/api/business-card/${editId}` : '/api/business-card'
      return api(url, { method: editId ? 'PUT' : 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-card'] })
      router.push('/business-card')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('errors.nameRequired'))
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {editId ? t('editTitle') : t('createTitle')}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Link
        href="/business-card"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('cardInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {err && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {err}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-2">
                    <Label htmlFor={`bc-${f.key}`}>{t(f.labelKey)}</Label>
                    <Input
                      id={`bc-${f.key}`}
                      type={f.type ?? 'text'}
                      value={form[f.key]}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={t(f.placeholderKey)}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bc-bio">{t('bioLabel')}</Label>
                <textarea
                  id="bc-bio"
                  value={form.bio}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={t('bioPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('templateLabel')}</Label>
                <div className="flex gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, template: tpl.value }))}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                        form.template === tpl.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <User className="h-4 w-4" />
                      {t(tpl.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/business-card')}
                  disabled={saveMut.isPending}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={saveMut.isPending}>
                  {saveMut.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  {t('save')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
