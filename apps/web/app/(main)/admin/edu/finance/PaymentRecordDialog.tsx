// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiOrThrow } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui-react'
import { EDU_AI_BASE, PAYMENT_METHODS, EMPTY_PAYMENT_RECORD } from './helpers'
import type { PaymentRecordForm, RosterEnrollment } from './types'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * G-28 登记缴费:站内记录一笔缴费,挂到一条确定的报名(enrollmentId)上。
 * 归属只靠选出来的 enrollmentId,不自报 studentId/classId(后端以报名行为准并做一致性校验)。
 * 名册取 GET /student-roster(应缴/已缴/欠费都由账目出口带,前端不自己减)。
 */
export function PaymentRecordDialog({ open, onClose }: Props) {
  const t = useTranslations('admin.edu.finance.index')
  const qc = useQueryClient()
  const [form, setForm] = React.useState<PaymentRecordForm>(EMPTY_PAYMENT_RECORD)
  const [err, setErr] = React.useState<string | null>(null)

  const rosterQuery = useQuery({
    queryKey: ['edu-ai-management', 'student-roster', 'payable'],
    enabled: open,
    queryFn: () =>
      apiOrThrow<{ list: RosterEnrollment[]; total: number }>(
        `${EDU_AI_BASE}/student-roster?page=1&pageSize=100`,
      ),
  })
  const roster = rosterQuery.data?.list ?? []

  const reset = React.useCallback(() => {
    setForm(EMPTY_PAYMENT_RECORD)
    setErr(null)
  }, [])

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const amountInt = Math.round(Number(form.amount))
  const methodLabel = (value: string) => {
    if (value === 'cash') return t('methodCash')
    if (value === 'transfer') return t('methodTransfer')
    if (value === 'wechat') return t('methodWechat')
    return t('methodAlipay')
  }
  const valid =
    !!form.enrollmentId &&
    form.amount.trim() !== '' &&
    Number.isFinite(amountInt) &&
    amountInt >= 0 &&
    !!form.paymentDate &&
    !!form.paymentMethod

  const saveMut = useMutation({
    mutationFn: () =>
      apiOrThrow(`${EDU_AI_BASE}/payment-record`, {
        method: 'POST',
        body: JSON.stringify({
          enrollmentId: form.enrollmentId,
          amount: amountInt,
          paymentDate: form.paymentDate,
          paymentMethod: form.paymentMethod,
          remark: form.remark.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu-ai-management'] })
      reset()
      onClose()
    },
    onError: (e: Error) => setErr(e.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!valid || saveMut.isPending) return
    saveMut.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('recordTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('enrollmentLabel')}</Label>
            <Select
              value={form.enrollmentId}
              onValueChange={(v) => setForm({ ...form, enrollmentId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('enrollmentPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {roster.map((r) => (
                  <SelectItem key={r.enrollmentId} value={r.enrollmentId}>
                    {t('rosterLine', {
                      name: r.studentName,
                      cls: r.className,
                      totalFee: r.totalFee,
                      paidAmount: r.paidAmount,
                      dueAmount: r.dueAmount,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rosterQuery.isLoading && (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            )}
            {!rosterQuery.isLoading && roster.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('emptyRoster')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pr-amount">{t('amountLabel')}</Label>
              <Input
                id="pr-amount"
                type="number"
                min={0}
                step={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-date">{t('dateLabel')}</Label>
              <Input
                id="pr-date"
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('payWayLabel')}</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) => setForm({ ...form, paymentMethod: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {methodLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('remarkLabel')}</Label>
              <Input
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                placeholder={t('remarkPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saveMut.isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!valid || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
