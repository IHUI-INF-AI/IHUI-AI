'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, PAGE_SIZE, EMPTY_DETAIL, type ListData, type WithdrawalItem } from './types'

export function useWithdrawalDetail(enabled: boolean) {
  const qc = useQueryClient()

  const [dStatus, setDStatus] = React.useState('all')
  const [dSearch, setDSearch] = React.useState({
    user: '',
    outBillNo: '',
    reviewer: '',
    userName: '',
  })
  const [dDebounced, setDDebounced] = React.useState(dSearch)
  const [dAmountRange, setDAmountRange] = React.useState({ min: '', max: '' })
  const [dPage, setDPage] = React.useState(1)
  const [dOpen, setDOpen] = React.useState(false)
  const [dEditing, setDEditing] = React.useState<WithdrawalItem | null>(null)
  const [dForm, setDForm] = React.useState(EMPTY_DETAIL)
  const [dErr, setDErr] = React.useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [reviewForm, setReviewForm] = React.useState<WithdrawalItem | null>(null)
  const [reviewErr, setReviewErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => setDDebounced(dSearch), 400)
    return () => clearTimeout(timer)
  }, [dSearch])

  const dQs = React.useMemo(() => {
    const q = new URLSearchParams({ page: String(dPage), pageSize: String(PAGE_SIZE) })
    if (dStatus !== 'all') q.set('status', dStatus)
    if (dDebounced.user) q.set('user', dDebounced.user)
    if (dDebounced.outBillNo) q.set('outBillNo', dDebounced.outBillNo)
    if (dDebounced.reviewer) q.set('reviewer', dDebounced.reviewer)
    if (dDebounced.userName) q.set('userName', dDebounced.userName)
    if (dAmountRange.min) q.set('minAmount', dAmountRange.min)
    if (dAmountRange.max) q.set('maxAmount', dAmountRange.max)
    return q.toString()
  }, [dStatus, dDebounced, dAmountRange, dPage])

  const { data: dData, isLoading: dLoading } = useQuery({
    queryKey: ['admin', 'shop', 'withdrawals', dQs],
    queryFn: () => api<ListData<WithdrawalItem>>(`/api/admin/shop/withdrawals?${dQs}`),
    enabled,
  })

  const dSaveMut = useMutation({
    mutationFn: () => {
      const body = {
        user: dForm.user.trim(),
        amount: Number(dForm.amount) || 0,
        channel: dForm.channel,
        account: dForm.account.trim(),
        status: dForm.status,
      }
      return dEditing
        ? api(`/api/admin/shop/withdrawals/${dEditing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/shop/withdrawals', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(dEditing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'withdrawals'] })
      closeDetail()
    },
    onError: (e: Error) => setDErr(e.message),
  })

  const dDeleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/shop/withdrawals/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'withdrawals'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const auditMut = useMutation({
    mutationFn: (p: { id: string; action: 'approve' | 'reject' }) =>
      api(`/api/admin/shop/withdrawals/${p.id}/${p.action}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'shop', 'withdrawals'] }),
  })

  const reviewMut = useMutation({
    mutationFn: (p: { id: string; action: 'approve' | 'reject'; notes?: string }) => {
      const body: Record<string, unknown> = {}
      if (p.notes) body.notes = p.notes
      return api(`/api/admin/shop/withdrawals/${p.id}/${p.action}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success('审核完成')
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'withdrawals'] })
      setReviewOpen(false)
      setReviewForm(null)
    },
    onError: (e: Error) => setReviewErr(e.message),
  })

  function openCreateDetail() {
    setDEditing(null)
    setDForm(EMPTY_DETAIL)
    setDErr(null)
    setDOpen(true)
  }
  function openEditDetail(w: WithdrawalItem) {
    setDEditing(w)
    setDForm({
      user: w.user,
      amount: String(w.amount),
      channel: w.channel,
      account: w.account,
      status: w.status,
    })
    setDErr(null)
    setDOpen(true)
  }
  function closeDetail() {
    if (dSaveMut.isPending) return
    setDOpen(false)
    setDEditing(null)
    setDErr(null)
  }
  function submitDetail(e: React.FormEvent) {
    e.preventDefault()
    setDErr(null)
    if (!dForm.user.trim()) {
      setDErr('请输入用户')
      return
    }
    dSaveMut.mutate()
  }
  function handleDeleteDetail(w: WithdrawalItem) {
    if (!confirm(`确认删除提现记录 "${w.id}"?`)) return
    dDeleteMut.mutate(w.id)
  }
  function openReview(w: WithdrawalItem) {
    setReviewForm(w)
    setReviewErr(null)
    setReviewOpen(true)
  }
  function submitReview(action: 'approve' | 'reject') {
    if (!reviewForm) return
    reviewMut.mutate({ id: reviewForm.id, action, notes: reviewForm.notes })
  }
  function handleResetDetail() {
    setDSearch({ user: '', outBillNo: '', reviewer: '', userName: '' })
    setDAmountRange({ min: '', max: '' })
    setDStatus('all')
    setDPage(1)
  }

  const dList = dData?.list ?? []
  const dTotal = dData?.total ?? 0
  const dTotalPages = Math.max(1, Math.ceil(dTotal / PAGE_SIZE))

  return {
    dStatus,
    setDStatus,
    dSearch,
    setDSearch,
    dAmountRange,
    setDAmountRange,
    dPage,
    setDPage,
    dList,
    dTotal,
    dTotalPages,
    dLoading,
    dOpen,
    setDOpen,
    dEditing,
    dForm,
    setDForm,
    dErr,
    reviewOpen,
    setReviewOpen,
    reviewForm,
    setReviewForm,
    reviewErr,
    dSaveMut,
    dDeleteMut,
    auditMut,
    reviewMut,
    openCreateDetail,
    openEditDetail,
    closeDetail,
    submitDetail,
    handleDeleteDetail,
    openReview,
    submitReview,
    handleResetDetail,
  }
}
