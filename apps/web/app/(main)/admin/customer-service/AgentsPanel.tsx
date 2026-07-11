'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Headphones } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { type Agent, type AgentStatus, api, AGENT_STATUS_LABEL, AGENT_STATUS_BADGE } from './types'

export function AgentsPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ userId: '', nickname: '', maxConcurrent: 5 })
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'cs-agents'],
    queryFn: () => api<{ list: Agent[] }>(`/api/admin/customer-service/agents`),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<{ agent: Agent }>('/api/admin/customer-service/agents', {
        method: 'POST',
        body: JSON.stringify({
          userId: form.userId,
          nickname: form.nickname,
          maxConcurrent: form.maxConcurrent,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'cs-agents'] })
      setOpen(false)
      setForm({ userId: '', nickname: '', maxConcurrent: 5 })
      setErr(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function updateStatus(id: string, status: AgentStatus) {
    api(`/api/admin/customer-service/agents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
      .then(() => qc.invalidateQueries({ queryKey: ['admin', 'cs-agents'] }))
      .catch((e: Error) => setErr(e.message))
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>+ 添加坐席</Button>
      </div>

      {err && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">昵称</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">负载</th>
              <th className="px-4 py-2.5 font-medium">技能</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Headphones className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无坐席
                </td>
              </tr>
            ) : (
              list.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 font-medium">{a.nickname}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        AGENT_STATUS_BADGE[a.status],
                      )}
                    >
                      {AGENT_STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {a.currentLoad}/{a.maxConcurrent}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {a.skills.join(', ') || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Select
                      value=""
                      onValueChange={(v) => v && updateStatus(a.id, v as AgentStatus)}
                    >
                      <SelectTrigger className="h-8 w-[100px]">
                        <SelectValue placeholder="切换状态" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(AGENT_STATUS_LABEL) as AgentStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {AGENT_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : setOpen(false))}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setErr(null)
              createMut.mutate()
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>添加坐席</DialogTitle>
              <DialogDescription>将用户指定为客服坐席</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="agent-userId">用户 ID</Label>
              <Input
                id="agent-userId"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                placeholder="UUID 格式的用户 ID"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-nickname">坐席昵称</Label>
              <Input
                id="agent-nickname"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-max">最大并发会话数</Label>
              <Input
                id="agent-max"
                type="number"
                min={1}
                max={100}
                value={form.maxConcurrent}
                onChange={(e) => setForm({ ...form, maxConcurrent: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
