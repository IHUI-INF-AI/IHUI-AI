'use client'
import { Plus, Download } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button, Input } from '@ihui/ui'
import { PERM } from './helpers'

interface PlatformQuery {
  code: string
  name: string
}

interface Props {
  q: PlatformQuery
  onQChange: (patch: Partial<PlatformQuery>) => void
  onReset: () => void
  onCreate: () => void
  onExport: () => void
}

export function PlatformFilter({ q, onQChange, onReset, onCreate, onExport }: Props) {
  const inputCls = 'h-9 w-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
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
