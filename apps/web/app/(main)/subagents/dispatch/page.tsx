'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { DispatchForm } from '@/components/subagents/DispatchForm'
import { createDispatch } from '@/lib/subagents-api'
import type { SubagentDispatchInput } from '@ihui/shared/subagents/index'

export default function SubagentDispatchPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: (input: SubagentDispatchInput) => createDispatch(input),
    onSuccess: (data) => {
      if (data.outcome === 'success' && data.dispatch?.id) {
        qc.invalidateQueries({ queryKey: ['subagents'] })
        router.push(`/subagents/detail?id=${data.dispatch.id}`)
      } else if (data.outcome === 'concurrent_limit') {
        setError(data.error ?? '并发派单数已达上限')
      } else if (data.outcome === 'cyclic_dependency') {
        setError(data.error ?? 'DAG 存在循环依赖')
      } else {
        setError('派单失败:未知结果')
      }
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <button
        type="button"
        onClick={() => router.push('/subagents')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">新建 Subagent 派单</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          按需配置 Agent 角色 / 编排模式 / 优先级 / DAG / 资源配额
        </p>
      </div>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-sm">派单表单</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <DispatchForm onSubmit={(input) => mut.mutate(input)} isSubmitting={mut.isPending} error={error} />
        </CardContent>
      </Card>
    </div>
  )
}
