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
import { ClipboardPaste, Eye, EyeOff, Loader2 } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'

import {
  createProviderV2,
  updateProviderV2,
  providerToForm,
  EMPTY_PROVIDER_FORM,
} from './helpers-v2'
import type { ProviderFormState, UserLlmProvider } from './types-v2'
import type { PlatformTemplate } from './types'
import { Tooltip } from '@/components/feedback'

interface Props {
  open: boolean
  provider: UserLlmProvider | null
  templates: PlatformTemplate[]
  /** 模板是否正在加载(2026-07-25:用于 templates=[] 时区分"加载中"vs"加载失败") */
  templatesLoading?: boolean
  /** 模板加载错误(2026-07-25:用户能看到具体原因) */
  templatesError?: string | null
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
  templatesLoading = false,
  templatesError = null,
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
        // 新建:用 templates[0] 作为默认平台(若 templates 已加载,providerCode 必须落在 SelectItem 列表里,
        // 否则 Radix SelectValue 会显示空白 → trigger 变成"黑不溜秋一条")。
        // templates=[] 时(API 未就绪/未登录)保留 EMPTY 默认 'openai',SelectValue 走 placeholder 兜底。
        const tpl = templates[0]
        setForm({
          ...EMPTY_PROVIDER_FORM,
          providerCode: tpl?.code ?? EMPTY_PROVIDER_FORM.providerCode,
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
    if (!isEdit && !form.providerCode.trim()) {
      // templates 未加载好时(触发器变成 muted 显示,用户无法选择)→ 直接拦截,提示重试
      toast.error(t('templatesNotReady'))
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
  const [showKey, setShowKey] = React.useState(false)

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
            {templates.length === 0 ? (
              // 模板未就绪:显示加载/错误状态,而不是空下拉(避免用户看到"黑不溜秋一条"无内容下拉)
              <div
                id="providerCode"
                className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground"
              >
                {templatesError ? (
                  <span className="truncate" title={templatesError}>
                    {t('templatesLoadError', { error: templatesError })}
                  </span>
                ) : templatesLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    {t('templatesLoading')}
                  </>
                ) : (
                  <span>{t('templatesEmpty')}</span>
                )}
              </div>
            ) : (
              <Select
                value={form.providerCode}
                onValueChange={(v) => {
                  const next = templates.find((tt) => tt.code === v)
                  setForm({
                    ...form,
                    providerCode: v,
                    baseUrlOverride: next?.baseUrl ?? '',
                    apiFormat: next?.apiFormat ?? 'openai_chat',
                    name: form.name || next?.name || '',
                  })
                }}
                disabled={isEdit}
              >
                <SelectTrigger id="providerCode" className="w-full">
                  <SelectValue placeholder={t('platformPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.code} value={tpl.code}>
                      {tpl.name} {tpl.isOfficial ? '★' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder={isEdit ? t('keyPlaceholderEdit') : t('keyPlaceholderNew')}
                  className="flex-1 pr-9 font-mono"
                />
                <Tooltip content={showKey ? t('hideKey') : t('showKey')}>
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    aria-label={showKey ? t('hideKey') : t('showKey')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {showKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </Tooltip>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText()
                    if (!text) {
                      toast.error(t('pasteEmpty'))
                      return
                    }
                    setForm({ ...form, apiKey: text.trim() })
                    toast.success(t('pasteSuccess'))
                  } catch {
                    toast.error(t('pasteFailed'))
                  }
                }}
                className="shrink-0 px-2"
                title={t('pasteFromClipboard')}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
              </Button>
            </div>
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
              <Select
                value={form.providerGroup}
                onValueChange={(v) => {
                  const matched = existingGroups.find((g) => g.group === v)
                  setForm({
                    ...form,
                    providerGroup: v,
                    groupLabel: matched?.groupLabel ?? v,
                  })
                }}
              >
                <SelectTrigger id="providerGroup" className="w-full">
                  <SelectValue placeholder={t('groupPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t('defaultGroup')}</SelectItem>
                  {existingGroups
                    .filter((g) => g.group !== 'default')
                    .map((g) => (
                      <SelectItem key={g.group} value={g.group}>
                        {g.groupLabel}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apiFormat">{t('protocol')}</Label>
              <Select
                value={form.apiFormat}
                onValueChange={(v) =>
                  setForm({ ...form, apiFormat: v as ProviderFormState['apiFormat'] })
                }
              >
                <SelectTrigger id="apiFormat" className="w-full">
                  <SelectValue placeholder={t('protocolPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai_chat">OpenAI Chat</SelectItem>
                  <SelectItem value="openai_responses">OpenAI Responses</SelectItem>
                  <SelectItem value="anthropic_messages">Anthropic Messages</SelectItem>
                </SelectContent>
              </Select>
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
