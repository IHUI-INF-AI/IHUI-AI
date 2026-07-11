'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, ClipboardList, Clock, Upload } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'

interface HomeworkItem {
  id: string
  title: string
  deadline?: string
  endTime?: string
  status?: number | string
  submitted?: boolean
}
interface HomeworkListData {
  list: HomeworkItem[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatDeadline(t?: string) {
  if (!t) return ''
  try {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return t
  }
}

const STATUS_MAP: Record<string, string> = {
  waiting_approval: '待批改',
  pass_approval: '已通过',
  fail_approval: '未通过',
  not_submitted: '未提交',
  submitted: '已提交',
}
const NUM_STATUS_MAP: Record<number, string> = {
  0: '未提交',
  1: '已提交',
  2: '已通过',
  3: '未通过',
}

function statusText(status?: number | string) {
  if (status === undefined || status === null) return '未提交'
  if (typeof status === 'number') return NUM_STATUS_MAP[status] ?? '未知'
  return STATUS_MAP[status] ?? status
}

export default function CourseHomeworkPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'homework', id],
    queryFn: () => api<HomeworkListData>(`/api/learn/${id}/homework`),
  })

  const submitMut = useMutation({
    mutationFn: (hwId: string) =>
      api(`/api/learn/${id}/homework/${hwId}/submit`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn', 'homework', id] }),
  })

  const list = data?.list ?? []

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/learn/${id}`)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回课程
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '加载失败'}
        </div>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href={`/learn/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回课程
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <ClipboardList className="h-6 w-6 text-primary" />
        课程作业
      </h1>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无作业</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const deadline = formatDeadline(item.deadline ?? item.endTime)
            const submitted = item.submitted ?? (item.status === 'submitted' || item.status === 1)
            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-medium">{item.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          截止时间：{deadline}
                        </span>
                      )}
                      <span className="rounded px-1.5 py-0.5 bg-muted">
                        {statusText(item.status)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button
                      size="sm"
                      variant={submitted ? 'outline' : 'default'}
                      disabled={submitted || submitMut.isPending}
                      onClick={() => submitMut.mutate(item.id)}
                    >
                      {submitMut.isPending && submitMut.variables === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {submitted ? '已提交' : '提交作业'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
