'use client'

import { Loader2 } from 'lucide-react'
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
          <DialogTitle>审核对比 — {compareType === 0 ? '课程' : '视频'}</DialogTitle>
        </DialogHeader>
        {loadingCompare ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载对比数据...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground">
              <div>字段</div>
              <div className="text-red-600 dark:text-red-400">修改前</div>
              <div className="text-emerald-600 dark:text-emerald-400">修改后</div>
            </div>
            {fields.map(([key, label]) => (
              <CompareRow
                key={key}
                label={label}
                before={compareData.before[key]}
                after={compareData.after[key]}
              />
            ))}
            <div className="space-y-2 pt-2">
              <Label htmlFor="audit-remark">审核意见</Label>
              <textarea
                id="audit-remark"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={compareRemark}
                onChange={(e) => onRemarkChange(e.target.value)}
                placeholder="请输入审核意见（整改必填）"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            关闭
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRectify}
            disabled={pending || loadingCompare}
            className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
          >
            提交整改
          </Button>
          <Button type="button" onClick={onApprove} disabled={pending || loadingCompare}>
            {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}通过审核
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
