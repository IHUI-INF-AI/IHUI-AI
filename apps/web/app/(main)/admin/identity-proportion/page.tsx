'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Percent,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { DatePicker } from '@/components/form/DatePicker'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@ihui/ui'

interface IdentityProportion {
  id: string
  identityType: string
  gift: string | null
  tokenProportion: string | null
  vipGift: string | null
  routineProportion: string | null
  beginTime: string | null
  endTime: string | null
  status: number
}

interface ListData {
  list: IdentityProportion[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = {
  identityType: '',
  gift: '',
  tokenProportion: '',
  vipGift: '',
  routineProportion: '',
  beginTime: '',
  endTime: '',
  status: true,
}

export default function IdentityProportionPage() {
  const qc = useQueryClient()
  const [searchBegin, setSearchBegin] = React.useState('')
  const [searchEnd, setSearchEnd] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<IdentityProportion | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'identity-proportion', searchBegin, searchEnd, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchBegin) qs.set('beginTime', searchBegin)
      if (searchEnd) qs.set('endTime', searchEnd)
      return api<ListData>(`/api/admin/identity-proportion?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        identityType: form.identityType.trim(),
        gift: form.gift || undefined,
        tokenProportion: form.tokenProportion || undefined,
        vipGift: form.vipGift || undefined,
        routineProportion: form.routineProportion || undefined,
        beginTime: form.beginTime || undefined,
        endTime: form.endTime || undefined,
        status: form.status ? 1 : 0,
      }
      return editing
        ? api(`/api/admin/identity-proportion/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/identity-proportion', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'identity-proportion'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/identity-proportion/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'identity-proportion'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: IdentityProportion) {
    setEditing(item)
    setForm({
      identityType: item.identityType,
      gift: item.gift ?? '',
      tokenProportion: item.tokenProportion ?? '',
      vipGift: item.vipGift ?? '',
      routineProportion: item.routineProportion ?? '',
      beginTime: item.beginTime ?? '',
      endTime: item.endTime ?? '',
      status: item.status === 1,
    })
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.identityType.trim()) {
      setErr('请输入身份类型')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: IdentityProportion) {
    if (!window.confirm(`确认删除 "${item.identityType}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '身份比例',
      [
        { key: 'id', title: 'ID' },
        { key: 'identityType', title: '身份类型' },
        { key: 'gift', title: '赠送' },
        { key: 'tokenProportion', title: 'Token比例' },
        { key: 'vipGift', title: 'VIP赠送' },
        { key: 'routineProportion', title: '常规比例' },
        { key: 'beginTime', title: '开始时间' },
        { key: 'endTime', title: '结束时间' },
        { key: 'status', title: '状态', formatter: (v) => (v === 1 ? '启用' : '禁用') },
      ],
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">身份比例管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:identity_proportion:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          value={searchBegin}
          onChange={(v) => {
            setSearchBegin(v as string)
            setPage(1)
          }}
          placeholder="开始时间"
        />
        <DatePicker
          value={searchEnd}
          onChange={(v) => {
            setSearchEnd(v as string)
            setPage(1)
          }}
          placeholder="结束时间"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">身份类型</TableHead>
              <TableHead className="px-4 py-2.5">赠送</TableHead>
              <TableHead className="px-4 py-2.5">Token比例</TableHead>
              <TableHead className="px-4 py-2.5">VIP赠送</TableHead>
              <TableHead className="px-4 py-2.5">常规比例</TableHead>
              <TableHead className="px-4 py-2.5">开始时间</TableHead>
              <TableHead className="px-4 py-2.5">结束时间</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Percent className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{item.identityType}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.gift || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.tokenProportion || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.vipGift || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.routineProportion || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.beginTime || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.endTime || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={
                        item.status === 1
                          ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600'
                          : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                      }
                    >
                      {item.status === 1 ? '启用' : '禁用'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="ai:identity_proportion:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:identity_proportion:remove">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑身份比例' : '新增身份比例'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label>身份类型</Label>
              <Input
                value={form.identityType}
                onChange={(e) => setForm({ ...form, identityType: e.target.value })}
                placeholder="请输入身份类型"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>赠送</Label>
                <Input
                  value={form.gift}
                  onChange={(e) => setForm({ ...form, gift: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Token比例</Label>
                <Input
                  value={form.tokenProportion}
                  onChange={(e) => setForm({ ...form, tokenProportion: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>VIP赠送</Label>
                <Input
                  value={form.vipGift}
                  onChange={(e) => setForm({ ...form, vipGift: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>常规比例</Label>
                <Input
                  value={form.routineProportion}
                  onChange={(e) => setForm({ ...form, routineProportion: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>开始时间</Label>
                <DatePicker
                  value={form.beginTime}
                  onChange={(v) => setForm({ ...form, beginTime: v as string })}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <DatePicker
                  value={form.endTime}
                  onChange={(v) => setForm({ ...form, endTime: v as string })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>启用</Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
