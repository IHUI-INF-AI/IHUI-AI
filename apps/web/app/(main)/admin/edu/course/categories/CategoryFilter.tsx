'use client'
import Link from 'next/link'
import { Plus, Trash2, Download, ChevronLeft } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button, Input } from '@ihui/ui'
import { PERM } from './helpers'

interface CategoryQuery {
  code: string
  name: string
  prentId: string
}

interface Props {
  q: CategoryQuery
  onQChange: (patch: Partial<CategoryQuery>) => void
  onReset: () => void
  onCreate: () => void
  onBatchDelete: () => void
  onExport: () => void
  hasSelection: boolean
}

export function CategoryFilter({
  q,
  onQChange,
  onReset,
  onCreate,
  onBatchDelete,
  onExport,
  hasSelection,
}: Props) {
  const inputCls = 'h-9 w-36'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/course">
          <ChevronLeft className="h-4 w-4" />
          返回课程管理
        </Link>
      </Button>
      <Input
        placeholder="编码"
        value={q.code}
        onChange={(e) => onQChange({ code: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder="名称"
        value={q.name}
        onChange={(e) => onQChange({ name: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder="父ID"
        value={q.prentId}
        onChange={(e) => onQChange({ prentId: e.target.value })}
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
