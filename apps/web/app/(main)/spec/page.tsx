'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileText, Loader2, AlertCircle, Layers } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import {
  SPEC_BUILTIN_TEMPLATES,
  type SpecHistoryEntry,
  type SpecScopeType,
} from '@ihui/shared/spec/index'
import { fetchSpecHistory } from '@/lib/spec-api'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function scopeLabel(t: SpecScopeType): string {
  switch (t) {
    case 'file':
      return '文件'
    case 'dir':
      return '目录'
    case 'workspace':
      return '工作区'
  }
}

function HistoryRow({ entry }: { entry: SpecHistoryEntry }) {
  return (
    <Link href={`/spec/${entry.id}`} className="block">
      <Card className="transition-colors hover:bg-accent/30">
        <CardContent className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground">
                {scopeLabel(entry.scope.type)}
              </span>
              {entry.scope.path && (
                <span className="truncate text-xs text-muted-foreground">
                  {entry.scope.path}
                </span>
              )}
            </div>
            <p className="truncate text-sm text-foreground">{entry.summary}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(entry.generatedAt)} · 分析 {entry.filesAnalyzed} 个文件
            </p>
          </div>
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}

export default function SpecListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['spec', 'history'],
    queryFn: () => fetchSpecHistory(),
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spec 模式</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            代码规格文档生成 · 四阶段生命周期管理
          </p>
        </div>
        <Button asChild>
          <Link href="/spec/generate">
            <Plus className="h-4 w-4" />
            生成 Spec
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">历史版本</h2>
          {isLoading ? (
            <div className="flex items-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              加载失败,请稍后重试
            </div>
          ) : data && data.length > 0 ? (
            <div className="space-y-2">
              {data.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">暂无 Spec,点击右上角生成</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Layers className="h-4 w-4" />
            模板
          </h2>
          <Card>
            <CardContent className="space-y-1 p-3">
              {SPEC_BUILTIN_TEMPLATES.map((tpl) => (
                <Link
                  key={tpl.id}
                  href="/spec/templates"
                  className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {tpl.name}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
