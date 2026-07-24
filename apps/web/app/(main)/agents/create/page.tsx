'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { AgentCreateForm } from './AgentCreateForm'
import { EMPTY_FORM, api } from './helpers'
import type { AgentForm, CategoriesData } from './types'

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

      <AgentCreateForm
        form={form}
        update={update}
        categories={categories}
        err={err}
        isPending={createMut.isPending}
        onSubmit={submit}
        onCancel={() => router.push('/agents')}
      />
    </div>
  )
}
