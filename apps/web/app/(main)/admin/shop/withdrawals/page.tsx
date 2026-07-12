'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Wallet,
  Check,
  X,
  Plus,
  Edit,
  Trash2,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
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
import { cn } from '@/lib/utils'

interface WithdrawalItem {
  id: string
  user: string
  userName?: string
  amount: number
  channel: 'alipay' | 'wechat' | 'bank'
  account: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'
  createdAt: string
  reviewer?: string
  reviewerTime?: number
  outBillNo?: string
  notes?: string
  weChatMsg?: string
  withdrawalTime?: number
  auditAmount?: number
}

interface WithdrawalFlowItem {
  id: string
  userId: string
  amount: number
  outBillNo: string
  status: number
  createdAt: string
  updatedAt: string
  transferDetail: string
}

interface ListData<T> {
  list: T[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const PAGE_SIZE = 10

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const inputSm =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const CHANNEL_LABEL: Record<WithdrawalItem['channel'], string> = {
  alipay: '支付宝',
  wechat: '微信',
  bank: '银行卡',
}
const STATUS_LABEL: Record<WithdrawalItem['status'], string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  completed: '已完成',
  failed: '已失败',
}
const STATUS_STYLE: Record<WithdrawalItem['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  rejected: 'bg-muted text-muted-foreground',
  completed: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
}
const FLOW_STATUS: Record<number, string> = { 0: '处理中', 1: '成功', 2: '失败' }
const FLOW_STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600',
  1: 'bg-emerald-500/10 text-emerald-600',
  2: 'bg-red-500/10 text-red-600',
}

const EMPTY_DETAIL = {
  user: '',
  amount: '',
  channel: 'alipay' as WithdrawalItem['channel'],
  account: '',
  status: 'pending' as WithdrawalItem['status'],
}
const EMPTY_FLOW = {
  userId: '',
  amount: '',
  outBillNo: '',
  status: '0',
  transferDetail: '',
}

const DETAIL_EXPORT = [
  { key: 'id', title: 'ID' },
  { key: 'user', title: '用户' },
  { key: 'amount', title: '金额(分)' },
  { key: 'channel', title: '渠道' },
  { key: 'account', title: '账户' },
  { key: 'status', title: '状态' },
  { key: 'reviewer', title: '审核人' },
  { key: 'createdAt', title: '申请时间' },
]
const FLOW_EXPORT = [
  { key: 'id', title: 'ID' },
  { key: 'userId', title: '用户ID' },
  { key: 'amount', title: '金额(分)' },
  { key: 'outBillNo', title: '外部单号' },
  { key: 'status', title: '状态' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'updatedAt', title: '更新时间' },
  { key: 'transferDetail', title: '转账详情' },
]

