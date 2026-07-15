'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Globe, Loader2, ExternalLink, Info } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface AiCategory {
  id: string
  name: string
  icon: string
}

interface HotApp {
  id: string
  name: string
  href: string
}

interface AiWorldData {
  categories: AiCategory[]
  hotApps: HotApp[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const ICON_LABEL: Record<string, string> = {
  message: '对话',
  palette: '绘画',
  video: '视频',
  music: '音乐',
  code: '代码',
  briefcase: '办公',
  graduation: '教育',
  megaphone: '营销',
}

export default function AdminAiWorldSitesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'ai-world'],
    queryFn: () => api<AiWorldData>('/api/ai-world'),
  })

  const categories = data?.categories ?? []
  const hotApps = data?.hotApps ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Globe className="h-6 w-6 text-primary" />
          AI 世界站点管理
        </h1>
        <Button size="sm" variant="outline" asChild>
          <Link href="/admin/agents">
            <ExternalLink className="h-4 w-4" />
            前往 Agent 管理
          </Link>
        </Button>
      </div>

      <Alert
        variant="info"
        description="AI 世界站点由已发布的 Agent 组成。如需新增或修改站点,请在 Agent 管理中操作。"
      />

      {isError && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">分类配置({categories.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
                      {ICON_LABEL[cat.icon] ?? cat.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">{cat.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">热门站点({hotApps.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {hotApps.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  暂无热门站点,请在 Agent 管理中发布 Agent
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">站点名称</th>
                        <th className="px-3 py-2 font-medium">ID</th>
                        <th className="px-3 py-2 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {hotApps.map((app) => (
                        <tr key={app.id} className="transition-colors hover:bg-accent/50">
                          <td className="px-3 py-2 font-medium">{app.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {app.id}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost" asChild>
                              <Link href="/admin/agents">编辑</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
