'use client'

import { useState, type FormEvent } from 'react'
import { Button, Input } from '@ihui/ui'
import { Loader2 } from 'lucide-react'
import { MEMORY_SCOPE_OPTIONS, MEMORY_TYPE_OPTIONS } from '@/lib/memory-api'
import type { MemoryCreateInput } from '@/lib/memory-api'
import type { MemoryScope, MemoryEntryType } from '@ihui/types'
import { cn } from '@/lib/utils'

interface MemoryFormProps {
  initial?: Partial<MemoryCreateInput>
  onSubmit: (input: MemoryCreateInput) => Promise<void>
  submitLabel?: string
}

const fieldCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const textareaCls =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[100px]'

const labelCls = 'text-xs font-medium text-muted-foreground'

export function MemoryForm({ initial, onSubmit, submitLabel = '保存' }: MemoryFormProps) {
  const [scope, setScope] = useState<MemoryScope>(initial?.scope ?? 'session')
  const [type, setType] = useState<MemoryEntryType>(initial?.type ?? 'fact')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [sessionId, setSessionId] = useState(initial?.sessionId ?? '')
  const [projectKey, setProjectKey] = useState(initial?.projectKey ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) {
      setError('记忆内容不能为空')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        scope,
        type,
        category: category.trim() || '未分类',
        text: text.trim(),
        source: 'web',
        sessionId: sessionId.trim() || undefined,
        projectKey: projectKey.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelCls}>作用域</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as MemoryScope)}
            className={fieldCls}
          >
            {MEMORY_SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} · {o.desc}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>类型</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MemoryEntryType)}
            className={fieldCls}
          >
            {MEMORY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>分类</label>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="如:UI 偏好 / API 约定"
        />
      </div>

      <div className="space-y-1.5">
        <label className={cn(labelCls, 'flex items-center gap-1')}>
          记忆内容 <span className="text-destructive">*</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="详细描述这条记忆..."
          rows={5}
          className={textareaCls}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelCls}>会话 ID(可选)</label>
          <Input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="scope=session 时填写"
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>项目标识(可选)</label>
          <Input
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value)}
            placeholder="scope=project 时填写"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
