'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ShoppingCart, Download, Plus, Edit, Trash2 } from 'lucide-react'
import type { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { type EduOrder, type PageData, api, PAGE_SIZE, ORDER_STATUS_CFG } from './types'
import { Pagination } from './Pagination'
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
  DialogFooter,
} from '@ihui/ui'

const inputSm = 'h-8 text-xs'

const ORDER_STATUS_TABS: {
  value: string
  labelKey: 'all' | 'pending' | 'paid' | 'cancelled' | 'refunded'
}[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'paid', labelKey: 'paid' },
  { value: 'cancelled', labelKey: 'cancelled' },
  { value: 'refunded', labelKey: 'refunded' },
]

const PAYMENT_STATUS: Record<number, string> = {
  0: '待支付',
  1: '已支付',
  2: '退款中',
  3: '已结束',
}

interface OrderForm {
  userId: string
  outTradeNo: string
  openId: string
  amount: string
  productId: string
  refundReason: string
}

const EMPTY_FORM: OrderForm = {
  userId: '',
  outTradeNo: '',
  openId: '',
  amount: '',
  productId: '',
  refundReason: '',
}

export function OrdersTab({
  t,
  dateFmt,
  currencyFmt,
}: {
  t: ReturnType<typeof useTranslations<'admin.orders'>>
  dateFmt: Intl.DateTimeFormat
  currencyFmt: Intl.NumberFormat
}) {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [paymentStatus, setPaymentStatus] = React.useState('all')
  const [search, setSearch] = React.useState({
    userId: '',
    outTradeNo: '',
    openId: '',
    amount: '',
    productId: '',
    createdAt: '',
    paidAt: '',
    refundTime: '',
  })
  const [debounced, setDebounced] = React.useState(search)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EduOrder | null>(null)
  const [form, setForm] = React.useState<OrderForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const qs = React.useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (status !== 'all') q.set('status', status)
    if (paymentStatus !== 'all') q.set('paymentStatus', paymentStatus)
    if (debounced.userId) q.set('userId', debounced.userId)
    if (debounced.outTradeNo) q.set('outTradeNo', debounced.outTradeNo)
    if (debounced.openId) q.set('openId', debounced.openId)
    if (debounced.amount) q.set('amount', debounced.amount)
    if (debounced.productId) q.set('productId', debounced.productId)
    if (debounced.createdAt) q.set('createdAt', debounced.createdAt)
    if (debounced.paidAt) q.set('paidAt', debounced.paidAt)
    if (debounced.refundTime) q.set('refundTime', debounced.refundTime)
    return q.toString()
  }, [status, paymentStatus, debounced, page])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'orders', status, paymentStatus, debounced, page],
    queryFn: () => api<PageData<EduOrder>>(`/api/admin/orders?${qs}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        userId: form.userId.trim(),
        outTradeNo: form.outTradeNo.trim(),
        openId: form.openId.trim(),
        amount: Number(form.amount) || 0,
        productId: form.productId.trim() || undefined,
        refundReason: form.refundReason.trim() || undefined,
      }
      if (editing) {
        return api(`/api/admin/orders/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api(`/api/admin/orders`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/orders/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(o: EduOrder) {
    setEditing(o)
    setForm({
      userId: o.userId ?? '',
      outTradeNo: o.orderNo ?? '',
      openId: '',
      amount: o.payAmount ?? '',
      productId: o.targetId ?? '',
      refundReason: o.remark ?? '',
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
    if (!form.userId.trim()) return setErr('请输入用户ID')
    if (!form.outTradeNo.trim()) return setErr('请输入订单号')
    saveMut.mutate()
  }

  function handleDelete(o: EduOrder) {
    if (!window.confirm(`确认删除订单 "${o.orderNo}" 吗?`)) return
    deleteMut.mutate(o.id)
  }

  function handleExport() {
    const list = (data?.list ?? []) as unknown as Record<string, unknown>[]
    exportToExcel(
      '订单数据',
      [
        { key: 'id', title: 'ID' },
        { key: 'userId', title: '用户ID' },
        { key: 'orderNo', title: '订单号' },
        { key: 'payAmount', title: '金额' },
        { key: 'status', title: '状态' },
        { key: 'payType', title: '支付方式' },
        { key: 'targetTitle', title: '商品名称' },
        { key: 'orderType', title: '订单类型' },
        { key: 'createdAt', title: '创建时间' },
        { key: 'payTime', title: '支付时间' },
      ],
      list,
    )
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const orders = data?.list ?? []

  const selectClass =
    'h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  const hasSearch =
    search.userId ||
    search.outTradeNo ||
    search.openId ||
    search.amount ||
    search.productId ||
    search.createdAt ||
    search.paidAt ||
    search.refundTime

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <HasPermi code="ai:order:export">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
        <HasPermi code="ai:order:add">
          <Button size="sm" onClick={openCreate} className="ml-auto">
            <Plus className="h-4 w-4" />
            新增订单
          </Button>
        </HasPermi>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {ORDER_STATUS_TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => {
              setStatus(tb.value)
              setPage(1)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tb.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`status_${tb.labelKey}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search.userId}
          onChange={(e) => setSearch({ ...search, userId: e.target.value })}
          placeholder="用户ID"
          className={cn('w-28', inputSm)}
        />
        <Input
          value={search.outTradeNo}
          onChange={(e) => setSearch({ ...search, outTradeNo: e.target.value })}
          placeholder="订单号"
          className={cn('w-32', inputSm)}
        />
        <Input
          value={search.openId}
          onChange={(e) => setSearch({ ...search, openId: e.target.value })}
          placeholder="openId"
          className={cn('w-28', inputSm)}
        />
        <Input
          value={search.amount}
          onChange={(e) => setSearch({ ...search, amount: e.target.value })}
          placeholder="金额"
          className={cn('w-24', inputSm)}
        />
        <Input
          value={search.productId}
          onChange={(e) => setSearch({ ...search, productId: e.target.value })}
          placeholder="商品ID"
          className={cn('w-28', inputSm)}
        />
        <Input
          type="date"
          value={search.createdAt}
          onChange={(e) => setSearch({ ...search, createdAt: e.target.value })}
          className={cn('w-36', inputSm)}
          aria-label="创建时间"
        />
        <Input
          type="date"
          value={search.paidAt}
          onChange={(e) => setSearch({ ...search, paidAt: e.target.value })}
          className={cn('w-36', inputSm)}
          aria-label="支付时间"
        />
        <Input
          type="date"
          value={search.refundTime}
          onChange={(e) => setSearch({ ...search, refundTime: e.target.value })}
          className={cn('w-36', inputSm)}
          aria-label="退款时间"
        />
        <Select
          value={paymentStatus}
          onValueChange={(v) => {
            setPaymentStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={cn('w-28', selectClass)} aria-label="支付状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部支付</SelectItem>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasSearch && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSearch({
                userId: '',
                outTradeNo: '',
                openId: '',
                amount: '',
                productId: '',
                createdAt: '',
                paidAt: '',
                refundTime: '',
              })
            }
            className="h-8 text-xs"
          >
            重置
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('orderNo')}</th>
              <th className="px-4 py-2.5 font-medium">{t('orderType')}</th>
              <th className="px-4 py-2.5 font-medium">{t('target')}</th>
              <th className="px-4 py-2.5 font-medium">{t('amount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('payType')}</th>
              <th className="px-4 py-2.5 font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
              <th className="px-4 py-2.5 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const sc = ORDER_STATUS_CFG[o.status]
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{o.orderNo}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {t(`type_${o.orderType === 'course' ? 'course' : 'card'}`)}
                      </span>
                    </td>
                    <td className="max-w-xs break-words px-4 py-2.5">{o.targetTitle ?? '-'}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {currencyFmt.format(Number(o.payAmount))}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{o.payType ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          sc.cls,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                        {t(`status_${o.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {dateFmt.format(new Date(o.createdAt))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <HasPermi code="ai:order:edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(o)}
                            title="编辑"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                        <HasPermi code="ai:order:remove">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(o)}
                            title="删除"
                            className="text-destructive hover:text-destructive"
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} setPage={setPage} t={t} />

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑订单' : '新增订单'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="o-userId">用户ID *</Label>
                <Input
                  id="o-userId"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  placeholder="请输入用户ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-outTradeNo">订单号 *</Label>
                <Input
                  id="o-outTradeNo"
                  value={form.outTradeNo}
                  onChange={(e) => setForm({ ...form, outTradeNo: e.target.value })}
                  placeholder="请输入订单号"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="o-openId">openId</Label>
                <Input
                  id="o-openId"
                  value={form.openId}
                  onChange={(e) => setForm({ ...form, openId: e.target.value })}
                  placeholder="请输入openId"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-amount">金额</Label>
                <Input
                  id="o-amount"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="请输入金额"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="o-productId">商品ID</Label>
                <Input
                  id="o-productId"
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  placeholder="请输入商品ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-refundReason">退款原因</Label>
                <Input
                  id="o-refundReason"
                  value={form.refundReason}
                  onChange={(e) => setForm({ ...form, refundReason: e.target.value })}
                  placeholder="请输入退款原因"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                确认
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
