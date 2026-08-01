'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Network } from 'lucide-react'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Container } from '@/components/layout'

import { ProvidersHealthTab } from './ProvidersHealthTab'
import { CombosTab } from './CombosTab'
import { CompactionTab } from './CompactionTab'
import { isGatewayTab, type GatewayTab } from './types'

export default function GatewayDashboardPage() {
  const t = useTranslations('settings.gateway')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tab, setTab] = React.useState<GatewayTab>(() => {
    const q = searchParams.get('tab')
    return isGatewayTab(q) ? q : 'providers'
  })

  const onTabChange = React.useCallback(
    (next: string) => {
      if (!isGatewayTab(next)) return
      setTab(next)
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      router.replace(`/settings/gateway?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <Container maxWidth="xl" padding={false} className="space-y-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Network className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="providers">{t('tabs.providers')}</TabsTrigger>
          <TabsTrigger value="combos">{t('tabs.combos')}</TabsTrigger>
          <TabsTrigger value="compaction">{t('tabs.compaction')}</TabsTrigger>
        </TabsList>
        <TabsContent value="providers">
          <ProvidersHealthTab />
        </TabsContent>
        <TabsContent value="combos">
          <CombosTab />
        </TabsContent>
        <TabsContent value="compaction">
          <CompactionTab />
        </TabsContent>
      </Tabs>
    </Container>
  )
}
