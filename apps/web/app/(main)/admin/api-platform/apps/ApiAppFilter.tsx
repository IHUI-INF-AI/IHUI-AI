'use client'

import { Plus, KeyRound } from 'lucide-react'
import { Button } from '@ihui/ui'

interface Props {
  onCreate: () => void
}

export function ApiAppFilter({ onCreate }: Props) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <KeyRound className="h-6 w-6 text-primary" />
          API 应用管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">管理 API 平台应用、密钥与权限</p>
      </div>
      <Button size="sm" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        新建应用
      </Button>
    </div>
  )
}
