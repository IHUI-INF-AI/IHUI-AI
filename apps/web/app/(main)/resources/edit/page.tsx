'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { ResourceForm } from './ResourceForm'
import { api } from './helpers'
import type { Category, ResourceDetail } from './types'

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

      <ResourceForm
        title={title}
        setTitle={setTitle}
        description={description}
        setDescription={setDescription}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        categories={categories ?? []}
        fileName={fileName}
        uploadPending={uploadMut.isPending}
        uploadIsError={uploadMut.isError}
        uploadError={uploadMut.error}
        formError={formError}
        savePending={saveMut.isPending}
        saveIsError={saveMut.isError}
        saveError={saveMut.error}
        onFileChange={onFileChange}
        onRemoveFile={onRemoveFile}
        onSubmit={() => saveMut.mutate()}
        onCancel={() => router.push('/resources')}
        isEdit={!!id}
      />
    </div>
  )
}
