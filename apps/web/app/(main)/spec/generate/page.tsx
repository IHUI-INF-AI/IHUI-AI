'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clock, FileSearch, Hash } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import type { SpecGenerateResult } from '@ihui/shared/spec/index'
import { SpecGenerateForm } from '@/components/spec/SpecGenerateForm'
import { SpecMarkdown } from '@/components/spec/SpecMarkdown'

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

export default function SpecGeneratePage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template') ?? undefined
  const [result, setResult] = React.useState<SpecGenerateResult | null>(null)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/spec"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">生成 Spec</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            选择范围与模板,自动生成代码规格文档
          </p>
        </div>
      </div>

      <SpecGenerateForm
        defaultTemplateId={templateId}
        onGenerated={setResult}
      />

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              生成结果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 rounded-md bg-muted/50 p-3">
              <StatItem
                icon={<FileSearch className="h-3.5 w-3.5" />}
                label="分析文件"
                value={String(result.stats.filesAnalyzed)}
              />
              <StatItem
                icon={<Hash className="h-3.5 w-3.5" />}
                label="提取符号"
                value={String(result.stats.symbolsExtracted)}
              />
              <StatItem
                icon={<Clock className="h-3.5 w-3.5" />}
                label="耗时"
                value={`${(result.stats.durationMs / 1000).toFixed(2)}s`}
              />
            </div>
            <SpecMarkdown sections={result.sections} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
