// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
// 运营控制台通用 CRUD 资源 hook + 表单 Dialog(2026-09-17 立,4-4-12)。
// 服务对象:admin 下「单表列表管理页」(lottery / points-mall / promotion-rule / tax)。
// 设计原则:一处实现、各页声明式配置字段,避免四份重复的查询/分页/表单/删除样板。
// 后端契约:registerCrud 统一形态 —— GET list(search 分页) / POST / PUT :id / DELETE :id。

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { confirmDialog } from '@/components/feedback'

export interface CrudField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'datetime'
  options?: Array<{ value: string; label: string }>
  placeholder?: string
}

interface CrudListResp<T> {
  list: T[]
  total: number
}

const PAGE_SIZE = 10

/** 单表管理资源:列表(搜索+分页) + 新增/编辑 + 删除 */
export function useCrudResource<T extends { id: string }>(opts: {
  basePath: string
  queryKey: unknown[]
  /** 列表搜索参数名(默认 search;后端如用 word/keyword 等在此指定) */
  searchParam?: string
  /** 提交前对表单值做转换(类型矫正/JSON 包装等) */
  transform?: (values: Record<string, unknown>) => Record<string, unknown>
  /** 保存成功回调(用于 toast,mode 区分新增/编辑) */
  onSaved?: (mode: 'create' | 'edit') => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [dialog, setDialog] = React.useState<{ mode: 'create' | 'edit'; row?: T } | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  const query = useQuery({
    queryKey: [...opts.queryKey, 'list', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search.trim()) qs.set(opts.searchParam ?? 'search', search.trim())
      const r = await fetchApi<CrudListResp<T>>(`${opts.basePath}?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: opts.queryKey })

  const saveMut = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const row = dialog?.mode === 'edit' ? dialog.row : null
      const url = row ? `${opts.basePath}/${row.id}` : opts.basePath
      const payload = opts.transform ? opts.transform(values) : values
      return fetchApi(url, { method: row ? 'PUT' : 'POST', body: JSON.stringify(payload) })
    },
    onSuccess: (r) => {
      if (!r.success) {
        setErr(r.error)
        return
      }
      const mode = dialog?.mode ?? 'create'
      setErr(null)
      setDialog(null)
      invalidate()
      opts.onSaved?.(mode)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const removeMut = useMutation({
    mutationFn: async (id: string) => fetchApi(`${opts.basePath}/${id}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      if (!r.success) setErr(r.error)
      else invalidate()
    },
  })

  const remove = async (id: string) => {
    const ok = await confirmDialog({ title: '确认删除该条记录?删除后不可恢复' })
    if (ok) removeMut.mutate(id)
  }

  return {
    list: query.data?.list ?? [],
    total: query.data?.total ?? 0,
    totalPages: Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE)),
    isLoading: query.isLoading,
    search,
    setSearch: (v: string) => {
      setSearch(v)
      setPage(1)
    },
    page,
    setPage,
    dialog,
    openCreate: () => setDialog({ mode: 'create' }),
    openEdit: (row: T) => setDialog({ mode: 'edit', row }),
    closeDialog: () => setDialog(null),
    save: (values: Record<string, unknown>) => saveMut.mutate(values),
    saving: saveMut.isPending,
    remove,
    err,
    clearErr: () => setErr(null),
  }
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const inputCls = 'h-9 w-full'

/** 声明式表单 Dialog:文本 / 数字 / 下拉 / 日期时间,编辑时按 initial 预填 */
export function CrudFormDialog(props: {
  open: boolean
  mode: 'create' | 'edit'
  title: string
  fields: CrudField[]
  initial?: object | null
  pending: boolean
  err: string | null
  onSubmit: (values: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [values, setValues] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (!props.open) return
    const init: Record<string, string> = {}
    for (const f of props.fields) {
      const src = props.initial as Record<string, unknown> | null | undefined
      const v = src ? src[f.key] : undefined
      if (f.type === 'datetime') {
        const d = typeof v === 'string' || v instanceof Date ? new Date(v as string) : null
        init[f.key] = v && d && !isNaN(d.getTime()) ? toLocalInput(d) : ''
      } else {
        init[f.key] = v === null || v === undefined ? '' : String(v)
      }
      // select 无值时默认选第一项,避免空字符串提交
      if (f.type === 'select' && !init[f.key] && f.options?.length) {
        init[f.key] = f.options[0]!.value
      }
    }
    setValues(init)
    // 仅在打开/切换编辑对象时重置表单
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.mode, props.initial])

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  const submit = () => {
    const out: Record<string, unknown> = {}
    for (const f of props.fields) {
      const raw = values[f.key] ?? ''
      if (f.type === 'number') out[f.key] = raw === '' ? 0 : Number(raw)
      else if (f.type === 'datetime') out[f.key] = raw || null
      else out[f.key] = raw === '' ? null : raw
    }
    props.onSubmit(out)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) props.onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {props.fields.map((f) => (
            <label key={f.key} className="block space-y-1">
              <span className="text-sm text-muted-foreground">{f.label}</span>
              {f.type === 'select' ? (
                <Select value={values[f.key] ?? ''} onValueChange={(v) => set(f.key, v)}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder={f.placeholder ?? '请选择'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === 'datetime' ? (
                <Input
                  type="datetime-local"
                  className={inputCls}
                  value={values[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <Input
                  type={f.type === 'number' ? 'number' : 'text'}
                  className={inputCls}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
          {props.err ? <p className="text-sm text-rose-600">{props.err}</p> : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={props.onClose} disabled={props.pending}>
            取消
          </Button>
          <Button size="sm" onClick={submit} disabled={props.pending}>
            {props.pending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
