// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  Bell,
  CalendarDays,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { toast } from 'sonner'
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
import { Alert, confirmDialog } from '@/components/feedback'

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

/* 无归属缴费流水(GET /payment-record/unattributed):没挂到期次的钱,不计入任何期次已缴额 */
interface UnattributedPayment {
  id: string
  studentId: string
  classId: string
  amount: number
  paymentDate: string
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

interface RosterItem {
  enrollmentId: string
  studentId: string
  studentName: string
  studentPhone: string | null
  classId: string
  className: string
  businessLine: string
  grade: string | null
  termId: string
  enrollDate: string
  totalFee: number
  paidAmount: number
  dueAmount: number
  status: string
}

interface FeeReminder {
  id: string
  studentId: string
  enrollmentId: string | null
  classId: string | null
  dueAmount: number
  channel: string
  status: string
  message: string | null
  operatorId: string | null
  createdAt: string
  updatedAt: string
}

/* 催缴留痕统计(GET /fee-reminder/stats,2026-09-29 起 delivery 列随三条写路径落逐收件人回执) */
interface ReminderStats {
  days: number
  total: number
  byChannel: Array<{ channel: string; status: string; n: number }>
  byDay: Array<{ day: string; n: number }>
  delivery: {
    buckets: Record<string, number>
    unknownReminders: number
    remindersWithDelivery: number
  }
  caveat: string
}

/* ─── Constants (催费) ─── */

const BUSINESS_LINES = [
  { value: 'after_school_care', label: '托管' },
  { value: 'kindergarten', label: '幼儿园' },
  { value: 'academic', label: '文化课' },
  { value: 'ai_course', label: 'AI课' },
  { value: 'other', label: '其他' },
]
const BUSINESS_LINE_MAP = new Map(BUSINESS_LINES.map((b) => [b.value, b.label]))

const REMINDER_CHANNELS = [
  { value: 'in_app', label: '站内信' },
  { value: 'sms', label: '短信' },
  { value: 'wechat', label: '微信' },
]
const REMINDER_CHANNEL_MAP = new Map(REMINDER_CHANNELS.map((c) => [c.value, c.label]))

const REMINDER_STATUS_MAP = new Map([
  ['sent', '已发送'],
  ['failed', '发送失败'],
])
const REMINDER_STATUS_COLOR_MAP = new Map([
  ['sent', 'bg-green-500'],
  ['failed', 'bg-red-500'],
])

/* 回执分档 → 界面文案/配色。buckets 里可能出现此表之外的档位(后端扩档),原样展示 key。 */
const DELIVERY_BUCKET_LABELS: Array<[string, string]> = [
  ['sent', '送达'],
  ['failed', '失败'],
  ['not_configured', '通道未配置'],
  ['no_phone', '无号码'],
  ['user_refused', '用户未订阅'],
]
const DELIVERY_BUCKET_COLOR_MAP = new Map([
  ['sent', 'bg-green-500'],
  ['failed', 'bg-red-500'],
  ['user_refused', 'bg-amber-500'],
])

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

const BILLING_CYCLE_MAP: Map<string, string> = new Map(
  BILLING_CYCLES.map((c) => [c.value, c.label]),
)

const PAYMENT_METHODS = [
  { value: 'cash', label: '现金' },
  { value: 'transfer', label: '转账' },
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
] as const

const PAYMENT_METHOD_MAP: Map<string, string> = new Map(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
)

const PAYMENT_STATUSES = [
  { value: 'paid', label: '已支付', color: 'bg-green-500' },
  { value: 'refunded', label: '已退款', color: 'bg-gray-500' },
  { value: 'cancelled', label: '已取消', color: 'bg-red-500' },
] as const

const PAYMENT_STATUS_MAP: Map<string, string> = new Map(
  PAYMENT_STATUSES.map((s) => [s.value, s.label]),
)
const PAYMENT_STATUS_COLOR_MAP: Map<string, string> = new Map(
  PAYMENT_STATUSES.map((s) => [s.value, s.color]),
)

const TUITION_STATUSES = [
  { value: 'active', label: '生效', color: 'bg-green-500' },
  { value: 'inactive', label: '失效', color: 'bg-gray-500' },
] as const

const TUITION_STATUS_MAP: Map<string, string> = new Map(
  TUITION_STATUSES.map((s) => [s.value, s.label]),
)
const TUITION_STATUS_COLOR_MAP: Map<string, string> = new Map(
  TUITION_STATUSES.map((s) => [s.value, s.color]),
)

const REFUND_STATUSES = [
  { value: 'pending', label: '待审批', color: 'bg-yellow-500' },
  { value: 'approved', label: '已通过', color: 'bg-green-500' },
  { value: 'rejected', label: '已驳回', color: 'bg-red-500' },
  { value: 'completed', label: '已完成', color: 'bg-blue-500' },
  { value: 'cancelled', label: '已取消', color: 'bg-gray-500' },
] as const

const REFUND_STATUS_MAP: Map<string, string> = new Map(
  REFUND_STATUSES.map((s) => [s.value, s.label]),
)
const REFUND_STATUS_COLOR_MAP: Map<string, string> = new Map(
  REFUND_STATUSES.map((s) => [s.value, s.color]),
)

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
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
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
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
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
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
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
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-4 w-4" />
              )}
              删除
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={
              saving || !form.feeName.trim() || !form.classId || !form.termId || !form.effectiveDate
            }
          >
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
  /** 归属报名(期次)。必须是选出来的 id,不是敲出来的名字 */
  enrollmentId: string
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
  enrollments,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (data: PaymentFormData) => Promise<void>
  enrollments: RosterItem[]
}) {
  const [form, setForm] = React.useState<PaymentFormData>({
    enrollmentId: '',
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
        enrollmentId: '',
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

  /** 选中的那条报名:欠费额与应缴额都从名册(即账目出口)带,不在前端自己减 */
  const selected = enrollments.find((e) => e.enrollmentId === form.enrollmentId) ?? null

  const handleSave = async () => {
    if (!form.enrollmentId || !form.paymentDate || form.amount <= 0) return
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
          <div className="grid gap-1.5">
            <Label>期次（报名）</Label>
            <Select
              value={form.enrollmentId}
              onValueChange={(v) => update('enrollmentId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择学员的某一期报名" />
              </SelectTrigger>
              <SelectContent>
                {enrollments.map((e) => (
                  <SelectItem key={e.enrollmentId} value={e.enrollmentId}>
                    {`${e.studentName} · ${e.className} · 应缴 ${e.totalFee} 已缴 ${e.paidAmount}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 刻意不给「学员姓名 / 班级 / 费用名称」手填框：旧版把三个名字文本直接当
                studentId/classId 发给后端，而后端 zod 要的是 uuid ⇒ 每次必 400，
                这个「添加缴费」按钮实际从未成功过一次。归属只能是选出来的 id。 */}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>本期欠费</Label>
              <Input
                type="number"
                readOnly
                value={selected?.dueAmount ?? ''}
                placeholder="选期次后带出"
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
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
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
          <Button
            onClick={handleSave}
            disabled={saving || !form.enrollmentId || !form.paymentDate || form.amount <= 0}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            添加缴费
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── 账期(缴费计划)面板 ─── */

interface ScheduleItem {
  id: string
  enrollmentId: string
  periodLabel: string
  dueDate: string
  amountDue: number
  paidAmount: number
  refundAmount: number
  graceDays: number
  status: string
}

interface GenerateScheduleBody {
  enrollmentId: string
  periodCount: number
  firstDueDate: string
  cycle: 'once' | 'monthly' | 'termly'
  monthsPerPeriod?: number
  graceDays: number
  replace: boolean
}

/**
 * 账期面板。
 *
 * 为什么必须在界面上有这一格而不是"让机构调 API":后端已经有 `POST /fee-schedule/generate`,
 * 但 `edu_fee_schedule` 是空表 —— 没有入口,到期分级、提前提醒、按账期摊派全部空转,
 * 这条能力等于没交付(本仓把"造好没装车"记过多次:守门 64/70/81/115 同族)。
 *
 * 分期参数一律由操作者填,**界面不提供任何"默认期数/默认到期日"** ——
 * 预填值会被当成机构选过的值存进账期,然后原样出现在发给家长的催缴文案里。
 */
function SchedulePanel({ enrollments }: { enrollments: RosterItem[] }) {
  const queryClient = useQueryClient()
  const [enrollmentId, setEnrollmentId] = React.useState('')
  const [periodCount, setPeriodCount] = React.useState(2)
  const [cycle, setCycle] = React.useState<'once' | 'monthly' | 'termly'>('monthly')
  const [firstDueDate, setFirstDueDate] = React.useState('')
  const [monthsPerPeriod, setMonthsPerPeriod] = React.useState(6)
  const [graceDays, setGraceDays] = React.useState(0)
  const [replace, setReplace] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const selected = enrollments.find((e) => e.enrollmentId === enrollmentId) ?? null

  const listQuery = useQuery({
    queryKey: ['edu-ai-management', 'fee-schedule', enrollmentId],
    enabled: !!enrollmentId,
    queryFn: () =>
      api<{ list: ScheduleItem[]; total: number }>(
        `/api/edu-ai-management/fee-schedule?enrollmentId=${enrollmentId}`,
      ),
  })
  const schedules = listQuery.data?.list ?? []

  const generate = useMutation({
    mutationFn: (body: GenerateScheduleBody) =>
      api<{
        createdCount: number
        replaced: boolean
        planTotal: number
        amountTotal: number
        ledger: { arrears: number; nextDueDate: string | null } | null
      }>('/api/edu-ai-management/fee-schedule/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'fee-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'student-roster'] })
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'payment-record'] })
    },
  })

  const canSubmit =
    !!enrollmentId &&
    !!firstDueDate &&
    periodCount >= 1 &&
    (cycle !== 'termly' || monthsPerPeriod >= 1)

  const onGenerate = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      const res = await generate.mutateAsync({
        enrollmentId,
        periodCount,
        firstDueDate,
        cycle,
        ...(cycle === 'termly' ? { monthsPerPeriod } : {}),
        graceDays,
        replace,
      })
      // 摊派自证由后端算好回传:两者不等就说明后端展开器算错了,必须当场显示而不是静默
      const sumTip =
        res.planTotal === res.amountTotal
          ? `逐期相加 ${res.planTotal} 元与应缴一致`
          : `⚠️ 摊派不符:逐期合计 ${res.planTotal} ≠ 应缴 ${res.amountTotal}`
      toast.success(`已生成 ${res.createdCount} 期账期${res.replaced ? '(已替换旧账期)' : ''} · ${sumTip}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '账期生成失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">账期 / 缴费计划</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1.5">
          <Label>报名（期次）</Label>
          <Select value={enrollmentId} onValueChange={setEnrollmentId}>
            <SelectTrigger>
              <SelectValue placeholder="选择学员的某一期报名" />
            </SelectTrigger>
            <SelectContent>
              {enrollments.map((e) => (
                <SelectItem key={e.enrollmentId} value={e.enrollmentId}>
                  {`${e.studentName} · ${e.className} · 应缴 ${e.totalFee} 欠费 ${e.dueAmount}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>分期方式</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as typeof cycle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">一次缴清</SelectItem>
                  <SelectItem value="monthly">按月</SelectItem>
                  <SelectItem value="termly">按学期间隔</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>期数</Label>
              <Input
                type="number"
                min={1}
                max={36}
                disabled={cycle === 'once'}
                value={cycle === 'once' ? 1 : periodCount}
                onChange={(e) => setPeriodCount(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>首期到期日</Label>
              <Input
                type="date"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>逾期宽限（天）</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value))}
              />
            </div>
            {cycle === 'termly' ? (
              <div className="grid gap-1.5">
                <Label>每期间隔（月）</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={monthsPerPeriod}
                  onChange={(e) => setMonthsPerPeriod(Number(e.target.value))}
                />
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              已有账期时替换（会断开旧账期上的缴费归属）
            </label>
          </div>
        ) : null}

        <Button size="sm" onClick={onGenerate} disabled={!canSubmit || busy}>
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="mr-1 h-3.5 w-3.5" />}
          生成账期
        </Button>

        {enrollmentId ? (
          listQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-sm text-muted-foreground">该报名还没有账期</div>
          ) : (
            <ul className="space-y-1">
              {schedules.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>{`${s.periodLabel} · ${s.dueDate} · 应缴 ${s.amountDue}`}</span>
                  <span>{`${s.status} 已缴 ${s.paidAmount}${s.refundAmount ? ` 退 ${s.refundAmount}` : ''}`}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </CardContent>
    </Card>
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
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
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
          <Button
            onClick={handleSave}
            disabled={saving || !form.studentName.trim() || !form.reason.trim() || !form.refundDate}
          >
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
              <p>
                <span className="text-muted-foreground">学员：</span>
                {refund.studentName}
              </p>
              <p>
                <span className="text-muted-foreground">班级：</span>
                {refund.className}
              </p>
              <p>
                <span className="text-muted-foreground">金额：</span>
                <span className="font-medium">{refund.amount.toLocaleString()}元</span>
              </p>
              <p>
                <span className="text-muted-foreground">原因：</span>
                {refund.reason}
              </p>
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
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-1 h-4 w-4" />
            )}
            驳回
          </Button>
          <Button variant="default" onClick={() => handleAction('approved')} disabled={processing}>
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-4 w-4" />
            )}
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
  const [reminderBusinessLine, setReminderBusinessLine] = React.useState('')
  const [reminderClassFilter, setReminderClassFilter] = React.useState('')
  const [reminderRecordChannel, setReminderRecordChannel] = React.useState('')
  const [reminderSelected, setReminderSelected] = React.useState<Set<string>>(new Set())
  const [reminderDialogOpen, setReminderDialogOpen] = React.useState(false)
  const [reminderChannel, setReminderChannel] = React.useState('in_app')
  const [reminderMessage, setReminderMessage] = React.useState('')
  const [sendingReminder, setSendingReminder] = React.useState(false)

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
      return api<{ list: PaymentRecord[] }>(
        `/api/edu-ai-management/payment-record${qs ? `?${qs}` : ''}`,
      )
    },
  })
  const payments = (paymentQuery.data?.list ?? []).filter((p) => !p.deletedAt)

  const summaryQuery = useQuery({
    queryKey: ['edu-ai-management', 'payment-record', 'summary', paymentClassFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (paymentClassFilter) params.set('classId', paymentClassFilter)
      const qs = params.toString()
      return api<PaymentSummary>(
        `/api/edu-ai-management/payment-record/summary${qs ? `?${qs}` : ''}`,
      )
    },
  })
  const summary = summaryQuery.data

  // 无归属流水点名:只有缴费记录 tab 打开才拉;N>0 时亮警示条,0 时不占位。
  const unattributedQuery = useQuery({
    queryKey: ['edu-ai-management', 'payment-record', 'unattributed'],
    queryFn: () =>
      api<{ list: UnattributedPayment[]; total: number }>(
        '/api/edu-ai-management/payment-record/unattributed',
      ),
    enabled: activeTab === 'payments',
  })
  const unattributedPayments = unattributedQuery.data?.list ?? []

  const refundQuery = useQuery({
    queryKey: ['edu-ai-management', 'refund'],
    queryFn: () => api<{ list: RefundRecord[] }>('/api/edu-ai-management/refund'),
  })
  const refunds = (refundQuery.data?.list ?? []).filter((r) => !r.deletedAt)

  const arrearsQuery = useQuery({
    queryKey: [
      'edu-ai-management',
      'student-roster',
      'arrears',
      reminderBusinessLine,
      reminderClassFilter,
    ],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('arrearsOnly', '1')
      if (reminderBusinessLine) params.set('businessLine', reminderBusinessLine)
      if (reminderClassFilter) params.set('classId', reminderClassFilter)
      params.set('page', '1')
      params.set('pageSize', '100')
      return api<{ list: RosterItem[]; total: number }>(
        `/api/edu-ai-management/student-roster?${params.toString()}`,
      )
    },
  })
  const arrearsList = arrearsQuery.data?.list ?? []

  /**
   * 缴费登记与退费都要能"选到哪一期"。名册端点已按报名递 studentId/classId/dueAmount
   * (欠费额由账目出口统一算),所以这里不再自己拼名字去猜归属。
   * pageSize 必须落在该端点 schema 允许的上限内 —— 写 200 会拿到 400,
   * 表现为"下拉是空的",而 400 被 useQuery 吞掉时界面上看不出任何异常。
   */
  const payableRosterQuery = useQuery({
    queryKey: ['edu-ai-management', 'student-roster', 'payable'],
    queryFn: () =>
      api<{ list: RosterItem[]; total: number }>(
        '/api/edu-ai-management/student-roster?page=1&pageSize=100',
      ),
  })
  const payableEnrollments = payableRosterQuery.data?.list ?? []

  const reminderRecordsQuery = useQuery({
    queryKey: ['edu-ai-management', 'fee-reminder', reminderRecordChannel],
    queryFn: () => {
      const params = new URLSearchParams()
      if (reminderRecordChannel) params.set('channel', reminderRecordChannel)
      params.set('page', '1')
      params.set('pageSize', '50')
      return api<{ list: FeeReminder[]; total: number }>(
        `/api/edu-ai-management/fee-reminder?${params.toString()}`,
      )
    },
  })
  const reminderRecords = reminderRecordsQuery.data?.list ?? []

  // 催缴触达统计(近30天):只有催缴 tab 打开才拉,不在其余四个 tab 上白付一次报表查询。
  const reminderStatsQuery = useQuery({
    queryKey: ['edu-ai-management', 'fee-reminder', 'stats'],
    queryFn: () => api<ReminderStats>('/api/edu-ai-management/fee-reminder/stats?days=30'),
    enabled: activeTab === 'reminders',
  })
  const reminderStats = reminderStatsQuery.data

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

  /* 退费登记响应带 unattributed: true ⇒ 这笔退费没挂到期次,不会从任何期次的已缴额扣减。
     该信号必须当场递到操作者脸上,否则错账要到对账时才被发现。
     (响应里还有 refundRecord/enrollmentId,前端只用 unattributed,类型只声明用到的。) */
  const createRefund = useMutation({
    mutationFn: (data: RefundFormData) =>
      api<{ unattributed: boolean }>('/api/edu-ai-management/refund', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  /* 撤销缴费(软删 + 重算):后端 DELETE /payment-record/:id 早已建成,此前前端没有入口,
     错录的流水只能永远挂着。响应 unattributed=true ⇒ 被撤流水本来就没挂期次。 */
  const voidPayment = useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean; unattributed: boolean }>(
        `/api/edu-ai-management/payment-record/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })

  const approveRefund = useMutation({
    mutationFn: ({
      id,
      status,
      remark,
    }: {
      id: string
      status: 'approved' | 'rejected'
      remark: string
    }) =>
      api(`/api/edu-ai-management/refund/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status, approveRemark: remark || null }),
      }),
    onSuccess: invalidate,
  })

  const sendFeeReminder = useMutation({
    mutationFn: (data: { enrollmentIds: string[]; channel: string; message?: string }) =>
      api<{
        sent: number
        total: number
        wxSent: number
        // 短信四档聚合(后端批量端点;dueList 为空时不带该字段)
        sms?: { sent: number; failed: number; not_configured: number; no_phone: number }
        skipped: Array<{ enrollmentId: string; reason: string }>
      }>('/api/edu-ai-management/fee-reminder/batch', {
        method: 'POST',
        body: JSON.stringify(data),
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
    try {
      await createPayment.mutateAsync(data)
      toast.success('缴费已登记,欠费数字已同步重算')
    } catch (err) {
      // 后端 400 的文案本身就在教操作者怎么补救(例如"请重新选择期次"),
      // 必须原样递到脸上 —— 否则表现是"点了没反应",而这一格此前正是这样坏掉的。
      toast.error(err instanceof Error ? err.message : '缴费登记失败')
      throw err
    }
  }

  const handleAddRefund = async (data: RefundFormData) => {
    const res = await createRefund.mutateAsync(data)
    // 无归属退费 = 退了钱但任何期次的已缴额都没动,必须当场点名,不等对账。
    if (res.unattributed)
      toast.warning(
        '这笔退费没有挂到期次(未关联缴费流水,且该学员在该班有多条报名),不会从任何期次的已缴额中扣减',
      )
  }

  const handleVoidPayment = async (p: PaymentRecord) => {
    const ok = await confirmDialog({
      title: '撤销缴费',
      content: `撤销 ${p.studentName} 的缴费 ${p.amount.toLocaleString()} 元?撤销后该笔流水作废,对应期次的已缴额与欠费会立即重算。`,
      confirmText: '撤销',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await voidPayment.mutateAsync(p.id)
      toast.success('缴费已撤销,账目已重算')
      if (res.unattributed)
        toast.warning('该流水原本就没有挂到期次,撤销不改变任何期次的账目')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '撤销缴费失败')
    }
  }

  const handleApproveRefund = async (
    id: string,
    status: 'approved' | 'rejected',
    remark: string,
  ) => {
    await approveRefund.mutateAsync({ id, status, remark })
  }

  const toggleReminderSelect = (id: string) => {
    setReminderSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSendReminder = async () => {
    setSendingReminder(true)
    try {
      const res = await sendFeeReminder.mutateAsync({
        enrollmentIds: [...reminderSelected],
        channel: reminderChannel,
        ...(reminderMessage.trim() ? { message: reminderMessage.trim() } : {}),
      })
      setReminderDialogOpen(false)
      setReminderSelected(new Set())
      setReminderMessage('')
      // 2026-09-19: 展示发送结果,含微信订阅消息实际推送条数(未授权/未订阅的家长会被跳过)
      // 2026-09-30: 短信通道当场读出四档(送达/未留手机号/服务未配置/失败) —— 只报总数时,
      // "发出去了 0 条"与"服务端没配短信模板"在 toast 上同形,真因要等翻报表才知道。
      const wxPart = reminderChannel === 'wechat' ? `，微信推送 ${res.wxSent} 条` : ''
      const smsTally =
        reminderChannel === 'sms' && res.sms
          ? [
              res.sms.sent > 0 ? `短信送达 ${res.sms.sent} 条` : '',
              res.sms.no_phone > 0 ? `${res.sms.no_phone} 条收件人未留手机号` : '',
              res.sms.not_configured > 0 ? `${res.sms.not_configured} 条因短信服务未配置未发出` : '',
              res.sms.failed > 0 ? `${res.sms.failed} 条发送失败` : '',
            ].filter(Boolean)
          : []
      const smsPart = smsTally.length ? `（${smsTally.join('，')}）` : ''
      const skippedPart = res.skipped.length > 0 ? `，跳过 ${res.skipped.length} 条` : ''
      if (res.sent > 0) {
        toast.success(`催费已发送 ${res.sent} 条${wxPart}${smsPart}${skippedPart}`)
      } else {
        toast.warning(`没有成功发送的催费${smsPart}${skippedPart}`)
      }
    } finally {
      setSendingReminder(false)
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
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
          <TabsTrigger value="schedules">
            <CalendarDays className="mr-1.5 h-4 w-4" />
            账期管理
          </TabsTrigger>
          <TabsTrigger value="reminders">
            <Bell className="mr-1.5 h-4 w-4" />
            催费管理
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ Tab 1: Tuition Standards ════════════════ */}
        <TabsContent value="tuition" className="space-y-4">
          <Card>
            <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
              <Button
                size="sm"
                onClick={() => {
                  setEditingTuition(null)
                  setTuitionDialogOpen(true)
                }}
              >
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
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          班级
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          学期
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          费用名称
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          金额
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          计费周期
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          生效日期
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          状态
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          操作
                        </th>
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
                                size="xs"
                                className="text-xs"
                                onClick={() => {
                                  setEditingTuition(t)
                                  setTuitionDialogOpen(true)
                                }}
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                编辑
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                className="text-xs text-red-500"
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
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  已缴费人数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary?.paidCount ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  欠费人数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-500">{summary?.unpaidCount ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  欠费总额
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-500">
                  {summary?.unpaidAmount?.toLocaleString() ?? '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
              <Select
                value={paymentClassFilter}
                onValueChange={(v) => setPaymentClassFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部班级</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={paymentStatusFilter}
                onValueChange={(v) => setPaymentStatusFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
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

          {/* 无归属流水点名:N=0 不渲染;有则亮警示条给处置路径(重录或撤销)。
              这些钱不计入任何期次的已缴额,机构看不到就会以为已经收进账里。 */}
          {unattributedQuery.data && unattributedQuery.data.total > 0 && (
            <Alert
              variant="warning"
              title={`有 ${unattributedQuery.data.total} 笔缴费流水没有挂到期次（合计 ${unattributedPayments
                .reduce((s, r) => s + r.amount, 0)
                .toLocaleString()} 元）`}
              description="这些流水不计入任何期次的已缴额，也不会被催缴覆盖。请撤销错录的流水，或按正确期次重新登记缴费。"
            />
          )}

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
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          学员
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          班级
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          费用名称
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          金额
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          缴费日期
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          缴费方式
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          状态
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          收据号
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{p.studentName}</td>
                          <td className="px-4 py-3 text-xs">{p.className}</td>
                          <td className="px-4 py-3 text-xs">{p.feeName}</td>
                          <td className="px-4 py-3 text-xs font-medium">
                            {p.amount.toLocaleString()}
                          </td>
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
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {p.receiptNo || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline disabled:opacity-50 disabled:hover:no-underline"
                              disabled={voidPayment.isPending}
                              onClick={() => handleVoidPayment(p)}
                            >
                              撤销
                            </button>
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

        {/* ════════════════ Tab 3: Refunds ════════════════ */}
        <TabsContent value="schedules" className="space-y-4">
          <SchedulePanel enrollments={payableEnrollments} />
        </TabsContent>

        <TabsContent value="refunds" className="space-y-4">
          <Card>
            <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
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
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          学员
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          班级
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          金额
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          退费日期
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          退费方式
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          原因
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          状态
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {refunds.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{r.studentName}</td>
                          <td className="px-4 py-3 text-xs">{r.className}</td>
                          <td className="px-4 py-3 text-xs font-medium">
                            {r.amount.toLocaleString()}
                          </td>
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
                                size="xs"
                                className="text-xs"
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

        {/* ════════════════ Tab 4: Fee Reminders ════════════════ */}
        <TabsContent value="reminders" className="space-y-4">
          {/* 欠费名单 */}
          <Card>
            <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
              <Select
                value={reminderBusinessLine || 'all'}
                onValueChange={(v) => {
                  setReminderBusinessLine(v === 'all' ? '' : v)
                  setReminderSelected(new Set())
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部业务线" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部业务线</SelectItem>
                  {BUSINESS_LINES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={reminderClassFilter || 'all'}
                onValueChange={(v) => {
                  setReminderClassFilter(v === 'all' ? '' : v)
                  setReminderSelected(new Set())
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部班级</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={reminderSelected.size === 0}
                onClick={() => setReminderDialogOpen(true)}
              >
                <Bell className="mr-1 h-3.5 w-3.5" />
                发送催费({reminderSelected.size})
              </Button>
              {arrearsQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {arrearsQuery.error ? (
            <Alert variant="danger" description="加载欠费名单失败，请稍后重试" />
          ) : arrearsQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载欠费名单...
              </CardContent>
            </Card>
          ) : arrearsList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无欠费学生
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="w-10 px-4 py-3" />
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          学员
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          业务线
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          班级
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          电话
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          总费用
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          已支付
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          欠费
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {arrearsList.map((r) => (
                        <tr
                          key={r.enrollmentId}
                          className="border-b last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={reminderSelected.has(r.enrollmentId)}
                              onChange={() => toggleReminderSelect(r.enrollmentId)}
                            />
                          </td>
                          <td className="px-4 py-3 text-xs font-medium">{r.studentName}</td>
                          <td className="px-4 py-3 text-xs">
                            {BUSINESS_LINE_MAP.get(r.businessLine) ?? r.businessLine}
                          </td>
                          <td className="px-4 py-3 text-xs">{r.className}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {r.studentPhone ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-xs">{r.totalFee.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs">{r.paidAmount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs font-medium text-red-600">
                            {r.dueAmount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 催缴触达统计:delivery.buckets 是逐收件人回执聚合,"送达"才计入真触达;
              unknownReminders 是回执列上线前的历史行,两向都不计。caveat 文案来自后端,与数字同源。 */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">催缴触达统计（近 30 天）</h2>
            {reminderStatsQuery.error ? (
              <Alert variant="danger" description="加载催缴统计失败，请稍后重试" />
            ) : reminderStatsQuery.isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  加载统计...
                </CardContent>
              </Card>
            ) : reminderStats ? (
              <Card>
                <CardContent className="min-[640px]:p-3 space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="text-[10px] text-white bg-blue-500">
                      登记催缴 {reminderStats.total} 条
                    </Badge>
                    {DELIVERY_BUCKET_LABELS.map(([key, label]) => {
                      const n = reminderStats.delivery.buckets[key] ?? 0
                      if (n === 0) return null
                      return (
                        <Badge
                          key={key}
                          variant="secondary"
                          className={cn(
                            'text-[10px] text-white',
                            DELIVERY_BUCKET_COLOR_MAP.get(key) ?? 'bg-gray-500',
                          )}
                        >
                          {label} {n}
                        </Badge>
                      )
                    })}
                    {Object.entries(reminderStats.delivery.buckets)
                      .filter(([k]) => !DELIVERY_BUCKET_LABELS.some(([lk]) => lk === k))
                      .map(([k, n]) => (
                        <Badge key={k} variant="secondary" className="text-[10px] text-white bg-gray-500">
                          {k} {n}
                        </Badge>
                      ))}
                    {reminderStats.delivery.unknownReminders > 0 && (
                      <Badge variant="secondary" className="text-[10px] text-white bg-gray-400">
                        无回执（历史行） {reminderStats.delivery.unknownReminders}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {reminderStats.caveat}
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>

          {/* 催费记录 */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">催费记录</h2>
            <Card>
              <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
                <Select
                  value={reminderRecordChannel || 'all'}
                  onValueChange={(v) => setReminderRecordChannel(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="全部通道" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部通道</SelectItem>
                    {REMINDER_CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reminderRecordsQuery.isLoading && (
                  <div className="ml-auto flex items-center text-xs text-muted-foreground">
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    加载中...
                  </div>
                )}
              </CardContent>
            </Card>

            {reminderRecordsQuery.error ? (
              <Alert variant="danger" description="加载催费记录失败，请稍后重试" />
            ) : reminderRecords.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  暂无催费记录
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            通道
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            催缴金额
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            内容
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            状态
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            时间
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reminderRecords.map((m) => (
                          <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 text-xs">
                              {REMINDER_CHANNEL_MAP.get(m.channel) ?? m.channel}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium">
                              {m.dueAmount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              <TruncatedText value={m.message ?? '-'} className="max-w-[320px]" />
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[10px] text-white',
                                  REMINDER_STATUS_COLOR_MAP.get(m.status) ?? 'bg-gray-500',
                                )}
                              >
                                {REMINDER_STATUS_MAP.get(m.status) ?? m.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {new Date(m.createdAt).toLocaleString('zh-CN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 发送催费 Dialog */}
          <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>发送催费</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  已选择 {reminderSelected.size}{' '}
                  条欠费记录，发送后将通过所选通道通知学生（短信/微信通道当前同步发送一条站内信兜底）。
                </p>
                <div className="space-y-1.5">
                  <Label>发送通道</Label>
                  <Select value={reminderChannel} onValueChange={setReminderChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDER_CHANNELS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>自定义文案（可选）</Label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    placeholder="留空则使用系统默认催缴文案"
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    className="flex w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSendReminder} disabled={sendingReminder}>
                  {sendingReminder && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  确认发送
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        enrollments={payableEnrollments}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
