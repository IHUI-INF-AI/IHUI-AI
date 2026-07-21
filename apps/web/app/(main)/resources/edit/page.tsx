'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { ResourceForm } from './ResourceForm'
import { api, parseIdList, toIdListString } from './helpers'
import type { Category, ResourceDetail, ResourceType } from './types'

export default function ResourceEditPage() {
  const router = useRouter()
  const t = useTranslations('resourcesEditPage')
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [title, setTitle] = React.useState('')
  const [intro, setIntro] = React.useState('')
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
      setIntro(d.intro ?? '')
      setCidList(d.cidList ? toIdListString(d.cidList) : (d.categoryId ?? ''))
      setType((d.type ?? 'other') as ResourceType)
      setProductId(d.productId ?? '')
      setTagIdList(toIdListString(d.tagIdList))
      setImage(d.image ?? '')
      setIntroduction(d.introduction ?? '')
      setFileUrl(d.fileUrl ?? '')
      setFileName(d.title ?? '')
      return d
    },
    enabled: !!id,
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      setFormError(null)
      if (!title.trim()) {
        setFormError(t('errTitleRequired'))
        throw new Error(t('errTitleRequired'))
      }
      if (!type) {
        setFormError(t('errTypeRequired'))
        throw new Error(t('errTypeRequired'))
      }
      if (!productId.trim()) {
        setFormError(t('errProductIdRequired'))
        throw new Error(t('errProductIdRequired'))
      }
      if (!introduction.trim()) {
        setFormError(t('errIntroductionRequired'))
        throw new Error(t('errIntroductionRequired'))
      }
      const cidArr = parseIdList(cidList)
      if (cidArr.length === 0) {
        setFormError(t('errCategoryRequired'))
        throw new Error(t('errCategoryRequired'))
      }

      const body = {
        title: title.trim(),
        intro: intro.trim(),
        categoryId: cidArr[0],
        cidList: cidArr,
        fileUrl,
        fileType: file?.type ?? undefined,
        type,
        productId: productId.trim(),
        tagIdList: parseIdList(tagIdList),
        image,
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
        {t('loading')}
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/resources"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{id ? t('editTitle') : t('createTitle')}</h1>

      <ResourceForm
        title={title}
        setTitle={setTitle}
        intro={intro}
        setIntro={setIntro}
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
