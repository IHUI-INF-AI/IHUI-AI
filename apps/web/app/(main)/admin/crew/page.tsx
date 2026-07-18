'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bot, CheckCircle2, Loader2, Plus, RefreshCw, Users, Activity } from 'lucide-react'
import { Alert } from '@/components/feedback'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@ihui/ui'
import {
  checkCrewHealth,
  listCrewAgents,
  listCrewSessions,
  createCrewSession,
} from '@/lib/crew-api'
import { EMPTY_FORM, fmtTime, statusBadgeClass } from './helpers'
import type { CreateSessionForm, HealthState } from './types'

export default function CrewPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<CreateSessionForm>(EMPTY_FORM)

  const healthQ = useQuery({
    queryKey: ['crew', 'health'],
    queryFn: async (): Promise<HealthState> => {
      const r = await checkCrewHealth()
      return { status: r.status, service: r.service, ok: r.status === 'ok' }
    },
    staleTime: 30_000,
  })

  const agentsQ = useQuery({
    queryKey: ['crew', 'agents'],
    queryFn: () => listCrewAgents(),
    staleTime: 60_000,
  })

  const sessionsQ = useQuery({
    queryKey: ['crew', 'sessions'],
    queryFn: () => listCrewSessions(undefined, 50),
    refetchInterval: 10_000,
  })

  const createMut = useMutation({
    mutationFn: () =>
      createCrewSession({
        userId: form.userId || 'admin',
        inputMessage: form.inputMessage,
        title: form.title || form.inputMessage.slice(0, 40),
        config: {
          collectionName: form.collectionName || undefined,
          modelId: form.modelId || undefined,
          maxRetries: form.maxRetries,
        },
      }),
    onSuccess: (r) => {
      toast.success('会话已创建')
      setOpen(false)
      setForm(EMPTY_FORM)
      qc.invalidateQueries({ queryKey: ['crew', 'sessions'] })
      router.push(`/admin/crew/${r.sessionId}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.inputMessage.trim()) {
      toast.error('请输入任务消息')
      return
    }
    createMut.mutate()
  }

  const health: HealthState = healthQ.data ?? { status: '?', ok: false }
  const agents = agentsQ.data ?? []
  const sessions = sessionsQ.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bot className="h-6 w-6 text-primary" /> Crew 多智能体协作
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            5 角色流水线:planner → researcher → executor → reviewer → reporter
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              healthQ.refetch()
              agentsQ.refetch()
              sessionsQ.refetch()
            }}
          >
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> 新建会话
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          {health.ok ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          )}
          <div>
            <p className="text-sm font-semibold">{health.ok ? '服务正常' : '检查中...'}</p>
            <p className="text-xs text-muted-foreground">{health.service ?? 'crew-service'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">{agents.length} 角色</p>
            <p className="text-xs text-muted-foreground">已注册智能体</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <Activity className="h-5 w-5 text-sky-600" />
          <div>
            <p className="text-sm font-semibold">{sessions.length} 会话</p>
            <p className="text-xs text-muted-foreground">最近 50 条</p>
          </div>
        </div>
      </div>

      {agentsQ.data && agents.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2.5">
            <p className="text-sm font-medium">角色配置</p>
          </div>
          <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <div key={a.role} className="rounded border p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.role}</span>
                  <span className="text-xs text-muted-foreground">{a.llmModelId || '默认'}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.goal}</p>
                {a.tools.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {a.tools.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <p className="text-sm font-medium">会话列表</p>
        </div>
        {sessionsQ.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            暂无会话,点击右上角「新建会话」开始
          </div>
        ) : (
          <div className="divide-y">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/admin/crew/${s.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {s.title || s.inputMessage.slice(0, 40)}
                    </p>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${statusBadgeClass(s.status)}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.userId} · {fmtTime(s.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {sessionsQ.error && (
        <Alert variant="danger" title="查询失败" description={(sessionsQ.error as Error).message} />
      )}

      <Dialog open={open} onOpenChange={(v) => !createMut.isPending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 Crew 会话</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="可选,留空自动取消息前 40 字"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="userId">用户 ID</Label>
              <Input
                id="userId"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                placeholder="可选,留空使用 admin"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inputMessage">任务消息 *</Label>
              <textarea
                id="inputMessage"
                required
                rows={4}
                value={form.inputMessage}
                onChange={(e) => setForm({ ...form, inputMessage: e.target.value })}
                placeholder="例如:撰写一份关于 RAG 知识库使用最佳实践的总结报告"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="collectionName">知识库集合</Label>
                <Input
                  id="collectionName"
                  value={form.collectionName}
                  onChange={(e) => setForm({ ...form, collectionName: e.target.value })}
                  placeholder="default"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modelId">模型 ID</Label>
                <Input
                  id="modelId"
                  value={form.modelId}
                  onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                  placeholder="可选,留空用默认"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="maxRetries">最大重试次数</Label>
              <Input
                id="maxRetries"
                type="number"
                min={0}
                max={5}
                value={form.maxRetries}
                onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) || 0 })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => !createMut.isPending && setOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                创建并进入
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
