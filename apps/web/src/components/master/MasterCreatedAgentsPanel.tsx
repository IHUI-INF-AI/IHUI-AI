// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管创建的智能体(2026-11-28 用户纠正):
 *
 * 这里不是项目已有的「智能体」= AI 应用商店,也不是 agent-registry 的模板库。
 * 只列"这次跟总管对话时,总管实际派出去"的运行账本:
 * - 进行中:圆形旋转动画,3 秒轮询一次;
 * - 已完成:跑完/失败/取消/超时的都归到这里。
 *
 * 数据面是 GET /api/agent-registry/runs?sessionId=...,后端按 owner + session 收口。
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { useAiPanelStore } from '@/stores/ai-panel'

interface AgentRunView {
  id: string
  definitionName: string
  goal: string
  status: string
  mode: string
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  artifactCount: number
  errorMessage: string | null
}

const ACTIVE_STATUSES = new Set(['queued', 'running', 'paused', 'blocked'])
const COMPLETED_STATUSES = new Set(['succeeded', 'failed', 'canceled', 'timeout'])

const STATUS_LABELS: Record<string, string> = {
  queued: '排队中',
  running: '进行中',
  paused: '已暂停',
  blocked: '等确认',
  succeeded: '已完成',
  failed: '没跑成',
  canceled: '已取消',
  timeout: '超时',
}

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-[#f2eee7] text-[#7c7468]',
  running: 'bg-[#fbf1d9] text-[#8a6114]',
  paused: 'bg-[#f2eee7] text-[#7c7468]',
  blocked: 'bg-[#fbefed] text-[#a2483b]',
  succeeded: 'bg-[#eef5ec] text-[#3f7144]',
  failed: 'bg-[#fbefed] text-[#a2483b]',
  canceled: 'bg-[#f2eee7] text-[#7c7468]',
  timeout: 'bg-[#f2eee7] text-[#7c7468]',
}

