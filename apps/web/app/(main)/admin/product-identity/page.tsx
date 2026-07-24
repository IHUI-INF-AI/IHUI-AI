'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { ProductIdentityFilter } from './ProductIdentityFilter'
import { ProductIdentityTable } from './ProductIdentityTable'
import { ProductIdentityDialog } from './ProductIdentityDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EXPORT_COLUMNS, productIdentityToForm } from './helpers'
import type { ProductIdentity, ProductIdentityForm, ListData } from './types'

export default function ProductIdentityPage() {
  const qc = useQueryClient()
  const [searchBegin, setSearchBegin] = React.useState('')
  const [searchEnd, setSearchEnd] = React.useState('')
  const [searchCreator, setSearchCreator] = React.useState('')
  const [debouncedCreator, setDebouncedCreator] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProductIdentity | null>(null)
  const [form, setForm] = React.useState<ProductIdentityForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebouncedCreator(searchCreator)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [searchCreator])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'product-identity', searchBegin, searchEnd, debouncedCreator, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchBegin) qs.set('beginTime', searchBegin)
      if (searchEnd) qs.set('endTime', searchEnd)
      if (debouncedCreator) qs.set('creator', debouncedCreator)
      return api<ListData>(`/api/admin/product-identity?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        productName: form.productName.trim() || undefined,
        amount: form.amount.trim(),
        beginTime: form.beginTime || undefined,
        endTime: form.endTime || undefined,
        defAmount: form.defAmount || undefined,
        status: form.status ? 1 : 0,
        remark: form.remark || undefined,
      }
      return editing
        ? api(`/api/admin/product-identity/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/product-identity', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'product-identity'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/product-identity/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'product-identity'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: ProductIdentity) {
    setEditing(item)
    setForm(productIdentityToForm(item))
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.amount.trim()) {
      setErr('请输入金额')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: ProductIdentity) {
    if (!window.confirm(`确认删除 "${item.productName || item.id}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '产品身份',
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">产品身份管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:product_identity:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <ProductIdentityFilter
        searchBegin={searchBegin}
        setSearchBegin={(v) => {
          setSearchBegin(v)
          setPage(1)
        }}
        searchEnd={searchEnd}
        setSearchEnd={(v) => {
          setSearchEnd(v)
          setPage(1)
        }}
        searchCreator={searchCreator}
        setSearchCreator={setSearchCreator}
      />

      <ProductIdentityTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ProductIdentityDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
