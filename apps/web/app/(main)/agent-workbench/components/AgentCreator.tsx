'use client'

import * as React from 'react'
import { History, Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import { FALLBACK_MODELS } from '@/components/chat/fallback-models'
import { fetchApi } from '@/lib/api'
import {
  isArchivedModel,
  normalizeCategory,
  normalizeTier,
  type ModelTier,
  type ModelUsageCategory,
} from '@ihui/shared'

/**
 * 2026-08-29 立:Agent 创建器里的模型项。
 * 后端 /llm/models 现在带用途分类与代次档位,历史过时模型和
 * 嵌入/语音/图像等非对话专用模型默认折叠,点"历史模型"才展开。
 */
interface CreatorModel {
  id: string
  category: ModelUsageCategory
  tier: ModelTier
}

/** API 不可达时的兜底列表(人工挑选的当前可用主力,一律按最新对话模型处理) */
function toFallbackModels(): CreatorModel[] {
  return FALLBACK_MODELS.map((m) => ({ id: m.value, category: 'chat', tier: 'latest' }))
}

/** "历史模型"展开按钮的哨兵 value(不会与真实模型 id 冲突,且 onSelect 被 preventDefault 拦下) */
const HISTORY_TOGGLE_VALUE = '__ihui_show_history_models__'

const ROLE_OPTIONS = [
  { value: 'researcher', label: '研究员' },
  { value: 'coder', label: '编码员' },
  { value: 'reviewer', label: '审查员' },
  { value: 'tester', label: '测试员' },
  { value: 'custom', label: '自定义' },
]

const PERMISSION_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'acceptEdits', label: '自动接受编辑' },
  { value: 'bypassPermissions', label: '跳过权限' },
  { value: 'plan', label: '仅规划' },
]

const TOOL_OPTIONS = [
  'read_file',
  'write_file',
  'edit_file',
  'grep',
  'glob',
  'bash',
  'memory_recall',
  'web_search',
  'web_fetch',
]

// 共享已验证兜底(仅后端不可达时使用;FALLBACK_MODELS 来自 @ihui/shared,全部已验证连通)
const FALLBACK_MODEL_VALUES = FALLBACK_MODELS.map((f) => f.value)

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function AgentCreator({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState('coder')
  const [model, setModel] = React.useState(FALLBACK_MODEL_VALUES[0] ?? '')
  const [tools, setTools] = React.useState<string[]>(['read_file', 'grep', 'glob'])
  const [permissionMode, setPermissionMode] = React.useState('default')
  const [maxIterations, setMaxIterations] = React.useState(25)
  const [systemPrompt, setSystemPrompt] = React.useState('')
  // 2026-08-29 立:模型带分类字段(用途 + 代次),历史模型默认折叠
  const [models, setModels] = React.useState<CreatorModel[]>(() =>
    FALLBACK_MODEL_VALUES.map((id) => ({ id, category: 'chat', tier: 'latest' })),
  )
  const [showHistory, setShowHistory] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  // 拉取模型列表:主源 = 后端已过滤(可用+有配额)的 /llm/models。
  // API 成功且非空 → 仅展示后端列表,不混入任何硬编码模型;
  // API 失败/空 → 降级共享已验证兜底 FALLBACK_MODELS(后端不可达时的最小降级)。
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<{
          models?: Array<{
            id: string
            category?: ModelUsageCategory
            model_tier?: ModelTier
          }>
        }>('/api/llm/models')
        if (cancelled) return
        if (!res.success || !res.data) {
          setModels(toFallbackModels())
          return
        }
        const list = (res.data.models ?? [])
          .filter((m) => !!m.id)
          .map((m) => ({
            id: m.id,
            category: normalizeCategory(m.category),
            tier: normalizeTier(m.model_tier),
          }))
        setModels(list.length > 0 ? list : toFallbackModels())
      } catch {
        if (cancelled) return
        setModels(toFallbackModels())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const toggleTool = (t: string) => {
    setTools((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  // 2026-08-29 立:默认区(最新最强的对话模型)/ 历史模型折叠区(过时版本 + 非对话专用模型)
  const { visibleModels, archivedModels } = React.useMemo(() => {
    const primary: CreatorModel[] = []
    const archived: CreatorModel[] = []
    for (const m of models) {
      if (isArchivedModel(m.category, m.tier)) archived.push(m)
      else primary.push(m)
    }
    return { visibleModels: primary, archivedModels: archived }
  }, [models])

  const reset = () => {
    setName('')
    setRole('coder')
    setModel(FALLBACK_MODEL_VALUES[0] ?? '')
    setTools(['read_file', 'grep', 'glob'])
    setPermissionMode('default')
    setMaxIterations(25)
    setSystemPrompt('')
    setErr(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErr('请输入 Agent 名字')
      return
    }
    setSubmitting(true)
    setErr(null)
    const payload: Record<string, unknown> = {
      name: name.trim(),
      role,
      model,
      tools,
      permissionMode,
      maxIterations,
    }
    if (systemPrompt.trim()) payload.systemPrompt = systemPrompt.trim()
    try {
      const res = await fetchApi<unknown>('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.success) {
        setErr(res.error || '创建失败')
        return
      }
      reset()
      onOpenChange(false)
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建 Agent</DialogTitle>
          <DialogDescription>配置名字、角色、模型、工具白名单与权限模式</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ag-name">
              名字 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:代码审查助手"
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>模型</Label>
              <Select
                value={model}
                onValueChange={setModel}
                onOpenChange={(o) => {
                  // 每次关闭弹层都收起历史模型,回到"默认只看最新"状态
                  if (!o) setShowHistory(false)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                  {/* 历史模型折叠区:默认只显示一个入口,点开才加载全部过时/专用模型 */}
                  {archivedModels.length > 0 &&
                    (showHistory ? (
                      <SelectGroup>
                        <SelectLabel className="text-muted-foreground">
                          历史模型 ({archivedModels.length})
                        </SelectLabel>
                        {archivedModels.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.id}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : (
                      <SelectItem
                        value={HISTORY_TOGGLE_VALUE}
                        onSelect={(e) => {
                          // preventDefault 阻止 Radix 关闭弹层并写入选中值
                          e.preventDefault()
                          setShowHistory(true)
                        }}
                        className="text-muted-foreground"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <History className="h-3.5 w-3.5" />
                          历史模型 ({archivedModels.length})
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>工具白名单</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3 min-[640px]:grid-cols-3">
              {TOOL_OPTIONS.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-xs">
                  <Checkbox checked={tools.includes(t)} onCheckedChange={() => toggleTool(t)} />
                  <span className="font-mono">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
            <div className="space-y-2">
              <Label>权限模式</Label>
              <Select value={permissionMode} onValueChange={setPermissionMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-iter">最大迭代数</Label>
              <Input
                id="ag-iter"
                type="number"
                min={1}
                max={200}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value) || 25)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ag-sys">System Prompt(可选)</Label>
            <textarea
              id="ag-sys"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder="留空则使用角色默认 prompt"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
