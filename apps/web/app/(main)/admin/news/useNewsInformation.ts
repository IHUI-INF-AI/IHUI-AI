'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  api,
  EMPTY_INFO,
  INFO_PAGE_SIZE,
  type InfoData,
  type InfoForm,
  type Information,
} from './types'

export function useNewsInformation(enabled: boolean) {
  const qc = useQueryClient()

  const [infoSearch, setInfoSearch] = React.useState({
    title: '',
    url: '',
    sourceName: '',
    sourceUrl: '',
    sourceCreator: '',
    sourceTime: '',
    insertTime: '',
    browse: '',
  })
  const [infoDebounced, setInfoDebounced] = React.useState(infoSearch)
  const [infoPage, setInfoPage] = React.useState(1)
  const [infoOpen, setInfoOpen] = React.useState(false)
  const [editingInfo, setEditingInfo] = React.useState<Information | null>(null)
  const [infoForm, setInfoForm] = React.useState<InfoForm>(EMPTY_INFO)
  const [infoErr, setInfoErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setInfoDebounced(infoSearch)
      setInfoPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [infoSearch])

  const infoQs = React.useMemo(() => {
    const qs = new URLSearchParams({
      page: String(infoPage),
      pageSize: String(INFO_PAGE_SIZE),
    })
    if (infoDebounced.title) qs.set('title', infoDebounced.title)
    if (infoDebounced.url) qs.set('url', infoDebounced.url)
    if (infoDebounced.sourceName) qs.set('sourceName', infoDebounced.sourceName)
    if (infoDebounced.sourceUrl) qs.set('sourceUrl', infoDebounced.sourceUrl)
    if (infoDebounced.sourceCreator) qs.set('sourceCreator', infoDebounced.sourceCreator)
    if (infoDebounced.sourceTime) qs.set('sourceTime', infoDebounced.sourceTime)
    if (infoDebounced.insertTime) qs.set('insertTime', infoDebounced.insertTime)
    if (infoDebounced.browse) qs.set('browse', infoDebounced.browse)
    return qs.toString()
  }, [infoDebounced, infoPage])

  const {
    data: infoData,
    isLoading: infoLoading,
    error: infoError,
  } = useQuery({
    queryKey: ['admin', 'news', 'information', infoDebounced, infoPage],
    queryFn: () => api<InfoData>(`/api/admin/news/information?${infoQs}`),
    enabled,
  })

  const saveInfoMut = useMutation({
    mutationFn: () => {
      const body = {
        title: infoForm.title.trim(),
        content: infoForm.content,
        type: infoForm.type.trim() || undefined,
        url: infoForm.url.trim() || undefined,
        sourceName: infoForm.sourceName.trim() || undefined,
        sourceUrl: infoForm.sourceUrl.trim() || undefined,
        sourceCreator: infoForm.sourceCreator.trim() || undefined,
        sourceTime: infoForm.sourceTime || undefined,
        insertTime: infoForm.insertTime || undefined,
        browse: Number(infoForm.browse) || 0,
        creator: infoForm.creator.trim() || undefined,
        crearedTime: infoForm.crearedTime || undefined,
      }
      if (editingInfo) {
        return api(`/api/admin/news/information/${editingInfo.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api(`/api/admin/news/information`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editingInfo ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'information'] })
      closeInfoDialog()
    },
    onError: (e: Error) => setInfoErr(e.message),
  })

  const deleteInfoMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/news/information/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'information'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreateInfo() {
    setEditingInfo(null)
    setInfoForm(EMPTY_INFO)
    setInfoErr(null)
    setInfoOpen(true)
  }

  function openEditInfo(info: Information) {
    setEditingInfo(info)
    setInfoForm({
      title: info.title ?? '',
      type: info.type ?? '',
      url: info.url ?? '',
      sourceName: info.sourceName ?? '',
      sourceUrl: info.sourceUrl ?? '',
      sourceCreator: info.sourceCreator ?? '',
      sourceTime: info.sourceTime ?? '',
      insertTime: info.insertTime ?? '',
      browse: info.browse !== null && info.browse !== undefined ? String(info.browse) : '0',
      creator: info.creator ?? '',
      crearedTime: info.crearedTime ?? '',
      content: info.content ?? '',
    })
    setInfoErr(null)
    setInfoOpen(true)
  }

  function closeInfoDialog() {
    if (saveInfoMut.isPending) return
    setInfoOpen(false)
    setEditingInfo(null)
    setInfoErr(null)
  }

  function submitInfo(e: React.FormEvent) {
    e.preventDefault()
    setInfoErr(null)
    if (!infoForm.title.trim()) {
      setInfoErr('请输入标题')
      return
    }
    saveInfoMut.mutate()
  }

  function handleDeleteInfo(info: Information) {
    if (!window.confirm(`确认删除信息 "${info.title}" 吗?`)) return
    deleteInfoMut.mutate(info.id)
  }

  const infoTotal = infoData?.total ?? 0
  const infoTotalPages = Math.max(1, Math.ceil(infoTotal / INFO_PAGE_SIZE))
  const infoList = infoData?.list ?? []

  const hasInfoSearch =
    infoSearch.title ||
    infoSearch.url ||
    infoSearch.sourceName ||
    infoSearch.sourceUrl ||
    infoSearch.sourceCreator ||
    infoSearch.sourceTime ||
    infoSearch.insertTime ||
    infoSearch.browse

  return {
    infoSearch,
    setInfoSearch,
    infoPage,
    setInfoPage,
    infoTotal,
    infoTotalPages,
    infoList,
    infoLoading,
    infoError,
    infoOpen,
    setInfoOpen,
    editingInfo,
    infoForm,
    setInfoForm,
    infoErr,
    saveInfoMut,
    deleteInfoMut,
    hasInfoSearch,
    openCreateInfo,
    openEditInfo,
    closeInfoDialog,
    submitInfo,
    handleDeleteInfo,
  }
}
