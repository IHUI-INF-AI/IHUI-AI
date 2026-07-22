'use client'

/**
 * ProviderFormDialog — Provider 添加/编辑对话框(2026-07-22 立)
 *
 * 字段:
 *  - providerCode (模板选择)
 *  - name
 *  - apiKey (留空 = 不修改)
 *  - apiFormat
 *  - baseUrlOverride
 *  - providerGroup / groupLabel
 *  - description
 *  - enabled
 */
import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui'

import {
  createProviderV2,
  updateProviderV2,
  providerToForm,
  EMPTY_PROVIDER_FORM,
} from './helpers-v2'
import type { ProviderFormState, UserLlmProvider } from './types-v2'
import type { PlatformTemplate } from './types'

interface Props {
  open: boolean
  provider: UserLlmProvider | null
  templates: PlatformTemplate[]
  /** 用户已存在的分组(供下拉选择) */
  existingGroups: { group: string; groupLabel: string }[]
  /** 从外部预填(如排行榜一键导入),仅新建时生效 */
  prefill?: Partial<ProviderFormState> | null
  onClose: () => void
  onSaved: () => void
}

export function ProviderFormDialog({
  open,
  provider,
  templates,
  existingGroups,
  prefill,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('llmSettings.v2.providerDialog')
  const [form, setForm] = React.useState<ProviderFormState>(EMPTY_PROVIDER_FORM)

  React.useEffect(() => {
    if (open) {
      if (provider) {
        setForm(providerToForm(provider, provider.providerCode))
      } else if (prefill) {
        // 外部预填(如排行榜一键导入):覆盖默认表单
        setForm({
          ...EMPTY_PROVIDER_FORM,
          ...prefill,
          id: null,
          apiKey: '',
        })
      } else {
        const tpl = templates[0]
        setForm({
          ...EMPTY_PROVIDER_FORM,
          name: tpl?.name ?? '',
          baseUrlOverride: tpl?.baseUrl ?? '',
          apiFormat: tpl?.apiFormat ?? 'openai_chat',
        })
      }
    }
  }, [open, provider, prefill, templates])

  const saveMut = useMutation({
    mutationFn: async (f: ProviderFormState) => {
      if (f.id) return updateProviderV2(f.id, f)
      return createProviderV2(f)
    },
    onSuccess: (res) => {
      toast.success(form.id ? t('saved') : t('created'), {
        description: 'name' in res && res.name ? `「${res.name}」` : undefined,
      })
      onSaved()
      onClose()
    },
    onError: (e: Error) => toast.error(t('saveFailed'), { description: e.message }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('nameRequired'))
      return
    }
    if (!form.id && !form.apiKey.trim()) {
      toast.error(t('keyRequired'))
      return
    }
    if (form.providerCode === 'custom' && !form.baseUrlOverride.trim()) {
      toast.error(t('baseUrlRequired'))
      return
    }
    saveMut.mutate(form)
  }

  const tpl = templates.find((t) => t.code === form.providerCode)
  const isEdit = !!form.id
  const isPending = saveMut.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('editTitle') : t('newTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 平台选择(只在新建时可改) */}
          <div className="space-y-1.5">
            <Label htmlFor="providerCode">{t('platform')}</Label>
            <select
              id="providerCode"
              value={form.providerCode}
              onChange={(e) => {
                const next = templates.find((tt) => tt.code === e.target.value)
                setForm({
                  ...form,
                  providerCode: e.target.value,
                  baseUrlOverride: next?.baseUrl ?? '',
                  apiFormat: next?.apiFormat ?? 'openai_chat',
                  name: form.name || next?.name || '',
                })
              }}
              disabled={isEdit}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {templates.map((tpl) => (
                <option key={tpl.code} value={tpl.code}>
                  {tpl.name} {tpl.isOfficial ? '★' : ''}
                </option>
              ))}
            </select>
            {tpl?.docsUrl ? (
              <a
                href={tpl.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {t('docs')} ↗
              </a>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apiKey">{t('apiKey')}</Label>
            <Input
              id="apiKey"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={isEdit ? t('keyPlaceholderEdit') : t('keyPlaceholderNew')}
            />
            {isEdit ? (
              <p className="text-xs text-muted-foreground">{t('keyKeepEmpty')}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="baseUrlOverride">
              {t('baseUrl')}
              {form.providerCode === 'custom' ? ` *` : ` (${t('optional')})`}
            </Label>
            <Input
              id="baseUrlOverride"
              value={form.baseUrlOverride}
              onChange={(e) => setForm({ ...form, baseUrlOverride: e.target.value })}
              placeholder={tpl?.baseUrl ?? 'https://api.example.com/v1'}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="providerGroup">{t('group')}</Label>
              <select
                id="providerGroup"
                value={form.providerGroup}
                onChange={(e) => {
                  const matched = existingGroups.find((g) => g.group === e.target.value)
                  setForm({
                    ...form,
                    providerGroup: e.target.value,
                    groupLabel: matched?.groupLabel ?? e.target.value,
                  })
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="default">{t('defaultGroup')}</option>
                {existingGroups
                  .filter((g) => g.group !== 'default')
                  .map((g) => (
                    <option key={g.group} value={g.group}>
                      {g.groupLabel}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apiFormat">{t('protocol')}</Label>
              <select
                id="apiFormat"
                value={form.apiFormat}
                onChange={(e) => setForm({ ...form, apiFormat: e.target.value as ProviderFormState['apiFormat'] })}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="openai_chat">OpenAI Chat</option>
                <option value="openai_responses">OpenAI Responses</option>
                <option value="anthropic_messages">Anthropic Messages</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t('description')}</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="enabled" className="text-sm">
                {t('enableConfig')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('enableConfigDesc')}</p>
            </div>
            <Switch
              id="enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              {isEdit ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
