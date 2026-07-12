'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { exportFromApi, exportToExcel } from '@/lib/export-utils'
import { api, PAGE_SIZE, type VipCrudConfig } from './helpers'
import type { Item, FormState } from './types'

export function useVipCrud(config: VipCrudConfig) {
  const qc = useQueryClient()

  const [search, setSearch] = React.useState<FormState>(
    Object.fromEntries(config.searchFields.map((f) => [f.key, ''])),
  )
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Item | null>(null)
  const [form, setForm] = React.useState<FormState>(config.empty)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(page), pageSize: String(PAGE_SIZE) }
    for (const f of config.searchFields) {
      const v = search[f.key]?.trim()
      if (v) p[f.key] = v
    }
    return p
  }, [search, page, config.searchFields])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', config.perm, params],
    queryFn: () =>
      api<{ list: Item[]; total: number }>(`${config.resource}?${new URLSearchParams(params)}`),
    enabled: config.enabled,
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${config.resource}/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(form),
          })
        : api(config.resource, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', config.perm] })
      toast.success(editing ? '更新成功' : '创建成功')
      closeDialog()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`${config.resource}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', config.perm] })
      toast.success('删除成功')
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(config.empty)
    setOpen(true)
  }
  function openEdit(item: Item) {
    setEditing(item)
    const next: FormState = { ...config.empty }
    for (const k of config.allKeys) next[k] = String(item[k] ?? '')
    setForm(next)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    for (const f of config.fields)
      if (f.required && !form[f.key]?.trim()) {
        toast.error(`${f.label}为必填项`)
        return
      }
    saveMut.mutate()
  }
  function handleReset() {
    setSearch(Object.fromEntries(config.searchFields.map((f) => [f.key, ''])))
    setPage(1)
  }
  async function handleExport() {
    if (config.exportMode === 'api') {
      const ok = await exportFromApi(
        `${config.resource}?${new URLSearchParams(params)}`,
        config.exportName,
        config.exportColumns,
      )
      if (!ok) toast.error('导出失败')
    } else {
      exportToExcel(
        config.exportName,
        config.exportColumns,
        list as unknown as Record<string, unknown>[],
      )
    }
  }

  return {
    search,
    setSearch,
    page,
    setPage,
    open,
    editing,
    form,
    setForm,
    delId,
    setDelId,
    list,
    total,
    totalPages,
    isLoading,
    saveMut,
    delMut,
    openCreate,
    openEdit,
    closeDialog,
    submit,
    handleReset,
    handleExport,
  }
}
