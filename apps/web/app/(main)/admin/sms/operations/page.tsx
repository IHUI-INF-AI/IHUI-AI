// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { BASE, api } from './helpers'
import { LogPanel } from './LogPanel'
import { SendPanel } from './SendPanel'
import { StatusPanel } from './StatusPanel'
import { UnsubscribePanel } from './UnsubscribePanel'
import type { SmsStatus } from './types'

export default function SmsOperationsPage() {
  const t = useTranslations('admin.smsOperations')
  const tc = useTranslations('common')
  /** 刷新按钮要绕过服务端 5 分钟的审核状态缓存,所以把"强制刷新"带进 query key。 */
  const [refreshKey, setRefreshKey] = React.useState(0)
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin', 'sms-operations', 'status', refreshKey],
    queryFn: () => api<SmsStatus>(`${BASE}/status${refreshKey > 0 ? '?refresh=1' : ''}`),
  })

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Send className="h-6 w-6 text-primary" />
          {t('page.title')}
        </h1>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {tc('refresh')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('page.loadingStatus')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message || tc('loadFailed')}
        </div>
      ) : data ? (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t('page.tabStatus')}</TabsTrigger>
            <TabsTrigger value="send">{t('page.tabSend')}</TabsTrigger>
            <TabsTrigger value="logs">{t('page.tabLogs')}</TabsTrigger>
            <TabsTrigger value="unsubscribes">{t('page.tabUnsubscribes')}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <StatusPanel status={data} />
          </TabsContent>
          <TabsContent value="send" className="mt-4">
            <SendPanel status={data} />
          </TabsContent>
          <TabsContent value="logs" className="mt-4">
            <LogPanel />
          </TabsContent>
          <TabsContent value="unsubscribes" className="mt-4">
            <UnsubscribePanel />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
