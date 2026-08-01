'use client'
import { Plus } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  onCreate: () => void
}

export function AiModelsFilter({ search, onSearchChange, onCreate }: Props) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight"><span className="truncate">AI 模型配置</span></h1>
        <Button size="sm" className="shrink-0" onClick={onCreate}>
          <Plus className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">新增</span>
        </Button>
      </div>
      <Input
        placeholder="搜索模型名称..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
    </>
  )
}
