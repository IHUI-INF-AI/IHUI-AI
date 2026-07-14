'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Loader2, Plus, Pencil, Trash2, Check, X } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface Address {
  id: string
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
}

type AddressInput = Omit<Address, 'id'>

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY: AddressInput = {
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false,
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
    setEditing({ ...EMPTY })
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
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">收货人</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => set('name', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">手机号</Label>
                  <Input
                    value={editing.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  placeholder="省"
                  value={editing.province}
                  onChange={(e) => set('province', e.target.value)}
                />
                <Input
                  placeholder="市"
                  value={editing.city}
                  onChange={(e) => set('city', e.target.value)}
                />
                <Input
                  placeholder="区"
                  value={editing.district}
                  onChange={(e) => set('district', e.target.value)}
                />
              </div>
              <Input
                placeholder="详细地址"
                value={editing.detail}
                onChange={(e) => set('detail', e.target.value)}
                required
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.isDefault}
                  onChange={(e) => set('isDefault', e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                设为默认地址
              </label>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saveMut.isPending}>
                  {saveMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  保存
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={cancel}>
                  <X className="h-4 w-4" />
                  取消
                </Button>
              </div>
              {saveMut.isError && (
                <Alert variant="danger" description={(saveMut.error as Error).message} />
              )}
            </form>
          </CardContent>
        </Card>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">还没有添加收货地址</p>
        </div>
      ) : (
        <div className="space-y-2">
          {addresses.map((a) => (
            <Card key={a.id} className="transition-colors hover:bg-accent">
              <CardContent className="space-y-1 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.phone}</span>
                    {a.isDefault && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        默认
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEdit(a)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => delMut.mutate(a.id)}
                      disabled={delMut.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {a.province}
                  {a.city}
                  {a.district}
                  {a.detail}
                </p>
                {!a.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => defaultMut.mutate(a.id)}
                    disabled={defaultMut.isPending}
                  >
                    <Check className="h-3 w-3" />
                    设为默认
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
