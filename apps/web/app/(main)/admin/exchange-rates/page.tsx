'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { Button } from '@ihui/ui'

import { ExchangeRateTable } from './ExchangeRateTable'
import { ExchangeRateDialog } from './ExchangeRateDialog'
import { api, EMPTY } from './helpers'
import type { ExchangeRate } from './types'

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

      <ExchangeRateTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(item) => {
          if (confirm('确认删除该汇率记录？')) deleteMut.mutate(item.id)
        }}
        deletePending={deleteMut.isPending}
      />

      <ExchangeRateDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />
    </div>
  )
}
