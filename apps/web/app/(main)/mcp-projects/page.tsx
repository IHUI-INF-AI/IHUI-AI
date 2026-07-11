'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Boxes } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ihui/ui'

interface McpProject {
  id: string
  name: string
  description: string
  status: 'running' | 'stopped' | 'error'
  config: string
}

const STATUS_LABEL: Record<McpProject['status'], string> = {
  running: '运行中',
  stopped: '已停止',
  error: '异常',
}

const STATUS_CLASS: Record<McpProject['status'], string> = {
  running: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  stopped: 'bg-muted text-muted-foreground',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export default function McpProjectsPage() {
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['mcp-projects'],
    queryFn: async () => {
      const r = await fetchApi<McpProject[]>('/api/mcp/projects')
      if (r.success && r.data) return r.data
      return []
    },
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Boxes className="h-6 w-6 text-primary" />
          MCP 项目
        </h1>
        <p className="text-sm text-muted-foreground">管理 Model Context Protocol 项目</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          暂无 MCP 项目
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((p) => (
            <Card key={p.id}>
              <CardHeader className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLASS[p.status] ?? ''
                    }`}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
                <CardDescription className="text-sm">{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  {p.config}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
