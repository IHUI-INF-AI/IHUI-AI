'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Loader2,
  DollarSign,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Wallet,
  TrendingUp,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { BackButton, TruncatedText } from '@/components/common'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

/* ─── Types ─── */

interface TuitionStandard {
  id: string
  classId: string
  termId: string
  className: string
  termName: string
  feeName: string
  amount: number
  billingCycle: string
  effectiveDate: string
  status: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface PaymentRecord {
  id: string
  studentName: string
  className: string
  feeName: string
  amount: number
  paymentDate: string
  paymentMethod: string
  status: string
  receiptNo: string
  remark: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface PaymentSummary {
  totalIncome: number
  paidCount: number
  unpaidCount: number
  unpaidAmount: number
}

interface RefundRecord {
  id: string
  studentName: string
  className: string
  amount: number
  refundDate: string
  refundMethod: string
  reason: string
  status: string
  remark: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface EduClass {
  id: string
  name: string
  grade: string | null
}

interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

/* ─── API helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Constants ─── */

const BILLING_CYCLES = [
  { value: 'term', label: '按学期' },
  { value: 'monthly', label: '按月' },
  { value: 'yearly', label: '按年' },
] as const

const BILLING_CYCLE_MAP: Map<string, string> = new Map(BILLING_CYCLES.map((c) => [c.value, c.label]))

const PAYMENT_METHODS = [
  { value: 'cash', label: '现金' },
  { value: 'transfer', label: '转账' },
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
] as const

const PAYMENT_METHOD_MAP: Map<string, string> = new Map(PAYMENT_METHODS.map((m) => [m.value, m.label]))

const PAYMENT_STATUSES = [
  { value: 'paid', label: '已支付', color: 'bg-green-500' },
  { value: 'refunded', label: '已退款', color: 'bg-gray-500' },
  { value: 'cancelled', label: '已取消', color: 'bg-red-500' },
] as const

const PAYMENT_STATUS_MAP: Map<string, string> = new Map(PAYMENT_STATUSES.map((s) => [s.value, s.label]))
const PAYMENT_STATUS_COLOR_MAP: Map<string, string> = new Map(PAYMENT_STATUSES.map((s) => [s.value, s.color]))

const TUITION_STATUSES = [
  { value: 'active', label: '生效', color: 'bg-green-500' },
  { value: 'inactive', label: '失效', color: 'bg-gray-500' },
] as const

const TUITION_STATUS_MAP: Map<string, string> = new Map(TUITION_STATUSES.map((s) => [s.value, s.label]))
const TUITION_STATUS_COLOR_MAP: Map<string, string> = new Map(TUITION_STATUSES.map((s) => [s.value, s.color]))

const REFUND_STATUSES = [
  { value: 'pending', label: '待审批', color: 'bg-yellow-500' },
  { value: 'approved', label: '已通过', color: 'bg-green-500' },
  { value: 'rejected', label: '已驳回', color: 'bg-red-500' },
  { value: 'completed', label: '已完成', color: 'bg-blue-500' },
  { value: 'cancelled', label: '已取消', color: 'bg-gray-500' },
] as const

const REFUND_STATUS_MAP: Map<string, string> = new Map(REFUND_STATUSES.map((s) => [s.value, s.label]))
const REFUND_STATUS_COLOR_MAP: Map<string, string> = new Map(REFUND_STATUSES.map((s) => [s.value, s.color]))

/* ─── Tuition Standard Dialog ─── */

interface TuitionFormData {
  classId: string
  termId: string
  feeName: string
  amount: number
  billingCycle: string
  effectiveDate: string
}

function TuitionDialog({
  open,
  onOpenChange,
  initial,
  classes,
  terms,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: TuitionStandard | null
  classes: EduClass[]
  terms: Term[]
  onSave: (data: TuitionFormData) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = React.useState<TuitionFormData>({
    classId: '',
    termId: '',
    feeName: '',
    amount: 0,
    billingCycle: 'term',
    effectiveDate: '',
  })
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        classId: initial.classId,
        termId: initial.termId,
        feeName: initial.feeName,
        amount: initial.amount,
        billingCycle: initial.billingCycle,
        effectiveDate: initial.effectiveDate,
      })
    } else {
      setForm({
        classId: classes[0]?.id ?? '',
        termId: terms[0]?.id ?? '',
        feeName: '',
        amount: 0,
        billingCycle: 'term',
        effectiveDate: '',
      })
    }
  }, [initial, classes, terms, open])

  const update = (key: keyof TuitionFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.feeName.trim() || !form.classId || !form.termId || !form.effectiveDate) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑学费标准' : '添加学费标准'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>班级</Label>
              <Select value={form.classId} onValueChange={(v) => update('classId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>学期</Label>
              <Select value={form.termId} onValueChange={(v) => update('termId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择学期" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>费用名称</Label>
            <Input
              value={form.feeName}
              onChange={(e) => update('feeName', e.target.value)}
              placeholder="如：学费、材料费"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>金额</Label>
              <Input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => update('amount', Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>计费周期</Label>
              <Select value={form.billingCycle} onValueChange={(v) => update('billingCycle', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>生效日期</Label>
            <Input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => update('effectiveDate', e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          {initial && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              删除
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !form.feeName.trim() || !form.classId || !form.termId || !form.effectiveDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? '保存' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Payment Dialog ─── */

interface PaymentFormData {
  studentName: string
  className: string
  feeName: string
  amount: number
  paymentDate: string
  paymentMethod: string
  receiptNo: string
  remark: string
}

function PaymentDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (data: PaymentFormData) => Promise<void>
}) {
  const [form, setForm] = React.useState<PaymentFormData>({
    studentName: '',
    className: '',
    feeName: '',
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0]!,
    paymentMethod: 'cash',
    receiptNo: '',
    remark: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        studentName: '',
        className: '',
        feeName: '',
        amount: 0,
        paymentDate: new Date().toISOString().split('T')[0]!,
        paymentMethod: 'cash',
        receiptNo: '',
        remark: '',
      })
    }
  }, [open])

  const update = (key: keyof PaymentFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.studentName.trim() || !form.feeName.trim() || !form.paymentDate) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加缴费记录</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>学员姓名</Label>
              <Input
                value={form.studentName}
                onChange={(e) => update('studentName', e.target.value)}
                placeholder="学员姓名"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>班级</Label>
              <Input
                value={form.className}
                onChange={(e) => update('className', e.target.value)}
                placeholder="班级名称"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>费用名称</Label>
              <Input
                value={form.feeName}
                onChange={(e) => update('feeName', e.target.value)}
                placeholder="如：学费"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>金额</Label>
              <Input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => update('amount', Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>缴费日期</Label>
              <Input
                type="date"
                value={form.paymentDate}
                onChange={(e) => update('paymentDate', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>缴费方式</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => update('paymentMethod', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>收据号</Label>
            <Input
              value={form.receiptNo}
              onChange={(e) => update('receiptNo', e.target.value)}
              placeholder="可选"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => update('remark', e.target.value)}
              placeholder="可选"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !form.studentName.trim() || !form.feeName.trim() || !form.paymentDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            添加缴费
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Refund Dialog ─── */

interface RefundFormData {
  studentName: string
  className: string
  amount: number
  refundDate: string
  refundMethod: string
  reason: string
  remark: string
}

function RefundDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (data: RefundFormData) => Promise<void>
}) {
  const [form, setForm] = React.useState<RefundFormData>({
    studentName: '',
    className: '',
    amount: 0,
    refundDate: new Date().toISOString().split('T')[0]!,
    refundMethod: 'cash',
    reason: '',
    remark: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        studentName: '',
        className: '',
        amount: 0,
        refundDate: new Date().toISOString().split('T')[0]!,
        refundMethod: 'cash',
        reason: '',
        remark: '',
      })
    }
  }, [open])

  const update = (key: keyof RefundFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.studentName.trim() || !form.reason.trim() || !form.refundDate) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>申请退费</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>学员姓名</Label>
              <Input
                value={form.studentName}
                onChange={(e) => update('studentName', e.target.value)}
                placeholder="学员姓名"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>班级</Label>
              <Input
                value={form.className}
                onChange={(e) => update('className', e.target.value)}
                placeholder="班级名称"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>退费金额</Label>
              <Input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => update('amount', Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>退费日期</Label>
              <Input
                type="date"
                value={form.refundDate}
                onChange={(e) => update('refundDate', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>退费方式</Label>
            <Select value={form.refundMethod} onValueChange={(v) => update('refundMethod', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>退费原因</Label>
            <Input
              value={form.reason}
              onChange={(e) => update('reason', e.target.value)}
              placeholder="请输入退费原因"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => update('remark', e.target.value)}
              placeholder="可选"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !form.studentName.trim() || !form.reason.trim() || !form.refundDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            提交申请
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Approve Refund Dialog ─── */

function ApproveRefundDialog({
  open,
  onOpenChange,
  refund,
  onApprove,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  refund: RefundRecord | null
  onApprove: (id: string, status: 'approved' | 'rejected', remark: string) => Promise<void>
}) {
  const [remark, setRemark] = React.useState('')
  const [processing, setProcessing] = React.useState(false)

  React.useEffect(() => {
    if (open) setRemark('')
  }, [open])

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!refund) return
    setProcessing(true)
    try {
      await onApprove(refund.id, status, remark)
      onOpenChange(false)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>审批退费申请</DialogTitle>
        </DialogHeader>
        {refund && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">学员：</span>{refund.studentName}</p>
              <p><span className="text-muted-foreground">班级：</span>{refund.className}</p>
              <p><span className="text-muted-foreground">金额：</span><span className="font-medium">{refund.amount.toLocaleString()}元</span></p>
              <p><span className="text-muted-foreground">原因：</span>{refund.reason}</p>
            </div>
            <div className="grid gap-1.5">
              <Label>审批意见</Label>
              <Input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="可选，审批意见"
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={() => handleAction('rejected')}
            disabled={processing}
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-1 h-4 w-4" />}
            驳回
          </Button>
          <Button
            variant="default"
            onClick={() => handleAction('approved')}
            disabled={processing}
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            批准
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function FinancePage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [activeTab, setActiveTab] = React.useState('tuition')
  const [paymentClassFilter, setPaymentClassFilter] = React.useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = React.useState('')
  const [tuitionDialogOpen, setTuitionDialogOpen] = React.useState(false)
  const [editingTuition, setEditingTuition] = React.useState<TuitionStandard | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = React.useState(false)
  const [approveRefundOpen, setApproveRefundOpen] = React.useState(false)
  const [approvingRefund, setApprovingRefund] = React.useState<RefundRecord | null>(null)

  /* ── Queries ── */
  const { data: termsData } = useQuery({
    queryKey: ['edu-ai-management', 'term'],
    queryFn: () => api<{ list: Term[] }>('/api/edu-ai-management/term'),
  })
  const terms = React.useMemo(() => termsData?.list ?? [], [termsData])

  const { data: classesData } = useQuery({
    queryKey: ['edu-ai-management', 'class'],
    queryFn: () => api<{ list: EduClass[] }>('/api/edu-ai-management/class'),
  })
  const classes = React.useMemo(() => classesData?.list ?? [], [classesData])

  const tuitionQuery = useQuery({
    queryKey: ['edu-ai-management', 'tuition-standard'],
    queryFn: () => api<{ list: TuitionStandard[] }>('/api/edu-ai-management/tuition-standard'),
  })
  const tuitions = (tuitionQuery.data?.list ?? []).filter((t) => !t.deletedAt)

  const paymentQuery = useQuery({
    queryKey: ['edu-ai-management', 'payment-record', paymentClassFilter, paymentStatusFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (paymentClassFilter) params.set('classId', paymentClassFilter)
      if (paymentStatusFilter) params.set('status', paymentStatusFilter)
      const qs = params.toString()
      return api<{ list: PaymentRecord[] }>(`/api/edu-ai-management/payment-record${qs ? `?${qs}` : ''}`)
    },
  })
  const payments = (paymentQuery.data?.list ?? []).filter((p) => !p.deletedAt)

  const summaryQuery = useQuery({
    queryKey: ['edu-ai-management', 'payment-record', 'summary', paymentClassFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (paymentClassFilter) params.set('classId', paymentClassFilter)
      const qs = params.toString()
      return api<PaymentSummary>(`/api/edu-ai-management/payment-record/summary${qs ? `?${qs}` : ''}`)
    },
  })
  const summary = summaryQuery.data

  const refundQuery = useQuery({
    queryKey: ['edu-ai-management', 'refund'],
    queryFn: () => api<{ list: RefundRecord[] }>('/api/edu-ai-management/refund'),
  })
  const refunds = (refundQuery.data?.list ?? []).filter((r) => !r.deletedAt)

  /* ── Mutations ── */
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management'] })
  }, [queryClient])

  const createTuition = useMutation({
    mutationFn: (data: TuitionFormData) =>
      api('/api/edu-ai-management/tuition-standard', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const updateTuition = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TuitionFormData }) =>
      api(`/api/edu-ai-management/tuition-standard/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const deleteTuition = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/tuition-standard/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const createPayment = useMutation({
    mutationFn: (data: PaymentFormData) =>
      api('/api/edu-ai-management/payment-record', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const createRefund = useMutation({
    mutationFn: (data: RefundFormData) =>
      api('/api/edu-ai-management/refund', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const approveRefund = useMutation({
    mutationFn: ({ id, status, remark }: { id: string; status: 'approved' | 'rejected'; remark: string }) =>
      api(`/api/edu-ai-management/refund/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status, approveRemark: remark || null }),
      }),
    onSuccess: invalidate,
  })

  /* ── Handlers ── */
  const handleAddTuition = async (data: TuitionFormData) => {
    await createTuition.mutateAsync(data)
  }

  const handleEditTuition = async (data: TuitionFormData) => {
    if (editingTuition) {
      await updateTuition.mutateAsync({ id: editingTuition.id, data })
    }
  }

  const handleDeleteTuition = async () => {
    if (editingTuition) {
      await deleteTuition.mutateAsync(editingTuition.id)
    }
  }

  const handleAddPayment = async (data: PaymentFormData) => {
    await createPayment.mutateAsync(data)
  }

  const handleAddRefund = async (data: RefundFormData) => {
    await createRefund.mutateAsync(data)
  }

  const handleApproveRefund = async (id: string, status: 'approved' | 'rejected', remark: string) => {
    await approveRefund.mutateAsync({ id, status, remark })
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">财务管理</h1>
        <p className="text-xs text-muted-foreground">管理学费标准、缴费记录和退费申请</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tuition">
            <Wallet className="mr-1.5 h-4 w-4" />
            学费标准
          </TabsTrigger>
          <TabsTrigger value="payments">
            <DollarSign className="mr-1.5 h-4 w-4" />
            缴费记录
          </TabsTrigger>
          <TabsTrigger value="refunds">
            <TrendingUp className="mr-1.5 h-4 w-4" />
            退费管理
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ Tab 1: Tuition Standards ════════════════ */}
        <TabsContent value="tuition" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Button size="sm" onClick={() => { setEditingTuition(null); setTuitionDialogOpen(true) }}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加学费标准
              </Button>
              {tuitionQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {tuitionQuery.error ? (
            <Alert variant="danger" description="加载学费标准失败，请稍后重试" />
          ) : tuitionQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载学费标准...
              </CardContent>
            </Card>
          ) : tuitions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无学费标准
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">班级</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">学期</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">费用名称</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">金额</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">计费周期</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">生效日期</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tuitions.map((t) => (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs">{t.className}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{t.termName}</td>
                          <td className="px-4 py-3 text-xs font-medium">{t.feeName}</td>
                          <td className="px-4 py-3 text-xs">{t.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {BILLING_CYCLE_MAP.get(t.billingCycle) ?? t.billingCycle}
                          </td>
                          <td className="px-4 py-3 text-xs">{t.effectiveDate}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] text-white',
                                TUITION_STATUS_COLOR_MAP.get(t.status) ?? 'bg-gray-500',
                              )}
                            >
                              {TUITION_STATUS_MAP.get(t.status) ?? t.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => { setEditingTuition(t); setTuitionDialogOpen(true) }}
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                编辑
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-500"
                                onClick={() => deleteTuition.mutate(t.id)}
                                disabled={deleteTuition.isPending}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                删除
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════ Tab 2: Payments ════════════════ */}
        <TabsContent value="payments" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">总收入</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {summary?.totalIncome?.toLocaleString() ?? '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">已缴费人数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary?.paidCount ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">欠费人数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-500">{summary?.unpaidCount ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">欠费总额</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-500">
                  {summary?.unpaidAmount?.toLocaleString() ?? '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Select value={paymentClassFilter} onValueChange={(v) => setPaymentClassFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部班级</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentStatusFilter} onValueChange={(v) => setPaymentStatusFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加缴费
              </Button>
              {paymentQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {paymentQuery.error ? (
            <Alert variant="danger" description="加载缴费记录失败，请稍后重试" />
          ) : paymentQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载缴费记录...
              </CardContent>
            </Card>
          ) : payments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无缴费记录
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">学员</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">班级</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">费用名称</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">金额</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">缴费日期</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">缴费方式</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">收据号</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{p.studentName}</td>
                          <td className="px-4 py-3 text-xs">{p.className}</td>
                          <td className="px-4 py-3 text-xs">{p.feeName}</td>
                          <td className="px-4 py-3 text-xs font-medium">{p.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs">{p.paymentDate}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {PAYMENT_METHOD_MAP.get(p.paymentMethod) ?? p.paymentMethod}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] text-white',
                                PAYMENT_STATUS_COLOR_MAP.get(p.status) ?? 'bg-gray-500',
                              )}
                            >
                              {PAYMENT_STATUS_MAP.get(p.status) ?? p.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{p.receiptNo || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════ Tab 3: Refunds ════════════════ */}
        <TabsContent value="refunds" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Button size="sm" onClick={() => setRefundDialogOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                申请退费
              </Button>
              {refundQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {refundQuery.error ? (
            <Alert variant="danger" description="加载退费记录失败，请稍后重试" />
          ) : refundQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载退费记录...
              </CardContent>
            </Card>
          ) : refunds.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无退费记录
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">学员</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">班级</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">金额</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">退费日期</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">退费方式</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">原因</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refunds.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{r.studentName}</td>
                          <td className="px-4 py-3 text-xs">{r.className}</td>
                          <td className="px-4 py-3 text-xs font-medium">{r.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs">{r.refundDate}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {PAYMENT_METHOD_MAP.get(r.refundMethod) ?? r.refundMethod}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <TruncatedText value={r.reason} className="max-w-[120px]" />
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] text-white',
                                REFUND_STATUS_COLOR_MAP.get(r.status) ?? 'bg-gray-500',
                              )}
                            >
                              {REFUND_STATUS_MAP.get(r.status) ?? r.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {r.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setApprovingRefund(r)
                                  setApproveRefundOpen(true)
                                }}
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                审批
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TuitionDialog
        open={tuitionDialogOpen}
        onOpenChange={setTuitionDialogOpen}
        initial={editingTuition}
        classes={classes}
        terms={terms}
        onSave={editingTuition ? handleEditTuition : handleAddTuition}
        onDelete={editingTuition ? handleDeleteTuition : undefined}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onSave={handleAddPayment}
      />

      <RefundDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        onSave={handleAddRefund}
      />

      <ApproveRefundDialog
        open={approveRefundOpen}
        onOpenChange={setApproveRefundOpen}
        refund={approvingRefund}
        onApprove={handleApproveRefund}
      />
    </div>
  )
}