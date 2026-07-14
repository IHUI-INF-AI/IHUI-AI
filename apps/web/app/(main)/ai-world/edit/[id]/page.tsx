'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface AiWorldItem {
  id: string
  categoryId: string | null
  title: string
  content: string | null
  coverImage: string | null
  config?: string | null
}

interface Category {
  id: string
  name: string
}

interface CategoriesData {
  list: Category[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AiWorldEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const { data: world, isLoading } = useQuery({
    queryKey: ['ai-world', 'detail', params.id],
    queryFn: () => api<{ world: AiWorldItem }>(`/api/ai-world/${params.id}`).then((d) => d.world),
    enabled: !!params.id,
  })

  const { data: catData } = useQuery({
    queryKey: ['ai-world', 'categories'],
    queryFn: () => api<CategoriesData>('/api/ai-world/categories'),
  })

  const [form, setForm] = React.useState({
    name: '',
    description: '',
    categoryId: '',
    coverImage: '',
    config: '',
  })
  const [err, setErr] = React.useState<string | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (world && !hydrated) {
      setForm({
        name: world.title ?? '',
        description: world.content ?? '',
        categoryId: world.categoryId ?? '',
        coverImage: world.coverImage ?? '',
        config: world.config ?? '',
      })
      setHydrated(true)
    }
  }, [world, hydrated])

  const updateMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.name.trim(),
        content: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
        coverImage: form.coverImage.trim() || undefined,
        config: form.config.trim() || undefined,
      }
      return api<unknown>(`/api/ai-world/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success('更新成功')
      router.push(`/ai-world/${params.id}`)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr('请输入名称')
      return
    }
    updateMut.mutate()
  }

  const categories = catData?.list ?? []
  const inputClass =
    'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push(`/ai-world/${params.id}`)}>
        <ArrowLeft className="h-4 w-4" />
        返回
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">编辑 AI 世界项目</h1>
        <p className="mt-1 text-sm text-muted-foreground">修改项目信息</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="aw-name">
                名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aw-name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="请输入项目名称"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aw-desc">描述</Label>
              <textarea
                id="aw-desc"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="请输入项目描述"
                rows={4}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aw-cat">分类</Label>
              <select
                id="aw-cat"
                value={form.categoryId}
                onChange={(e) => update('categoryId', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">不选择分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aw-cover">封面链接</Label>
              <Input
                id="aw-cover"
                value={form.coverImage}
                onChange={(e) => update('coverImage', e.target.value)}
                placeholder="请输入封面图片 URL"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aw-config">配置</Label>
              <textarea
                id="aw-config"
                value={form.config}
                onChange={(e) => update('config', e.target.value)}
                placeholder="JSON 配置(可选)"
                rows={3}
                className={`${inputClass} font-mono`}
              />
            </div>
          </CardContent>
        </Card>

        {err && <Alert variant="danger" description={err} />}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/ai-world/${params.id}`)}
            disabled={updateMut.isPending}
          >
            取消
          </Button>
          <Button type="submit" disabled={updateMut.isPending}>
            {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {updateMut.isPending ? '提交中...' : '保存'}
          </Button>
        </div>
      </form>
    </div>
  )
}
