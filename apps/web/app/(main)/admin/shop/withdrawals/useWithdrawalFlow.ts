'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, PAGE_SIZE, EMPTY_FLOW, type ListData, type WithdrawalFlowItem } from './types'

export function useWithdrawalFlow(enabled: boolean) {
  const qc = useQueryClient()

  const [fSearch, setFSearch] = React.useState({
    userId: '',
    amount: '',
    outBillNo: '',
    createdAt: '',
    updatedAt: '',
    transferDetail: '',
  })
  const [fDebounced, setFDebounced] = React.useState(fSearch)
  const [fStatus, setFStatus] = React.useState('all')
  const [fPage, setFPage] = React.useState(1)
  const [fOpen, setFOpen] = React.useState(false)
  const [fEditing, setFEditing] = React.useState<WithdrawalFlowItem | null>(null)
  const [fForm, setFForm] = React.useState(EMPTY_FLOW)
  const [fErr, setFErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => setFDebounced(fSearch), 400)
    return () => clearTimeout(timer)
  }, [fSearch])

  const fQs = React.useMemo(() => {
    const q = new URLSearchParams({ page: String(fPage), pageSize: String(PAGE_SIZE) })
    if (fStatus !== 'all') q.set('status', fStatus)
    if (fDebounced.userId) q.set('userId', fDebounced.userId)
    if (fDebounced.amount) q.set('amount', fDebounced.amount)
    if (fDebounced.outBillNo) q.set('outBillNo', fDebounced.outBillNo)
    if (fDebounced.createdAt) q.set('createdAt', fDebounced.createdAt)
    if (fDebounced.updatedAt) q.set('updatedAt', fDebounced.updatedAt)
    if (fDebounced.transferDetail) q.set('transferDetail', fDebounced.transferDetail)
    return q.toString()
  }, [fStatus, fDebounced, fPage])

  const { data: fData, isLoading: fLoading } = useQuery({
    queryKey: ['admin', 'shop', 'withdrawal-flow', fQs],
    queryFn: () => api<ListData<WithdrawalFlowItem>>(`/api/admin/shop/withdrawal-flow?${fQs}`),
    enabled,
  })

  const fSaveMut = useMutation({
    mutationFn: () => {
      const body = {
        userId: fForm.userId.trim(),
        amount: Number(fForm.amount) || 0,
        outBillNo: fForm.outBillNo.trim(),
        status: Number(fForm.status) || 0,
        transferDetail: fForm.transferDetail.trim() || undefined,
      }
      return fEditing
        ? api(`/api/admin/shop/withdrawal-flow/${fEditing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/shop/withdrawal-flow', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(fEditing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'withdrawal-flow'] })
      closeFlow()
    },
    onError: (e: Error) => setFErr(e.message),
  })

  const fDeleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/shop/withdrawal-flow/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'withdrawal-flow'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreateFlow() {
    setFEditing(null)
    setFForm(EMPTY_FLOW)
    setFErr(null)
    setFOpen(true)
  }
  function openEditFlow(w: WithdrawalFlowItem) {
    setFEditing(w)
    setFForm({
      userId: w.userId,
      amount: String(w.amount),
      outBillNo: w.outBillNo,
      status: String(w.status),
      transferDetail: w.transferDetail ?? '',
    })
    setFErr(null)
    setFOpen(true)
  }
  function closeFlow() {
    if (fSaveMut.isPending) return
    setFOpen(false)
    setFEditing(null)
    setFErr(null)
  }
  function submitFlow(e: React.FormEvent) {
    e.preventDefault()
    setFErr(null)
    if (!fForm.userId.trim()) {
      setFErr('请输入用户ID')
      return
    }
    fSaveMut.mutate()
  }
  function handleDeleteFlow(w: WithdrawalFlowItem) {
    if (!confirm(`确认删除流水记录 "${w.id}"?`)) return
    fDeleteMut.mutate(w.id)
  }
  function handleResetFlow() {
    setFSearch({
      userId: '',
      amount: '',
      outBillNo: '',
      createdAt: '',
      updatedAt: '',
      transferDetail: '',
    })
    setFStatus('all')
    setFPage(1)
  }

  const fList = fData?.list ?? []
  const fTotal = fData?.total ?? 0
  const fTotalPages = Math.max(1, Math.ceil(fTotal / PAGE_SIZE))

  return {
    fSearch,
    setFSearch,
    fStatus,
    setFStatus,
    fPage,
    setFPage,
    fList,
    fTotal,
    fTotalPages,
    fLoading,
    fOpen,
    setFOpen,
    fEditing,
    fForm,
    setFForm,
    fErr,
    fSaveMut,
    fDeleteMut,
    openCreateFlow,
    openEditFlow,
    closeFlow,
    submitFlow,
    handleDeleteFlow,
    handleResetFlow,
  }
}
