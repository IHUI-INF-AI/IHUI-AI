// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库文档：入库、列出、检索、删除。
 */

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Loader2, Search, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatKnowledgeDocView, WechatKnowledgeHit } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

function DocRow({
  doc,
  deleting,
  onDelete,
}: {
  doc: WechatKnowledgeDocView
  deleting: boolean
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-stroke-subtle px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-body font-medium">{doc.title}</p>
        <p className="font-[weight:inherit] text-label text-muted-foreground">
          {doc.chunkCount} 个切片
          {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleString()}` : ''}
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onDelete} disabled={deleting}>
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export default function KnowledgeDocsCard({ accountId }: { accountId: string }) {
  const qc = useQueryClient()
  const [title, setTitle] = React.useState('')
  const [text, setText] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [hits, setHits] = React.useState<WechatKnowledgeHit[] | null>(null)

  const docsQuery = useQuery({
    queryKey: ['wechat-hub', 'knowledge', accountId],
    queryFn: () => wechatHubApi.knowledge(accountId),
  })
  const docs = docsQuery.data ?? []

  const ingestMutation = useMutation({
    mutationFn: () => wechatHubApi.ingestKnowledge(accountId, { title: title.trim(), text }),
    onSuccess: () => {
      setTitle('')
      setText('')
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'knowledge', accountId] })
    },
  })
  const searchMutation = useMutation({
    mutationFn: () => wechatHubApi.searchKnowledge(accountId, query.trim(), 5),
    onSuccess: (data) => setHits(data),
  })
  const deleteMutation = useMutation({
    mutationFn: (docId: number) => wechatHubApi.deleteKnowledge(accountId, docId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'knowledge', accountId] })
    },
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body">
          <BookOpen className="h-4 w-4" />
          <span>知识库</span>
        </CardTitle>
        <CardDescription>
          按账号隔离 collection，复用站内 RAG 切片与检索；自动回复写
          <code className="mx-1 rounded-md bg-muted px-1">{'{{knowledge}}'}</code>
          时会检索这里的前 3 条。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="wechat-kb-title">文档标题</Label>
          <Input
            id="wechat-kb-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：2026 年报价单 / 售后政策"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wechat-kb-text">正文</Label>
          <textarea
            id="wechat-kb-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="font-[weight:inherit] w-full rounded-md border border-stroke-field bg-transparent px-3 py-2 text-body outline-none focus:border-stroke-focus"
            placeholder="粘贴制度、价格表、FAQ；入库后按切片检索。"
          />
          <p className="font-[weight:inherit] text-label text-muted-foreground">{text.length} / 200000</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => ingestMutation.mutate()}
            disabled={ingestMutation.isPending || !title.trim() || !text.trim()}
          >
            {ingestMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            <span>入库</span>
          </Button>
          {ingestMutation.data ? (
            <span className="font-[weight:inherit] text-label text-muted-foreground">
              已切 {ingestMutation.data.chunkCount} 片
            </span>
          ) : null}
        </div>
        {ingestMutation.isError ? (
          <Alert
            variant="danger"
            title="入库失败"
            description={
              ingestMutation.error instanceof Error ? ingestMutation.error.message : '未知错误'
            }
          />
        ) : null}

        <div className="space-y-2">
          {docsQuery.isLoading ? (
            <p className="font-[weight:inherit] text-body text-muted-foreground">加载文档…</p>
          ) : docs.length === 0 ? (
            <p className="font-[weight:inherit] text-body text-muted-foreground">还没有文档，先入库一份。</p>
          ) : (
            docs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                deleting={deleteMutation.isPending && deleteMutation.variables === doc.id}
                onDelete={() => deleteMutation.mutate(doc.id)}
              />
            ))
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 min-[700px]:grid-cols-[1fr_auto]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="用一句话检索知识库，例如：退换货多久到账"
          />
          <Button
            variant="outline"
            onClick={() => searchMutation.mutate()}
            disabled={searchMutation.isPending || !query.trim()}
          >
            {searchMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            <span>检索</span>
          </Button>
        </div>
        {hits ? (
          hits.length === 0 ? (
            <p className="font-[weight:inherit] text-body text-muted-foreground">没有命中。</p>
          ) : (
            <div className="space-y-2">
              {hits.map((hit) => (
                <div
                  key={`${hit.docId}-${hit.chunkIndex}`}
                  className="font-[weight:inherit] rounded-md border border-stroke-subtle p-3 text-body"
                >
                  <p className="whitespace-pre-wrap">{hit.content}</p>
                  <p className="font-[weight:inherit] mt-1 text-label text-muted-foreground">
                    doc {hit.docId} · 切片 {hit.chunkIndex} · score {hit.score.toFixed(3)}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
