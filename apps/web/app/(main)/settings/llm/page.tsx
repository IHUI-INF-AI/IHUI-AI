'use client'

/**
 * 用户级 LLM 配置中心 — 主页面 v2(2026-07-22 升级)
 *
 * 方案 B 整合:两栏布局
 *  - 左侧:GroupSidebar(分组导航 + 添加分组)
 *  - 右侧:ProviderCardV2 列表(每个 provider 卡片含其下所有 model)
 *
 * 深度功能(2026-07-22):
 *  - 批量导入/导出(BulkImportExportDialog)
 *  - 跨 Provider 模型对比(CompareModelsDialog)
 *  - 一键复制 model 到其他 provider(CopyModelDialog)
 *  - 模板选择 + 行业通用英文术语(Temperature / Max Tokens 等)
 */
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { Button, Card, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Alert } from '@/components/feedback'
import { KeyRound, Loader2, PackagePlus, Sparkles, Upload, Wand2 } from 'lucide-react'

import { GroupSidebar } from './GroupSidebar'
import { ProviderCardV2 } from './ProviderCardV2'
import { ProviderFormDialog } from './ProviderFormDialog'
import { ModelFormDialog } from './ModelFormDialog'
import { BulkImportExportDialog } from './BulkImportExportDialog'
import { CompareModelsDialog } from './CompareModelsDialog'
import { CopyModelDialog } from './CopyModelDialog'
import {
  fetchProvidersV2,
  fetchTemplatesV2,
  fetchGroupsV2,
} from './helpers-v2'
import type { PlatformTemplate } from './types'
import type {
  ProviderGroup,
  UserLlmModel,
  UserLlmProvider,
} from './types-v2'
import type { ProviderFormState } from './types-v2'

