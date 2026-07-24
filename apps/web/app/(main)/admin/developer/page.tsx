'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Code2, Download } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'
import { DeveloperCards } from './DeveloperCards'
import { DeveloperCozeTable } from './DeveloperCozeTable'
import { DeveloperCozeDialog } from './DeveloperCozeDialog'
import { DeveloperKeyDialog, DeveloperWebhookDialog } from './DeveloperKeyDialog'
import { useDeveloperCoze } from './useDeveloperCoze'
import type { ApiKey, WebhookConfig, SdkItem } from './types'

export default function DeveloperPage() {
  const t = useTranslations('adminTools')
  const td = useTranslations('admin.developer')
  const qc = useQueryClient()
  const [keyOpen, setKeyOpen] = React.useState(false)
  const [keyName, setKeyName] = React.useState('')
  const [whOpen, setWhOpen] = React.useState(false)
  const [whForm, setWhForm] = React.useState({ url: '', events: '' })

  const { data: keys, isLoading } = useQuery({
    queryKey: ['admin', 'developer', 'keys'],
    queryFn: async () => {
      const r = await fetchApi<ApiKey[]>('/api/developer/api-keys')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const { data: webhooks } = useQuery({
    queryKey: ['admin', 'developer', 'webhooks'],
    queryFn: async () => {
      const r = await fetchApi<WebhookConfig[]>('/api/developer/webhooks')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const { data: sdks } = useQuery({
    queryKey: ['admin', 'developer', 'sdks'],
    queryFn: async () => {
      const r = await fetchApi<SdkItem[]>('/api/sdks')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const createKeyMut = useMutation({
    mutationFn: async () => {
      const r = await fetchApi('/api/developer/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: keyName }),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'keys'] })
      setKeyOpen(false)
      setKeyName('')
      toast.success(t('developer.keyCreateSuccess'))
    },
  })
  const delKeyMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/developer/api-keys/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'keys'] })
      toast.success(t('developer.keyDeleteSuccess'))
    },
  })
  const createWhMut = useMutation({
    mutationFn: async () => {
      const events = whForm.events
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
      const r = await fetchApi('/api/developer/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url: whForm.url, events }),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'webhooks'] })
      setWhOpen(false)
      setWhForm({ url: '', events: '' })
      toast.success(t('developer.whCreateSuccess'))
    },
  })

  function copyKey(k: string) {
    navigator.clipboard?.writeText(k).then(
      () => toast.success(t('developer.copied')),
      () => toast.error(t('developer.copyFailed')),
    )
  }

  const coze = useDeveloperCoze()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Code2 className="h-6 w-6 text-primary" />
            {t('developer.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('developer.subtitle')}</p>
        </div>
        <HasPermi code="ai:developer:export">
          <Button variant="outline" size="sm" onClick={coze.handleCozeExport}>
            <Download className="h-4 w-4" />
            {td('cozeExport')}
          </Button>
        </HasPermi>
      </div>

      <DeveloperCards
        isLoading={isLoading}
        keysList={keys ?? []}
        webhooksList={webhooks ?? []}
        sdksList={sdks ?? []}
        delKeyPending={delKeyMut.isPending}
        onCopyKey={copyKey}
        onDeleteKey={delKeyMut.mutate}
        onCreateKey={() => setKeyOpen(true)}
        onCreateWebhook={() => setWhOpen(true)}
      />

      <DeveloperCozeTable
        list={coze.cozeList}
        isLoading={coze.cozeLoading}
        search={coze.cozeSearch}
        onSearchChange={coze.setCozeSearch}
        page={coze.cozePage}
        totalPages={coze.cozeTotalPages}
        total={coze.cozeTotal}
        onPageChange={coze.setCozePage}
        onCreate={coze.openCozeCreate}
        onEdit={coze.openCozeEdit}
        onDelete={coze.cozeDeleteMut.mutate}
        onStatusChange={(id, status) => coze.cozeStatusMut.mutate({ id, status })}
        deletePending={coze.cozeDeleteMut.isPending}
      />

      <DeveloperCozeDialog
        open={coze.cozeOpen}
        editing={coze.cozeEditing}
        form={coze.cozeForm}
        err={coze.cozeErr}
        isPending={coze.cozeSaveMut.isPending}
        onFormChange={coze.setCozeForm}
        onClose={coze.closeCozeDialog}
        onSubmit={coze.submitCoze}
      />

      <DeveloperKeyDialog
        open={keyOpen}
        name={keyName}
        isPending={createKeyMut.isPending}
        onNameChange={setKeyName}
        onClose={() => setKeyOpen(false)}
        onSubmit={createKeyMut.mutate}
      />

      <DeveloperWebhookDialog
        open={whOpen}
        url={whForm.url}
        events={whForm.events}
        isPending={createWhMut.isPending}
        onUrlChange={(v) => setWhForm({ ...whForm, url: v })}
        onEventsChange={(v) => setWhForm({ ...whForm, events: v })}
        onClose={() => setWhOpen(false)}
        onSubmit={createWhMut.mutate}
      />
    </div>
  )
}
