// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Bot,
  Boxes,
  Cpu,
  Database,
  Loader2,
  MessageSquare,
  RefreshCw,
  Variable,
  Workflow,
} from 'lucide-react'

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { apiOrThrow } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CozeConfigView } from './types'

const STATUS_CLASS: Record<string, string> = {
  synced: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  not_found: 'bg-destructive/10 text-destructive',
  error: 'bg-destructive/10 text-destructive',
  skipped_no_token: 'bg-muted text-muted-foreground',
  never: 'bg-muted text-muted-foreground',
}

const codeCls =
  'max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all'

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  return <pre className={codeCls}>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 text-body font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="break-words text-body">{value}</div>
    </div>
  )
}

interface CozeConfigDialogProps {
  open: boolean
  agentId: string | null
  onClose: () => void
}

export function CozeConfigDialog({ open, agentId, onClose }: CozeConfigDialogProps) {
  const t = useTranslations('admin.agents.coze')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agents', 'coze', agentId],
    queryFn: () => apiOrThrow<CozeConfigView>(`/api/agents/${agentId}/coze/config`),
    enabled: open && Boolean(agentId),
  })

  const syncMut = useMutation({
    mutationFn: () =>
      apiOrThrow<{ status: string }>(`/api/agents/${agentId}/coze/sync`, {
        method: 'POST',
        body: JSON.stringify({ isPublished: true, allowDraft: true }),
      }),
    onSuccess: (result) => {
      toast.success(t('syncSuccess', { status: result.status }))
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'coze', agentId] })
      qc.invalidateQueries({ queryKey: ['admin', 'agents'] })
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const v = data
  const status = v?.status ?? 'never'

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto min-[640px]:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {t('title')}
            {v ? <span className="text-body font-normal text-muted-foreground">· {v.name}</span> : null}
            {v?.botId ? (
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {v.botId}
              </span>
            ) : null}
            <span className={cn('rounded px-2 py-0.5 text-label font-medium', STATUS_CLASS[status])}>
              {t(`status_${status}`)}
            </span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {tc('loading')}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
            {(error as Error).message}
          </div>
        ) : !v ? null : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-label text-muted-foreground">
                <span>
                  source: <strong className="text-foreground">{v.source ?? '—'}</strong>
                </span>
                <span>
                  version: <strong className="text-foreground">{v.version ?? '—'}</strong>
                </span>
                <span>
                  syncedAt: <strong className="text-foreground">{v.syncedAt ? dateFmt.format(new Date(v.syncedAt)) : '—'}</strong>
                </span>
                <span>
                  hash: <strong className="font-mono text-foreground">{v.hash ? v.hash.slice(0, 12) : '—'}</strong>
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate()}
                disabled={!v.botId || syncMut.isPending}
              >
                {syncMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-4 w-4" />
                )}
                {t('syncOne')}
              </Button>
            </div>

            {v.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-label text-destructive">
                {v.error}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title={t('prompt')} icon={<MessageSquare className="h-4 w-4 text-primary" />}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="prompt_mode" value={text(v.prompt.mode)} />
                  <Field label="prefix_prompt" value={<JsonBlock value={v.prompt.prefixPrompt} />} />
                </div>
                <Field label="prompt" value={<JsonBlock value={v.prompt.text} />} />
              </Section>

              <Section title={t('model')} icon={<Cpu className="h-4 w-4 text-primary" />}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="model_id" value={text(v.model.id)} />
                  <Field label="model_name" value={text(v.model.name)} />
                  <Field label="temperature" value={text(v.model.temperature)} />
                  <Field label="top_p" value={text(v.model.topP)} />
                  <Field label="top_k" value={text(v.model.topK)} />
                  <Field label="max_tokens" value={text(v.model.maxTokens)} />
                  <Field label="context_round" value={text(v.model.contextRound)} />
                  <Field label="response_format" value={text(v.model.responseFormat)} />
                  <Field label="presence_penalty" value={text(v.model.presencePenalty)} />
                  <Field label="frequency_penalty" value={text(v.model.frequencyPenalty)} />
                </div>
                <Field label="parameters" value={<JsonBlock value={v.model.parameters} />} />
              </Section>
            </div>

            <Section title={t('onboarding')} icon={<MessageSquare className="h-4 w-4 text-primary" />}>
              <div className="grid gap-3 lg:grid-cols-2">
                <Field label="prologue" value={<JsonBlock value={v.prologue} />} />
                <Field label="suggested_questions" value={<JsonBlock value={v.suggestedQuestions} />} />
              </div>
              <Field label="onboarding_info" value={<JsonBlock value={v.onboarding} />} />
            </Section>

            <Section title={t('capabilities')} icon={<Boxes className="h-4 w-4 text-primary" />}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="plugin_info_list" value={<JsonBlock value={v.plugins} />} />
                <Field label="workflow_info_list" value={<JsonBlock value={v.workflows} />} />
                <Field label="knowledge" value={<JsonBlock value={v.knowledge} />} />
                <Field label="shortcut_commands" value={<JsonBlock value={v.shortcutCommands} />} />
                <Field label="voice_info_list" value={<JsonBlock value={v.voices} />} />
                <Field label="media_config" value={<JsonBlock value={v.mediaConfig} />} />
                <Field label="background_image_info" value={<JsonBlock value={v.backgroundImage} />} />
                <Field label="suggest_reply_info" value={<JsonBlock value={v.suggestReply} />} />
              </div>
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title={t('metadata')} icon={<Bot className="h-4 w-4 text-primary" />}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="bot_mode" value={text(v.botMode)} />
                  <Field label="default_user_input_type" value={text(v.defaultUserInputType)} />
                  <Field label="folder_id" value={text(v.folderId)} />
                  <Field label="owner_user_id" value={text(v.ownerUserId)} />
                  <Field label="create_time" value={text(v.createTime)} />
                  <Field label="update_time" value={text(v.updateTime)} />
                  <Field label="icon_url" value={text(v.iconUrl)} />
                  <Field label="description" value={text(v.description)} />
                </div>
              </Section>

              <Section title={t('variables')} icon={<Variable className="h-4 w-4 text-primary" />}>
                {v.variables.length === 0 ? (
                  <p className="text-body text-muted-foreground">{t('noVariables')}</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-label">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="px-2 py-1.5">keyword</th>
                          <th className="px-2 py-1.5">default_value</th>
                          <th className="px-2 py-1.5">enable</th>
                          <th className="px-2 py-1.5">prompt_enable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.variables.map((row) => (
                          <tr key={row.variableName} className="border-t">
                            <td className="px-2 py-1.5 font-mono">{row.variableName}</td>
                            <td className="px-2 py-1.5">{text(row.variableValue)}</td>
                            <td className="px-2 py-1.5">{text(row.enabled)}</td>
                            <td className="px-2 py-1.5">{text(row.promptEnable)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>

            <Section title={t('publicProjection')} icon={<Boxes className="h-4 w-4 text-primary" />}>
              <JsonBlock value={v.publicCapabilities} />
            </Section>

            <Section title={t('snapshots')} icon={<Workflow className="h-4 w-4 text-primary" />}>
              {v.snapshots.length === 0 ? (
                <p className="text-body text-muted-foreground">{t('noSnapshots')}</p>
              ) : (
                <ul className="space-y-1 text-label">
                  {v.snapshots.map((s) => (
                    <li key={s.id} className="flex flex-wrap gap-x-4 rounded border px-2 py-1">
                      <span className="font-mono">{dateFmt.format(new Date(s.fetchedAt))}</span>
                      <span className="text-muted-foreground">{s.source}</span>
                      <span className="text-muted-foreground">{s.version ?? '—'}</span>
                      <span className="font-mono text-muted-foreground">{s.payloadHash.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={t('rawConfig')} icon={<Database className="h-4 w-4 text-primary" />}>
              <JsonBlock value={v.raw} />
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
