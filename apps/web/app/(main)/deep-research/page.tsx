// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 深度研究(Deep Research)页面。
// 流程:输入查询 → POST /api/research/start 获取 research_id → 轮询 GET /api/research/{id}
// 实时展示规划/检索/深挖/成稿各阶段进度 → 生成最终 Markdown 报告 + 来源溯源。
// 2026-09-07 工作线 B:API 收口到 @ihui/api-client(research 端点封装);
// 新增来源溯源面板(SourcesPanel)+ 本地历史任务回看(HistoryPanel)。

'use client'

import * as React from 'react'
import { Loader2, Play, FileText, RefreshCw, Search } from 'lucide-react'

import { useTranslations } from 'next-intl'
import { getResearchReport, startResearch, type ResearchReportDto } from '@ihui/api-client'
import { MarkdownViewer } from '@/components/media/MarkdownViewer'
import { SourcesPanel } from './sources-panel'
import { RunStatusPanel } from './status-panel'
import {
  HistoryPanel,
  appendDeepResearchHistory,
  type DeepResearchHistoryItem,
} from './history-panel'

const POLL_INTERVAL_MS = 2500

export default function DeepResearchPage() {
  const t = useTranslations('deepResearch')
  const [query, setQuery] = React.useState('')
  const [iterations, setIterations] = React.useState(4)
  const [loading, setLoading] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [state, setState] = React.useState<ResearchReportDto | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // 轮询研究状态(finished / error 时自动停止)
  const poll = React.useCallback(
    async (id: string) => {
      try {
        const data = await getResearchReport(id)
        setState(data)
        if (data.finished || data.status === 'error') stopPolling()
      } catch (e) {
        setState({ status: 'error', error: (e as Error).message })
        stopPolling()
      }
    },
    [stopPolling],
  )

  const startPolling = React.useCallback(
    (id: string) => {
      stopPolling()
      void poll(id)
      timerRef.current = setInterval(() => void poll(id), POLL_INTERVAL_MS)
    },
    [poll, stopPolling],
  )

  const start = async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setState(null)
    try {
      const res = await startResearch(q, iterations)
      appendDeepResearchHistory({ researchId: res.research_id, query: q, savedAt: Date.now() })
      setActiveId(res.research_id)
      setLoading(false)
      startPolling(res.research_id)
    } catch (e) {
      setState({ status: 'error', error: (e as Error).message || t('startFailed') })
      setLoading(false)
    }
  }

  // 历史任务回看:按 research_id 重新拉快照(后端断点续跑语义)
  const reopenHistory = React.useCallback(
    (item: DeepResearchHistoryItem) => {
      stopPolling()
      setState(null)
      setQuery(item.query)
      setActiveId(item.researchId)
      startPolling(item.researchId)
    },
    [startPolling, stopPolling],
  )

  React.useEffect(() => stopPolling, [stopPolling])

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {/* 历史任务回看 */}
      <div className="mb-6">
        <HistoryPanel activeId={activeId} onSelect={reopenHistory} />
      </div>

      {/* 输入区 */}
      <div className="mb-6 rounded-xl border p-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder={t('queryPlaceholder')}
          className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('maxIterations')}
            <input
              type="number"
              min={1}
              max={10}
              value={iterations}
              onChange={(e) =>
                setIterations(Math.max(1, Math.min(10, Number(e.target.value) || 4)))
              }
              className="w-20 rounded-lg border bg-background px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={start}
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t('start')}
          </button>
        </div>
      </div>

      {/* 状态 / 阶段进度 */}
      {state && <RunStatusPanel state={state} activeId={activeId} />}

      {/* 子问题清单 */}
      {state?.subquestions && state.subquestions.length > 0 && (
        <div className="mb-6 rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" /> {t('subquestionsTitle')}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {state.subquestions.map((sq, i) => (
              <li key={i}>{sq}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 已检索证据 */}
      {state?.evidence && state.evidence.length > 0 && (
        <div className="mb-6 rounded-xl border p-4">
          <h2 className="mb-2 text-sm font-semibold">
            {t('evidenceTitle', { count: state.evidence.length })}
          </h2>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {state.evidence.slice(0, 20).map((e, i) => (
              <li key={i}>
                <span className="font-semibold text-foreground">[{e.question}]</span>
                <span className="ml-1">
                  {t('evidenceDepth', { depth: e.depth })} · {e.content.slice(0, 80)}…
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 最终报告 */}
      {state?.markdown ? (
        <div className="mb-6 rounded-xl border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t('reportTitle')}</h2>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {t('sourceCount', { count: state.sources?.length ?? 0 })}
            </span>
          </div>
          <div className="px-5 py-4">
            <MarkdownViewer content={state.markdown} />
          </div>
        </div>
      ) : state?.running ? (
        <div className="mb-6 flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> {t('generating')}
        </div>
      ) : null}

      {/* 来源溯源(SourceRef 分级 / 置信度 / 核验标注) */}
      {state?.sources && state.sources.length > 0 && (
        <div className="mb-6">
          <SourcesPanel sources={state.sources} />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
