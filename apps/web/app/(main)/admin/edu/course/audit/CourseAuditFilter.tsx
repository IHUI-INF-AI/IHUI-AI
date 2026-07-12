'use client'

import { Download } from 'lucide-react'
import { Button, Input } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM } from './helpers'
import type { CourseAuditSearch } from './types'

interface Props {
  q: CourseAuditSearch
  onQChange: (patch: Partial<CourseAuditSearch>) => void
  onReset: () => void
  onExport: () => void
}

export function CourseAuditFilter({ q, onQChange, onReset, onExport }: Props) {
  const inputCls = 'h-9 w-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="操作"
        value={q.operate}
        onChange={(e) => onQChange({ operate: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder="源ID"
        value={q.sourceId}
        onChange={(e) => onQChange({ sourceId: e.target.value })}
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
      <div className="ml-auto">
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
