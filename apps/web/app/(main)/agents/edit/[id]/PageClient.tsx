'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button } from '@ihui/ui'
import { AgentCreateForm } from '../../create/AgentCreateForm'
import { api } from '../../create/helpers'
import type { AgentForm, CategoriesData } from '../../create/types'

interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  categoryId: string | null
  status: string
  price: number
  isFree: boolean
  sort: number
  remark: string | null
}

function agentToForm(a: Agent): AgentForm {
  return {
    name: a.name ?? '',
    description: a.description ?? '',
    avatar: a.avatar ?? '',
    cover: a.cover ?? '',
    categoryId: a.categoryId ?? '',
    status: a.status ?? 'pending',
    price: String(a.price ?? 0),
    isFree: a.isFree ?? false,
    sort: String(a.sort ?? 0),
    remark: a.remark ?? '',
  }
}

export default function EditAgentPage() {
  const t = useTranslations('agents')
  const tc = useTranslations('common')
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [form, setForm] = React.useState<AgentForm | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agents', 'detail', id],
    queryFn: () => api<Agent>(`/api/agents/${id}`),
    enabled: !!id,
  })

  const { data: catData } = useQuery({
    queryKey: ['agents', 'categories'],
    queryFn: () => api<CategoriesData>(`/api/categories/list?page=1&pageSize=100`),
  })

  React.useEffect(() => {
    if (agent && !form) {
      setForm(agentToForm(agent))
    }
  }, [agent, form])

  const updateMut = useMutation({
    mutationFn: () => {
      const f = form!
      const body = {
        name: f.name.trim(),
        description: f.description.trim() || undefined,
        avatar: f.avatar.trim() || undefined,
        cover: f.cover.trim() || undefined,
        categoryId: f.categoryId || undefined,
        status: f.status,
        price: Number(f.price) || 0,
        isFree: f.isFree,
        sort: Number(f.sort) || 0,
        remark: f.remark.trim() || undefined,
      }
      return api<unknown>(`/api/agents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('updateSuccess'))
      router.push(`/agents/${id}`)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function update<K extends keyof AgentForm>(key: K, value: AgentForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form?.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    updateMut.mutate()
  }

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  const categories = catData?.list ?? []

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/agents/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
          {tc('back')}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('editTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('editSubtitle')}</p>
      </div>

      <AgentCreateForm
        form={form}
        update={update}
        categories={categories}
        err={err}
        isPending={updateMut.isPending}
        onSubmit={submit}
        onCancel={() => router.push(`/agents/${id}`)}
      />
    </div>
  )
}
