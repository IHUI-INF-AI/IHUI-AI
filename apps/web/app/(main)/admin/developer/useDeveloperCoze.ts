'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { COZE_PAGE_SIZE, COZE_EXPORT_COLUMNS, EMPTY_COZE } from './helpers'
import type { CozeAccount, CozeListData, CozeForm } from './types'

export function useDeveloperCoze() {
  const qc = useQueryClient()

  const [cozeOpen, setCozeOpen] = React.useState(false)
  const [cozeEditing, setCozeEditing] = React.useState<CozeAccount | null>(null)
  const [cozeForm, setCozeForm] = React.useState<CozeForm>(EMPTY_COZE)
  const [cozeSearch, setCozeSearch] = React.useState('')
  const [cozeDebounced, setCozeDebounced] = React.useState('')
  const [cozePage, setCozePage] = React.useState(1)
  const [cozeErr, setCozeErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setCozeDebounced(cozeSearch)
      setCozePage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [cozeSearch])

  const { data: cozeData, isLoading: cozeLoading } = useQuery({
    queryKey: ['admin', 'developer', 'coze', cozeDebounced, cozePage],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(cozePage),
        pageSize: String(COZE_PAGE_SIZE),
      })
      if (cozeDebounced) qs.set('keyword', cozeDebounced)
      const r = await fetchApi<CozeListData>(`/api/admin/developer/coze?${qs.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const cozeSaveMut = useMutation({
    mutationFn: async () => {
      const body = {
        cozeId: cozeForm.cozeId.trim(),
        signAccount: cozeForm.signAccount.trim(),
        signPassword: cozeForm.signPassword.trim(),
        signNickname: cozeForm.signNickname.trim(),
        platform: cozeForm.platform.trim(),
        address: cozeForm.address.trim(),
        status: Number(cozeForm.status),
      }
      const url = cozeEditing
        ? `/api/admin/developer/coze/${cozeEditing.id}`
        : '/api/admin/developer/coze'
      const r = await fetchApi(url, {
        method: cozeEditing ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      toast.success(cozeEditing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'coze'] })
      closeCozeDialog()
    },
    onError: (e: Error) => setCozeErr(e.message),
  })

  const cozeStatusMut = useMutation({
    mutationFn: async (p: { id: string; status: number }) => {
      const r = await fetchApi(`/api/admin/developer/coze/${p.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: p.status }),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      toast.success('状态已更新')
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'coze'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cozeDeleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/developer/coze/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'coze'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCozeCreate() {
    setCozeEditing(null)
    setCozeForm(EMPTY_COZE)
    setCozeErr(null)
    setCozeOpen(true)
  }
  function openCozeEdit(c: CozeAccount) {
    setCozeEditing(c)
    setCozeForm({
      cozeId: c.cozeId,
      signAccount: c.signAccount,
      signPassword: c.signPassword,
      signNickname: c.signNickname,
      platform: c.platform,
      address: c.address,
      status: String(c.status),
    })
    setCozeErr(null)
    setCozeOpen(true)
  }
  function closeCozeDialog() {
    if (cozeSaveMut.isPending) return
    setCozeOpen(false)
    setCozeEditing(null)
    setCozeErr(null)
  }
  function submitCoze(e: React.FormEvent) {
    e.preventDefault()
    setCozeErr(null)
    if (!cozeForm.cozeId.trim()) return setCozeErr('请输入 Coze ID')
    if (!cozeForm.signAccount.trim()) return setCozeErr('请输入签权账号')
    cozeSaveMut.mutate()
  }
  function handleCozeExport() {
    exportToExcel(
      'Coze开发者账号',
      COZE_EXPORT_COLUMNS,
      (cozeData?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const cozeList = cozeData?.list ?? []
  const cozeTotal = cozeData?.total ?? 0
  const cozeTotalPages = Math.max(1, Math.ceil(cozeTotal / COZE_PAGE_SIZE))

  return {
    cozeOpen,
    cozeEditing,
    cozeForm,
    setCozeForm,
    cozeSearch,
    setCozeSearch,
    cozePage,
    setCozePage,
    cozeErr,
    cozeLoading,
    cozeList,
    cozeTotal,
    cozeTotalPages,
    cozeSaveMut,
    cozeStatusMut,
    cozeDeleteMut,
    openCozeCreate,
    openCozeEdit,
    closeCozeDialog,
    submitCoze,
    handleCozeExport,
  }
}
