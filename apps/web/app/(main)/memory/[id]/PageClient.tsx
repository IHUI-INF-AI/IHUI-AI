'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Brain, Loader2, Trash2, AlertCircle, Save, Pencil, X } from 'lucide-react'
import { Button, Input } from '@ihui/ui'
import {
  fetchMemory,
  deleteMemory,
  createMemory,
  formatMemoryTime,
  getMemoryTypeOption,
  getMemoryScopeOption,
} from '@/lib/memory-api'
import type { MemoryEntry } from '@ihui/types'
import { cn } from '@/lib/utils'

const textareaCls =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y'

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [entry, setEntry] = useState<MemoryEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editCategory, setEditCategory] = useState('')
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetchMemory()
        const found = res.entries.find((e) => e.id === id)
        if (cancelled) return
        if (!found) {
          setError('记忆条目不存在')
        } else {
          setEntry(found)
          setEditCategory(found.category)
          setEditText(found.text)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSave() {
    if (!entry) return
    setSaving(true)
    setError(null)
    try {
      await deleteMemory(entry.id)
      await createMemory({
        scope: entry.scope,
        type: entry.type,
        category: editCategory.trim() || '未分类',
        text: editText.trim(),
        source: entry.source,
      })
      router.push('/memory')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!entry) return
    setDeleting(true)
    try {
      await deleteMemory(entry.id)
      router.push('/memory')
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      </div>
    )
  }

  const typeOpt = entry ? getMemoryTypeOption(entry.type) : undefined
  const scopeOpt = entry ? getMemoryScopeOption(entry.scope) : undefined

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/memory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">记忆详情</h1>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {entry && (
        <div className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-sm px-2 py-0.5 text-[11px] font-medium',
                typeOpt?.color ?? 'bg-muted text-muted-foreground',
              )}
            >
              {typeOpt?.label ?? entry.type}
            </span>
            <span className="rounded-sm bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {scopeOpt?.label ?? entry.scope}
            </span>
            <span className="text-[11px] text-muted-foreground/70">来源:{entry.source}</span>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">分类</label>
                <Input
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="分类名称"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">内容</label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={6}
                  className={textareaCls}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">{entry.category}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {entry.text}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 text-[11px] text-muted-foreground/70">
            <span>创建:{formatMemoryTime(entry.createdAt)}</span>
            <span>更新:{formatMemoryTime(entry.updatedAt)}</span>
          </div>

          <div className="flex items-center justify-end gap-2">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false)
                    setEditCategory(entry.category)
                    setEditText(entry.text)
                  }}
                  disabled={saving || deleting}
                >
                  <X className="h-4 w-4" />
                  取消
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || deleting}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                  disabled={deleting}
                >
                  <Pencil className="h-4 w-4" />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  删除
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
