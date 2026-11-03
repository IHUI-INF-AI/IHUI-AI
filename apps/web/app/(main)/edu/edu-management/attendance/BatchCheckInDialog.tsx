// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Users } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { ClassSelect } from './ClassSelect'

/** 批量点名协议响应(后端 batch-check-in 契约) */
interface BatchCheckInResult {
  created: number
  skipped: number
  missedIds: string[]
}

/** 数字计数徽章模板(AGENTS §4,禁止裸 span 手搓) */
function CountBadge({ value, tone }: { value: number; tone: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-md px-1 text-[10px] font-semibold leading-none tabular-nums text-white',
        tone,
      )}
    >
      {value}
    </span>
  )
}

export function BatchCheckInDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultClassId = '',
  statusOptions,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultDate: string
  defaultClassId?: string
  statusOptions: ReadonlyArray<{ value: string; labelKey: string }>
  onDone: () => void
}) {
  const t = useTranslations('eduAttendance')
  const [classId, setClassId] = React.useState(defaultClassId)
  const [date, setDate] = React.useState(defaultDate)
  const [status, setStatus] = React.useState('present')
  const [remark, setRemark] = React.useState('')
  const [result, setResult] = React.useState<BatchCheckInResult | null>(null)

  React.useEffect(() => {
    if (open) {
      setDate(defaultDate)
      if (defaultClassId) setClassId(defaultClassId)
      setResult(null)
    }
  }, [open, defaultDate, defaultClassId])

  const mutation = useMutation<BatchCheckInResult, Error>({
    mutationFn: () =>
      apiOrThrow<BatchCheckInResult>('/api/edu-ai-management/attendance/batch-check-in', {
        method: 'POST',
        body: JSON.stringify({
          classId,
          date,
          status,
          remark: remark.trim() || undefined,
        }),
      }),
    onSuccess: (data) => {
      setResult(data)
      onDone()
    },
  })

  const canSubmit = classId.length > 0 && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('batchCheckIn')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>{t('classLabel')}</Label>
            <ClassSelect value={classId} onChange={setClassId} triggerClassName="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('date')}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('status')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(s.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('remark')}</Label>
            <Input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={t('remarkPlaceholder')}
            />
          </div>
          {mutation.error ? (
            <Alert
              variant="danger"
              description={
                mutation.error.message.trim().length > 0 ? mutation.error.message : t('batchFailed')
              }
            />
          ) : null}
          {result ? (
            <div className="rounded-md border p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  {t('batchResultCreated')}
                  <CountBadge value={result.created} tone="bg-green-500" />
                </span>
                <span className="flex items-center gap-1.5">
                  {t('batchResultSkipped')}
                  <CountBadge value={result.skipped} tone="bg-gray-500" />
                </span>
                <span className="flex items-center gap-1.5">
                  {t('batchResultMissed')}
                  <CountBadge value={result.missedIds.length} tone="bg-red-500" />
                </span>
              </div>
              {result.missedIds.length > 0 && (
                <p className="text-muted-foreground font-mono break-all">
                  {result.missedIds.map((id) => id.slice(0, 8)).join(', ')}
                </p>
              )}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <Users className="mr-1 h-4 w-4" />
            {result ? t('batchCheckIn') : t('batchConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