export default function AdminShopWithdrawalsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'detail' | 'flow'>('detail')

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
    const timer = setTimeout(() => setDDebounced(dSearch), 400)
    return () => clearTimeout(timer)
  }, [dSearch])
  React.useEffect(() => {
    const timer = setTimeout(() => setFDebounced(fSearch), 400)
    return () => clearTimeout(timer)
  }, [fSearch])

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
    enabled: tab === 'detail',
  })

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
    enabled: tab === 'flow',
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
  function handleExportDetail() {
    exportToExcel(
      `withdrawals_${Date.now()}`,
      DETAIL_EXPORT,
      (dData?.list ?? []) as unknown as Record<string, unknown>[],
    )
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
  function handleExportFlow() {
    exportToExcel(
      `withdrawal_flow_${Date.now()}`,
      FLOW_EXPORT,
      (fData?.list ?? []) as unknown as Record<string, unknown>[],
    )
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

  const dList = dData?.list ?? []
  const dTotal = dData?.total ?? 0
  const dTotalPages = Math.max(1, Math.ceil(dTotal / PAGE_SIZE))
  const fList = fData?.list ?? []
  const fTotal = fData?.total ?? 0
  const fTotalPages = Math.max(1, Math.ceil(fTotal / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" />
          提现管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">审核与处理用户提现申请</p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border bg-muted/30 p-1">
        <button
          onClick={() => setTab('detail')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'detail'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          提现详情
        </button>
        <button
          onClick={() => setTab('flow')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'flow'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          提现流水
        </button>
      </div>

      {tab === 'detail' && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">用户</Label>
              <Input
                className={inputSm}
                value={dSearch.user}
                onChange={(e) => setDSearch({ ...dSearch, user: e.target.value })}
                placeholder="用户"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">用户名</Label>
              <Input
                className={inputSm}
                value={dSearch.userName}
                onChange={(e) => setDSearch({ ...dSearch, userName: e.target.value })}
                placeholder="用户名"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">外部单号</Label>
              <Input
                className={inputSm}
                value={dSearch.outBillNo}
                onChange={(e) => setDSearch({ ...dSearch, outBillNo: e.target.value })}
                placeholder="外部单号"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">审核人</Label>
              <Input
                className={inputSm}
                value={dSearch.reviewer}
                onChange={(e) => setDSearch({ ...dSearch, reviewer: e.target.value })}
                placeholder="审核人"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">金额范围(分)</Label>
              <div className="flex items-center gap-1">
                <Input
                  className={inputSm}
                  value={dAmountRange.min}
                  onChange={(e) => setDAmountRange({ ...dAmountRange, min: e.target.value })}
                  placeholder="最小"
                />
                <span>-</span>
                <Input
                  className={inputSm}
                  value={dAmountRange.max}
                  onChange={(e) => setDAmountRange({ ...dAmountRange, max: e.target.value })}
                  placeholder="最大"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">状态</Label>
              <Select value={dStatus} onValueChange={setDStatus}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetDetail}>
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
            <div className="flex-1" />
            <HasPermi code="ai:withdrawaldetail:export">
              <Button variant="outline" size="sm" onClick={handleExportDetail}>
                <Download className="h-4 w-4" />
                导出
              </Button>
            </HasPermi>
            <HasPermi code="ai:withdrawaldetail:add">
              <Button size="sm" onClick={openCreateDetail}>
                <Plus className="h-4 w-4" />
                新增
              </Button>
            </HasPermi>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">用户</th>
                  <th className="px-4 py-2.5 font-medium">金额</th>
                  <th className="px-4 py-2.5 font-medium">渠道</th>
                  <th className="px-4 py-2.5 font-medium">账户</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">审核人</th>
                  <th className="px-4 py-2.5 font-medium">申请时间</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                ) : dList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      暂无提现申请
                    </td>
                  </tr>
                ) : (
                  dList.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{w.user ?? w.userName ?? '-'}</td>
                      <td className="px-4 py-2.5 font-medium">¥{(w.amount / 100).toFixed(2)}</td>
                      <td className="px-4 py-2.5">{CHANNEL_LABEL[w.channel] ?? '-'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {w.account}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                            STATUS_STYLE[w.status],
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {STATUS_LABEL[w.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{w.reviewer ?? '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(w.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          {w.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={auditMut.isPending}
                                onClick={() => auditMut.mutate({ id: w.id, action: 'approve' })}
                              >
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                通过
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={auditMut.isPending}
                                onClick={() => auditMut.mutate({ id: w.id, action: 'reject' })}
                              >
                                <X className="h-3.5 w-3.5 text-red-600" />
                                驳回
                              </Button>
                              <HasPermi code="ai:withdrawaldetail:edit">
                                <Button size="sm" variant="ghost" onClick={() => openReview(w)}>
                                  审核
                                </Button>
                              </HasPermi>
                            </>
                          )}
                          <HasPermi code="ai:withdrawaldetail:edit">
                            <Button size="sm" variant="ghost" onClick={() => openEditDetail(w)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                          <HasPermi code="ai:withdrawaldetail:remove">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDeleteDetail(w)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {dTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                共 {dTotal} 条 · 第 {dPage}/{dTotalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDPage((p) => Math.max(1, p - 1))}
                  disabled={dPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDPage((p) => Math.min(dTotalPages, p + 1))}
                  disabled={dPage >= dTotalPages}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Dialog open={dOpen} onOpenChange={(o) => (o ? setDOpen(true) : closeDetail())}>
            <DialogContent>
              <form onSubmit={submitDetail} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>{dEditing ? '编辑提现' : '新增提现'}</DialogTitle>
                </DialogHeader>
                {dErr && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {dErr}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>用户 *</Label>
                  <Input
                    className={inputSm}
                    value={dForm.user}
                    onChange={(e) => setDForm({ ...dForm, user: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>金额(分) *</Label>
                  <Input
                    className={inputSm}
                    type="number"
                    value={dForm.amount}
                    onChange={(e) => setDForm({ ...dForm, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>渠道</Label>
                  <Select
                    value={dForm.channel}
                    onValueChange={(v) =>
                      setDForm({ ...dForm, channel: v as WithdrawalItem['channel'] })
                    }
                  >
                    <SelectTrigger className={selectClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>账户</Label>
                  <Input
                    className={inputSm}
                    value={dForm.account}
                    onChange={(e) => setDForm({ ...dForm, account: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>状态</Label>
                  <Select
                    value={dForm.status}
                    onValueChange={(v) =>
                      setDForm({ ...dForm, status: v as WithdrawalItem['status'] })
                    }
                  >
                    <SelectTrigger className={selectClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDetail}
                    disabled={dSaveMut.isPending}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={dSaveMut.isPending}>
                    {dSaveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    保存
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog
            open={reviewOpen}
            onOpenChange={(o) =>
              o ? setReviewOpen(true) : (setReviewOpen(false), setReviewForm(null))
            }
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>审核提现</DialogTitle>
                <DialogDescription>审核提现申请并填写备注</DialogDescription>
              </DialogHeader>
              {reviewErr && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {reviewErr}
                </div>
              )}
              {reviewForm && (
                <div className="space-y-3">
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <div className="font-medium">
                      {reviewForm.user ?? reviewForm.userName ?? '-'}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      ¥{(reviewForm.amount / 100).toFixed(2)} ·{' '}
                      {CHANNEL_LABEL[reviewForm.channel] ?? '-'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>审核备注</Label>
                    <textarea
                      className={textareaClass}
                      rows={4}
                      value={reviewForm.notes ?? ''}
                      onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                      placeholder="请输入审核备注"
                    />
                  </div>
                  {reviewForm.weChatMsg && (
                    <div className="space-y-2">
                      <Label>提现记录(溯源)</Label>
                      <textarea
                        className={textareaClass}
                        rows={6}
                        value={reviewForm.weChatMsg}
                        disabled
                      />
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewOpen(false)}>
                  关闭
                </Button>
                <Button
                  variant="destructive"
                  disabled={reviewMut.isPending}
                  onClick={() => submitReview('reject')}
                >
                  退回
                </Button>
                <Button disabled={reviewMut.isPending} onClick={() => submitReview('approve')}>
                  {reviewMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  通过
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {tab === 'flow' && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">用户ID</Label>
              <Input
                className={inputSm}
                value={fSearch.userId}
                onChange={(e) => setFSearch({ ...fSearch, userId: e.target.value })}
                placeholder="用户ID"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">金额(分)</Label>
              <Input
                className={inputSm}
                value={fSearch.amount}
                onChange={(e) => setFSearch({ ...fSearch, amount: e.target.value })}
                placeholder="金额"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">外部单号</Label>
              <Input
                className={inputSm}
                value={fSearch.outBillNo}
                onChange={(e) => setFSearch({ ...fSearch, outBillNo: e.target.value })}
                placeholder="外部单号"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">创建时间</Label>
              <Input
                type="date"
                className={inputSm}
                value={fSearch.createdAt}
                onChange={(e) => setFSearch({ ...fSearch, createdAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">更新时间</Label>
              <Input
                type="date"
                className={inputSm}
                value={fSearch.updatedAt}
                onChange={(e) => setFSearch({ ...fSearch, updatedAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">转账详情</Label>
              <Input
                className={inputSm}
                value={fSearch.transferDetail}
                onChange={(e) => setFSearch({ ...fSearch, transferDetail: e.target.value })}
                placeholder="转账详情"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">状态</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(FLOW_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetFlow}>
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
            <div className="flex-1" />
            <HasPermi code="ai:withdrawal_flow:export">
              <Button variant="outline" size="sm" onClick={handleExportFlow}>
                <Download className="h-4 w-4" />
                导出
              </Button>
            </HasPermi>
            <HasPermi code="ai:withdrawal_flow:add">
              <Button size="sm" onClick={openCreateFlow}>
                <Plus className="h-4 w-4" />
                新增
              </Button>
            </HasPermi>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">用户ID</th>
                  <th className="px-4 py-2.5 font-medium">金额(分)</th>
                  <th className="px-4 py-2.5 font-medium">外部单号</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">创建时间</th>
                  <th className="px-4 py-2.5 font-medium">更新时间</th>
                  <th className="px-4 py-2.5 font-medium">转账详情</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                ) : fList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                      暂无流水记录
                    </td>
                  </tr>
                ) : (
                  fList.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">{w.id}</td>
                      <td className="px-4 py-2.5">{w.userId}</td>
                      <td className="px-4 py-2.5 font-medium">{w.amount}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{w.outBillNo}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs',
                            FLOW_STATUS_STYLE[w.status] ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {FLOW_STATUS[w.status] ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {w.createdAt ? new Date(w.createdAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {w.updatedAt ? new Date(w.updatedAt).toLocaleString() : '-'}
                      </td>
                      <td className="max-w-xs break-words px-4 py-2.5">
                        {w.transferDetail ?? '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <HasPermi code="ai:withdrawal_flow:edit">
                            <Button size="sm" variant="ghost" onClick={() => openEditFlow(w)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                          <HasPermi code="ai:withdrawal_flow:remove">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDeleteFlow(w)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {fTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                共 {fTotal} 条 · 第 {fPage}/{fTotalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFPage((p) => Math.max(1, p - 1))}
                  disabled={fPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFPage((p) => Math.min(fTotalPages, p + 1))}
                  disabled={fPage >= fTotalPages}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Dialog open={fOpen} onOpenChange={(o) => (o ? setFOpen(true) : closeFlow())}>
            <DialogContent>
              <form onSubmit={submitFlow} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>{fEditing ? '编辑流水' : '新增流水'}</DialogTitle>
                </DialogHeader>
                {fErr && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {fErr}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>用户ID *</Label>
                  <Input
                    className={inputSm}
                    value={fForm.userId}
                    onChange={(e) => setFForm({ ...fForm, userId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>金额(分) *</Label>
                  <Input
                    className={inputSm}
                    type="number"
                    value={fForm.amount}
                    onChange={(e) => setFForm({ ...fForm, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>外部单号 *</Label>
                  <Input
                    className={inputSm}
                    value={fForm.outBillNo}
                    onChange={(e) => setFForm({ ...fForm, outBillNo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>状态</Label>
                  <Select
                    value={fForm.status}
                    onValueChange={(v) => setFForm({ ...fForm, status: v })}
                  >
                    <SelectTrigger className={selectClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FLOW_STATUS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>转账详情</Label>
                  <textarea
                    className={textareaClass}
                    rows={3}
                    value={fForm.transferDetail}
                    onChange={(e) => setFForm({ ...fForm, transferDetail: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeFlow}
                    disabled={fSaveMut.isPending}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={fSaveMut.isPending}>
                    {fSaveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    保存
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
