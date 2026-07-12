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
  AudioLines,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
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
} from '@ihui/ui'

interface UserAgentAudio {
  id: string
  uuid: string | null
  audioId: string | null
  agentId: string | null
  audioPath: string | null
  source: string | null
  platform: string | null
  createdAt: string | null
  updateAt: string | null
}

interface ListData {
  list: UserAgentAudio[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = { uuid: '', audioId: '', agentId: '', audioPath: '', source: '', platform: '' }

export default function UserAgentAudioPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({
    uuid: '',
    audioId: '',
    agentId: '',
    source: '',
    platform: '',
  })
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserAgentAudio | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify(search))
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-agent-audio', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search.uuid) qs.set('uuid', search.uuid)
      if (search.audioId) qs.set('audioId', search.audioId)
      if (search.agentId) qs.set('agentId', search.agentId)
      if (search.source) qs.set('source', search.source)
      if (search.platform) qs.set('platform', search.platform)
      return api<ListData>(`/api/admin/user-agent-audio?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        uuid: form.uuid.trim(),
        audioId: form.audioId.trim(),
        agentId: form.agentId.trim(),
        audioPath: form.audioPath || undefined,
        source: form.source || undefined,
        platform: form.platform || undefined,
      }
      return editing
        ? api(`/api/admin/user-agent-audio/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/user-agent-audio', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-audio'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/user-agent-audio/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-audio'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: UserAgentAudio) {
    setEditing(item)
    setForm({
      uuid: item.uuid ?? '',
      audioId: item.audioId ?? '',
      agentId: item.agentId ?? '',
      audioPath: item.audioPath ?? '',
      source: item.source ?? '',
      platform: item.platform ?? '',
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
    if (!form.uuid.trim()) {
      setErr('请输入用户UUID')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: UserAgentAudio) {
    if (!window.confirm(`确认删除 "${item.uuid}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '用户Agent音频',
      [
        { key: 'id', title: 'ID' },
        { key: 'uuid', title: '用户UUID' },
        { key: 'audioId', title: '音频ID' },
        { key: 'agentId', title: 'AgentID' },
        { key: 'audioPath', title: '音频路径' },
        { key: 'source', title: '来源' },
        { key: 'platform', title: '平台' },
        { key: 'createdAt', title: '创建时间' },
        { key: 'updateAt', title: '更新时间' },
      ],
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const sch = (k: keyof typeof search) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch({ ...search, [k]: e.target.value })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">用户Agent音频</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="slave:useragentaudit:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search.uuid}
          onChange={sch('uuid')}
          placeholder="用户UUID"
          className="h-9 w-40"
        />
        <Input
          value={search.audioId}
          onChange={sch('audioId')}
          placeholder="音频ID"
          className="h-9 w-40"
        />
        <Input
          value={search.agentId}
          onChange={sch('agentId')}
          placeholder="AgentID"
          className="h-9 w-40"
        />
        <Input
          value={search.source}
          onChange={sch('source')}
          placeholder="来源"
          className="h-9 w-32"
        />
        <Input
          value={search.platform}
          onChange={sch('platform')}
          placeholder="平台"
          className="h-9 w-32"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">用户UUID</TableHead>
              <TableHead className="px-4 py-2.5">音频ID</TableHead>
              <TableHead className="px-4 py-2.5">AgentID</TableHead>
              <TableHead className="px-4 py-2.5">音频路径</TableHead>
              <TableHead className="px-4 py-2.5">来源</TableHead>
              <TableHead className="px-4 py-2.5">平台</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <AudioLines className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{item.uuid || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.audioId || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.agentId || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">
                    {item.audioPath || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{item.source || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.platform || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.createdAt || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="slave:useragentaudit:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="slave:useragentaudit:remove">
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
              <DialogTitle>{editing ? '编辑用户Agent音频' : '新增用户Agent音频'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>用户UUID *</Label>
                <Input
                  value={form.uuid}
                  onChange={(e) => setForm({ ...form, uuid: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>音频ID</Label>
                <Input
                  value={form.audioId}
                  onChange={(e) => setForm({ ...form, audioId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>AgentID</Label>
                <Input
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>来源</Label>
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>平台</Label>
                <Input
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>音频路径</Label>
              <Input
                value={form.audioPath}
                onChange={(e) => setForm({ ...form, audioPath: e.target.value })}
                placeholder="请输入音频URL"
              />
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
