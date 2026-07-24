'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Pencil, ArrowLeft, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Button,
  Input,
  Label,
} from '@ihui/ui-react'
import { Alert, Drawer } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Rule {
  id: string
  name: string
  level?: number
  rate: number
  minAmount?: number
  maxAmount?: number
  status?: string
  description?: string
  updatedAt?: string
}

interface ListData {
  items?: Rule[]
  list?: Rule[]
  total?: number
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetchApi<T>(url)
    return r.success ? r.data : fallback
  } catch {
    return fallback
  }
}

const fmtRate = (rate: number) => `${(rate / 100).toFixed(2)}%`

interface FormState {
  name: string
  rate: number
  description: string
}

const EMPTY_FORM: FormState = { name: '', rate: 0, description: '' }

export default function AdminDistributionRulesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = React.useState<Rule | null>(null)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)

  const listQ = useQuery({
    queryKey: ['admin', 'distribution', 'rules'],
    queryFn: () => safeFetch<ListData>('/commission/rules', { items: [], total: 0 }),
  })

  const items = listQ.data?.items ?? listQ.data?.list ?? []

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editing ? `/commission/rules/${editing.id}` : '/commission/rules'
      const r = await fetchApi<Rule>(url, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('保存成功')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['admin', 'distribution', 'rules'] })
    },
    onError: (e: Error) => toast.error(e.message || '保存失败'),
  })

  const openEdit = (r: Rule) => {
    setEditing(r)
    setForm({ name: r.name, rate: r.rate, description: r.description ?? '' })
    setOpen(true)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/distribution"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回分销中心
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">佣金规则</h1>
          <p className="mt-1 text-sm text-muted-foreground">配置分级佣金比例</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新增规则
        </Button>
      </div>

      {listQ.isError && (
        <Alert variant="danger" title="加载失败" description="无法获取佣金规则列表" />
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5">规则名称</TableHead>
              <TableHead className="px-4 py-2.5">等级</TableHead>
              <TableHead className="px-4 py-2.5 text-right">佣金比例</TableHead>
              <TableHead className="px-4 py-2.5">说明</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  暂无规则,点击"新增规则"创建
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 font-medium">{it.name}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {it.level ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right font-medium text-primary">
                    {fmtRate(it.rate)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {it.description ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        it.status === 'disabled'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
                      )}
                    >
                      {it.status === 'disabled' ? '已停用' : '启用中'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(it)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? '编辑规则' : '新增规则'}
        width="28rem"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>规则名称</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="如:一级分销"
            />
          </div>
          <div className="space-y-1.5">
            <Label>佣金比例(%)</Label>
            <Input
              type="number"
              value={form.rate / 100}
              onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) * 100 }))}
              placeholder="如:10"
            />
            <p className="text-xs text-muted-foreground">输入百分比数值,如 10 表示 10%</p>
          </div>
          <div className="space-y-1.5">
            <Label>说明</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="可选"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form.name.trim()}
            >
              {saveMut.isPending ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
