'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import {
  batchDeleteKnowledgeDocs,
  checkKnowledgeHealth,
  deleteKnowledgeDoc,
  getKnowledgeDocChunks,
  ingestKnowledgeText,
  listKnowledgeDocs,
  searchKnowledge,
} from '@/lib/knowledge-rag-api'
import { EMPTY_INGEST, EMPTY_SEARCH, fmtScore, fmtTime } from './helpers'
import type { IngestForm, KnowledgeChunkPreview, SearchForm } from './types'

export default function KnowledgeRagPage() {
  const qc = useQueryClient()
  const [owner, setOwner] = React.useState('admin')
  const [ingestOpen, setIngestOpen] = React.useState(false)
  const [ingest, setIngest] = React.useState<IngestForm>(EMPTY_INGEST)
  const [search, setSearch] = React.useState<SearchForm>(EMPTY_SEARCH)
  const [chunksOpen, setChunksOpen] = React.useState(false)
  const [chunksLoading, setChunksLoading] = React.useState(false)
  const [chunks, setChunks] = React.useState<KnowledgeChunkPreview[]>([])
  const [selected, setSelected] = React.useState<Set<number>>(new Set())

  const healthQ = useQuery({
    queryKey: ['knowledge', 'health'],
    queryFn: () => checkKnowledgeHealth(),
    staleTime: 30_000,
  })

  const docsQ = useQuery({
    queryKey: ['knowledge', 'docs', owner],
    queryFn: () => listKnowledgeDocs(owner),
    enabled: !!owner,
    refetchInterval: 30_000,
  })

  const ingestMut = useMutation({
    mutationFn: () =>
      ingestKnowledgeText({
        ownerUuid: ingest.ownerUuid || owner,
        title: ingest.title,
        text: ingest.text,
        collectionName: ingest.collectionName || undefined,
      }),
    onSuccess: (r) => {
      toast.success(`入库成功,切片 ${r.chunkCount} 块`)
      setIngestOpen(false)
      setIngest(EMPTY_INGEST)
      qc.invalidateQueries({ queryKey: ['knowledge', 'docs'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const searchMut = useMutation({
    mutationFn: () =>
      searchKnowledge({
        query: search.query,
        collectionName: search.collectionName || undefined,
        topK: search.topK,
        scoreThreshold: search.scoreThreshold,
        ownerUuid: owner,
      }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteKnowledgeDoc(id, owner),
    onSuccess: () => {
      toast.success('已删除')
      qc.invalidateQueries({ queryKey: ['knowledge', 'docs'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const batchDeleteMut = useMutation({
    mutationFn: (ids: number[]) => batchDeleteKnowledgeDocs(ids, owner),
    onSuccess: (r) => {
      toast.success(`已删除 ${r.success.length} 个,失败 ${r.failed.length} 个`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['knowledge', 'docs'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function viewChunks(docId: number) {
    setChunksOpen(true)
    setChunksLoading(true)
    setChunks([])
    try {
      const r = await getKnowledgeDocChunks(docId, owner, 20)
      setChunks(r)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setChunksLoading(false)
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submitIngest(e: React.FormEvent) {
    e.preventDefault()
    if (!ingest.title.trim() || !ingest.text.trim()) {
      toast.error('标题和正文必填')
      return
    }
    ingestMut.mutate()
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!search.query.trim()) {
      toast.error('请输入检索词')
      return
    }
    searchMut.mutate()
  }

  const docs = docsQ.data ?? []
  const hits = searchMut.data ?? []
  const health = healthQ.data
  const healthOk = health?.status === 'ok'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BookOpen className="h-6 w-6 text-primary" /> RAG 知识库
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DashScope Embedding + 文本切片 + 语义检索
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              healthQ.refetch()
              docsQ.refetch()
            }}
          >
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
          <Button size="sm" onClick={() => setIngestOpen(true)}>
            <Plus className="h-4 w-4" /> 文本入库
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          {healthOk ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          )}
          <div>
            <p className="text-sm font-semibold">{healthOk ? '服务正常' : '检查中...'}</p>
            <p className="text-xs text-muted-foreground">{health?.status ?? '?'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <Database className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">{docs.length} 文档</p>
            <p className="text-xs text-muted-foreground">当前 owner</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <FileText className="h-5 w-5 text-sky-600" />
          <div>
            <p className="text-sm font-semibold">
              {docs.reduce((s, d) => s + d.chunkCount, 0)} 切片
            </p>
            <p className="text-xs text-muted-foreground">总块数</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
        <Label htmlFor="owner" className="text-xs">
          Owner
        </Label>
        <Input
          id="owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="h-8 w-40"
          placeholder="owner uuid"
        />
        <span className="ml-auto text-xs text-muted-foreground">切换 owner 后自动刷新文档列表</span>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-medium">文档列表</p>
          {selected.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => batchDeleteMut.mutate(Array.from(selected))}
              disabled={batchDeleteMut.isPending}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> 批量删除 ({selected.size})
            </Button>
          )}
        </div>
        {docsQ.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
          </div>
        ) : docs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            暂无文档,点击「文本入库」开始
          </div>
        ) : (
          <div className="divide-y">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggleSelect(d.id)}
                  className="h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {d.sourceType}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {d.chunkCount} 块
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    #{d.id} · {fmtTime(d.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => viewChunks(d.id)}>
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`确认删除「${d.title}」?`)) deleteMut.mutate(d.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Search className="h-4 w-4" /> 检索测试
          </p>
        </div>
        <form onSubmit={submitSearch} className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label htmlFor="query" className="text-xs">
                检索词 *
              </Label>
              <Input
                id="query"
                required
                value={search.query}
                onChange={(e) => setSearch({ ...search, query: e.target.value })}
                placeholder="例如:如何使用 RAG?"
              />
            </div>
            <div>
              <Label htmlFor="collectionName" className="text-xs">
                集合
              </Label>
              <Input
                id="collectionName"
                value={search.collectionName}
                onChange={(e) => setSearch({ ...search, collectionName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="topK" className="text-xs">
                Top K
              </Label>
              <Input
                id="topK"
                type="number"
                min={1}
                max={20}
                value={search.topK}
                onChange={(e) => setSearch({ ...search, topK: Number(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="scoreThreshold" className="text-xs">
              分数阈值
            </Label>
            <input
              id="scoreThreshold"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={search.scoreThreshold}
              onChange={(e) => setSearch({ ...search, scoreThreshold: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="w-12 text-right text-xs text-muted-foreground">
              {search.scoreThreshold.toFixed(2)}
            </span>
            <Button type="submit" size="sm" disabled={searchMut.isPending}>
              {searchMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1 h-4 w-4" />
              )}
              检索
            </Button>
          </div>
        </form>

        {hits.length > 0 && (
          <div className="divide-y border-t">
            {hits.map((h) => (
              <div key={h.id} className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    doc #{h.docId} · chunk #{h.chunkIndex}
                  </span>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
                    {fmtScore(h.score)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{h.content}</p>
              </div>
            ))}
          </div>
        )}
        {searchMut.isError && (
          <div className="border-t p-3">
            <Alert
              variant="danger"
              title="检索失败"
              description={(searchMut.error as Error).message}
            />
          </div>
        )}
      </div>

      <Dialog open={ingestOpen} onOpenChange={(v) => !ingestMut.isPending && setIngestOpen(v)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>文本入库</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitIngest} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ingest-title">标题 *</Label>
                <Input
                  id="ingest-title"
                  required
                  value={ingest.title}
                  onChange={(e) => setIngest({ ...ingest, title: e.target.value })}
                  placeholder="文档标题"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ingest-owner">Owner UUID</Label>
                <Input
                  id="ingest-owner"
                  value={ingest.ownerUuid}
                  onChange={(e) => setIngest({ ...ingest, ownerUuid: e.target.value })}
                  placeholder="留空使用上方 owner"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ingest-collection">集合</Label>
              <Input
                id="ingest-collection"
                value={ingest.collectionName}
                onChange={(e) => setIngest({ ...ingest, collectionName: e.target.value })}
                placeholder="default"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ingest-text">正文 *</Label>
              <textarea
                id="ingest-text"
                required
                rows={8}
                value={ingest.text}
                onChange={(e) => setIngest({ ...ingest, text: e.target.value })}
                placeholder="粘贴需要入库的文本内容(500 字符一切片,50 字符重叠)"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => !ingestMut.isPending && setIngestOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={ingestMut.isPending}>
                {ingestMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                入库
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={chunksOpen} onOpenChange={setChunksOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>切片预览(最多 20 条)</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {chunksLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
              </div>
            ) : chunks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无切片</p>
            ) : (
              <div className="space-y-2">
                {chunks.map((c) => (
                  <div key={c.id} className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">chunk #{c.chunkIndex}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
