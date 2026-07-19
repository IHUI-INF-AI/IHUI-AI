'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Info, KeyRound, Loader2, Plus, Sparkles, Wand2 } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Alert } from '@/components/feedback'

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
    () => Object.fromEntries(templates.map((t) => [t.code, t])),
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
      toast.success('已创建', { description: `「${res.name}」已保存` })
      qc.invalidateQueries({ queryKey: ['user-llm-configs'] })
      closeDialog()
    },
    onError: (e: Error) => toast.error('创建失败', { description: e.message }),
  })

  // 更新
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) => updateConfig(id, f),
    onSuccess: () => {
      toast.success('已保存')
      qc.invalidateQueries({ queryKey: ['user-llm-configs'] })
      closeDialog()
    },
    onError: (e: Error) => toast.error('保存失败', { description: e.message }),
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
      toast.error('请选择平台模板')
      return
    }
    if (!form.name.trim()) {
      const tpl = templateMap[form.templateCode]
      setForm({ ...form, name: tpl?.name ?? '我的配置' })
    }
    if (!form.id && !form.apiKey) {
      toast.error('请填写 API Key')
      return
    }
    if (!form.modelId.trim()) {
      toast.error('请填写模型 ID')
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
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <KeyRound className="h-6 w-6 text-primary" />
          我的 LLM 配置
        </h1>
        <p className="text-sm text-muted-foreground">
          为每个 AI 平台保存独立的 API Key、模型 ID 与上下文长度。系统已预置 15+
          平台模板,只需填写授权信息。
        </p>
      </header>

      {/* Info Banner */}
      <Alert
        variant="info"
        title="配置说明"
        description="平台 URL 与协议已预置,您只需填写 API Key、模型 ID 和上下文支持数。保存后可一键测试连通,或拉取上游所有模型 ID。每个账号的配置互相独立、加密存储。"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">总配置</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">已启用</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {enabledCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">可用平台</p>
            <p className="text-2xl font-bold text-primary">{templates.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? '尚未添加任何配置' : `共 ${total} 个配置 · ${enabledCount} 个已启用`}
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          新增配置
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-md bg-primary/10 p-3">
              <Wand2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">还没有配置</p>
              <p className="mt-1 text-xs text-muted-foreground">
                点击「新增配置」开始添加,或选择下方平台模板快速开始
              </p>
            </div>
            <Button onClick={openCreate} variant="outline" size="sm">
              <Sparkles className="mr-1.5 h-4 w-4" />
              添加第一个配置
            </Button>
            {/* Quick start templates */}
            <div className="mt-4 w-full">
              <p className="mb-2 text-xs text-muted-foreground">常用平台(点击快速开始):</p>
              <div className="flex flex-wrap justify-center gap-2">
                {templates
                  .filter(
                    (t) =>
                      t.isOfficial &&
                      ['openai', 'deepseek', 'zhipu', 'alibaba', 'moonshot'].includes(t.code),
                  )
                  .map((t) => (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => {
                        setForm(templateToForm(t))
                        setOpen(true)
                      }}
                      className="rounded-md border px-3 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      {t.name}
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
        <p>
          API Key 使用 AES-256 加密存储,仅本账号可见。每个平台的 URL、协议、Headers
          已按官方规范预置,无需您手动配置。
        </p>
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
