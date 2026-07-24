'use client'

/**
 * CopyModelDialog — 把一个 model 的配置一键复制到其他 provider(2026-07-22 立,深度功能)
 *
 * 用法:在 ProviderCardV2 的 model 列表点击「复制」图标 → 打开此 dialog
 *  - 上方:源 model + 源 provider 信息(只读)
 *  - 中部:目标 provider 选择(单选,排除源 provider 自身)
 *  - 下方:要复制的字段勾选(displayName / contextLength / 价格 / 默认参数)
 *  - 确认后调用 createModelV2,modelId 自动加 "-copy" 后缀避免冲突
 */
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy, Loader2 } from 'lucide-react'

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@ihui/ui-react'

import { createModelV2, modelToForm } from './helpers-v2'
import type { UserLlmModel, UserLlmProvider } from './types-v2'

interface Props {
  open: boolean
  sourceProvider: UserLlmProvider | null
  sourceModel: UserLlmModel | null
  /** 全部 provider(排除 source 自身) */
  allProviders: UserLlmProvider[]
  onClose: () => void
  onSaved: () => void
}

export function CopyModelDialog({
  open,
  sourceProvider,
  sourceModel,
  allProviders,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('llmSettings.v2.copyDialog')
  const qc = useQueryClient()
  const [targetId, setTargetId] = React.useState<number | null>(null)
  const [fields, setFields] = React.useState({
    displayName: true,
    contextLength: true,
    price: true,
    defaultParams: true,
    enabled: true,
    isDefault: false,
  })

  React.useEffect(() => {
    if (open) {
      setTargetId(null)
      setFields({
        displayName: true,
        contextLength: true,
        price: true,
        defaultParams: true,
        enabled: true,
        isDefault: false,
      })
    }
  }, [open])

  const targetProviders = React.useMemo(
    () => allProviders.filter((p) => p.id !== sourceProvider?.id),
    [allProviders, sourceProvider],
  )

  const copyMut = useMutation({
    mutationFn: async (targetProviderId: number) => {
      if (!sourceModel) throw new Error('No source model')
      const baseForm = modelToForm(sourceModel)
      // 构造目标 model 的 form
      const targetForm = {
        ...baseForm,
        id: null, // 强制新建
        modelId: `${sourceModel.modelId}-copy`,
        displayName: fields.displayName ? baseForm.displayName : '',
        contextLength: fields.contextLength ? baseForm.contextLength : 32000,
        inputPricePer1k: fields.price ? baseForm.inputPricePer1k : '0',
        outputPricePer1k: fields.price ? baseForm.outputPricePer1k : '0',
        enabled: fields.enabled,
        isDefault: fields.isDefault,
        // defaultParams 整体复制(advancedJson 优先)
        params: fields.defaultParams ? baseForm.params : {},
        advancedJson: fields.defaultParams ? baseForm.advancedJson : '',
      }
      return createModelV2(targetProviderId, targetForm)
    },
    onSuccess: (res) => {
      const modelIdEcho = 'modelId' in res ? res.modelId : undefined
      toast.success(t('success'), {
        description: modelIdEcho ? `「${modelIdEcho}」` : undefined,
      })
      qc.invalidateQueries({ queryKey: ['v2-providers'] })
      onSaved()
      onClose()
    },
    onError: (e: Error) => toast.error(t('failed'), { description: e.message }),
  })

  function handleConfirm() {
    if (!targetId) {
      toast.error(t('pickTarget'))
      return
    }
    copyMut.mutate(targetId)
  }

  if (!sourceProvider || !sourceModel) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-primary" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 源信息 */}
          <div className="space-y-1 rounded-md border bg-muted/20 p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('sourceProvider')}</span>
              <span className="font-medium">{sourceProvider.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('sourceModel')}</span>
              <code className="font-mono">{sourceModel.modelId}</code>
            </div>
          </div>

          {/* 目标选择 */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('targetProvider')}</Label>
            {targetProviders.length === 0 ? (
              <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                {t('noTargets')}
              </p>
            ) : (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-1.5">
                {targetProviders.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-accent ${
                      targetId === p.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetProvider"
                      checked={targetId === p.id}
                      onChange={() => setTargetId(p.id)}
                      className="h-3 w-3"
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <code className="text-[10px] text-muted-foreground">
                      {p.providerCode}
                    </code>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 字段勾选 */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('fields')}</Label>
            <div className="grid grid-cols-2 gap-1.5 rounded-md border p-2">
              <FieldCheckbox
                id="f-display"
                label={t('fieldDisplayName')}
                checked={fields.displayName}
                onChange={(v) => setFields({ ...fields, displayName: v })}
              />
              <FieldCheckbox
                id="f-context"
                label={t('fieldContext')}
                checked={fields.contextLength}
                onChange={(v) => setFields({ ...fields, contextLength: v })}
              />
              <FieldCheckbox
                id="f-price"
                label={t('fieldPrice')}
                checked={fields.price}
                onChange={(v) => setFields({ ...fields, price: v })}
              />
              <FieldCheckbox
                id="f-params"
                label={t('fieldParams')}
                checked={fields.defaultParams}
                onChange={(v) => setFields({ ...fields, defaultParams: v })}
              />
              <FieldCheckbox
                id="f-enabled"
                label={t('fieldEnabled')}
                checked={fields.enabled}
                onChange={(v) => setFields({ ...fields, enabled: v })}
              />
              <FieldCheckbox
                id="f-default"
                label={t('fieldDefault')}
                checked={fields.isDefault}
                onChange={(v) => setFields({ ...fields, isDefault: v })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={copyMut.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={copyMut.isPending || !targetId}>
            {copyMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-1.5 text-xs">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>{label}</span>
    </label>
  )
}
