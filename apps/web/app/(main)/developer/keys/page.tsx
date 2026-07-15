'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Key, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { KeysList } from './KeysList'
import { KeyDialog } from './KeyDialog'
import type { ApiKey } from './types'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KeysPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<string[]>(['read'])

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'keys'],
    queryFn: () => api<ApiKey[]>('/api/developer/keys').catch(() => [] as ApiKey[]),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api('/api/developer/keys', {
        method: 'POST',
        body: JSON.stringify({ name, scopes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'keys'] })
      setOpen(false)
      setName('')
      setScopes(['read'])
      toast.success('密钥已创建')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'keys'] })
      toast.success('密钥已删除')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/keys/${id}/reset`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'keys'] })
      toast.success('密钥已重置')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function toggleScope(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Key className="h-5 w-5 text-primary" />
            密钥管理
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">创建与维护 API 密钥及权限范围</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          新建密钥
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <KeysList
        list={list}
        isLoading={isLoading}
        dateFmt={dateFmt}
        resetPending={resetMut.isPending}
        delPending={delMut.isPending}
        onReset={(id) => resetMut.mutate(id)}
        onDelete={(id) => delMut.mutate(id)}
      />

      <KeyDialog
        open={open}
        name={name}
        scopes={scopes}
        isPending={createMut.isPending}
        onOpenChange={setOpen}
        onNameChange={setName}
        onToggleScope={toggleScope}
        onCreate={() => createMut.mutate()}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}
