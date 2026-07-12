'use client'
import Link from 'next/link'
import { Plus, Trash2, Download, ChevronLeft } from 'lucide-react'
import { selectClass } from '@/lib/edu'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { PERM } from './helpers'

interface CourseQuery {
  title: string
  stage: string
  label: string
  creator: string
}

interface Props {
  q: CourseQuery
  onQChange: (patch: Partial<CourseQuery>) => void
  onReset: () => void
  onCreate: () => void
  onBatchDelete: () => void
  onExport: () => void
  hasSelection: boolean
}

export function CourseFilter({
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
        placeholder="标题"
        value={q.title}
        onChange={(e) => onQChange({ title: e.target.value })}
        className={inputCls}
      />
      <div className="w-28">
        <Select
          value={q.stage || 'all'}
          onValueChange={(v) => onQChange({ stage: v === 'all' ? '' : v })}
        >
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="阶段" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部阶段</SelectItem>
            <SelectItem value="0">初级</SelectItem>
            <SelectItem value="1">中级</SelectItem>
            <SelectItem value="2">高级</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input
        placeholder="标签"
        value={q.label}
        onChange={(e) => onQChange({ label: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder="创建人"
        value={q.creator}
        onChange={(e) => onQChange({ creator: e.target.value })}
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
