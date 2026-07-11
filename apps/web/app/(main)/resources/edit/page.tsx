'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Upload, FileText, X } from 'lucide-react'

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

interface Category {
  id: string
  name: string
}
interface ResourceDetail {
  id?: string
  title: string
  description: string
  categoryId: string
  url?: string
  fileName?: string
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ResourceEditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [fileUrl, setFileUrl] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  const { data: categories } = useQuery({
    queryKey: ['resources', 'categories'],
    queryFn: () => api<{ list: Category[] }>(`/api/resources/categories`).then((d) => d.list ?? []),
  })

  // 编辑模式：加载已有资源
  const { isLoading: loadingDetail } = useQuery({
    queryKey: ['resource', 'edit', id],
    queryFn: async () => {
      if (!id) return null
      const r = await fetchApi<ResourceDetail>(`/api/resources/${id}`)
      if (!r.success) return null
      const d = r.data
      setTitle(d.title ?? '')
      setDescription(d.description ?? '')
      setCategoryId(d.categoryId ?? '')
      setFileUrl(d.url ?? '')
      setFileName(d.fileName ?? d.title ?? '')
      return d
    },
    enabled: !!id,
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      setFormError(null)
      if (!title.trim()) {
        setFormError('请输入标题')
        throw new Error('请输入标题')
      }
      if (!categoryId) {
        setFormError('请选择分类')
        throw new Error('请选择分类')
      }

      const body = {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        url: fileUrl,
        fileName: fileName || file?.name,
      }

      if (id) {
        return api(`/api/resource/${id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api(`/api/resource`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => router.push('/resources'),
  })

  const uploadMut = useMutation({
    mutationFn: async (f: File) => {
      const formData = new FormData()
      formData.append('file', f)
      const r = await fetchApi<{ url: string }>(`/api/oss/resource/file`, {
        method: 'POST',
        body: formData,
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      setFileUrl(d.url)
      setFileName(file?.name ?? '')
    },
  })

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileName(f.name)
    uploadMut.mutate(f)
  }

  const onRemoveFile = () => {
    setFile(null)
    setFileName('')
    setFileUrl('')
  }

  if (id && loadingDetail)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/resources"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回资源列表
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{id ? '编辑资源' : '发布资源'}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">资源信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入资源标题"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入资源描述"
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label>分类</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className={selectClass} aria-label="分类">
                <SelectValue placeholder="请选择分类" />
              </SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>文件上传</Label>
            {fileName ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  {fileName}
                </span>
                <button
                  type="button"
                  onClick={onRemoveFile}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="移除文件"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-6 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-primary">
                <Upload className="h-5 w-5" />
                {uploadMut.isPending ? '上传中...' : '点击上传文件'}
                <input
                  type="file"
                  className="hidden"
                  onChange={onFileChange}
                  disabled={uploadMut.isPending}
                />
              </label>
            )}
            {uploadMut.isError && (
              <p className="text-xs text-destructive">{(uploadMut.error as Error)?.message}</p>
            )}
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}
          {saveMut.isError && !formError && (
            <p className="text-sm text-destructive">{(saveMut.error as Error)?.message}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {id ? '保存修改' : '发布资源'}
            </Button>
            <Button variant="outline" onClick={() => router.push('/resources')}>
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
