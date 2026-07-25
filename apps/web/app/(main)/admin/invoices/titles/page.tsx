'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Plus, Edit, Trash2, ChevronLeft, ChevronRight, FileText } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'

import { TitleDialog } from './TitleDialog'
import {
  api,
  EMPTY_FORM,
  PAGE_SIZE,
  type InvoiceTitle,
  type TitleForm,
  type TitlesData,
} from './types'

export default function AdminInvoiceTitlesPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<InvoiceTitle | null>(null)
  const [form, setForm] = React.useState<TitleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'invoice-titles', page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      return api<TitlesData>(`/api/admin/invoices/titles?${qs.toString()}`)
    },
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form }
      return editing
        ? api<InvoiceTitle>(`/api/admin/invoices/titles/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api<InvoiceTitle>(`/api/admin/invoices/titles`, {
            method: 'POST',
            body: JSON.stringify(body),
          })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'invoice-titles'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/invoices/titles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'invoice-titles'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(t: InvoiceTitle) {
    setEditing(t)
    setForm({
      titleName: t.titleName,
      taxNo: t.taxNo,
      titleType: t.titleType,
      bankName: t.bankName ?? '',
      bankAccount: t.bankAccount ?? '',
      address: t.address ?? '',
      phone: t.phone ?? '',
      isDefault: t.isDefault,
    })
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
    if (!form.titleName.trim()) {
      setErr('请输入抬头名称')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(t: InvoiceTitle) {
    if (!window.confirm('确认删除该发票抬头?')) return
    deleteMut.mutate(t.id)
  }

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">发票抬头管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理用户与企业发票抬头信息</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          新建抬头
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">抬头名称</TableHead>
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">税号</TableHead>
              <TableHead className="px-4 py-2.5">默认</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  接口未配置或加载失败
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无发票抬头
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{t.titleName}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        t.titleType === 'company'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t.titleType === 'company' ? '企业' : '个人'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {t.taxNo || '—'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {t.isDefault ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        默认
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {dateFmt.format(new Date(t.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content="编辑">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="删除">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(t)}
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <TitleDialog
        open={open}
        setOpen={setOpen}
        editing={!!editing}
        form={form}
        setForm={setForm}
        err={err}
        saving={saveMut.isPending}
        onClose={closeDialog}
        onSubmit={submit}
      />
    </div>
  )
}
