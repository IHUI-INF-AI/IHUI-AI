'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface Variable {
  id: string
  botId: string
  variableName: string
  variableValue: string | null
  description: string | null
  dataType: string | null
  createdAt?: string
  updatedAt?: string
}

interface VariableForm {
  botId: string
  variableName: string
  variableValue: string
  description: string
  dataType: string
}

const EMPTY: VariableForm = {
  botId: '',
  variableName: '',
  variableValue: '',
  description: '',
  dataType: 'string',
}

const DATA_TYPES = ['string', 'number', 'boolean', 'json', 'array']

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground'
const th = 'px-4 py-2.5 text-left font-medium'

export default function AdminVariablesPage() {
  const t = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Variable | null>(null)
  const [form, setForm] = React.useState<VariableForm>(EMPTY)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'coze-variables'],
    queryFn: () =>
      api<{ list: Variable[]; total: number }>('/api/coze/variables/list?pageSize=100'),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        botId: form.botId,
        variableName: form.variableName,
        variableValue: form.variableValue || null,
        description: form.description || null,
        dataType: form.dataType,
      }
      return editing
        ? api<Variable>('/api/coze/variables/update', {
            method: 'POST',
            body: JSON.stringify({ id: editing.id, ...body }),
          })
        : api<Variable>('/api/coze/variables/create', {
            method: 'POST',
            body: JSON.stringify(body),
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'coze-variables'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api<void>('/api/coze/variables/delete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'coze-variables'] })
      toast.success('删除成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: Variable) {
    setEditing(item)
    setForm({
      botId: item.botId,
      variableName: item.variableName,
      variableValue: item.variableValue ?? '',
      description: item.description ?? '',
      dataType: item.dataType ?? 'string',
    })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.botId.trim() || !form.variableName.trim()) {
      toast.error('Bot ID 和变量名为必填')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: Variable) {
    if (!confirm(`确认删除变量 "${item.variableName}"?`)) return
    deleteMut.mutate(item.id)
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">变量管理</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {isError && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">暂无变量,点击右上角创建</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className={th}>Bot ID</th>
                <th className={th}>变量名</th>
                <th className={th}>变量值</th>
                <th className={th}>类型</th>
                <th className={th}>描述</th>
                <th className={`${th} text-right`}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((v) => (
                <tr key={v.id} className="transition-colors hover:bg-accent/50">
                  <td className="px-4 py-2.5 font-mono text-xs">{v.botId}</td>
                  <td className="px-4 py-2.5 font-medium">{v.variableName}</td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">
                    {v.variableValue ?? '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {v.dataType ?? 'string'}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">
                    {v.description ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(v)}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑变量' : '创建变量'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="var-bot-id" className="block text-sm font-medium">
                Bot ID *
              </label>
              <input
                id="var-bot-id"
                className={inputCls}
                placeholder="Bot ID"
                value={form.botId}
                onChange={(e) => setForm({ ...form, botId: e.target.value })}
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="var-name" className="block text-sm font-medium">
                变量名 *
              </label>
              <input
                id="var-name"
                className={inputCls}
                placeholder="variableName"
                value={form.variableName}
                onChange={(e) => setForm({ ...form, variableName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="var-value" className="block text-sm font-medium">
                变量值
              </label>
              <input
                id="var-value"
                className={inputCls}
                placeholder="variableValue"
                value={form.variableValue}
                onChange={(e) => setForm({ ...form, variableValue: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="var-type" className="block text-sm font-medium">
                数据类型
              </label>
              <select
                id="var-type"
                className={inputCls}
                value={form.dataType}
                onChange={(e) => setForm({ ...form, dataType: e.target.value })}
              >
                {DATA_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="var-desc" className="block text-sm font-medium">
                描述
              </label>
              <input
                id="var-desc"
                className={inputCls}
                placeholder="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t('cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
