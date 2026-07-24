'use client'

/**
 * 一键配置 API Key 弹窗
 *
 * 用途:从模型广场页 / 详情对话框触发,允许用户输入一个 API Key 即可
 *      为该模型所属厂商创建一个 LLM 配置(模板已预置 baseUrl / apiFormat)。
 *
 * 核心特性:
 *  - 1 个输入框(API Key)+ 1 个可选(模型 ID 自动用广场选的 / 模板默认)
 *  - "测试连通" + "保存并启用" 两按钮(分开:测通不一定立即保存)
 *  - 加密存储提示(用户规则:安全可见)
 *  - 自定义平台:展开 Base URL 字段
 *  - 状态徽章:已配置 → 显示 update,未配置 → save
 *
 * 设计原则:
 *  - 严格遵守 AGENTS.md §4 UI 约束(无 rounded-full、无蓝光描边、无单边 border 分割线)
 *  - 复用 packages/ui 的 Dialog / Button / Input / Label / Switch
 *  - 复用 lucide-react 图标
 *  - 复用 src/lib/user-llm-configs 的 API(与 /settings/llm 共享)
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@ihui/ui-react'

import { BrandIcon } from '@/components/ai/brand-icon'
import { Tooltip } from '@/components/feedback'
import {
  createConfig,
  fetchConfigs,
  fetchTemplates,
  previewTest,
  type PlatformTemplate,
  type UserLlmConfig,
} from '@/lib/user-llm-configs'
import { providerToTemplateCode } from '@/lib/llm-templates'

import type { Model } from './types'

interface Props {
  /** 触发本弹窗的模型(从详情对话框传入) */
  model: Model | null
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 保存成功后回调(用于刷新广场页配置状态) */
  onSaved?: () => void
}

