'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquare, Settings } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui-react'
import { imChannelsApi } from './im-channels-api'
import AdapterConfigForm from './AdapterConfigForm'
import MessageHistory from './MessageHistory'
import PlatformList from './PlatformList'
import type { ImPlatformMeta } from '@ihui/types'
import type { TabKey } from './types'

export default function PageClient() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = React.useState<TabKey>('config')
  const [selectedPlatform, setSelectedPlatform] = React.useState<string | undefined>(undefined)

  const platformsQuery = useQuery({
    queryKey: ['im-channels', 'platforms'],
    queryFn: imChannelsApi.fetchPlatforms,
    staleTime: 5 * 60 * 1000,
  })
  const adaptersQuery = useQuery({
    queryKey: ['im-channels', 'adapters'],
    queryFn: imChannelsApi.fetchAdapters,
    staleTime: 30 * 1000,
  })
  const statusQuery = useQuery({
    queryKey: ['im-channels', 'status'],
    queryFn: imChannelsApi.fetchStatus,
    refetchInterval: 30_000,
  })

  const platforms = React.useMemo<ImPlatformMeta[]>(
    () => platformsQuery.data ?? [],
    [platformsQuery.data],
  )
  const isLoadingMeta = platformsQuery.isLoading || adaptersQuery.isLoading

  // 默认选中第一个平台
  React.useEffect(() => {
    if (!selectedPlatform && platforms.length > 0) {
      const first = platforms[0]
      if (first) setSelectedPlatform(first.platform)
    }
  }, [platforms, selectedPlatform])

  const selectedMeta = platforms.find((p) => p.platform === selectedPlatform)
  const selectedAdapter = adaptersQuery.data?.find((a) => a.platform === selectedPlatform)

  const invalidateAll = (): void => {
    void qc.invalidateQueries({ queryKey: ['im-channels'] })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span>IM 渠道管理</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          统一管理 16 平台 IM 适配器配置、连接状态与消息历史
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="config" className="gap-1">
            <Settings className="h-3 w-3" />
            <span>平台配置</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>消息历史</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-4">
          {isLoadingMeta ? (
            <Card>
              <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载平台元数据…
              </CardContent>
            </Card>
          ) : platforms.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                暂无平台元数据,请检查后端 /api/im-gateway/platforms 接口
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">平台列表</CardTitle>
                  <CardDescription>共 {platforms.length} 个平台,点击查看配置</CardDescription>
                </CardHeader>
                <CardContent>
                  <PlatformList
                    platforms={platforms}
                    adapters={adaptersQuery.data ?? []}
                    statuses={statusQuery.data ?? []}
                    selected={selectedPlatform}
                    onSelect={setSelectedPlatform}
                  />
                </CardContent>
              </Card>
              <div>
                {selectedMeta ? (
                  <AdapterConfigForm
                    key={selectedMeta.platform}
                    platform={selectedMeta}
                    adapter={selectedAdapter}
                    onSaved={invalidateAll}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      请在左侧选择一个平台
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <MessageHistory platforms={platforms} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
