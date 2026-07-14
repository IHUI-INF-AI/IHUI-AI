'use client'
import { Plus } from 'lucide-react'
import { Button, Input } from '@ihui/ui'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  onCreate: () => void
}

export function AiModelsFilter({ search, onSearchChange, onCreate }: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">AI 模型配置</h1>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          新增
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
