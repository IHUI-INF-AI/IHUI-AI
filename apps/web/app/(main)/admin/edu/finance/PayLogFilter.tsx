'use client'
import Link from 'next/link'
import { Plus, Trash2, Download, ChevronLeft } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button, Input } from '@ihui/ui'
import { PERM } from './helpers'

interface PayLogQuery {
  userUuid: string
  courseId: string
  videoId: string
  outBillOn: string
  payWay: string
}

interface Props {
  q: PayLogQuery
  onQChange: (patch: Partial<PayLogQuery>) => void
  onReset: () => void
  onCreate: () => void
  onBatchDelete: () => void
  onExport: () => void
  hasSelection: boolean
}

export function PayLogFilter({
  q,
  onQChange,
  onReset,
  onCreate,
  onBatchDelete,
  onExport,
  hasSelection,
}: Props) {
  const inputCls = 'h-9 w-32'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu">
          <ChevronLeft className="h-4 w-4" />
          返回教育后台
        </Link>
      </Button>
      <Input
        placeholder="用户UUID"
        value={q.userUuid}
        onChange={(e) => onQChange({ userUuid: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder="课程ID"
        value={q.courseId}
        onChange={(e) => onQChange({ courseId: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder="视频ID"
        value={q.videoId}
        onChange={(e) => onQChange({ videoId: e.target.value })}
        className={inputCls}
      />
      <Input
        type="date"
        placeholder="账单日期"
        value={q.outBillOn}
        onChange={(e) => onQChange({ outBillOn: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder="支付方式"
        value={q.payWay}
        onChange={(e) => onQChange({ payWay: e.target.value })}
        className={inputCls}
      />
      <Button variant="outline" size="sm" onClick={onReset}>
        重置
      </Button>
      <div className="ml-auto flex gap-2">
        <HasPermi code={`${PERM}add`}>
          <Button onClick={onCreate} size="sm">
            <Plus className="h-4 w-4" />
            新建
          </Button>
        </HasPermi>
        <HasPermi code={`${PERM}remove`}>
          <Button variant="outline" size="sm" disabled={!hasSelection} onClick={onBatchDelete}>
            <Trash2 className="h-4 w-4" />
            批量删除
          </Button>
        </HasPermi>
        <HasPermi code={`${PERM}export`}>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
      </div>
    </div>
  )
}
