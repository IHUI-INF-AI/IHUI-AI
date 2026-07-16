'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { ResourceForm } from './ResourceForm'
import { api, parseIdList, toIdListString } from './helpers'
import type { Category, ResourceDetail, ResourceType } from './types'

export default function ResourceEditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [cidList, setCidList] = React.useState('')
  const [type, setType] = React.useState<ResourceType>('other')
  const [productId, setProductId] = React.useState('')
  const [tagIdList, setTagIdList] = React.useState('')
  const [image, setImage] = React.useState('')
  const [introduction, setIntroduction] = React.useState('')
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
      setCidList(d.cidList ? toIdListString(d.cidList) : (d.categoryId ?? ''))
      setType((d.type ?? 'other') as ResourceType)
      setProductId(d.productId ?? '')
      setTagIdList(toIdListString(d.tagIdList))
      setImage(d.image ?? '')
      setIntroduction(d.introduction ?? '')
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
      if (!type) {
        setFormError('请选择资源类型')
        throw new Error('请选择资源类型')
      }
      if (!productId.trim()) {
        setFormError('请输入产品 ID')
        throw new Error('请输入产品 ID')
      }
      if (!introduction.trim()) {
        setFormError('请输入资源简介')
        throw new Error('请输入资源简介')
      }
      const cidArr = parseIdList(cidList)
      if (cidArr.length === 0) {
        setFormError('请至少选择一个分类')
        throw new Error('请至少选择一个分类')
      }

      // 后端 createResourceSchema/updateResourceSchema 仅支持:
      // title/coverImage/intro/categoryId(单)/fileUrl/fileType/fileSize/isPublished/sort/status
      // TODO(后端): 支持 type / productId / tagIdList / image / introduction / cidList(多)
      // 未支持字段暂随 body 发送,Zod 会 strip,需后端扩展 schema 后方可持久化
      const body = {
        title: title.trim(),
        description: description.trim(),
        // TODO(后端): cidList 多选 — 当前仅取首个映射 categoryId
        categoryId: cidArr[0],
        cidList: cidArr,
        url: fileUrl,
        fileName: fileName || file?.name,
        // TODO(后端): type 字段待支持
        type,
        // TODO(后端): productId 字段待支持
        productId: productId.trim(),
        // TODO(后端): tagIdList 字段待支持
        tagIdList: parseIdList(tagIdList),
        // TODO(后端): image 字段待支持(可映射 coverImage)
        image,
        // TODO(后端): introduction 字段待支持(可映射 intro)
        introduction,
      }

      // 创建/更新走 admin 路由(POST/PUT 仅注册在 /api/admin/resources)
      if (id) {
        return api(`/api/admin/resources/${id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api(`/api/admin/resources`, {
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
        cidList={cidList}
        setCidList={setCidList}
        categories={categories ?? []}
        type={type}
        setType={setType}
        productId={productId}
        setProductId={setProductId}
        tagIdList={tagIdList}
        setTagIdList={setTagIdList}
        image={image}
        setImage={setImage}
        introduction={introduction}
        setIntroduction={setIntroduction}
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
