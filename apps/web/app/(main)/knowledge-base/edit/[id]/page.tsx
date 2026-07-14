'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, Loader2, Save, X } from 'lucide-react'

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
interface KBArticle {
  id: string
  title: string
  summary?: string | null
  content: string
  categoryId?: string | null
  tags?: string[]
}
interface KBForm {
  title: string
  summary: string
  content: string
  categoryId: string
  tags: string[]
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KBEditByIdPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [form, setForm] = React.useState<KBForm>({
    title: '',
    summary: '',
    content: '',
    categoryId: '',
    tags: [],
  })
  const [tagInput, setTagInput] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  const { data: categories = [] } = useQuery({
    queryKey: ['kb', 'categories'],
    queryFn: () =>
      api<{ list: KBCategory[] }>(`/api/knowledge-base/categories`).then((d) => d.list ?? []),
  })
  const { data, isLoading, error } = useQuery({
    queryKey: ['kb', 'detail', id],
    queryFn: () => api<{ article: KBArticle }>(`/api/knowledge-base/${id}`),
  })

  React.useEffect(() => {
    if (data && !loaded) {
      const a = data.article
      setForm({
        title: a.title,
        summary: a.summary ?? '',
        content: a.content,
        categoryId: a.categoryId ?? '',
        tags: a.tags ?? [],
      })
      setLoaded(true)
    }
  }, [data, loaded])

  const saveMut = useMutation({
    mutationFn: () =>
      api(`/api/knowledge-base/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim() || undefined,
          content: form.content,
          categoryId: form.categoryId || undefined,
          tags: form.tags.length > 0 ? form.tags : undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      router.push(`/knowledge-base/${id}`)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) return setErr('请输入标题')
    if (!form.content.trim()) return setErr('请输入内容')
    saveMut.mutate()
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t] })
    setTagInput('')
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href="/knowledge-base"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '文章不存在'}
        </div>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Edit className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">编辑文章</h1>
        </div>
        <p className="text-sm text-muted-foreground">修改知识库文章内容</p>
      </header>

      <Link
        href={`/knowledge-base/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回文章
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

            <div className="grid gap-4 sm:grid-cols-2">
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
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, tags: form.tags.filter((x) => x !== tag) })
                        }
                      >
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
                onClick={() => router.push(`/knowledge-base/${id}`)}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                保存
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
