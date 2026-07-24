'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  GitCompare,
  FileText,
  Activity,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { loadSpec, diffSpec } from '@/lib/spec-api'
import type { SpecDiff } from '@ihui/shared/spec/index'
import { SpecMarkdown } from '@/components/spec/SpecMarkdown'
import { SpecDiffView } from '@/components/spec/SpecDiffView'
import { LifecycleTimeline } from '@/components/spec/LifecycleTimeline'

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

export default function SpecDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data: spec, isLoading, error } = useQuery({
    queryKey: ['spec', 'detail', id],
    queryFn: () => loadSpec(id),
    enabled: !!id,
  })

  const [diff, setDiff] = React.useState<SpecDiff | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [diffError, setDiffError] = React.useState<string | null>(null)

  const handleDiff = async () => {
    if (!spec) return
    setDiffLoading(true)
    setDiffError(null)
    try {
      const result = await diffSpec(spec.id, spec.markdown)
      setDiff(result)
    } catch (e) {
      setDiffError(e instanceof Error ? e.message : '对比失败')
    } finally {
      setDiffLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中…
      </div>
    )
  }

  if (error || !spec) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error ? '加载失败,请稍后重试' : '未找到该 Spec'}
        </div>
        <Button variant="outline" asChild>
          <Link href="/spec">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/spec"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Spec 详情</h1>
            <p className="text-xs text-muted-foreground">
              {formatDate(spec.generatedAt)} · 分析 {spec.stats?.filesAnalyzed ?? 0} 个文件
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleDiff} disabled={diffLoading}>
          {diffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
          对比变更
        </Button>
      </div>

      {diffError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {diffError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[200px_1fr_320px]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Activity className="h-3.5 w-3.5" />
              生命周期
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LifecycleTimeline proposedAt={spec.generatedAt} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <FileText className="h-3.5 w-3.5" />
              Spec 文档
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpecMarkdown sections={spec.sections} markdown={spec.markdown} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <GitCompare className="h-3.5 w-3.5" />
              变更对比
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpecDiffView diff={diff} loading={diffLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
