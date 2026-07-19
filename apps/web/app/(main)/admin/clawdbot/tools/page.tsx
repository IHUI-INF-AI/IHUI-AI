'use client'

import * as React from 'react'
import { Wrench, Loader2, Play, X } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface ToolItem {
  name: string
  description: string
  category: string
  timeout: number
  requiredPermissions: string[]
  enabled: boolean
}

type ToolsData = { list: ToolItem[] } | ToolItem[]

interface ToolExecResult {
  success: boolean
  output?: unknown
  error?: string
  durationMs: number
  timedOut: boolean
}

export default function ClawdbotToolsPage() {
  const [tools, setTools] = React.useState<ToolItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [testing, setTesting] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ToolExecResult | null>(null)
  const [paramsText, setParamsText] = React.useState('{}')

  const load = React.useCallback(async () => {
    const res = await fetchApi<ToolsData>('/api/admin/clawdbot/tools')
    if (res.success && res.data) {
      const d = res.data
      setTools(Array.isArray(d) ? d : (d.list ?? []))
    } else if (!res.success) {
      setError(res.error)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const testTool = async (name: string) => {
    setTesting(name)
    let params = {}
    try {
      params = JSON.parse(paramsText)
    } catch {
      params = {}
    }
    const res = await fetchApi<ToolExecResult>(`/api/admin/clawdbot/tools/${name}/execute`, {
      method: 'POST',
      body: JSON.stringify({ params }),
    })
    setTesting(null)
    if (!res.success) {
      setResult({ success: false, error: res.error, durationMs: 0, timedOut: false })
    } else if (res.data) {
      setResult(res.data)
    } else {
      setResult({ success: false, error: '无数据', durationMs: 0, timedOut: false })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中...
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4">
        <Alert variant="danger" title="加载失败" description={error} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Wrench className="h-6 w-6 text-primary" /> 工具管理
      </h1>

      <div className="rounded-lg border bg-card">
        <div className="divide-y">
          {tools.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              暂无工具
            </div>
          ) : (
            tools.map((t) => (
              <div key={t.name} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {t.category}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs',
                        t.enabled
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t.enabled ? '启用' : '禁用'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.description} · 超时 {t.timeout}ms
                  </p>
                  {t.requiredPermissions.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      权限: {t.requiredPermissions.join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testTool(t.name)}
                  disabled={testing === t.name}
                >
                  {testing === t.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border bg-card p-4">
        <Label>测试参数 (JSON)</Label>
        <Input
          value={paramsText}
          onChange={(e) => setParamsText(e.target.value)}
          placeholder='{"key": "value"}'
        />
      </div>

      {result && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
          tabIndex={0}
          onClick={() => setResult(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setResult(null)
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-lg border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <p className="text-sm font-medium">执行结果</p>
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs',
                    result.success
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-red-500/10 text-red-600',
                  )}
                >
                  {result.success ? '成功' : '失败'}
                </span>
                <span className="text-xs text-muted-foreground">{result.durationMs}ms</span>
                {result.timedOut && <span className="text-xs text-amber-600">超时</span>}
              </div>
              {result.error && <div className="text-red-600">{result.error}</div>}
              {result.output !== undefined && (
                <div>
                  <span className="text-muted-foreground">输出:</span>
                  <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted/50 p-2 text-xs">
                    {typeof result.output === 'string'
                      ? result.output
                      : JSON.stringify(result.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
