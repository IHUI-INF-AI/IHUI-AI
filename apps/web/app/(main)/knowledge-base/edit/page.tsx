'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, Loader2, Send, X } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface KBCategory {
  id: string
  name: string
}

interface KBForm {
  title: string
  summary: string
  content: string
  categoryId: string
  tags: string[]
}

const EMPTY_FORM: KBForm = {
  title: '',
  summary: '',
  content: '',
  categoryId: '',
  tags: [],
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KBEditPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const [form, setForm] = React.useState<KBForm>(EMPTY_FORM)
  const [tagInput, setTagInput] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['kb', 'categories'],
    queryFn: () =>
      api<{ list: KBCategory[] }>(`/api/knowledge-base/categories`).then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        content: form.content,
        categoryId: form.categoryId || undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
      }
      return api(`/api/knowledge-base`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      router.push('/knowledge-base')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm({ ...form, tags: [...form.tags, t] })
    }
    setTagInput('')
  }

  function removeTag(t: string) {
    setForm({ ...form, tags: form.tags.filter((x) => x !== t) })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) {
      setErr('请输入标题')
      return
    }
    if (!form.content.trim()) {
      setErr('请输入内容')
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Edit className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">新建知识库文章</h1>
        </div>
        <p className="text-sm text-muted-foreground">撰写新的知识库文章并发布</p>
      </header>

      <Link
        href="/knowledge-base"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">文章信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="kb-title">标题</Label>
              <Input
                id="kb-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="输入文章标题"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-summary">摘要</Label>
              <Input
                id="kb-summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="一句话描述文章内容"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-category">分类</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v })}
              >
                <SelectTrigger className={selectClass} id="kb-category">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-tags">标签</Label>
              <div className="flex gap-2">
                <Input
                  id="kb-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="输入标签后回车"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  添加
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-content">正文(Markdown)</Label>
              <textarea
                id="kb-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={14}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="支持 Markdown 语法..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/knowledge-base')}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                发布
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
