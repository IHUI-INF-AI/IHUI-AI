// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Activity, History, Loader2, ThumbsDown, ThumbsUp, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rulesApi } from './rules-api'
import {
  RECOMMENDATION_DISABLE,
  RECOMMENDATION_ENABLE,
  RECOMMENDATION_NEUTRAL,
  type RuleDiffResponse,
  type RuleHistoryEntry,
  type RuleHistoryResponse,
  type RulePredictEffectResult,
  type RuleStats,
} from './types'
import type { Rule } from '@ihui/types'
import { Button, CloseButton } from '@ihui/ui-react'
import { HitsBarChart, SatisfactionPie, StatCard } from './RuleDetailCharts'

interface RuleDetailDialogProps {
  rule: Rule
  onClose: () => void
}

const RECOMMENDATION_LABEL_KEYS = {
  [RECOMMENDATION_ENABLE]: 'enabled',
  [RECOMMENDATION_DISABLE]: 'recDisable',
  [RECOMMENDATION_NEUTRAL]: 'recNeutral',
} as const

function RuleDetailDialog({ rule, onClose }: RuleDetailDialogProps) {
  const t = useTranslations('rules')
  const tCommon = useTranslations('common')
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
      setDiff(res.diff || t('diffNone'))
    } catch {
      setDiff(t('loadFailed'))
    }
  }

  const handleRollback = async (version: string) => {
    setRollingBack(version)
    try {
      await rulesApi<unknown>(
        `/api/rules/${encodeURIComponent(rule.id)}/rollback?version=${encodeURIComponent(version)}`,
        { method: 'POST' },
      )
      setFeedbackMsg(t('rollbackSuccess'))
    } catch (e) {
      setFeedbackMsg(t('rollbackFailed', { msg: (e as Error).message }))
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
      setFeedbackMsg(t('feedbackRecorded'))
    } catch (e) {
      setFeedbackMsg(t('feedbackFailed', { msg: (e as Error).message }))
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
        recommendation: RECOMMENDATION_NEUTRAL,
        degraded: true,
        message: t('predictFailed', { msg: (e as Error).message }),
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
      setLearnFeedbackMsg(t('learnFeedbackRecorded'))
    } catch (e) {
      setLearnFeedbackMsg(t('feedbackFailed', { msg: (e as Error).message }))
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(X)提供等价交互
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-white/40 p-3 dark:bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t('ruleDetailTitle', { name: rule.name })}</span>
          <CloseButton aria-label={tCommon('close')} onClick={onClose} />
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
            {t('tabStats')}
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
            {t('tabHistoryCount', { n: history.length })}
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
            {t('tabPredict')}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {tCommon('loading')}
          </div>
        ) : tab === 'stats' ? (
          stats && (
            <div className="thin-scroll space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
                <StatCard label={t('statMatchCount')} value={String(stats.matchCount)} />
                <StatCard label={t('statHits7d')} value={String(stats.hits7d)} />
                <StatCard label={t('statHits30d')} value={String(stats.hits30d)} />
                <StatCard label={t('statAvgToken')} value={stats.avgTokenDelta.toFixed(1)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 rounded-md border border-border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground">{t('hitRateCompare')}</p>
                  <HitsBarChart hits7d={stats.hits7d} hits30d={stats.hits30d} />
                </div>
                <div className="space-y-1.5 rounded-md border border-border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground">
                    {t('satisfactionPercent', { pct: stats.satisfactionRate.toFixed(0) })}
                  </p>
                  <SatisfactionPie positive={stats.positiveFeedback} total={stats.totalFeedback} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{t('feedbackLabel')}</span>
                <button
                  type="button"
                  onClick={() => handleFeedback('thumbs_up')}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                >
                  <ThumbsUp className="h-3 w-3" />
                  {t('useful')}
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback('thumbs_down')}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                >
                  <ThumbsDown className="h-3 w-3" />
                  {t('useless')}
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
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t('noVersionHistory')}
              </p>
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
                          {t('compareToPrev')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRollback(entry.timestamp)}
                        disabled={rollingBack !== null}
                        className="rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent"
                      >
                        {rollingBack === entry.timestamp ? t('rollingBack') : t('rollback')}
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
            <p className="text-[10px] text-muted-foreground">{t('predictHint')}</p>
            <textarea
              value={predictPrompt}
              onChange={(e) => setPredictPrompt(e.target.value)}
              placeholder={t('predictPromptPlaceholder')}
              rows={3}
              className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-foreground/20"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                onClick={handlePredict}
                disabled={predictLoading || !predictPrompt.trim()}
              >
                {predictLoading ? t('predicting') : t('runPredict')}
              </Button>
            </div>
            {predictResult && (
              <div className="space-y-2">
                {predictResult.message && (
                  <p className="text-[10px] text-muted-foreground">{predictResult.message}</p>
                )}
                <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3">
                  <StatCard
                    label={t('statTokenDelta')}
                    value={
                      predictResult.tokenDelta > 0
                        ? `+${predictResult.tokenDelta}`
                        : String(predictResult.tokenDelta)
                    }
                  />
                  <StatCard
                    label={t('statOutputDiff')}
                    value={predictResult.similarityDelta.toFixed(3)}
                  />
                  <StatCard
                    label={t('statQualityScore')}
                    value={predictResult.qualityScore.toFixed(3)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{t('suggestionLabel')}</span>
                  <span
                    className={cn(
                      'rounded-sm px-2 py-1 text-[10px]',
                      predictResult.recommendation === RECOMMENDATION_ENABLE
                        ? 'bg-green-500/10 text-green-600'
                        : predictResult.recommendation === RECOMMENDATION_DISABLE
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {t(RECOMMENDATION_LABEL_KEYS[predictResult.recommendation])}
                  </span>
                  {predictResult.degraded && (
                    <span className="rounded-sm bg-yellow-500/10 px-1 text-[10px] text-yellow-600">
                      {t('degradedMode')}
                    </span>
                  )}
                </div>
                {predictResult.withRule && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 rounded-md border border-border bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">{t('withoutRule')}</p>
                      <pre className="thin-scroll max-h-32 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        {predictResult.withoutRule}
                      </pre>
                    </div>
                    <div className="space-y-1 rounded-md border border-border bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">{t('withRule')}</p>
                      <pre className="thin-scroll max-h-32 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        {predictResult.withRule}
                      </pre>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {t('learnFeedbackLabel')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('helpful')}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    {t('helpful')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('unhelpful')}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                  >
                    <ThumbsDown className="h-3 w-3" />
                    {t('unhelpful')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('harmful')}
                    className="flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 text-[10px] text-destructive transition-colors hover:bg-destructive/10"
                  >
                    {t('harmful')}
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
            {tCommon('close')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export { RuleDetailDialog }
export type { RuleDetailDialogProps }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
