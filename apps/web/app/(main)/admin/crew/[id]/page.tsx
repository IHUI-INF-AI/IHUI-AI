'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
  Loader2,
  MessageSquare,
  Play,
  StopCircle,
  Terminal,
} from 'lucide-react'
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import {
  getCrewSession,
  listCrewSessionMessages,
  listCrewSessionTasks,
  listCrewRunArtifacts,
  streamCrewRun,
} from '@/lib/crew-api'
import { fmtTime, parseSseChunk, sseToLogEntry, statusBadgeClass } from '../helpers'
import type { StreamLogEntry } from '../types'

export default function CrewSessionDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const sessionId = params.id

  const [logs, setLogs] = React.useState<StreamLogEntry[]>([])
  const [streaming, setStreaming] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const logEndRef = React.useRef<HTMLDivElement>(null)

  const sessionQ = useQuery({
    queryKey: ['crew', 'session', sessionId],
    queryFn: () => getCrewSession(sessionId),
    enabled: !!sessionId,
    refetchInterval: streaming ? false : 5_000,
  })

  const tasksQ = useQuery({
    queryKey: ['crew', 'session', sessionId, 'tasks'],
    queryFn: () => listCrewSessionTasks(sessionId),
    enabled: !!sessionId,
    refetchInterval: streaming ? 2_000 : 15_000,
  })

  const messagesQ = useQuery({
    queryKey: ['crew', 'session', sessionId, 'messages'],
    queryFn: () => listCrewSessionMessages(sessionId),
    enabled: !!sessionId,
    refetchInterval: streaming ? 2_000 : 30_000,
  })

  // 产物需要 runId,简化:用 sessionId 兜底(后端可能用 sessionId 作为 runId)
  const artifactsQ = useQuery({
    queryKey: ['crew', 'session', sessionId, 'artifacts'],
    queryFn: () => listCrewRunArtifacts(sessionId),
    enabled: !!sessionId,
    refetchInterval: streaming ? 3_000 : 30_000,
    retry: false,
  })

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function startStream() {
    if (streaming) return
    setStreaming(true)
    setLogs([])
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const body = await streamCrewRun(sessionId)
      if (!body) {
        toast.error('未获得流响应')
        return
      }
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { events, rest } = parseSseChunk(buffer)
        buffer = rest
        for (const evt of events) {
          const entry = sseToLogEntry(evt)
          if (entry) {
            setLogs((prev) => [...prev, entry])
            if (entry.type === 'complete' || entry.type === 'error') {
              setStreaming(false)
              abortRef.current = null
            }
          }
        }
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stopStream() {
    abortRef.current?.abort()
    setStreaming(false)
    setLogs((prev) => [...prev, { type: 'error', text: '⏹ 用户已停止', ts: Date.now() }])
  }

  React.useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const session = sessionQ.data
  const tasks = tasksQ.data ?? []
  const messages = messagesQ.data ?? []
  const artifacts = artifactsQ.data ?? []

  if (sessionQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载会话...
      </div>
    )
  }
  if (sessionQ.error) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/crew')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> 返回列表
        </Button>
        <Alert variant="danger" title="加载失败" description={(sessionQ.error as Error).message} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/crew">
              <ArrowLeft className="mr-1 h-4 w-4" /> 返回
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{session?.title || '未命名会话'}</h1>
            <p className="text-xs text-muted-foreground">
              ID: {sessionId} · {session?.userId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs ${statusBadgeClass(session?.status ?? '')}`}
          >
            {session?.status}
          </span>
          {streaming ? (
            <Button variant="outline" size="sm" onClick={stopStream}>
              <StopCircle className="mr-1 h-4 w-4 text-rose-600" /> 停止
            </Button>
          ) : (
            <Button size="sm" onClick={startStream}>
              <Play className="mr-1 h-4 w-4" /> 流式执行
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground">输入</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{session?.inputMessage}</p>
        {session?.outputMessage && (
          <>
            <p className="mt-3 text-xs font-medium text-muted-foreground">最终输出</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{session.outputMessage}</p>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          创建: {fmtTime(session?.createdAt)} · 完成: {fmtTime(session?.completedAt)}
        </p>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">任务 ({tasks.length})</TabsTrigger>
          <TabsTrigger value="messages">消息 ({messages.length})</TabsTrigger>
          <TabsTrigger value="artifacts">产物 ({artifacts.length})</TabsTrigger>
          <TabsTrigger value="logs">实时日志 ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-3">
          <div className="rounded-lg border bg-card">
            {tasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无任务</div>
            ) : (
              <div className="divide-y">
                {tasks.map((t) => (
                  <div key={t.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{t.taskIndex}</span>
                        <span className="text-sm font-medium">{t.agentRole}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${statusBadgeClass(t.status)}`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtTime(t.startedAt)} → {fmtTime(t.completedAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                    {t.outputData && (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                        {t.outputData}
                      </pre>
                    )}
                    {t.errorMessage && (
                      <p className="mt-1 text-xs text-rose-600">错误: {t.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="messages" className="mt-3">
          <div className="rounded-lg border bg-card">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无消息</div>
            ) : (
              <div className="divide-y">
                {messages.map((m) => (
                  <div key={m.id} className="flex gap-3 p-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{m.fromRole}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-xs font-medium">{m.toRole}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {fmtTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="artifacts" className="mt-3">
          <div className="rounded-lg border bg-card">
            {artifacts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无产物</div>
            ) : (
              <div className="divide-y">
                {artifacts.map((a) => (
                  <div key={a.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{a.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {a.type}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {fmtTime(a.createdAt)}
                      </span>
                    </div>
                    <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-xs">
                      {a.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-3">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Terminal className="h-4 w-4" /> 实时日志
              </span>
              <span className="text-xs text-muted-foreground">
                {streaming ? '运行中...' : '空闲'}
              </span>
            </div>
            <div className="max-h-96 overflow-auto p-3 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">点击「流式执行」开始...</p>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="py-0.5">
                    <span className="text-muted-foreground">
                      [{new Date(l.ts).toLocaleTimeString('zh-CN')}]
                    </span>{' '}
                    {l.text}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
