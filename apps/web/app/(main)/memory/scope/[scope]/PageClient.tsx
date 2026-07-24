'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Loader2, Brain, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@ihui/ui'
import { fetchMemory, deleteMemory, getMemoryScopeOption } from '@/lib/memory-api'
import type { MemoryEntry, MemoryScope, MemoryEntryType } from '@ihui/types'
import { MemoryCard } from '@/components/memory/MemoryCard'
import { MemoryTypeFilter, type TypeFilter } from '@/components/memory/MemoryTypeFilter'

const VALID_SCOPES: MemoryScope[] = ['global', 'project', 'session', 'user']

export default function MemoryScopePage() {
  const params = useParams<{ scope: string }>()
  const router = useRouter()
  const rawScope = params?.scope
  const isValidScope = rawScope ? (VALID_SCOPES as string[]).includes(rawScope) : false
  const scope = isValidScope ? (rawScope as MemoryScope) : undefined
  const scopeOpt = scope ? getMemoryScopeOption(scope) : undefined

  const [type, setType] = useState<TypeFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!scope) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchMemory({ scope })
      setEntries(res.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = entries.filter((e) => {
    if (type !== 'all' && e.type !== (type as MemoryEntryType)) return false
    const k = keyword.trim().toLowerCase()
    if (!k) return true
    return e.text.toLowerCase().includes(k) || e.category.toLowerCase().includes(k)
  })

  async function handleDelete(id: string) {
    if (!scope) return
    setDeletingId(id)
    try {
      await deleteMemory(id, { scope })
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isValidScope) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/memory">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">无效的作用域</h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          作用域 &ldquo;{rawScope}&rdquo; 不存在,有效值:global / project / session / user
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/memory">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">
              {scopeOpt?.label ?? scope} 记忆
            </h1>
            <span className="text-sm text-muted-foreground">({entries.length})</span>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/memory/new">
            <Plus className="h-4 w-4" />
            新建
          </Link>
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MemoryTypeFilter active={type} onChange={setType} />
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索分类或内容..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card py-16 text-center">
          <Brain className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">该作用域下还没有记忆条目</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/memory/new">
              <Plus className="h-4 w-4" />
              创建记忆
            </Link>
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <MemoryCard
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
              onEdit={(e) => { router.push(`/memory/${e.id}`) }}
              deleting={deletingId === entry.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
