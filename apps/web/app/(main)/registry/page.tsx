'use client'

import * as React from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  useRegistryItems,
  useRegistrySyncLogs,
  useRegistrySync,
  useRegistryInstall,
  useRegistryUpgradeAll,
  useRegistryConfigDrift,
} from '@/hooks/use-registry'
import { RegistryTabs } from '@/components/registry/RegistryTabs'
import { RegistryItemCard } from '@/components/registry/RegistryItemCard'
import { SyncLogPanel } from '@/components/registry/SyncLogPanel'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type {
  RegistrySortKey,
  RegistrySourceType,
  RegistryInstallStatus,
  RegistryItem,
} from '@ihui/types'

const FILTERS: Array<{ key: RegistrySourceType | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'mcp', label: 'MCP' },
  { key: 'skill', label: 'Skill' },
  { key: 'plugin', label: 'Plugin' },
]

export default function RegistryPage() {
  const { user } = useAuth()
  const isAdmin = (user?.roleId ?? 0) >= 1

  const [sort, setSort] = React.useState<RegistrySortKey>('latest')
  const [filter, setFilter] = React.useState<RegistrySourceType | 'all'>('all')

  const sourceType = filter === 'all' ? undefined : filter
  const { items, installedIds, loading, error, refresh } = useRegistryItems(sort, sourceType)
  const install = useRegistryInstall()
  const upgradeAll = useRegistryUpgradeAll()
  const sync = useRegistrySync()
  const syncLogs = useRegistrySyncLogs()
  const drift = useRegistryConfigDrift()

  const upgradableCount = installedIds.length

  const handleInstall = React.useCallback(
    async (item: RegistryItem) => {
      const res = await install.install({ sourceType: item.sourceType, sourceId: item.sourceId })
      if (res) refresh()
    },
    [install, refresh],
  )
  const handleUpgradeAll = React.useCallback(async () => {
    const res = await upgradeAll.upgradeAll({})
    if (res) refresh()
  }, [upgradeAll, refresh])
  const handleSync = React.useCallback(async () => {
    const res = await sync.trigger({})
    if (res) {
      syncLogs.refresh()
      refresh()
    }
  }, [sync, syncLogs, refresh])

  const getStatus = (item: RegistryItem): RegistryInstallStatus =>
    installedIds.includes(item.id) ? 'installed' : 'not_installed'

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-lg font-semibold">资源更新中心</h1>

      {upgradableCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <p className="text-sm">
            有 <span className="font-semibold text-primary">{upgradableCount}</span> 个新版本可用
          </p>
          <Button size="sm" disabled={upgradeAll.upgrading} onClick={handleUpgradeAll}>
            {upgradeAll.upgrading ? '升级中…' : '一键全部升级'}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RegistryTabs value={sort} onChange={setSort} />
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                filter === f.key
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border bg-card p-4 text-sm text-rose-600">{error}</div>
      ) : loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">加载中…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">暂无资源</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <RegistryItemCard
              key={item.id}
              item={item}
              installStatus={getStatus(item)}
              installing={install.installing}
              onInstall={handleInstall}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">管理操作</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={sync.syncing} onClick={handleSync}>
                {sync.syncing ? '同步中…' : '手动触发同步'}
              </Button>
              <Button size="sm" variant="outline" disabled={drift.loading} onClick={() => drift.detect()}>
                {drift.loading ? '检测中…' : '配置漂移检测'}
              </Button>
            </div>
            {sync.result && (
              <p className="text-xs text-muted-foreground">
                同步完成:新增 {sync.result.stats.synced} · 失败 {sync.result.stats.failed} · 跳过 {sync.result.stats.skipped}
              </p>
            )}
            {drift.report && (
              <div className="rounded-md bg-muted p-3 text-xs">
                {drift.report.hasDrift
                  ? `检测到 ${drift.report.reports.filter((r) => r.drifted).length} 个文件存在配置漂移`
                  : '未检测到配置漂移'}
              </div>
            )}
            <SyncLogPanel logs={syncLogs.logs} loading={syncLogs.loading} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
