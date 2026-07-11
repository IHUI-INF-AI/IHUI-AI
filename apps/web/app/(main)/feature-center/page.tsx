'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Package, Bot, FileText, Cpu, Code2, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ihui/ui'
import { FeatureCenterHeader, FeatureCenterNav } from '@/components/feature-center'

interface FeatureStats {
  apiCount: number
  agentCount: number
  documentCount: number
  modelCount: number
  sdkCount: number
}

const FALLBACK_STATS: FeatureStats = {
  apiCount: 0,
  agentCount: 0,
  documentCount: 0,
  modelCount: 0,
  sdkCount: 0,
}

async function fetchStats(): Promise<FeatureStats> {
  const res = await fetchApi<FeatureStats>('/api/feature-center/stats')
  if (!res.success) throw new Error(res.error)
  return res.data
}

const ENTRIES = [
  {
    key: 'apis',
    label: 'API 集市',
    description: '浏览与接入开放 API',
    icon: Package,
    href: '/feature-center/apis',
  },
  {
    key: 'agents',
    label: 'Agent 集市',
    description: '发现可复用的 AI Agent',
    icon: Bot,
    href: '/feature-center/agents',
  },
  {
    key: 'documents',
    label: '文档集市',
    description: '查阅接入与开发文档',
    icon: FileText,
    href: '/feature-center/documents',
  },
  {
    key: 'models',
    label: '模型集市',
    description: '选择适合的 AI 模型',
    icon: Cpu,
    href: '/feature-center/models',
  },
  {
    key: 'sdks',
    label: 'SDK 集市',
    description: '下载各语言 SDK',
    icon: Code2,
    href: '/feature-center/sdks',
  },
] as const

export default function FeatureCenterPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['feature-center-stats'],
    queryFn: fetchStats,
  })

  const stats = data ?? FALLBACK_STATS
  const statMap: Record<string, number> = {
    apiCount: stats.apiCount,
    agentCount: stats.agentCount,
    documentCount: stats.documentCount,
    modelCount: stats.modelCount,
    sdkCount: stats.sdkCount,
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FeatureCenterHeader
        title="开放平台 Feature Center"
        description="一站式发现 API、Agent、文档、模型与 SDK"
      />
      <FeatureCenterNav />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENTRIES.map((entry) => {
            const Icon = entry.icon
            return (
              <Card key={entry.key} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="flex items-center justify-between">
                    {entry.label}
                    <span className="text-2xl font-bold text-primary">
                      {statMap[`${entry.key}Count`] ?? 0}
                    </span>
                  </CardTitle>
                  <CardDescription>{entry.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="ghost" size="sm" className="px-0">
                    <Link href={entry.href}>
                      进入集市 <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
