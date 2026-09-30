// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { History, Loader2, LogIn, Trash2, FileText, Folder } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { useAuthStore } from '@/stores/auth'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'

type ResourceType = 'project' | 'file' | 'doc' | 'post'

interface HistoryItem {
  id: string
  resourceType: ResourceType
  resourceId: string
  title?: string | null
  visitedAt: string
}

const TYPE_ICON: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  project: Folder,
  file: FileText,
  doc: FileText,
  post: FileText,
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberHistoryPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  // 2026-09-30 登录态门:与 /chat/history 同型修复。此前匿名访问也发注定 401 的请求
  // (queryFn 静默吞错返回 [],界面显示「暂无浏览记录」而非登录引导)。
  const { ready } = useAuthBootstrap()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'history'],
    queryFn: () =>
      api<{ list: HistoryItem[] }>('/api/history')
        .then((d) => d.list ?? [])
        .catch(() => [] as HistoryItem[]),
    enabled: ready && isAuthenticated,
  })

  const clearMut = useMutation({
    mutationFn: () => api('/api/history', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'history'] }),
  })

  const items = data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="px-4 space-y-4">
      <BackButton />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight">
            <History className="h-5 w-5 shrink-0 text-primary" />
            <span className="whitespace-nowrap">浏览历史</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">最近浏览过的内容</p>
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearMut.mutate()}
            disabled={clearMut.isPending}
            className="whitespace-nowrap text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {clearMut.isPending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 shrink-0" />
            )}
            <span className="whitespace-nowrap">清空</span>
          </Button>
        )}
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {!ready || !isAuthenticated ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
          <LogIn className="h-8 w-8 opacity-40" />
          <p className="text-sm">请先登录后查看浏览历史</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
          <span className="whitespace-nowrap">加载中...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <History className="h-8 w-8 shrink-0 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">暂无浏览记录</p>
        </div>
      ) : (
        <ul className="space-y-2 rounded-lg border p-2">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.resourceType] ?? FileText
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0 whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {item.resourceType}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.title ?? item.resourceId}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                  {dateFmt.format(new Date(item.visitedAt))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
