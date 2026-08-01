'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common/Toaster'
import { toUserFriendlyMessage } from '@ihui/shared'

import { adminApi, ADMIN_PAGE_SIZE, buildAdminQs } from '@/lib/admin/api'
import { pushError } from '@/stores/error-banner'
import type { PageData } from '@ihui/api-client'

/**
 * CRUD 列表配置 — 各 admin 页面通过此配置注入差异。
 */
export interface CrudListConfig<T, TForm> {
  /** API 基础路径,如 '/api/admin/carousel' */
  basePath: string
  /** React Query key 前缀,如 'carousel' → ['admin', 'carousel', ...] */
  queryKeyBase: string
  /** 搜索查询参数名,如 'title' → ?title=xxx;不传则不搜索 */
  searchParam?: string
  /** 每页条数,默认 10 */
  pageSize?: number
  /** 防抖延迟(ms),默认 300 */
  debounceMs?: number
  /** i18n 命名空间,如 'admin.carousel' */
  i18nNamespace: string
  /** 空表单初始值 */
  emptyForm: TForm
  /** entity → form 转换 */
  toForm: (item: T) => TForm
  /** form → 请求 body 转换 */
  toBody: (form: TForm, editing: T | null) => Record<string, unknown>
  /** 表单验证,返回错误消息或 null */
  validate?: (form: TForm) => string | null
  /** 额外查询参数 */
  extraQuery?: Record<string, string | undefined>
}

/**
 * CRUD 列表 Hook — 封装 admin 页面通用的状态管理 + 数据获取 + 增删改。
 *
 * 消除 ~100 个 admin page.tsx 中重复的:
 * - search/debounced/page/open/editing/form/err 状态声明
 * - debounce useEffect
 * - useQuery 列表查询
 * - useMutation 保存(create/update)
 * - useMutation 删除
 * - openCreate/openEdit/closeDialog/submit/handleDelete 函数
 */
export function useCrudList<T extends { id: string }, TForm>(
  config: CrudListConfig<T, TForm>,
) {
  const {
    basePath,
    queryKeyBase,
    searchParam,
    pageSize = ADMIN_PAGE_SIZE,
    debounceMs = 300,
    i18nNamespace,
    emptyForm,
    toForm,
    toBody,
    validate,
    extraQuery,
  } = config

  const t = useTranslations(i18nNamespace)
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<T | null>(null)
  const [form, setForm] = React.useState<TForm>(emptyForm)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, debounceMs)
    return () => clearTimeout(tm)
  }, [search, debounceMs])

  const queryKey = React.useMemo(
    () => ['admin', queryKeyBase, debounced, page, extraQuery] as const,
    [queryKeyBase, debounced, page, extraQuery],
  )

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const qs = buildAdminQs({
        page,
        pageSize,
        search: debounced,
        searchParam,
        extra: extraQuery,
      })
      return adminApi<PageData<T>>(`${basePath}?${qs}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = toBody(form, editing)
      return editing
        ? adminApi(`${basePath}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : adminApi(basePath, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', queryKeyBase] })
      closeDialog()
    },
    onError: (e: Error) => setErr(toUserFriendlyMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi(`${basePath}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', queryKeyBase] })
    },
    onError: (e: Error) => pushError(e),
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: T) {
    setEditing(item)
    setForm(toForm(item))
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    setErr(null)
    if (validate) {
      const v = validate(form)
      if (v) {
        setErr(v)
        return
      }
    }
    saveMut.mutate()
  }
  function handleDelete(item: T) {
    const name = String((item as Record<string, unknown>).name ?? item.id)
    if (!window.confirm(t('deleteConfirm', { name }))) return
    deleteMut.mutate(item.id)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    // i18n
    t,
    // list state
    list,
    total,
    totalPages,
    isLoading,
    page,
    setPage,
    // search state
    search,
    setSearch,
    // dialog state
    open,
    editing,
    form,
    setForm,
    err,
    savePending: saveMut.isPending,
    // actions
    openCreate,
    openEdit,
    closeDialog,
    submit,
    handleDelete,
    deletePending: deleteMut.isPending,
    // raw mutations for advanced use
    saveMut,
    deleteMut,
    // query invalidation
    invalidate: () => qc.invalidateQueries({ queryKey: ['admin', queryKeyBase] }),
  }
}

export type CrudListResult<T extends { id: string }, TForm> = ReturnType<typeof useCrudList<T, TForm>>
