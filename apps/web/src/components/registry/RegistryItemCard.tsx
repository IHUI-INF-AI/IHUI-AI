'use client'

import * as React from 'react'
import { Card, CardContent, CardFooter, CardHeader, Button, Badge } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type {
  RegistryItem,
  RegistryInstallStatus,
  RegistryUpstreamSource,
  RegistrySourceType,
} from '@ihui/types'

const SOURCE_BADGE: Record<RegistryUpstreamSource, { label: string; cls: string }> = {
  github: { label: 'GitHub', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300' },
  npm: { label: 'npm', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  mcp_marketplace: { label: 'Marketplace', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  custom: { label: '自建', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
}

const STATUS_BADGE: Record<RegistryInstallStatus, { label: string; cls: string }> = {
  not_installed: { label: '未安装', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400' },
  installed: { label: '已安装', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  upgradable: { label: '可升级', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  failed: { label: '失败', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
}

const TYPE_LABEL: Record<RegistrySourceType, string> = {
  mcp: 'MCP',
  skill: 'Skill',
  plugin: 'Plugin',
}

function formatCount(n: number): string {
  if (n >= 10000) return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  return String(n)
}

export interface RegistryItemCardProps {
  item: RegistryItem
  installStatus: RegistryInstallStatus
  installing?: boolean
  onInstall?: (item: RegistryItem) => void
}

export function RegistryItemCard({ item, installStatus, installing, onInstall }: RegistryItemCardProps) {
  const src = SOURCE_BADGE[item.source]
  const st = STATUS_BADGE[installStatus]
  const canInstall = installStatus === 'not_installed' || installStatus === 'failed'
  const canUpgrade = installStatus === 'upgradable'

  return (
    <Card className="flex flex-col transition-colors hover:bg-accent/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 text-xs font-medium text-muted-foreground">
                {TYPE_LABEL[item.sourceType]}
              </Badge>
              <h3 className="truncate font-semibold leading-tight" title={item.name}>
                {item.name}
              </h3>
            </div>
            {item.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
            )}
          </div>
          <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', st.cls)}>
            {st.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('rounded-md px-1.5 py-0.5 font-medium', src.cls)}>{src.label}</span>
          {item.version && <span>v{item.version}</span>}
          {item.author && <span className="truncate">· {item.author}</span>}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>下载 {formatCount(item.installCount)}</span>
          <span>热度 {formatCount(item.heatScore)}</span>
          <span>质量 {item.qualityScore > 0 ? item.qualityScore.toFixed(1) : '-'}</span>
        </div>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        {canInstall && (
          <Button
            size="sm"
            className="w-full"
            disabled={installing}
            onClick={() => onInstall?.(item)}
          >
            {installing ? '安装中…' : '安装'}
          </Button>
        )}
        {canUpgrade && (
          <Button size="sm" variant="outline" className="w-full" disabled={installing} onClick={() => onInstall?.(item)}>
            {installing ? '升级中…' : '升级'}
          </Button>
        )}
        {installStatus === 'installed' && (
          <span className="w-full text-center text-xs text-muted-foreground">已是最新版本</span>
        )}
      </CardFooter>
    </Card>
  )
}
