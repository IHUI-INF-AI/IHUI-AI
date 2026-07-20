'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Info, KeyRound, Loader2, Plus, Sparkles, Wand2 } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Alert } from '@/components/feedback'
import Link from 'next/link'
import { PackagePlus } from 'lucide-react'

import { LlmConfigDialog } from './LlmConfigDialog'
import { LlmConfigCard } from './LlmConfigCard'
import {
  fetchConfigs,
  fetchTemplates,
  createConfig,
  updateConfig,
  configToForm,
  templateToForm,
  EMPTY_FORM,
  type FormState,
} from './helpers'
import type { PlatformTemplate, UserLlmConfig } from './types'

export default function UserLlmConfigsPage() {
  const t = useTranslations('llmSettings')
  const tDialog = useTranslations('llmSettings.dialog')
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  // URL 深链预填:?template=openai&model=gpt-4o&name=我的 OpenAI&action=create
  // - 用于从模型广场 / 详情对话框 / QuickKeyDialog 关闭后跳到完整配置页继续编辑
  const urlTemplate = searchParams.get('template') || ''
  const urlModel = searchParams.get('model') || ''
  const urlName = searchParams.get('name') || ''
  const urlAction = searchParams.get('action') || ''
  const urlPrefillHandled = React.useRef(false)

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)

  // 加载模板
  const { data: tplData } = useQuery({
    queryKey: ['user-llm-templates'],
    queryFn: () => fetchTemplates(),
    staleTime: 5 * 60_000,
  })
  const templates: PlatformTemplate[] = React.useMemo(() => tplData?.templates ?? [], [tplData])
  const templateMap = React.useMemo(
    () => Object.fromEntries(templates.map((tpl) => [tpl.code, tpl])),
    [templates],
  )

  // URL 深链预填:模板加载完成 + 含有效 template 时 → 自动打开 dialog
  React.useEffect(() => {
    if (urlPrefillHandled.current) return
    if (!urlTemplate || !templates.length) return
    const tpl = templateMap[urlTemplate]
    if (!tpl) return
    const pre: FormState = {
      ...templateToForm(tpl),
      modelId: urlModel || tpl.defaultModelId,
      name: urlName || tpl.name,
    }
    setForm(pre)
    if (urlAction === 'create' || urlAction === 'edit' || !urlAction) {
      setOpen(true)
    }
    urlPrefillHandled.current = true
  }, [urlTemplate, urlModel, urlName, urlAction, templates, templateMap])

  // 加载用户配置
  const { data, isLoading } = useQuery({
    queryKey: ['user-llm-configs'],
    queryFn: () => fetchConfigs(),
  })
  const list: UserLlmConfig[] = data?.list ?? []

  // 创建
  const createMut = useMutation({
    mutationFn: (f: FormState) => createConfig(f),
    onSuccess: (res) => {
      toast.success(tDialog('created'), { description: tDialog('createdDesc', { name: res.name }) })
      qc.invalidateQueries({ queryKey: ['user-llm-configs'] })
      closeDialog()
    },
    onError: (e: Error) => toast.error(tDialog('createFailed'), { description: e.message }),
  })

  // 更新
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) => updateConfig(id, f),
    onSuccess: () => {
      toast.success(tDialog('saved'))
      qc.invalidateQueries({ queryKey: ['user-llm-configs'] })
      closeDialog()
    },
    onError: (e: Error) => toast.error(tDialog('saveFailed'), { description: e.message }),
  })

  function openCreate() {
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(c: UserLlmConfig) {
    setForm(configToForm(c, c.providerCode))
    setOpen(true)
  }
  function closeDialog() {
    if (createMut.isPending || updateMut.isPending) return
    setOpen(false)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.templateCode) {
      toast.error(tDialog('selectTemplate'))
      return
    }
    if (!form.name.trim()) {
      const tpl = templateMap[form.templateCode]
      setForm({ ...form, name: tpl?.name ?? tDialog('namePlaceholder') })
    }
    if (!form.id && !form.apiKey) {
      toast.error(tDialog('fillKey'))
      return
    }
    if (!form.modelId.trim()) {
      toast.error(tDialog('fillModelId'))
      return
    }
    if (form.id) {
      updateMut.mutate({ id: form.id, f: form })
    } else {
      createMut.mutate(form)
    }
  }

  const enabledCount = list.filter((c) => c.enabled).length
  const total = list.length

  return (
    <Container maxWidth="lg" padding={false} className="space-y-6 py-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings/import">
            <PackagePlus className="mr-1.5 h-4 w-4" />
            <span>{t('importCliConfig')}</span>
          </Link>
        </Button>
      </header>

      {/* Info Banner */}
      <Alert variant="info" title={t('infoTitle')} description={t('infoDesc')} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('statsTotal')}</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('statsEnabled')}</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {enabledCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('statsAvailablePlatforms')}</p>
            <p className="text-2xl font-bold text-primary">{templates.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? t('emptyList') : t('listCount', { total, enabledCount })}
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('newConfig')}
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-md bg-primary/10 p-3">
              <Wand2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('noConfigs')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('noConfigsDesc')}</p>
            </div>
            <Button onClick={openCreate} variant="outline" size="sm">
              <Sparkles className="mr-1.5 h-4 w-4" />
              {t('firstConfig')}
            </Button>
            {/* Quick start templates */}
            <div className="mt-4 w-full">
              <p className="mb-2 text-xs text-muted-foreground">{t('quickStartTitle')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {templates
                  .filter(
                    (tpl) =>
                      tpl.isOfficial &&
                      ['openai', 'deepseek', 'zhipu', 'alibaba', 'moonshot'].includes(tpl.code),
                  )
                  .map((tpl) => (
                    <button
                      key={tpl.code}
                      type="button"
                      onClick={() => {
                        setForm(templateToForm(tpl))
                        setOpen(true)
                      }}
                      className="rounded-md border px-3 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      {tpl.name}
                    </button>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((c) => (
            <LlmConfigCard
              key={c.id}
              config={c}
              template={templateMap[c.providerCode]}
              onEdit={openEdit}
              onDeleted={() => qc.invalidateQueries({ queryKey: ['user-llm-configs'] })}
            />
          ))}
        </div>
      )}

      {/* Security notice */}
      <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>{t('securityNotice')}</p>
      </div>

      {/* Edit/Create dialog */}
      <LlmConfigDialog
        open={open}
        form={form}
        setForm={setForm}
        templates={templates}
        savePending={createMut.isPending || updateMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </Container>
  )
}
