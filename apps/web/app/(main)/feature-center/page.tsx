'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Package, Bot, FileText, Cpu, Code2, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
    labelKey: 'apisLabel',
    descKey: 'apisDesc',
    icon: Package,
    href: '/feature-center/apis',
  },
  {
    key: 'agents',
    labelKey: 'agentsLabel',
    descKey: 'agentsDesc',
    icon: Bot,
    href: '/feature-center/agents',
  },
  {
    key: 'documents',
    labelKey: 'documentsLabel',
    descKey: 'documentsDesc',
    icon: FileText,
    href: '/feature-center/documents',
  },
  {
    key: 'models',
    labelKey: 'modelsLabel',
    descKey: 'modelsDesc',
    icon: Cpu,
    href: '/feature-center/models',
  },
  {
    key: 'sdks',
    labelKey: 'sdksLabel',
    descKey: 'sdksDesc',
    icon: Code2,
    href: '/feature-center/sdks',
  },
] as const

export default function FeatureCenterPage() {
  const t = useTranslations('featureCenter')
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
      <FeatureCenterHeader title={t('title')} description={t('description')} />
      <FeatureCenterNav />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
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
                    {t(entry.labelKey)}
                    <span className="text-2xl font-bold text-primary">
                      {statMap[`${entry.key}Count`] ?? 0}
                    </span>
                  </CardTitle>
                  <CardDescription>{t(entry.descKey)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="ghost" size="sm" className="px-0">
                    <Link href={entry.href}>
                      {t('enterMarketplace')} <ArrowRight className="ml-1 h-4 w-4" />
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
