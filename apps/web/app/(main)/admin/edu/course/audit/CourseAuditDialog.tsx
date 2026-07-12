'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
} from '@ihui/ui'
import { COURSE_FIELDS, VIDEO_FIELDS } from './helpers'
import type { CompareData } from './types'

function CompareRow({ label, before, after }: { label: string; before: unknown; after: unknown }) {
  const b = before === null || before === undefined || before === '' ? '-' : String(before)
  const a = after === null || after === undefined || after === '' ? '-' : String(after)
  const diff = b !== a
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-muted/40 py-1.5 text-sm">
      <div className="font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          'break-words',
          diff && 'rounded bg-red-500/5 px-1 text-red-600 dark:text-red-400',
        )}
      >
        {b}
      </div>
      <div
        className={cn(
          'break-words',
          diff && 'rounded bg-emerald-500/5 px-1 text-emerald-600 dark:text-emerald-400',
        )}
      >
        {a}
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  compareType: number
  compareData: CompareData
  loadingCompare: boolean
  compareRemark: string
  onRemarkChange: (v: string) => void
  pending: boolean
  onApprove: () => void
  onRectify: () => void
  onClose: () => void
}

export function CourseAuditDialog({
  open,
  compareType,
  compareData,
  loadingCompare,
  compareRemark,
  onRemarkChange,
  pending,
  onApprove,
  onRectify,
  onClose,
}: Props) {
  const t = useTranslations('admin.edu.course.audit')
  const fields = compareType === 0 ? COURSE_FIELDS : VIDEO_FIELDS
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('dialog.compareTitle', { type: t(`type.${compareType}`) })}</DialogTitle>
        </DialogHeader>
        {loadingCompare ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('dialog.loadingCompare')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground">
              <div>{t('dialog.field')}</div>
              <div className="text-red-600 dark:text-red-400">{t('dialog.before')}</div>
              <div className="text-emerald-600 dark:text-emerald-400">{t('dialog.after')}</div>
            </div>
            {fields.map(([key, label]) => (
              <CompareRow
                key={key}
                label={t(label)}
                before={compareData.before[key]}
                after={compareData.after[key]}
              />
            ))}
            <div className="space-y-2 pt-2">
              <Label htmlFor="audit-remark">{t('dialog.remark')}</Label>
              <textarea
                id="audit-remark"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={compareRemark}
                onChange={(e) => onRemarkChange(e.target.value)}
                placeholder={t('dialog.remarkPlaceholder')}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {t('dialog.close')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRectify}
            disabled={pending || loadingCompare}
            className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
          >
            {t('dialog.rectify')}
          </Button>
          <Button type="button" onClick={onApprove} disabled={pending || loadingCompare}>
            {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t('dialog.approve')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
