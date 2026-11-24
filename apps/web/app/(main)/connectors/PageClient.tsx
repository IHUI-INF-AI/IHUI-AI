// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  BookOpen,
  Building2,
  Clock,
  FileText,
  Library,
  Loader2,
  Megaphone,
  MessageCircle,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  checkConnector,
  connectManagedConnector,
  deleteConnector,
  fetchConnectorDoc,
  getConnectorCatalog,
  getConnectors,
  saveConnectorConfig,
  setConnectorEnabled,
  syncConnector,
  type ConnectorCapability,
  type ConnectorCatalogItem,
  type ConnectorEntry,
  type ConnectorListResponse,
  type ConnectorSyncItem,
  type SaveConnectorConfigInput,
} from '@ihui/api-client/endpoints/connectors'
import { useAuthStore } from '@/stores/auth'
import { BackButton, AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/data'
import { Button, Switch } from '@ihui/ui-react'

import { ConnectorConfigDialog } from '@/components/connectors/connector-config-dialog'
import { ConnectorInvokeDialog } from '@/components/connectors/connector-invoke-dialog'
import { CAPABILITY_LABEL_KEY } from '@/components/connectors/connector-utils'

/** 连接器类型 -> 图标 */
const TYPE_ICON: Record<string, LucideIcon> = {
  yuque: BookOpen,
  feishu: Send,
  wecom: Building2,
  dingtalk: MessageCircle,
  wechat_mp: Megaphone,
  custom: Plug,
}

interface DocDialogState {
  title: string
  content: string
  truncated: boolean
}

/**
 * 中文连接器页(2026-09-02 立;2026-11-23 升级为通用接入中心)。
 *
 * - 预置平台:飞书 / 钉钉 / 企业微信 / 公众号 / 语雀(填凭据即可用模板操作)
 * - 自定义 HTTP:填 Base URL + 鉴权,导入 OpenAPI 或手填操作
 * - 操作按能力位执行(list/search/fetch/action);写操作需显式开启 + 二次确认
 */
export default function ConnectorsPageClient() {
  const t = useTranslations('connectors')
  const tGate = useTranslations('chatHistory')
  const { allow } = useAuthGate()
  const queryClient = useQueryClient()
  const principalId = useAuthStore((s) => s.user?.id ?? null)

  const {
    data: list,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['connectors', 'list', principalId ?? 'anonymous'],
    enabled: allow,
    queryFn: async (): Promise<ConnectorListResponse> => {
      const r = await getConnectors()
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  const { data: catalog } = useQuery({
    queryKey: ['connectors', 'catalog'],
    enabled: allow,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const r = await getConnectorCatalog()
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  const [configOpen, setConfigOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ConnectorEntry | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [invokeTarget, setInvokeTarget] = React.useState<ConnectorEntry | null>(null)
  const [syncingKey, setSyncingKey] = React.useState<string | null>(null)
  const [syncItems, setSyncItems] = React.useState<Record<string, ConnectorSyncItem[]>>({})
  const [readingKey, setReadingKey] = React.useState<string | null>(null)
  const [docDialog, setDocDialog] = React.useState<DocDialogState | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ConnectorEntry | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [connectingType, setConnectingType] = React.useState<string | null>(null)
  const [checkingKey, setCheckingKey] = React.useState<string | null>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ['connectors', 'list', principalId ?? 'anonymous'],
    })
  }

  const openCreate = () => {
    setEditing(null)
    setConfigOpen(true)
  }

  const openEdit = (entry: ConnectorEntry) => {
    setEditing(entry)
    setConfigOpen(true)
  }

  const handleSave = async (input: SaveConnectorConfigInput) => {
    if (saving) return
    setSaving(true)
    try {
      const r = await saveConnectorConfig(input)
      if (r.success) {
        toast.success(t('saved'))
        setConfigOpen(false)
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleManagedConnect = async (type: string, label: string) => {
    if (connectingType) return
    setConnectingType(type)
    try {
      const r = await connectManagedConnector(type)
      if (r.success) {
        // 一键接入后立刻自检:用户不用再去列表里点「测试连接」才知道凭据是否有效。
        const key = r.data?.key
        if (key) {
          const check = await checkConnector(key)
          if (check.success && check.data?.ok) {
            toast.success(
              `${t('managedConnected', { name: label })}，${check.data.message || t('checkOk')}`,
            )
          } else {
            const failMessage = check.success ? check.data?.message : ''
            toast.error(
              `${t('managedConnected', { name: label })}，${failMessage || t('checkFailed')}`,
            )
          }
        } else {
          toast.success(t('managedConnected', { name: label }))
        }
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setConnectingType(null)
    }
  }

  const handleCheck = async (entry: ConnectorEntry) => {
    if (checkingKey) return
    setCheckingKey(entry.key)
    try {
      const r = await checkConnector(entry.key)
      if (r.success && r.data) {
        if (r.data.ok) toast.success(r.data.message || t('checkOk'))
        else toast.error(r.data.message || t('checkFailed'))
      } else {
        toast.error(r.error ?? t('checkFailed'))
      }
    } catch {
      toast.error(t('checkFailed'))
    } finally {
      setCheckingKey(null)
    }
  }

  const handleToggle = async (entry: ConnectorEntry, enabled: boolean) => {
    try {
      const r = await setConnectorEnabled(entry.key, enabled)
      if (r.success) {
        toast.success(
          enabled
            ? t('enableSuccess', { name: entry.name })
            : t('disableSuccess', { name: entry.name }),
        )
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    }
  }

  const handleSync = async (entry: ConnectorEntry) => {
    if (syncingKey) return
    setSyncingKey(entry.key)
    try {
      const r = await syncConnector(entry.key)
      if (r.success && r.data) {
        const items = r.data.items ?? []
        if (r.data.ok) {
          setSyncItems((prev) => ({ ...prev, [entry.key]: items }))
          toast.success(
            items.length > 0 ? t('syncSuccess', { count: items.length }) : t('syncEmpty'),
          )
          refresh()
        } else {
          toast.error(r.data.message || t('syncFailed'))
        }
      } else {
        toast.error(r.error ?? t('syncFailed'))
      }
    } catch {
      toast.error(t('syncFailed'))
    } finally {
      setSyncingKey(null)
    }
  }

  const handleFetchDoc = async (entry: ConnectorEntry, item: ConnectorSyncItem) => {
    if (readingKey) return
    setReadingKey(item.doc_id)
    try {
      const r = await fetchConnectorDoc(entry.key, item.doc_id)
      if (r.success && r.data) {
        if (r.data.ok) {
          setDocDialog({
            title: r.data.title || item.title,
            content: r.data.content,
            truncated: r.data.truncated,
          })
        } else {
          toast.error(r.data.message || t('syncFailed'))
        }
      } else {
        toast.error(r.error ?? t('syncFailed'))
      }
    } catch {
      toast.error(t('syncFailed'))
    } finally {
      setReadingKey(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const r = await deleteConnector(deleteTarget.key)
      if (r.success) {
        toast.success(t('deleteSuccess'))
        setDeleteTarget(null)
        refresh()
      } else {
        toast.error(r.error ?? t('deleteFailed'))
      }
    } catch {
      toast.error(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const connectors = list?.connectors ?? []
  const quickTemplates = (catalog?.templates ?? []).filter((item) => item.type !== 'yuque')
  const managedByType = new Map(connectors.map((item) => [item.type, item]))

  return (
    <div className="py-4 mx-auto w-full max-w-6xl space-y-5 px-4">
      <BackButton />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            <h1 className="text-display font-bold tracking-tight">{t('title')}</h1>
            {allow && !isLoading && !error && (
              <Badge variant="primary">
                {t('count', { count: list?.count ?? connectors.length })}
              </Badge>
            )}
          </div>
          <p className="text-label text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" onClick={openCreate}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {t('advancedAdd')}
        </Button>
      </header>

      {allow && quickTemplates.length > 0 && (
        <section className="space-y-2.5 rounded-lg border bg-card p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            <div className="space-y-0.5">
              <p className="text-body font-semibold">{t('quickTitle')}</p>
              <p className="text-label text-muted-foreground">{t('quickHint')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 min-[720px]:grid-cols-2">
            {quickTemplates.map((tpl: ConnectorCatalogItem) => {
              const installed = managedByType.get(tpl.type)
              const st = tpl.managed
              const available = Boolean(st?.available)
              const connecting = connectingType === tpl.type
              return (
                <div
                  key={tpl.type}
                  className="flex flex-col gap-2 rounded-md border border-stroke-subtle bg-muted/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-label font-semibold text-foreground">
                          {tpl.label}
                        </span>
                        {installed ? (
                          <Badge variant="success">{t('connected')}</Badge>
                        ) : (
                          <Badge variant={available ? 'success' : 'default'}>
                            {available ? t('managedReady') : t('managedNotReady')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{tpl.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {t('operationCount', { count: tpl.operations.length })}
                    </span>
                    {installed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInvokeTarget(installed)}
                      >
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        {t('invoke')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!available || connecting}
                        onClick={() => void handleManagedConnect(tpl.type, tpl.label)}
                      >
                        {connecting ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {available ? t('connectNow') : t('managedNotReady')}
                      </Button>
                    )}
                  </div>
                  {!available ? (
                    <p className="text-[11px] text-muted-foreground">
                      {st?.reason || t('managedUnavailableHint')}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {allow && catalog?.unsupported?.length ? (
        <div className="space-y-1 rounded-lg border border-stroke-subtle bg-muted/30 p-3">
          <p className="text-label font-medium">{t('unsupportedTitle')}</p>
          {catalog.unsupported.map((item) => (
            <p key={item.type} className="text-label text-muted-foreground">
              {item.label}:{item.reason}
            </p>
          ))}
        </div>
      ) : null}

      {!allow ? (
        <AuthGatePrompt message={tGate('loginRequired')} />
      ) : (
        isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-body text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('loading')}</span>
          </div>
        )
      )}

      {allow && error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
          {t('loadFailed')}
        </div>
      )}

      {allow && !isLoading && !error && connectors.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-center">
          <Plug className="h-8 w-8 text-muted-foreground" />
          <p className="text-body text-muted-foreground">{t('empty')}</p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('add')}
          </Button>
        </div>
      )}

      {allow && !isLoading && !error && connectors.length > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
          {connectors.map((entry) => (
            <ConnectorCard
              key={entry.key}
              entry={entry}
              syncing={syncingKey === entry.key}
              checking={checkingKey === entry.key}
              reading={readingKey}
              items={syncItems[entry.key] ?? entry.sync_items ?? []}
              onToggle={(enabled) => void handleToggle(entry, enabled)}
              onSync={() => void handleSync(entry)}
              onCheck={() => void handleCheck(entry)}
              onInvoke={() => setInvokeTarget(entry)}
              onEdit={() => openEdit(entry)}
              onRead={(item) => void handleFetchDoc(entry, item)}
              onDelete={() => setDeleteTarget(entry)}
            />
          ))}
        </div>
      )}

      <ConnectorConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        editing={editing}
        catalog={catalog}
        saving={saving}
        onSubmit={(input) => void handleSave(input)}
      />

      <ConnectorInvokeDialog
        entry={invokeTarget}
        open={invokeTarget !== null}
        onOpenChange={(v) => !v && setInvokeTarget(null)}
      />

      {docDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border bg-card p-4 shadow-elevation-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-body font-semibold">{docDialog.title}</h2>
              <Button variant="outline" size="sm" onClick={() => setDocDialog(null)}>
                {t('cancel')}
              </Button>
            </div>
            {docDialog.truncated && (
              <p className="mb-2 text-[11px] text-muted-foreground">
                {t('truncatedHint', { chars: docDialog.content.length })}
              </p>
            )}
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-label leading-relaxed">
              {docDialog.content}
            </pre>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc', { name: deleteTarget?.name ?? '' })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        variant="destructive"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

/** 单个连接器卡片:状态 + 能力位 + 操作入口 + 文档列表 */
function ConnectorCard({
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
}: {
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
}) {
  const t = useTranslations('connectors')
  const Icon = TYPE_ICON[entry.type] ?? Plug
  const caps = Object.entries(entry.operation_capabilities ?? {}).filter(
    ([, present]) => present,
  ) as [ConnectorCapability, boolean][]

  return (
    <div className="flex flex-col gap-2.5 ui-card rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
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
                  size="sm"
                  className="h-6 shrink-0 px-2 text-[11px]"
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
