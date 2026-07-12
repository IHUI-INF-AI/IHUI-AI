'use client'

import { Plus, Download } from 'lucide-react'
import { Button, Input } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM } from './helpers'
import type { CoursePaySearch } from './types'

interface Props {
  q: CoursePaySearch
  onQChange: (patch: Partial<CoursePaySearch>) => void
  onReset: () => void
  onCreate: () => void
  onExport: () => void
}

export function CoursePayFilter({ q, onQChange, onReset, onCreate, onExport }: Props) {
  const inputCls = 'h-9 w-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="付费人群"
        value={q.payCrowd}
        onChange={(e) => onQChange({ payCrowd: e.target.value })}
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