export default function UserLlmConfigsPage() {
  const t = useTranslations('llmSettings')
  const tV2 = useTranslations('llmSettings.v2')
  const qc = useQueryClient()

  // 选中的 group('__all__' | '__ungrouped__' | groupCode)
  const [activeGroup, setActiveGroup] = React.useState('__all__')

  // Dialog 状态
  const [provDialogOpen, setProvDialogOpen] = React.useState(false)
  const [editingProvider, setEditingProvider] = React.useState<UserLlmProvider | null>(null)
  /** 外部预填(如排行榜一键导入,通过 ?prefill=base64 传递) */
  const [prefill, setPrefill] = React.useState<Partial<ProviderFormState> | null>(null)

  const [modelDialogOpen, setModelDialogOpen] = React.useState(false)
  const [modelDialogProvider, setModelDialogProvider] = React.useState<UserLlmProvider | null>(null)
  const [editingModel, setEditingModel] = React.useState<UserLlmModel | null>(null)

  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [compareOpen, setCompareOpen] = React.useState(false)
  const [compareSelectedIds, setCompareSelectedIds] = React.useState<number[]>([])

  const [copySource, setCopySource] = React.useState<{
    prov: UserLlmProvider
    m: UserLlmModel
  } | null>(null)

  // 加载模板
  const { data: tplData } = useQuery({
    queryKey: ['v2-templates'],
    queryFn: () => fetchTemplatesV2(),
    staleTime: 5 * 60_000,
  })
  const templates: PlatformTemplate[] = React.useMemo(
    () => tplData?.templates ?? [],
    [tplData],
  )
  const templateMap = React.useMemo(
    () => Object.fromEntries(templates.map((tpl) => [tpl.code, tpl])),
    [templates],
  )

  // 外部预填:从 ?prefill=base64 读取(如排行榜一键导入)
  const searchParams = useSearchParams()
  React.useEffect(() => {
    const encoded = searchParams.get('prefill')
    if (!encoded) return
    try {
      const json = decodeURIComponent(atob(encoded))
      const payload = JSON.parse(json) as Partial<ProviderFormState>
      setPrefill(payload)
      setEditingProvider(null)
      setProvDialogOpen(true)
    } catch {
      // 解码失败,忽略
    }
  }, [searchParams])

  // 加载 provider 列表
  const { data, isLoading } = useQuery({
    queryKey: ['v2-providers'],
    queryFn: () => fetchProvidersV2(),
  })
  const groups: ProviderGroup[] = React.useMemo(() => data?.groups ?? [], [data])
  const allProviders: UserLlmProvider[] = React.useMemo(
    () => groups.flatMap((g) => g.providers),
    [groups],
  )

  // 加载分组(用于 ProviderFormDialog 的 existingGroups 下拉)
  const { data: groupsData } = useQuery({
    queryKey: ['v2-groups'],
    queryFn: () => fetchGroupsV2(),
    staleTime: 60_000,
  })
  const existingGroups = React.useMemo(
    () =>
      (groupsData?.list ?? []).map((g) => ({
        group: g.id.toString(),
        groupLabel: g.label,
      })),
    [groupsData],
  )

  // 按 activeGroup 过滤 provider
  const visibleProviders: UserLlmProvider[] = React.useMemo(() => {
    if (activeGroup === '__all__') return allProviders
    if (activeGroup === '__ungrouped__') {
      return allProviders.filter(
        (p) =>
          !p.providerGroup ||
          p.providerGroup === 'default' ||
          p.providerGroup === '' ||
          p.providerGroup === null,
      )
    }
    return allProviders.filter((p) => p.providerGroup === activeGroup)
  }, [allProviders, activeGroup])

  const total = allProviders.length
  const enabledCount = allProviders.filter((p) => p.enabled).length

  function openCreateProvider() {
    setEditingProvider(null)
    setProvDialogOpen(true)
  }
  function openEditProvider(prov: UserLlmProvider) {
    setEditingProvider(prov)
    setProvDialogOpen(true)
  }
  function openAddModel(prov: UserLlmProvider) {
    setEditingModel(null)
    setModelDialogProvider(prov)
    setModelDialogOpen(true)
  }
  function openEditModel(prov: UserLlmProvider, m: UserLlmModel) {
    setEditingModel(m)
    setModelDialogProvider(prov)
    setModelDialogOpen(true)
  }
  function handleCompareModel(_prov: UserLlmProvider, m: UserLlmModel) {
    setCompareSelectedIds([m.id])
    setCompareOpen(true)
  }
  function handleCopyModel(prov: UserLlmProvider, m: UserLlmModel) {
    setCopySource({ prov, m })
  }
  function refreshAll() {
    qc.invalidateQueries({ queryKey: ['v2-providers'] })
  }

  return (
    <Container maxWidth="xl" padding={false} className="space-y-5 py-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setBulkOpen(true)} size="sm" variant="outline">
            <PackagePlus className="mr-1.5 h-4 w-4" />
            {tV2('bulk.title')}
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/settings/import">
              <Upload className="mr-1.5 h-4 w-4" />
              {t('importCliConfig')}
            </a>
          </Button>
          <Button onClick={openCreateProvider} size="sm">
            <Sparkles className="mr-1.5 h-4 w-4" />
            {tV2('newProvider')}
          </Button>
        </div>
      </header>

      {/* Info Banner */}
      <Alert variant="info" title={t('infoTitle')} description={t('infoDesc')} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
        <div className="rounded-lg border bg-card p-2">
          <GroupSidebar
            groups={groups}
            activeGroup={activeGroup}
            onChange={setActiveGroup}
          />
        </div>
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {tV2('listCount', { total, enabledCount })}
            </p>
            {visibleProviders.length > 0 && (
              <Button onClick={openCreateProvider} size="sm" variant="outline">
                <Sparkles className="mr-1.5 h-4 w-4" />
                {tV2('newProvider')}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : visibleProviders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="rounded-md bg-primary/10 p-3">
                  <Wand2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{tV2('emptyTitle')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tV2('emptyDesc')}
                  </p>
                </div>
                <Button onClick={openCreateProvider} variant="outline" size="sm">
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {tV2('firstProvider')}
                </Button>
                {templates.length > 0 && (
                  <div className="mt-4 w-full">
                    <p className="mb-2 text-xs text-muted-foreground">
                      {tV2('quickStartTitle')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {templates
                        .filter(
                          (tpl) =>
                            tpl.isOfficial &&
                            ['openai', 'deepseek', 'zhipu', 'alibaba', 'moonshot'].includes(
                              tpl.code,
                            ),
                        )
                        .map((tpl) => (
                          <button
                            key={tpl.code}
                            type="button"
                            onClick={() => {
                              setEditingProvider(null)
                              setProvDialogOpen(true)
                            }}
                            className="rounded-md border px-3 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                          >
                            {tpl.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {visibleProviders.map((p) => (
                <ProviderCardV2
                  key={p.id}
                  provider={p}
                  template={templateMap[p.providerCode]}
                  onEditProvider={openEditProvider}
                  onAddModel={openAddModel}
                  onEditModel={openEditModel}
                  onCompareModel={handleCompareModel}
                  onCopyModelToProvider={handleCopyModel}
                  onDeleted={refreshAll}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <p>{t('securityNotice')}</p>
      </div>

      {/* Provider create/edit dialog */}
      <ProviderFormDialog
        open={provDialogOpen}
        provider={editingProvider}
        templates={templates}
        existingGroups={existingGroups}
        prefill={prefill}
        onClose={() => {
          setProvDialogOpen(false)
          setPrefill(null)
        }}
        onSaved={refreshAll}
      />

      {/* Model create/edit dialog */}
      <ModelFormDialog
        open={modelDialogOpen}
        provider={modelDialogProvider}
        model={editingModel}
        onClose={() => setModelDialogOpen(false)}
        onSaved={refreshAll}
      />

      {/* Bulk import/export */}
      <BulkImportExportDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />

      {/* Cross-provider model compare */}
      <CompareModelsDialog
        open={compareOpen}
        providers={allProviders}
        initialSelectedIds={compareSelectedIds}
        onClose={() => setCompareOpen(false)}
      />

      {/* Copy model to other provider */}
      <CopyModelDialog
        open={Boolean(copySource)}
        sourceProvider={copySource?.prov ?? null}
        sourceModel={copySource?.m ?? null}
        allProviders={allProviders}
        onClose={() => setCopySource(null)}
        onSaved={refreshAll}
      />
    </Container>
  )
}
