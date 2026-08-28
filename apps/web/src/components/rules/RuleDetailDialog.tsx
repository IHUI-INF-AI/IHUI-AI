'use client'

import * as React from 'react'
import { Activity, History, Loader2, ThumbsDown, ThumbsUp, TrendingUp, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rulesApi } from './rules-api'
import type {
  RuleDiffResponse,
  RuleHistoryEntry,
  RuleHistoryResponse,
  RulePredictEffectResult,
  RuleStats,
} from './types'
import type { Rule } from '@ihui/types'
import { Button } from '@ihui/ui-react'
import { HitsBarChart, SatisfactionPie, StatCard } from './RuleDetailCharts'

interface RuleDetailDialogProps {
  rule: Rule
  onClose: () => void
}

function RuleDetailDialog({ rule, onClose }: RuleDetailDialogProps) {
  const [tab, setTab] = React.useState<'stats' | 'history' | 'predict'>('stats')
  const [stats, setStats] = React.useState<RuleStats | null>(null)
  const [history, setHistory] = React.useState<RuleHistoryEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [diff, setDiff] = React.useState<string | null>(null)
  const [diffPair, setDiffPair] = React.useState<[string, string] | null>(null)
  const [rollingBack, setRollingBack] = React.useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = React.useState<string>('')
  // ── 效果预测 state(超越创新)──
  const [predictPrompt, setPredictPrompt] = React.useState('')
  const [predictResult, setPredictResult] = React.useState<RulePredictEffectResult | null>(null)
  const [predictLoading, setPredictLoading] = React.useState(false)
  const [learnFeedbackMsg, setLearnFeedbackMsg] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      rulesApi<RuleStats>(`/api/rules/${encodeURIComponent(rule.id)}/stats`),
      rulesApi<RuleHistoryResponse>(`/api/rules/${encodeURIComponent(rule.id)}/history`),
    ])
      .then(([s, h]) => {
        if (!cancelled) {
          setStats(s)
          setHistory(h.history)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [rule.id])

  const handleDiff = async (from: string, to: string) => {
    setDiffPair([from, to])
    setDiff(null)
    try {
      const res = await rulesApi<RuleDiffResponse>(
        `/api/rules/${encodeURIComponent(rule.id)}/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      setDiff(res.diff || '(无差异)')
    } catch {
      setDiff('加载失败')
    }
  }

  const handleRollback = async (version: string) => {
    setRollingBack(version)
    try {
      await rulesApi<unknown>(
        `/api/rules/${encodeURIComponent(rule.id)}/rollback?version=${encodeURIComponent(version)}`,
        { method: 'POST' },
      )
      setFeedbackMsg('回滚成功')
    } catch (e) {
      setFeedbackMsg(`回滚失败:${(e as Error).message}`)
    } finally {
      setRollingBack(null)
    }
  }

  const handleFeedback = async (feedback: 'thumbs_up' | 'thumbs_down') => {
    try {
      await rulesApi<{ success: boolean }>(`/api/rules/${encodeURIComponent(rule.id)}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback }),
      })
      setFeedbackMsg('反馈已记录')
    } catch (e) {
      setFeedbackMsg(`反馈失败:${(e as Error).message}`)
    }
  }

  const handlePredict = async () => {
    if (!predictPrompt.trim()) return
    setPredictLoading(true)
    setPredictResult(null)
    try {
      const res = await rulesApi<RulePredictEffectResult>(
        `/api/rules/${encodeURIComponent(rule.id)}/predict-effect`,
        {
          method: 'POST',
          body: JSON.stringify({ testPrompt: predictPrompt }),
        },
      )
      setPredictResult(res)
    } catch (e) {
      setPredictResult({
        withRule: '',
        withoutRule: '',
        tokenDelta: 0,
        similarityDelta: 0,
        qualityScore: 0,
        recommendation: '中性',
        degraded: true,
        message: `预测失败:${(e as Error).message}`,
      })
    } finally {
      setPredictLoading(false)
    }
  }

  const handleLearnFeedback = async (feedback: 'helpful' | 'unhelpful' | 'harmful') => {
    try {
      await rulesApi<{ success: boolean }>(
        `/api/rules/${encodeURIComponent(rule.id)}/learn-feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ feedback, context: predictPrompt.slice(0, 200) }),
        },
      )
      setLearnFeedbackMsg('学习反馈已记录')
    } catch (e) {
      setLearnFeedbackMsg(`反馈失败:${(e as Error).message}`)
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(X)提供等价交互
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-white/40 p-4 dark:bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">规则详情:{rule.name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('stats')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              tab === 'stats'
                ? 'bg-foreground/5 text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <Activity className="mr-1 inline h-3 w-3" />
            效果统计
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              tab === 'history'
                ? 'bg-foreground/5 text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <History className="mr-1 inline h-3 w-3" />
            版本历史({history.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('predict')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              tab === 'predict'
                ? 'bg-foreground/5 text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <TrendingUp className="mr-1 inline h-3 w-3" />
            效果预测
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : tab === 'stats' ? (
          stats && (
            <div className="thin-scroll space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
                <StatCard label="命中次数" value={String(stats.matchCount)} />
                <StatCard label="7天命中" value={String(stats.hits7d)} />
                <StatCard label="30天命中" value={String(stats.hits30d)} />
                <StatCard label="平均 token" value={stats.avgTokenDelta.toFixed(1)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 rounded-md border border-border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground">命中率对比</p>
                  <HitsBarChart hits7d={stats.hits7d} hits30d={stats.hits30d} />
                </div>
                <div className="space-y-1.5 rounded-md border border-border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground">
                    满意度({stats.satisfactionRate.toFixed(0)}%)
                  </p>
                  <SatisfactionPie positive={stats.positiveFeedback} total={stats.totalFeedback} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">反馈:</span>
                <button
                  type="button"
                  onClick={() => handleFeedback('thumbs_up')}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                >
                  <ThumbsUp className="h-3 w-3" />
                  有用
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback('thumbs_down')}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                >
                  <ThumbsDown className="h-3 w-3" />
                  无用
                </button>
                {feedbackMsg && (
                  <span className="text-[10px] text-muted-foreground">{feedbackMsg}</span>
                )}
              </div>
            </div>
          )
        ) : tab === 'history' ? (
          <div className="thin-scroll space-y-2 overflow-y-auto">
            {history.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">暂无版本历史</p>
            ) : (
              history.map((entry, idx) => (
                <div
                  key={entry.timestamp}
                  className="space-y-1 rounded-md border border-border bg-background px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-sm bg-muted px-1 py-0 text-[10px] text-muted-foreground">
                        {entry.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{entry.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {idx > 0 && history[idx - 1] && (
                        <button
                          type="button"
                          onClick={() => handleDiff(history[idx - 1]!.timestamp, entry.timestamp)}
                          className="rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent"
                        >
                          对比上一版
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRollback(entry.timestamp)}
                        disabled={rollingBack !== null}
                        className="rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent"
                      >
                        {rollingBack === entry.timestamp ? '回滚中...' : '回滚'}
                      </button>
                    </div>
                  </div>
                  {diffPair && diffPair[1] === entry.timestamp && diff !== null && (
                    <pre className="thin-scroll max-h-32 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                      {diff}
                    </pre>
                  )}
                </div>
              ))
            )}
            {feedbackMsg && tab === 'history' && (
              <p className="text-[10px] text-muted-foreground">{feedbackMsg}</p>
            )}
          </div>
        ) : (
          <div className="thin-scroll space-y-3 overflow-y-auto">
            <p className="text-[10px] text-muted-foreground">
              输入测试 prompt,dry-run 对比应用规则 vs 不应用规则的 LLM 输出
            </p>
            <textarea
              value={predictPrompt}
              onChange={(e) => setPredictPrompt(e.target.value)}
              placeholder="输入测试 prompt..."
              rows={3}
              className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-foreground/20"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                onClick={handlePredict}
                disabled={predictLoading || !predictPrompt.trim()}
              >
                {predictLoading ? '预测中...' : '运行预测'}
              </Button>
            </div>
            {predictResult && (
              <div className="space-y-2">
                {predictResult.message && (
                  <p className="text-[10px] text-muted-foreground">{predictResult.message}</p>
                )}
                <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3">
                  <StatCard
                    label="Token 差异"
                    value={
                      predictResult.tokenDelta > 0
                        ? `+${predictResult.tokenDelta}`
                        : String(predictResult.tokenDelta)
                    }
                  />
                  <StatCard label="输出差异度" value={predictResult.similarityDelta.toFixed(3)} />
                  <StatCard label="质量评分" value={predictResult.qualityScore.toFixed(3)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">建议:</span>
                  <span
                    className={cn(
                      'rounded-sm px-2 py-1 text-[10px]',
                      predictResult.recommendation === '启用'
                        ? 'bg-green-500/10 text-green-600'
                        : predictResult.recommendation === '不启用'
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {predictResult.recommendation}
                  </span>
                  {predictResult.degraded && (
                    <span className="rounded-sm bg-yellow-500/10 px-1 text-[10px] text-yellow-600">
                      降级模式
                    </span>
                  )}
                </div>
                {predictResult.withRule && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 rounded-md border border-border bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">不应用规则</p>
                      <pre className="thin-scroll max-h-32 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        {predictResult.withoutRule}
                      </pre>
                    </div>
                    <div className="space-y-1 rounded-md border border-border bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">应用规则</p>
                      <pre className="thin-scroll max-h-32 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        {predictResult.withRule}
                      </pre>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">学习反馈:</span>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('helpful')}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    有帮助
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('unhelpful')}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                  >
                    <ThumbsDown className="h-3 w-3" />
                    无帮助
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('harmful')}
                    className="flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 text-[10px] text-destructive transition-colors hover:bg-destructive/10"
                  >
                    有害
                  </button>
                  {learnFeedbackMsg && (
                    <span className="text-[10px] text-muted-foreground">{learnFeedbackMsg}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

export { RuleDetailDialog }
export type { RuleDetailDialogProps }
