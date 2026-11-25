// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import {
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react'

import {
  type ConnectorCapability,
  type ConnectorEntry,
  type ConnectorSyncItem,
} from '@ihui/api-client/endpoints/connectors'
import { Badge } from '@/components/data'
import { Button, Switch } from '@ihui/ui-react'

import { CAPABILITY_LABEL_KEY } from './connector-utils'
import { PlatformIcon } from './platform-icon'

interface ConnectorCardProps {
  entry: ConnectorEntry
  syncing: boolean
  checking: boolean
  reading: string | null
  items: ConnectorSyncItem[]
  onToggle: (enabled: boolean) => void
  onSync: () => void
  onCheck: () => void
  onInvoke: () => void
  onEdit: () => void
  onRead: (item: ConnectorSyncItem) => void
  onDelete: () => void
}

/** 单个连接器卡片:状态 + 能力位 + 操作入口 + 文档列表 */
export function ConnectorCard({
  entry,
  syncing,
  checking,
  reading,
  items,
  onToggle,
  onSync,
  onCheck,
  onInvoke,
  onEdit,
  onRead,
  onDelete,
}: ConnectorCardProps) {
  const t = useTranslations('connectors')
  const caps = Object.entries(entry.operation_capabilities ?? {}).filter(
    ([, present]) => present,
  ) as [ConnectorCapability, boolean][]

  return (
    <div className="flex flex-col gap-2.5 ui-card rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <PlatformIcon type={entry.type} size={22} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-body font-semibold leading-tight text-foreground">
              {entry.name}
            </span>
            <Badge variant="primary">{entry.type}</Badge>
            <Badge variant="default">
              {entry.mode === 'custom' ? t('modeCustom') : t('modePreset')}
            </Badge>
            {entry.managed && <Badge variant="primary">{t('managedBadge')}</Badge>}
            <Badge variant={entry.configured ? 'success' : 'default'}>
              {entry.configured ? t('configured') : t('notConfigured')}
            </Badge>
            {entry.configured && (
              <Badge variant={entry.enabled ? 'success' : 'default'}>
                {entry.enabled ? t('enabled') : t('disabled')}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {entry.last_sync_at ? `${t('lastSyncAt')}: ${entry.last_sync_at}` : t('neverSynced')}
            </span>
            {entry.operation_count > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Zap className="h-3 w-3" />
                {t('operationCount', { count: entry.operation_count })}
              </span>
            )}
          </div>
          {caps.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {caps.map(([cap]) => (
                <span
                  key={cap}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {t(CAPABILITY_LABEL_KEY[cap])}
                </span>
              ))}
            </div>
          )}
        </div>
        <Switch
          checked={entry.enabled}
          disabled={!entry.configured}
          onCheckedChange={onToggle}
          aria-label={entry.enabled ? t('enabled') : t('disabled')}
        />
      </div>

      {entry.last_error && (
        <p className="text-label text-destructive">{t('lastError', { error: entry.last_error })}</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={onInvoke}
          disabled={!entry.configured || entry.operation_count === 0}
        >
          <Zap className="mr-1.5 h-3.5 w-3.5" />
          {t('invoke')}
        </Button>
        <Button variant="outline" onClick={onSync} disabled={syncing || !entry.configured}>
          {syncing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          {syncing ? t('syncing') : t('sync')}
        </Button>
        <Button variant="outline" onClick={onCheck} disabled={checking || !entry.configured}>
          {checking ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
          )}
          {checking ? t('checking') : t('check')}
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {t('edit')}
        </Button>
        <Button
          variant="outline"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {t('delete')}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 pt-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <FileText className="h-3 w-3" />
            {t('docList')}
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {items.slice(0, 20).map((item) => (
              <li
                key={item.doc_id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5"
              >
                <span className="min-w-0 truncate text-label text-foreground">{item.title}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 px-2 text-[11px]"
                  onClick={() => onRead(item)}
                  disabled={reading === item.doc_id}
                >
                  {reading === item.doc_id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="mr-1 h-3 w-3" />
                  )}
                  {t('readDoc')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
