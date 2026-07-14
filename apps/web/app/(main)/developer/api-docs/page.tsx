'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Code, Loader2, Search, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface ApiParam {
  name: string
  type: string
  required?: boolean
  description?: string
}

interface ApiEndpoint {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  summary: string
  category: string
  params?: ApiParam[]
  responseExample?: string
}

interface ApiDocGroup {
  category: string
  endpoints: ApiEndpoint[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const METHOD_CLASS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DELETE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  PATCH: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export default function ApiDocsPage() {
  const [keyword, setKeyword] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const {
    data: groups = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'api-docs'],
    queryFn: () => api<ApiDocGroup[]>('/api/developer/docs').catch(() => [] as ApiDocGroup[]),
  })

  const filtered = React.useMemo(() => {
    if (!keyword.trim()) return groups
    const kw = keyword.toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        endpoints: g.endpoints.filter(
          (e) =>
            e.path.toLowerCase().includes(kw) ||
            e.summary.toLowerCase().includes(kw) ||
            e.category.toLowerCase().includes(kw),
        ),
      }))
      .filter((g) => g.endpoints.length > 0)
  }, [groups, keyword])

  const allEndpoints = filtered.flatMap((g) => g.endpoints)
  const selected = allEndpoints.find((e) => e.id === selectedId) ?? allEndpoints[0] ?? null

  React.useEffect(() => {
    if (!selectedId && allEndpoints.length > 0) setSelectedId(allEndpoints[0]?.id ?? null)
  }, [allEndpoints, selectedId])

  function copyPath(path: string) {
    navigator.clipboard?.writeText(path).then(
      () => toast.success('已复制路径'),
      () => toast.error('复制失败'),
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Code className="h-5 w-5 text-primary" />
          API 文档
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">查阅开放平台接口说明与调用示例</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索接口路径或名称..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">暂无 API 文档</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-3 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-2">
            {filtered.map((g) => (
              <div key={g.category}>
                <p className="mb-1 px-1 text-xs font-semibold uppercase text-muted-foreground">
                  {g.category}
                </p>
                <div className="space-y-0.5">
                  {g.endpoints.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                        selected?.id === e.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 rounded px-1 py-0.5 text-[10px] font-bold',
                          METHOD_CLASS[e.method],
                        )}
                      >
                        {e.method}
                      </span>
                      <span className="truncate">{e.path}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          {selected && (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-bold',
                        METHOD_CLASS[selected.method],
                      )}
                    >
                      {selected.method}
                    </span>
                    <code className="flex-1 text-sm font-medium">{selected.path}</code>
                    <button
                      onClick={() => copyPath(selected.path)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{selected.summary}</p>
                </div>

                {selected.params && selected.params.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-semibold">请求参数</p>
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium">参数名</th>
                            <th className="px-2 py-1.5 text-left font-medium">类型</th>
                            <th className="px-2 py-1.5 text-left font-medium">必填</th>
                            <th className="px-2 py-1.5 text-left font-medium">说明</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selected.params.map((p) => (
                            <tr key={p.name}>
                              <td className="px-2 py-1.5 font-mono">{p.name}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{p.type}</td>
                              <td className="px-2 py-1.5">
                                {p.required ? (
                                  <span className="text-rose-600 dark:text-rose-400">是</span>
                                ) : (
                                  <span className="text-muted-foreground">否</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground">
                                {p.description ?? '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selected.responseExample && (
                  <div>
                    <p className="mb-1.5 text-sm font-semibold">响应示例</p>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                      <code>{selected.responseExample}</code>
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
