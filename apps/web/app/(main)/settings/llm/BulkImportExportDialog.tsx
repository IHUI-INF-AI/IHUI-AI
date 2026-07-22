'use client'

/**
 * BulkImportExportDialog — 批量导入/导出 LLM 配置(2026-07-22 立,深度功能)
 *
 * 设计:
 *  - 导出:把所有 provider + model 序列化为 JSON,API Key 自动脱敏
 *  - 导入:解析 JSON,逐个创建 provider + model(API Key 留空,提示用户补)
 *  - 支持 file 上传 + 文本粘贴
 */
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Download, FileJson, Loader2, Upload } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ihui/ui'

import { createProviderV2, createModelV2 } from './helpers-v2'
import type { UserLlmModel, UserLlmProvider } from './types-v2'

interface Props {
  open: boolean
  onClose: () => void
}

interface ExportBundle {
  /** schema 版本(用于向后兼容) */
  version: 2
  exportedAt: string
  providers: Array<{
    providerCode: string
    name: string
    apiFormat: string
    baseUrl: string
    providerGroup: string
    groupLabel: string
    description: string
    enabled: boolean
    models: Array<{
      modelId: string
      displayName: string
      contextLength: number
      inputPricePer1k: string
      outputPricePer1k: string
      defaultParams: Record<string, unknown>
      enabled: boolean
      isDefault: boolean
    }>
  }>
}

function buildBundle(groups: Array<{ providers: UserLlmProvider[] }>): ExportBundle {
  const providers = groups.flatMap((g) => g.providers).map((p) => ({
    providerCode: p.providerCode,
    name: p.name,
    apiFormat: p.apiFormat,
    baseUrl: p.baseUrl,
    providerGroup: p.providerGroup ?? 'default',
    groupLabel: p.groupLabel ?? '',
    description: p.description ?? '',
    enabled: p.enabled,
    models: (p.models ?? []).map((m: UserLlmModel) => ({
      modelId: m.modelId,
      displayName: m.displayName ?? '',
      contextLength: m.contextLength,
      inputPricePer1k: m.inputPricePer1k,
      outputPricePer1k: m.outputPricePer1k,
      defaultParams: m.defaultParams ?? {},
      enabled: m.enabled,
      isDefault: m.isDefault,
    })),
  }))
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    providers,
  }
}

export function BulkImportExportDialog({ open, onClose }: Props) {
  const t = useTranslations('llmSettings.v2.bulk')
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'export' | 'import'>('export')
  const [importText, setImportText] = React.useState('')
  const [parsed, setParsed] = React.useState<ExportBundle | null>(null)

  // 导出 mutation:不需要 mutation,直接读 cache
  const exportMut = React.useCallback(() => {
    const data = qc.getQueryData<{ groups: Array<{ providers: UserLlmProvider[] }> }>(['v2-providers'])
    const groups = data?.groups ?? []
    const bundle = buildBundle(groups)
    const json = JSON.stringify(bundle, null, 2)
    const totalModels = bundle.providers.reduce((acc, p) => acc + p.models.length, 0)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `llm-configs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('exportSuccess', { count: bundle.providers.length, models: totalModels }))
  }, [qc, t])

  // 导入
  const importMut = useMutation({
    mutationFn: async (bundle: ExportBundle) => {
      // 1. 先 fetch 现有 provider 列表(需要 providerId 来创建 model)
      // 2. 逐个 createProvider → createModel
      // 3. 失败不中断,继续
      let provCount = 0
      let modelCount = 0
      const errors: string[] = []

      for (const p of bundle.providers) {
        try {
          const res = await createProviderV2({
            id: null,
            providerCode: p.providerCode,
            name: `${p.name} (imported)`,
            apiKey: '', // API Key 留空,用户自己补
            baseUrlOverride: p.baseUrl,
            apiFormat: p.apiFormat as 'openai_chat' | 'anthropic_messages' | 'openai_responses',
            providerGroup: p.providerGroup,
            groupLabel: p.groupLabel,
            description: p.description,
            enabled: false, // 导入默认停用,等用户填 key 后再启用
          })
          provCount++
          const newProviderId = res.id
          for (const m of p.models) {
            try {
              await createModelV2(newProviderId, {
                id: null,
                modelId: m.modelId,
                displayName: m.displayName,
                contextLength: m.contextLength,
                inputPricePer1k: m.inputPricePer1k,
                outputPricePer1k: m.outputPricePer1k,
                params: {},
                advancedJson: JSON.stringify(m.defaultParams ?? {}),
                enabled: m.enabled,
                isDefault: m.isDefault,
                sortOrder: 0,
              })
              modelCount++
            } catch (e) {
              errors.push(`model ${m.modelId}: ${(e as Error).message}`)
            }
          }
        } catch (e) {
          errors.push(`provider ${p.name}: ${(e as Error).message}`)
        }
      }

      return { provCount, modelCount, errors }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['v2-providers'] })
      if (res.errors.length > 0) {
        toast.warning(t('importSuccess', { providers: res.provCount, models: res.modelCount }), {
          description: `${res.errors.length} 个失败: ${res.errors.slice(0, 3).join('; ')}${
            res.errors.length > 3 ? '...' : ''
          }`,
        })
      } else {
        toast.success(t('importSuccess', { providers: res.provCount, models: res.modelCount }))
      }
      onClose()
    },
    onError: (e: Error) => {
      toast.error(t('importFailed', { error: e.message }))
    },
  })

  function handleParse() {
    try {
      const bundle = JSON.parse(importText.trim()) as ExportBundle
      if (!bundle || bundle.version !== 2 || !Array.isArray(bundle.providers)) {
        throw new Error('schema mismatch')
      }
      setParsed(bundle)
      toast.success(
        t('importSuccess', {
          providers: bundle.providers.length,
          models: bundle.providers.reduce((acc, p) => acc + p.models.length, 0),
        }),
        { description: '点击「开始导入」确认' },
      )
    } catch {
      toast.error(t('invalidJson'))
      setParsed(null)
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setImportText(text)
    }
    reader.readAsText(file)
  }

  React.useEffect(() => {
    if (!open) {
      setImportText('')
      setParsed(null)
      setTab('export')
    }
  }, [open])

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const isPending = importMut.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" />
            {tab === 'export' ? t('exportTitle') : t('importTitle')}
          </DialogTitle>
          <DialogDescription>
            {tab === 'export' ? t('exportDesc') : t('importDesc')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'export' | 'import')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {t('export')}
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {t('import')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">{t('exportDesc')}</p>
            <Button onClick={exportMut} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {t('exportBtn')}
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="importText" className="text-sm">
                  JSON
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  {t('importFile')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </div>
              <textarea
                id="importText"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={10}
                placeholder={t('importPlaceholder')}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {parsed ? (
              <div className="rounded-md border border-dashed bg-muted/30 p-2 text-xs">
                <p className="text-muted-foreground">{t('importConfirmDesc', {
                  providers: parsed.providers.length,
                  models: parsed.providers.reduce((acc, p) => acc + p.models.length, 0),
                })}</p>
                <p className="mt-1 text-muted-foreground">version: {parsed.version} · exported: {parsed.exportedAt}</p>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          {tab === 'import' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleParse}
                disabled={isPending || !importText.trim()}
              >
                解析 JSON
              </Button>
              <Button
                type="button"
                onClick={() => parsed && importMut.mutate(parsed)}
                disabled={isPending || !parsed}
              >
                {isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                {t('importSubmit')}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
