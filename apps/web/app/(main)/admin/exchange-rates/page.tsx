'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeftRight, Plus } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

interface ExchangeRate {
  id: number
  fromCurrency: string
  toCurrency: string
  rate: number
  status: number
  createdAt: string
  updatedAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const th = 'px-4 py-2.5 font-medium'
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const EMPTY = { fromCurrency: '', toCurrency: '', rate: '', status: 1 }

export default function ExchangeRatesPage() {
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [currentPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ExchangeRate | null>(null)
  const [form, setForm] = React.useState(EMPTY)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'exchange-rates', currentPage],
    queryFn: () => api<{ list: ExchangeRate[]; total: number }>('/api/admin/exchange-rates'),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const rateNum = Number(form.rate)
      const body = {
        fromCurrency: form.fromCurrency,
        toCurrency: form.toCurrency,
        rate: rateNum,
        status: form.status,
      }
      return editing
        ? api<ExchangeRate>(`/api/admin/exchange-rates/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api<ExchangeRate>('/api/admin/exchange-rates', {
            method: 'POST',
            body: JSON.stringify(body),
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'exchange-rates'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api<void>(`/api/admin/exchange-rates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'exchange-rates'] })
      toast.success('删除成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: ExchangeRate) {
    setEditing(item)
    setForm({
      fromCurrency: item.fromCurrency,
      toCurrency: item.toCurrency,
      rate: String(item.rate),
      status: item.status,
    })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fromCurrency.trim()) {
      toast.error('请输入源货币')
      return
    }
    if (!form.toCurrency.trim()) {
      toast.error('请输入目标货币')
      return
    }
    const rateNum = Number(form.rate)
    if (!form.rate || isNaN(rateNum) || rateNum <= 0) {
      toast.error('请输入有效的汇率')
      return
    }
    saveMut.mutate()
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
          汇率管理
        </h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {tc('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>源货币</th>
              <th className={th}>目标货币</th>
              <th className={th}>汇率</th>
              <th className={th}>状态</th>
              <th className={th}>创建时间</th>
              <th className={th}>{tc('edit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <ArrowLeftRight className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.fromCurrency}</td>
                  <td className="px-4 py-2.5 font-medium">{item.toCurrency}</td>
                  <td className="px-4 py-2.5">{item.rate}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={item.status === 1 ? 'text-emerald-600' : 'text-muted-foreground'}
                    >
                      {item.status === 1 ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.createdAt}</td>
                  <td className="px-4 py-2.5 space-x-2">
                    <button className="text-primary hover:underline" onClick={() => openEdit(item)}>
                      {tc('edit')}
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => {
                        if (confirm('确认删除该汇率记录？')) deleteMut.mutate(item.id)
                      }}
                      disabled={deleteMut.isPending}
                    >
                      {tc('delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑汇率' : '新增汇率'}</DialogTitle>
              <DialogDescription>{editing ? '修改汇率信息' : '添加新的汇率记录'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="er-from">源货币</Label>
                <Input
                  id="er-from"
                  value={form.fromCurrency}
                  onChange={(e) => setForm({ ...form, fromCurrency: e.target.value })}
                  placeholder="如 USD"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="er-to">目标货币</Label>
                <Input
                  id="er-to"
                  value={form.toCurrency}
                  onChange={(e) => setForm({ ...form, toCurrency: e.target.value })}
                  placeholder="如 CNY"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="er-rate">汇率</Label>
                <Input
                  id="er-rate"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder="如 7.25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="er-status">状态</Label>
                <Select
                  value={String(form.status)}
                  onValueChange={(v) => setForm({ ...form, status: Number(v) })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">启用</SelectItem>
                    <SelectItem value="0">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