export function QuickKeyDialog({ model, open, onOpenChange, onSaved }: Props) {
  const t = useTranslations('models')
  const qc = useQueryClient()

  // 平台模板(15+ 预置,无需登录即可获取)
  const tplQuery = useQuery({
    queryKey: ['user-llm-templates'],
    queryFn: () => fetchTemplates(),
    staleTime: 5 * 60_000,
  })
  const templates: PlatformTemplate[] = tplQuery.data?.templates ?? []
  const tplMap = React.useMemo(
    () => Object.fromEntries(templates.map((t) => [t.code, t])),
    [templates],
  )

  // 用户已保存的配置(用于判定"已配置"状态 + 拿 id 用于 update)
  const cfgQuery = useQuery({
    queryKey: ['user-llm-configs'],
    queryFn: () => fetchConfigs(),
    enabled: open, // 弹窗打开时才拉
    retry: false,
    throwOnError: false,
  })
  const userConfigs: UserLlmConfig[] = cfgQuery.data?.list ?? []

  // 当前模型 → templateCode → 命中的 template + 已存在的 config
  const templateCode = model ? providerToTemplateCode(model.provider) : null
  const tpl = templateCode ? tplMap[templateCode] : null

  // 命中的用户配置(同 templateCode 且启用)
  const existingConfig = React.useMemo(() => {
    if (!templateCode) return null
    return userConfigs.find((c) => c.providerCode === templateCode && c.enabled) ?? null
  }, [templateCode, userConfigs])

  // 表单状态(每次打开重置)
  const [apiKey, setApiKey] = React.useState('')
  const [modelId, setModelId] = React.useState('')
  const [showKey, setShowKey] = React.useState(false)

  React.useEffect(() => {
    if (!open || !model) return
    // 预填模型 ID:优先用模型自身的 id,否则用模板默认
    setModelId(model.id || tpl?.defaultModelId || '')
    setApiKey('')
    setShowKey(false)
  }, [open, model, tpl])

  const isUpdate = !!existingConfig
  const isCustom = templateCode === 'custom'
  const isMissingTemplate = !templateCode

  // 临时测试
  const previewMut = useMutation({
    mutationFn: () => {
      if (!templateCode) throw new Error(t('quickKey.errSelectPlatform'))
      if (!apiKey.trim()) throw new Error(t('quickKey.errApiKeyRequired'))
      if (!modelId.trim()) throw new Error(t('quickKey.errModelIdRequired'))
      return previewTest({
        templateCode,
        apiKey: apiKey.trim(),
        modelId: modelId.trim(),
      })
    },
    onSuccess: (res) => {
      toast.success(res.message || t('quickKey.testSuccess'), {
        description: `${t('quickKey.testDuration', { ms: res.responseMs ?? 0 })}${res.modelEcho ? ` · ${res.modelEcho}` : ''}`,
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      })
    },
    onError: (e: Error) => {
      toast.error(t('quickKey.testFailed'), {
        description: e.message,
        icon: <XCircle className="h-4 w-4 text-red-600" />,
      })
    },
  })

  // 保存(创建或更新)
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!templateCode) throw new Error(t('quickKey.errNoTemplate'))
      if (!apiKey.trim()) throw new Error(t('quickKey.errApiKeyRequired'))
      if (!modelId.trim()) throw new Error(t('quickKey.errModelIdRequired'))
      const name = tpl?.name ?? model?.name ?? t('quickKey.defaultConfigName')
      const contextLength = tpl?.defaultContextLength ?? 32000
      // 简化:这里只支持 create;update 走 /settings/llm 完整编辑流
      return createConfig({
        templateCode,
        name,
        apiKey: apiKey.trim(),
        modelId: modelId.trim(),
        contextLength,
      })
    },
    onSuccess: () => {
      toast.success(t('quickKey.saved'), {
        description: t('quickKey.savedDesc'),
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      })
      qc.invalidateQueries({ queryKey: ['user-llm-configs'] })
      qc.invalidateQueries({ queryKey: ['llm-models'] })
      onSaved?.()
      // 关闭并重置
      setApiKey('')
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toast.error(t('quickKey.saveFailed'), {
        description: e.message,
        icon: <XCircle className="h-4 w-4 text-red-600" />,
      })
    },
  })

  const canSave = !!apiKey.trim() && !!modelId.trim() && !isMissingTemplate
  const canTest = canSave

  if (!model) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="gap-2 p-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                {t('quickKey.title')}
                {isUpdate && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    {t('quickKey.configured')}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-xs">
                <BrandIcon vendor={model.provider} size={12} className="text-muted-foreground" />
                <span>{t(`providers.${model.provider}`)}</span>
                <span className="text-muted-foreground/60">·</span>
                <code className="font-mono text-[11px]">{model.id}</code>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-4">
          {/* 无预置模板提示 */}
          {isMissingTemplate ? (
            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              {t('quickKey.noTemplate')}
            </div>
          ) : (
            <>
              {/* 平台信息条 */}
              {tpl && (
                <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1 [&>span]:translate-y-[0.5px]">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="font-medium text-foreground">{tpl.name}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <code className="font-mono">{tpl.apiFormat}</code>
                    {tpl.isOfficial && (
                      <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {t('quickKey.official')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono">{tpl.baseUrl}</div>
                </div>
              )}

              {/* API Key 输入 */}
              <div className="space-y-1.5">
                <Label htmlFor="qk-key" className="flex items-center gap-1.5 text-sm">
                  <KeyRound className="h-3.5 w-3.5" />
                  {t('quickKey.apiKeyLabel')}
                </Label>
                <div className="relative">
                  <Input
                    id="qk-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t('quickKey.apiKeyPlaceholder')}
                    autoComplete="off"
                    className="pr-10 font-mono text-sm"
                  />
                  <Tooltip content={showKey ? t('quickKey.hideKey') : t('quickKey.showKey')}>
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* 模型 ID 输入 */}
              <div className="space-y-1.5">
                <Label htmlFor="qk-model" className="text-sm">
                  {t('quickKey.modelIdLabel')}
                </Label>
                <Input
                  id="qk-model"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder={tpl?.defaultModelId || 'gpt-4o-mini'}
                  className="font-mono text-sm"
                />
              </div>

              {/* 自定义平台提示 */}
              {isCustom && (
                <div className="rounded-md border border-dashed bg-muted/30 p-2 text-[11px] text-muted-foreground">
                  {t('quickKey.customBaseUrl')} →
                  <a
                    href="/settings/llm"
                    className="ml-1 text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    /settings/llm
                  </a>
                </div>
              )}

              {/* 完整配置深链:仅在用户已点过 Save & Enable 之后显示为可操作(避免在表单填到一半时跳转丢数据) */}
              {existingConfig && (
                <div className="rounded-md bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>{t('quickKey.fullConfigHint')}</span>
                  <a
                    href={`/settings/llm?template=${templateCode}&model=${encodeURIComponent(modelId.trim())}&name=${encodeURIComponent(existingConfig.name)}&action=edit`}
                    className="ml-1 text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('quickKey.openFullConfig')}
                  </a>
                </div>
              )}

              {/* 安全提示 */}
              <div className="rounded-md bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {t('quickKey.securityHint')}
              </div>
            </>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-2 rounded-b-lg bg-muted/40 px-5 py-3">
          {!isMissingTemplate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => previewMut.mutate()}
              disabled={!canTest || previewMut.isPending || saveMut.isPending}
            >
              {previewMut.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('quickKey.testBtn')}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saveMut.isPending || previewMut.isPending}
          >
            {t('quickKey.cancel')}
          </Button>
          {!isMissingTemplate && (
            <Button
              type="button"
              size="sm"
              onClick={() => saveMut.mutate()}
              disabled={!canSave || saveMut.isPending}
            >
              {saveMut.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isUpdate ? t('quickKey.updateBtn') : t('quickKey.saveBtn')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