function timeText(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function statusIcon(status: string) {
  if (status === 'succeeded') {
    return <CheckCircle2 className="h-4 w-4 text-[#5f9b6a]" />
  }
  if (status === 'failed') {
    return <XCircle className="h-4 w-4 text-[#a2483b]" />
  }
  if (status === 'canceled') {
    return <Ban className="h-4 w-4 text-[#a29a8e]" />
  }
  if (status === 'timeout') {
    return <Clock3 className="h-4 w-4 text-[#a29a8e]" />
  }
  return <CheckCircle2 className="h-4 w-4 text-[#a29a8e]" />
}

interface MasterCreatedAgentsPanelProps {
  className?: string
}

export function MasterCreatedAgentsPanel({ className = '' }: MasterCreatedAgentsPanelProps) {
  const sessionId = useAiPanelStore((state) => state.masterSessionId)
  const [runs, setRuns] = useState<AgentRunView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!sessionId) {
        setRuns([])
        setError('')
        return
      }
      if (!silent) setLoading(true)
      try {
        const response = await fetch(
          `/api/agent-registry/runs?sessionId=${encodeURIComponent(sessionId)}&limit=100`,
          { credentials: 'include', cache: 'no-store' },
        )
        const payload = (await response.json().catch(() => ({}))) as {
          code?: number
          message?: string
          data?: { items?: AgentRunView[] }
        }
        if (!response.ok || payload.code !== 0) {
          throw new Error(payload.message || `HTTP ${response.status}`)
        }
        setRuns(payload.data?.items ?? [])
        setError('')
        setUpdatedAt(new Date())
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [sessionId],
  )

  useEffect(() => {
    void load(false)
    if (!sessionId) return
    const timer = window.setInterval(() => void load(true), 3000)
    return () => window.clearInterval(timer)
  }, [sessionId, load])

  const active = runs.filter((run) => ACTIVE_STATUSES.has(run.status))
  const completed = runs.filter((run) => COMPLETED_STATUSES.has(run.status))

  return (
    <section className={`flex h-full min-h-0 flex-col bg-transparent ${className}`}>
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[#f0ebe3] px-7 py-6">
        <div>
          <h2 className="text-[22px] font-semibold leading-8 text-[#23211c]">
            总管创建的智能体
          </h2>
          <p className="mt-1 text-[12px] text-[#8d8579]">
            跟总管聊完派出去的活才会出现在这里,不是应用商店里的模板。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading || !sessionId}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#ded8ce] bg-white px-3 py-2 text-[12px] text-[#6d665b] transition hover:bg-[#f7f4ef] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8">
        {!sessionId ? (
          <EmptyState
            title="还没跟总管聊过"
            body="先给总管发一句,让它把活派出去;这里会按这次对话实时长出智能体。"
          />
        ) : loading && runs.length === 0 ? (
          <p className="py-16 text-center text-[12px] text-[#a29a8e]">读取这次对话的智能体…</p>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-[#f0d9d4] bg-[#fbf4f2] px-4 py-3 text-[12px] text-[#a2483b]">
            {error}
            <button
              type="button"
              onClick={() => void load(false)}
              className="ml-2 underline underline-offset-2"
            >
              重试
            </button>
          </div>
        ) : runs.length === 0 ? (
          <EmptyState
            title="这次还没派出智能体"
            body="总管现在只是跟你说话;等它真正把任务派出去,运行中的智能体会带旋转动画出现在这里。"
          />
        ) : (
          <>
            <RunGroup
              title="进行中"
              hint="圆形旋转代表它还在干活"
              runs={active}
              emptyText="现在没有在跑的智能体"
            />
            <RunGroup
              title="已完成"
              hint="跑完、没跑成、取消或超时的都归这里"
              runs={completed}
              emptyText="还没有完成的智能体"
            />
          </>
        )}
        {updatedAt && runs.length > 0 && (
          <p className="mt-5 text-center text-[11px] text-[#b3aa9d]">
            每 3 秒自动刷新 · 最近 {updatedAt.toLocaleTimeString('zh-CN')}
          </p>
        )}
      </div>
    </section>
  )
}

function RunGroup({
  title,
  hint,
  runs,
  emptyText,
}: {
  title: string
  hint: string
  runs: AgentRunView[]
  emptyText: string
}) {
  return (
    <section className="pt-6 first:pt-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h3 className="text-[15px] font-semibold text-[#2c2823]">{title}</h3>
        <span className="rounded-full bg-[#f1ede6] px-2 py-0.5 text-[11px] text-[#8d8579]">
          {runs.length}
        </span>
        <span className="text-[11px] text-[#aea69a]">{hint}</span>
      </div>
      {runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e7e1d7] bg-[#fbfaf7] px-4 py-5 text-center text-[12px] text-[#a29a8e]">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {runs.map((run) => (
            <AgentRunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  )
}

function AgentRunRow({ run }: { run: AgentRunView }) {
  const isActive = ACTIVE_STATUSES.has(run.status)
  return (
    <li className="rounded-2xl border border-[#eee9e1] bg-[#fbfaf7] px-4 py-3.5 transition hover:border-[#ddd5c8] hover:bg-white">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1ede6]">
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#8a6a2f]" aria-label="进行中" />
          ) : (
            statusIcon(run.status)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-[14px] font-semibold text-[#2c2823]">
              {run.definitionName || '智能体'}
            </h4>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                STATUS_STYLES[run.status] ?? 'bg-[#f2eee7] text-[#7c7468]'
              }`}
            >
              {STATUS_LABELS[run.status] ?? run.status}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#756d61]">{run.goal}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#aaa298]">
            <span>{timeText(run.createdAt)} 派出</span>
            {run.mode && <span>· {run.mode}</span>}
            {run.artifactCount > 0 && <span>· {run.artifactCount} 个产物</span>}
            {run.errorMessage && (
              <span className="text-[#a2483b]">· {run.errorMessage}</span>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f4f0e8]">
        <Sparkles className="h-5 w-5 text-[#b09a72]" />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-[#2c2823]">{title}</h3>
      <p className="mt-1.5 max-w-[360px] text-[12px] leading-5 text-[#8d8579]">{body}</p>
    </div>
  )
}
