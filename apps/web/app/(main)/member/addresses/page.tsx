'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Loader2, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { AddressForm } from './AddressForm'
import { AddressesList } from './AddressesList'
import { EMPTY_ADDRESS } from './types'
import type { Address, AddressInput } from './types'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberAddressesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = React.useState<AddressInput | null>(null)
  const [editId, setEditId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'addresses'],
    queryFn: () =>
      api<{ list: Address[] }>('/api/addresses')
        .then((d) => d.list ?? [])
        .catch(() => [] as Address[]),
  })

  const saveMut = useMutation({
    mutationFn: (input: AddressInput) => {
      const body = JSON.stringify(input)
      return editId
        ? api(`/api/addresses/${editId}`, { method: 'PUT', body })
        : api('/api/addresses', { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', 'addresses'] })
      setEditing(null)
      setEditId(null)
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/addresses/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'addresses'] }),
  })
  const defaultMut = useMutation({
    mutationFn: (id: string) => api(`/api/addresses/${id}/default`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'addresses'] }),
  })

  const addresses = data ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editing.name.trim() || !editing.phone.trim() || !editing.detail.trim()) return
    saveMut.mutate(editing)
  }

  const startCreate = () => {
    setEditing({ ...EMPTY_ADDRESS })
    setEditId(null)
  }
  const startEdit = (a: Address) => {
    setEditing({ ...a })
    setEditId(a.id)
  }
  const cancel = () => {
    setEditing(null)
    setEditId(null)
  }

  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) =>
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <MapPin className="h-5 w-5 text-primary" />
            收货地址
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">管理下单时使用的收货地址</p>
        </div>
        {!editing && (
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4" />
            新增
          </Button>
        )}
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : editing ? (
        <AddressForm
          editing={editing}
          isPending={saveMut.isPending}
          errorMessage={saveMut.isError ? (saveMut.error as Error).message : undefined}
          onChange={set}
          onSubmit={handleSubmit}
          onCancel={cancel}
        />
      ) : (
        <AddressesList
          list={addresses}
          delPending={delMut.isPending}
          defaultPending={defaultMut.isPending}
          onEdit={startEdit}
          onDelete={(id) => delMut.mutate(id)}
          onSetDefault={(id) => defaultMut.mutate(id)}
        />
      )}
    </div>
  )
}
