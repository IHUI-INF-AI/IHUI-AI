// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Library, Loader2, Plug, Plus, Settings2 } from 'lucide-react'

import {
  getConnectorCatalog,
  getConnectors,
  type ConnectorListResponse,
} from '@ihui/api-client/endpoints/connectors'
import { useAuthStore } from '@/stores/auth'
import { BackButton, AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/data'
import { Button } from '@ihui/ui-react'

import { ConnectorConfigDialog } from '@/components/connectors/connector-config-dialog'
import { ConnectorInvokeDialog } from '@/components/connectors/connector-invoke-dialog'
import { ConnectorCard } from '@/components/connectors/connector-card'
import { ManagedQuickSection } from '@/components/connectors/managed-quick-section'
import { WecomRobotSection } from '@/components/connectors/wecom-robot-section'
import { WechatClawbotSection } from '@/components/connectors/wechat-clawbot-section'
import { WechatHubSection } from '@/components/connectors/wechat-hub-section'
import { useConnectorActions } from '@/components/connectors/use-connector-actions'
import { CoveragePanel } from '@/components/connectors/coverage/coverage-panel'

/**
 * 连接器接入中心。
 *
 * 上半部分:预置平台一键接入(托管凭据)+ 平台 API 目录覆盖探测;
 * 下半部分:已配置连接器列表(调用 / 同步 / 自检 / 编辑 / 删除)。
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

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ['connectors', 'list', principalId ?? 'anonymous'],
    })
    void queryClient.invalidateQueries({ queryKey: ['connectors', 'coverage'] })
  }

  const actions = useConnectorActions(refresh)

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
        <Button variant="outline" onClick={actions.openCreate}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {t('advancedAdd')}
        </Button>
      </header>

      {allow && quickTemplates.length > 0 && (
        <ManagedQuickSection
          templates={quickTemplates}
          installed={managedByType}
          connectingType={actions.connectingType}
          onConnect={(type, label) => void actions.handleManagedConnect(type, label)}
          onInvoke={(entry) => actions.setInvokeTarget(entry)}
          onUserAuthorize={(type) => void actions.handleUserAuthorize(type)}
        />
      )}

      {allow && <WecomRobotSection />}

      {allow && <WechatClawbotSection />}

      {allow && <WechatHubSection />}

      {allow && <CoveragePanel connectors={connectors} onRefresh={refresh} />}

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
          <Button variant="outline" onClick={actions.openCreate}>
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
              syncing={actions.syncingKey === entry.key}
              checking={actions.checkingKey === entry.key}
              reading={actions.readingKey}
              items={actions.syncItems[entry.key] ?? entry.sync_items ?? []}
              onToggle={(enabled) => void actions.handleToggle(entry, enabled)}
              onSync={() => void actions.handleSync(entry)}
              onCheck={() => void actions.handleCheck(entry)}
              onInvoke={() => actions.setInvokeTarget(entry)}
              onEdit={() => actions.openEdit(entry)}
              onRead={(item) => void actions.handleFetchDoc(entry, item)}
              onDelete={() => actions.setDeleteTarget(entry)}
            />
          ))}
        </div>
      )}

      <ConnectorConfigDialog
        open={actions.configOpen}
        onOpenChange={actions.setConfigOpen}
        editing={actions.editing}
        catalog={catalog}
        saving={actions.saving}
        onSubmit={(input) => void actions.handleSave(input)}
      />

      <ConnectorInvokeDialog
        entry={actions.invokeTarget}
        open={actions.invokeTarget !== null}
        onOpenChange={(v) => !v && actions.setInvokeTarget(null)}
      />

      {actions.docDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border bg-card p-4 shadow-elevation-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-body font-semibold">{actions.docDialog.title}</h2>
              <Button variant="outline" size="sm" onClick={() => actions.setDocDialog(null)}>
                {t('cancel')}
              </Button>
            </div>
            {actions.docDialog.truncated && (
              <p className="mb-2 text-[11px] text-muted-foreground">
                {t('truncatedHint', { chars: actions.docDialog.content.length })}
              </p>
            )}
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-label leading-relaxed">
              {actions.docDialog.content}
            </pre>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={actions.deleteTarget !== null}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc', { name: actions.deleteTarget?.name ?? '' })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        variant="destructive"
        onConfirm={() => void actions.handleDelete()}
        onCancel={() => actions.setDeleteTarget(null)}
      />
    </div>
  )
}
