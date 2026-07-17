'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { HelpCircle, Loader2, Plus, Search, MessageSquare, Eye, CheckCircle2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui'
import { Input, Textarea } from '@/components/form'
import { cn } from '@/lib/utils'

interface AskItem {
  id: string
  title: string
  content: string
  author: { id: string; nickname: string; avatar: string | null }
  answerCount: number
  viewCount: number
  isResolved: boolean
  tags: string[]
  createdAt: string
}
interface AskListData {
  list: AskItem[]
  total: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

type Tab = 'all' | 'mine' | 'hot'

function initials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]
  const last = parts[parts.length - 1]
  if (!first || !last) return '?'
  if (parts.length === 1) return first.charAt(0).toUpperCase()
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

export default function AskPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<Tab>('all')
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState('')
  const [newContent, setNewContent] = React.useState('')
  const [newTags, setNewTags] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])
  React.useEffect(() => setPage(1), [tab])

  const { data, isLoading, error } = useQuery({
    queryKey: ['asks', tab, debounced, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('keyword', debounced)
      const url = tab === 'mine' ? `/api/asks/my?${qs.toString()}` : `/api/asks?${qs.toString()}`
      const r = await api<AskListData>(url)
      if (tab === 'hot') r.list = [...r.list].sort((a, b) => b.viewCount - a.viewCount)
      return r
    },
  })

  const createMut = useMutation({
    mutationFn: async () => {
      setFormError(null)
      if (!newTitle.trim()) {
        setFormError('请输入问题标题')
        throw new Error('empty title')
      }
      if (!newContent.trim()) {
        setFormError('请输入问题内容')
        throw new Error('empty content')
      }
      const tags = newTags
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      return api<AskItem>('/api/asks', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          tags: tags.length > 0 ? tags : undefined,
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asks'] })
      setDialogOpen(false)
      setNewTitle('')
      setNewContent('')
      setNewTags('')
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const asks = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'mine', label: '我的' },
    { key: 'hot', label: '热门' },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <HelpCircle className="h-7 w-7 text-primary" />
            问答
          </h1>
          <p className="text-sm text-muted-foreground">提问与解答，共同学习成长</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          提问
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border bg-muted/30 p-1">
          {tabs.map((it) => (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              className={cn(
                'rounded-sm px-3 py-1 text-sm font-medium transition-colors',
                tab === it.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索问题"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : asks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <HelpCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tab === 'mine' ? '你还没有提问过' : '暂无问题'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {asks.map((a) => (
            <Link key={a.id} href={`/asks/${a.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    {a.isResolved && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        已解决
                      </span>
                    )}
                    <p className="break-words text-sm font-medium">{a.title}</p>
                  </div>
                  {a.content && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{a.content}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-muted text-[10px] font-medium">
                        {initials(a.author.nickname)}
                      </span>
                      {a.author.nickname}
                    </span>
                    <span>{dateFmt.format(new Date(a.createdAt))}</span>
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="h-3 w-3" />
                      {a.answerCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Eye className="h-3 w-3" />
                      {a.viewCount}
                    </span>
                    {a.tags.slice(0, 3).map((tg) => (
                      <span key={tg} className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px]">
                        {tg}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>提出问题</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              label="标题"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="一句话描述你的问题"
              maxLength={100}
            />
            <Textarea
              label="内容"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="详细描述问题背景、已尝试的方案等"
              rows={6}
            />
            <Input
              label="标签"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="多个标签用逗号分隔"
              maxLength={100}
            />
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                发布
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
