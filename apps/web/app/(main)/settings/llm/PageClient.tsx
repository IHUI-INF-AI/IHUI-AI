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

import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'
import { Container } from '@/components/layout'
import { Alert } from '@/components/feedback'
import { BookOpen, KeyRound, Loader2, PackagePlus, ShieldCheck, Sparkles, Upload, Wand2 } from 'lucide-react'

import { GroupSidebar } from './GroupSidebar'
import { ProviderCardV2 } from './ProviderCardV2'
import { ProviderFormDialog } from './ProviderFormDialog'
import { ModelFormDialog } from './ModelFormDialog'
import { BulkImportExportDialog } from './BulkImportExportDialog'
import { CompareModelsDialog } from './CompareModelsDialog'
import { CopyModelDialog } from './CopyModelDialog'
import { fetchProvidersV2, fetchTemplatesV2, fetchGroupsV2 } from './helpers-v2'
import type { PlatformTemplate } from './types'
import type { ProviderGroup, UserLlmModel, UserLlmProvider } from './types-v2'
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

  // BYOK 模式 onboarding:仅首次访问弹出(localStorage 标记)
  // hydration 安全:初始 false,mounted 后读取 localStorage 决定是否显示
  const BYOK_ONBOARDING_KEY = 'ihui-byok-onboarding-dismissed'
  const [mounted, setMounted] = React.useState(false)
  const [showOnboarding, setShowOnboarding] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined' && !localStorage.getItem(BYOK_ONBOARDING_KEY)) {
      setShowOnboarding(true)
    }
  }, [BYOK_ONBOARDING_KEY])

  function dismissOnboarding() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(BYOK_ONBOARDING_KEY, '1')
    }
    setShowOnboarding(false)
  }

  function reopenOnboarding() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(BYOK_ONBOARDING_KEY)
    }
    setShowOnboarding(true)
  }

  // 加载模板
  const { data: tplData } = useQuery({
    queryKey: ['v2-templates'],
    queryFn: () => fetchTemplatesV2(),
    staleTime: 5 * 60_000,
  })
  const templates: PlatformTemplate[] = React.useMemo(() => tplData?.templates ?? [], [tplData])
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
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
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

      {/* BYOK 模式提示 */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
        <p className="flex-1">
          <span className="font-medium text-foreground">BYOK 模式</span>
          :你配置的 API Key 加密存储(AES-256-GCM),调用时直接使用你的 Key 访问大厂。平台只收 5-20%
          服务费,Cloudflare / GitHub Models / HuggingFace 等免费 provider 不收费。
        </p>
        {mounted && (
          <Button
            onClick={reopenOnboarding}
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 px-2 text-xs"
          >
            <BookOpen className="mr-1 h-3.5 w-3.5" />
            查看引导
          </Button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-[200px_1fr]">
        <div className="rounded-lg border bg-card p-2">
          <GroupSidebar groups={groups} activeGroup={activeGroup} onChange={setActiveGroup} />
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
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : visibleProviders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="rounded-md bg-primary/10 p-3">
                  <Wand2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{tV2('emptyTitle')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tV2('emptyDesc')}</p>
                </div>
                <Button onClick={openCreateProvider} variant="outline" size="sm">
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {tV2('firstProvider')}
                </Button>
                {templates.length > 0 && (
                  <div className="mt-4 w-full">
                    <p className="mb-2 text-xs text-muted-foreground">{tV2('quickStartTitle')}</p>
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
            <div className="grid grid-cols-1 gap-3 min-[1280px]:grid-cols-2">
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

      {/* BYOK 模式 onboarding:首次访问引导 */}
      <Dialog open={mounted && showOnboarding} onOpenChange={(o) => !o && dismissOnboarding()}>
        <DialogContent className="max-w-lg gap-0 p-0 min-[640px]:rounded-lg">
          <DialogHeader className="space-y-2 border-b p-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              欢迎使用 BYOK 平台模式
            </DialogTitle>
            <DialogDescription className="text-xs">
              自带 API Key 调用大厂模型,平台仅收 5-20% 服务费
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4 text-sm">
            {/* 价值说明 */}
            <section className="space-y-1.5">
              <p className="font-medium text-foreground">为什么选择 BYOK?</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                BYOK(Bring Your Own Key)让你自带大厂 API Key 调用模型,大厂直接扣你的账户,平台只收
                5-20% 服务费。相比传统中转站,你无需付中间商加价。
              </p>
            </section>

            {/* 免费 provider 推荐 */}
            <section className="space-y-2">
              <p className="font-medium text-foreground">免费 Provider 推荐</p>
              <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2">
                <Card className="rounded-md">
                  <CardContent className="space-y-0.5 p-3">
                    <p className="text-xs font-medium">Cloudflare Workers AI</p>
                    <p className="text-[11px] text-muted-foreground">@cf/ · 免费,无需 API Key</p>
                  </CardContent>
                </Card>
                <Card className="rounded-md">
                  <CardContent className="space-y-0.5 p-3">
                    <p className="text-xs font-medium">GitHub Models</p>
                    <p className="text-[11px] text-muted-foreground">github/ · 免费,用 GitHub token</p>
                  </CardContent>
                </Card>
                <Card className="rounded-md">
                  <CardContent className="space-y-0.5 p-3">
                    <p className="text-xs font-medium">HuggingFace</p>
                    <p className="text-[11px] text-muted-foreground">huggingface/ · 免费,用 HF token</p>
                  </CardContent>
                </Card>
                <Card className="rounded-md">
                  <CardContent className="space-y-0.5 p-3">
                    <p className="text-xs font-medium">Pollinations</p>
                    <p className="text-[11px] text-muted-foreground">pollinations/ · 免费,无需 API Key</p>
                  </CardContent>
                </Card>
                <Card className="rounded-md min-[640px]:col-span-2">
                  <CardContent className="space-y-0.5 p-3">
                    <p className="text-xs font-medium">LLM7</p>
                    <p className="text-[11px] text-muted-foreground">llm7/ · 免费,无需 API Key</p>
                  </CardContent>
                </Card>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-500">
                以上免费 provider 平台完全不收费(0 服务费)
              </p>
            </section>

            {/* 操作步骤 */}
            <section className="space-y-2">
              <p className="font-medium text-foreground">操作步骤</p>
              <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                <li>点击左侧「添加 Provider」按钮</li>
                <li>选择厂商(如 OpenAI / DeepSeek / 智谱)或免费 provider(如 cloudflare)</li>
                <li>填入你的 API Key(AES-256-GCM 加密存储,平台无法看到明文)</li>
                <li>添加你要用的模型</li>
                <li>调用时系统自动优先使用你的 Key</li>
              </ol>
            </section>
          </div>

          <DialogFooter className="border-t p-4">
            <Button onClick={dismissOnboarding} size="sm" className="w-full min-[640px]:w-auto">
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  )
}
