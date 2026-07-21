'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface Category {
  id: string
  name: string
}

interface CategoriesData {
  list: Category[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AiWorldCreatePage() {
  const t = useTranslations('aiWorldCreatePage')
  const router = useRouter()

  const [form, setForm] = React.useState({
    name: '',
    description: '',
    categoryId: '',
    coverImage: '',
    config: '',
  })
  const [err, setErr] = React.useState<string | null>(null)

  const { data: catData } = useQuery({
    queryKey: ['ai-world', 'categories'],
    queryFn: () => api<CategoriesData>('/api/ai-world/categories'),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.name.trim(),
        content: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
        coverImage: form.coverImage.trim() || undefined,
        config: form.config.trim() || undefined,
      }
      return api<unknown>('/api/ai-world/create', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('toastCreated'))
      router.push('/ai-world')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('errNameRequired'))
      return
    }
    createMut.mutate()
  }

  const categories = catData?.list ?? []
  const inputClass =
    'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/ai-world')}>
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="aw-name">
                {t('nameLabel')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aw-name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder={t('namePlaceholder')}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aw-desc">{t('descLabel')}</Label>
              <textarea
                id="aw-desc"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder={t('descPlaceholder')}
                rows={4}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aw-cat">{t('categoryLabel')}</Label>
              <select
                id="aw-cat"
                value={form.categoryId}
                onChange={(e) => update('categoryId', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{t('noCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aw-cover">{t('coverLabel')}</Label>
              <Input
                id="aw-cover"
                value={form.coverImage}
                onChange={(e) => update('coverImage', e.target.value)}
                placeholder={t('coverPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aw-config">{t('configLabel')}</Label>
              <textarea
                id="aw-config"
                value={form.config}
                onChange={(e) => update('config', e.target.value)}
                placeholder={t('configPlaceholder')}
                rows={3}
                className={`${inputClass} font-mono`}
              />
            </div>
          </CardContent>
        </Card>

        {err && <Alert variant="danger" description={err} />}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/ai-world')}
            disabled={createMut.isPending}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {createMut.isPending ? t('submitting') : t('create')}
          </Button>
        </div>
      </form>
    </div>
  )
}
