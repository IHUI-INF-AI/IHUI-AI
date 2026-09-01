// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Plus, Search, Loader2, Brain, AlertCircle, Sparkles } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'
import { fetchMemory, deleteMemory } from '@/lib/memory-api'
import { fetchApi } from '@/lib/api'
import type { MemoryEntry, MemoryScope, MemoryEntryType } from '@ihui/types'
import { MemoryCard } from '@/components/memory/MemoryCard'
import { MemoryScopeTabs, type ScopeFilter } from '@/components/memory/MemoryScopeTabs'
import { MemoryTypeFilter, type TypeFilter } from '@/components/memory/MemoryTypeFilter'
import { BackButton } from '@/components/common'

export default function MemoryListPage() {
  const router = useRouter()
  const t = useTranslations('memory')
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [autoMemory, setAutoMemory] = useState(true)
  const [autoMemoryLoading, setAutoMemoryLoading] = useState(true)
  const [autoMemoryToast, setAutoMemoryToast] = useState<{
    type: 'success' | 'error'
    msg: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchApi<{ settings: Record<string, string> }>('/settings/privacy')
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setAutoMemory(res.data.settings.autoMemory !== 'false')
        }
      })
      .catch(() => {
        // 读取失败保持默认开启,不阻塞记忆页
      })
      .finally(() => {
        if (!cancelled) setAutoMemoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!autoMemoryToast) return
    const timer = setTimeout(() => setAutoMemoryToast(null), 3000)
    return () => clearTimeout(timer)
  }, [autoMemoryToast])

  async function handleAutoMemoryChange(value: boolean) {
    setAutoMemory(value)
    try {
      const res = await fetchApi('/settings/privacy', {
        method: 'PUT',
        body: JSON.stringify({ autoMemory: String(value) }),
      })
      setAutoMemoryToast({
        type: res.success ? 'success' : 'error',
        msg: res.success ? t('autoMemorySaveSuccess') : t('autoMemorySaveFailed'),
      })
    } catch {
      setAutoMemoryToast({ type: 'error', msg: t('autoMemorySaveFailed') })
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = scope === 'all' ? {} : { scope: scope as MemoryScope }
      const res = await fetchMemory(query)
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
    setDeletingId(id)
    try {
      const query = scope === 'all' ? {} : { scope: scope as MemoryScope }
      await deleteMemory(id, query)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <BackButton />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {t('autoMemory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
              {t('autoMemoryDesc')}
            </span>
            <Switch
              checked={autoMemory}
              disabled={autoMemoryLoading}
              onCheckedChange={handleAutoMemoryChange}
              className="shrink-0"
            />
          </div>
        </CardContent>
      </Card>
      {autoMemoryToast && (
        <div
          className={`fixed right-4 top-4 z-modal rounded-md px-4 py-2 text-sm text-white shadow-lg ${autoMemoryToast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {autoMemoryToast.msg}
        </div>
      )}

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">记忆系统</h1>
          <span className="text-sm text-muted-foreground">({entries.length})</span>
        </div>
        <Button asChild>
          <Link href="/memory/new">
            <Plus className="h-4 w-4" />
            新建记忆
          </Link>
        </Button>
      </header>

      <MemoryScopeTabs active={scope} onChange={setScope} />

      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
        <MemoryTypeFilter active={type} onChange={setType} />
        <div className="relative w-full min-[640px]:max-w-xs">
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
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card py-8 text-center">
          <Brain className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">还没有记忆条目</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/memory/new">
              <Plus className="h-4 w-4" />
              创建第一条记忆
            </Link>
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {filtered.map((entry) => (
            <MemoryCard
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
              onEdit={(e) => {
                router.push(`/memory/${e.id}`)
              }}
              deleting={deletingId === entry.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
