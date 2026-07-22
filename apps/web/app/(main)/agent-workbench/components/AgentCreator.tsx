'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Checkbox, Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

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

const FALLBACK_MODELS = ['gpt-4o', 'claude-3-5-sonnet', 'glm-4.5', 'default']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function AgentCreator({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState('coder')
  const [model, setModel] = React.useState('default')
  const [tools, setTools] = React.useState<string[]>(['read_file', 'grep', 'glob'])
  const [permissionMode, setPermissionMode] = React.useState('default')
  const [maxIterations, setMaxIterations] = React.useState(25)
  const [systemPrompt, setSystemPrompt] = React.useState('')
  const [models, setModels] = React.useState<string[]>(FALLBACK_MODELS)
  const [submitting, setSubmitting] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  // 拉取模型列表(失败降级用 FALLBACK_MODELS)
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<{ list?: Array<{ id: string }>; data?: Array<{ id: string }> }>(
          '/api/ai-models?pageSize=100',
        )
        if (cancelled || !res.success || !res.data) return
        const arr = res.data.list ?? res.data.data ?? []
        const ids = arr.map((m) => m.id).filter(Boolean)
        if (ids.length) setModels([...new Set([...ids, ...FALLBACK_MODELS])])
      } catch {
        /* 降级用默认列表 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const toggleTool = (t: string) => {
    setTools((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const reset = () => {
    setName('')
    setRole('coder')
    setModel('default')
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

          <div className="grid gap-4 sm:grid-cols-2">
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
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>工具白名单</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
              {TOOL_OPTIONS.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-xs">
                  <Checkbox checked={tools.includes(t)} onCheckedChange={() => toggleTool(t)} />
                  <span className="font-mono">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
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
