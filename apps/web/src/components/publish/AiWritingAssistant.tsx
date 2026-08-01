'use client'

/**
 * AI 辅助写作 — 标题生成 / 正文润色 / 标签推荐 / 摘要生成 / SEO 分析 / 封面建议 / 批量分析。
 * titles/polish/tags/summary 复用 streamChat(/api/ai/chat/stream)SSE 基础设施。
 * seo/cover/analyzeAll 调用 @ihui/api-client 的 3 个 AI 写作端点
 * (analyzePublishSeo / suggestPublishCovers / analyzePublishAll),完整使用后端 7 个 AI 端点。
 *
 * AGENTS.md §4:rounded-md / 无分割线 / 无渐变遮罩
 * AGENTS.md §3:禁 any,精确类型
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Sparkles, Wand2, Tag, FileText, Search, ImageIcon, Zap } from 'lucide-react'
import {
  streamChat,
  analyzePublishSeo,
  suggestPublishCovers,
  analyzePublishAll,
} from '@ihui/api-client'
import type { SeoReport, AiAnalyzeAllResult } from '@ihui/api-client'
import { Button, Collapsible, CollapsibleTrigger, CollapsibleContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'

export interface AiWritingAssistantProps {
  readonly content: string
  readonly platform?: string
  readonly onApplyTitle: (title: string) => void
  readonly onApplyContent: (content: string) => void
  readonly onApplyTags: (tags: string[]) => void
  readonly onApplySummary: (summary: string) => void
}

type AiFunction = 'titles' | 'polish' | 'tags' | 'summary' | 'seo' | 'cover' | 'analyzeAll'

/** api-client 端点返回的结构化数据(seo/cover/analyzeAll) */
type AiEndpointData = SeoReport | string[] | AiAnalyzeAllResult

interface AiState {
  readonly loading: boolean
  readonly result: string
  readonly error: string
  readonly data?: AiEndpointData
}

const INITIAL_STATE: AiState = { loading: false, result: '', error: '' }

const PLATFORM_HINT: Record<string, string> = {
  wechat: '微信公众号(正式、有深度)',
  zhihu: '知乎(专业、有理有据)',
  xiaohongshu: '小红书(轻松、带 emoji、吸引点击)',
  csdn: 'CSDN(技术、实用)',
  juejin: '掘金(技术、年轻化)',
  weibo: '微博(简短、话题性强)',
  toutiao: '今日头条(信息量大、标题党适度)',
}

/** 走 streamChat 的 fn(titles/polish/tags/summary) */
const STREAM_FNS: ReadonlySet<AiFunction> = new Set(['titles', 'polish', 'tags', 'summary'])

function buildPrompt(fn: AiFunction, content: string, platform: string): string {
  const platformHint = PLATFORM_HINT[platform] ?? '通用平台'
  const truncated = content.length > 3000 ? content.slice(0, 3000) + '\n...(内容已截断)' : content

  switch (fn) {
    case 'titles':
      return `你是标题生成专家。基于以下正文,为${platformHint}生成 5 个吸引人的标题候选。每个标题单独一行,只输出标题文本,不要编号和解释。\n\n正文:\n${truncated}`
    case 'polish':
      return `你是中文润色专家。请润色以下正文,使其更通顺、更吸引人,适合${platformHint}发布。保持原意不变,直接输出润色后的完整正文,不要解释:\n\n${truncated}`
    case 'tags':
      return `你是标签推荐专家。基于以下正文,为${platformHint}推荐 5-10 个相关标签。每个标签用逗号分隔,只输出标签,不要解释:\n\n${truncated}`
    case 'summary':
      return `你是摘要生成专家。请为以下正文生成一段 100 字以内的摘要,用于 SEO。直接输出摘要文本,不要解释:\n\n${truncated}`
    default:
      // seo/cover/analyzeAll 走 api-client 端点,不经过 streamChat
      return ''
  }
}

function parseTags(raw: string): string[] {
  return raw.split(/[,，、\n]/).map((s) => s.trim().replace(/^#/, '')).filter(Boolean).slice(0, 10)
}

function parseTitles(raw: string): string[] {
  return raw.split('\n').map((s) => s.trim().replace(/^\d+[.、)]\s*/, '')).filter(Boolean).slice(0, 5)
}

/** 从正文第一行提取标题(用于 seo/analyzeAll 端点入参) */
function extractTitle(content: string): string {
  const firstLine = content.split('\n').map((l) => l.trim()).find((l) => l.length > 0)
  return firstLine ? firstLine.slice(0, 100) : ''
}

const AI_FUNCTIONS: readonly { fn: AiFunction; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { fn: 'titles', icon: Sparkles, labelKey: 'ai.generateTitles' },
  { fn: 'polish', icon: Wand2, labelKey: 'ai.polishContent' },
  { fn: 'tags', icon: Tag, labelKey: 'ai.recommendTags' },
  { fn: 'summary', icon: FileText, labelKey: 'ai.generateSummary' },
  { fn: 'seo', icon: Search, labelKey: 'ai.seoAnalysis' },
  { fn: 'cover', icon: ImageIcon, labelKey: 'ai.coverSuggestion' },
  { fn: 'analyzeAll', icon: Zap, labelKey: 'ai.analyzeAll' },
]

export function AiWritingAssistant({
  content,
  platform,
  onApplyTitle,
  onApplyContent,
  onApplyTags,
  onApplySummary,
}: AiWritingAssistantProps) {
  const t = useTranslations('publish')
  const model = useChatStore((s) => s.currentModel)
  const abortRef = React.useRef<AbortController | null>(null)
  const [states, setStates] = React.useState<Record<AiFunction, AiState>>({
    titles: INITIAL_STATE, polish: INITIAL_STATE, tags: INITIAL_STATE,
    summary: INITIAL_STATE, seo: INITIAL_STATE, cover: INITIAL_STATE,
    analyzeAll: INITIAL_STATE,
  })
  const [openFn, setOpenFn] = React.useState<AiFunction | null>(null)

  const runAi = React.useCallback(async (fn: AiFunction) => {
    if (!content.trim()) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStates((prev) => ({ ...prev, [fn]: { loading: true, result: '', error: '', data: undefined } }))
    setOpenFn(fn)

    let raw = ''
    try {
      await streamChat({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: buildPrompt(fn, content, platform ?? '') }],
        signal: controller.signal,
        onDelta: (delta) => {
          raw += delta
          setStates((prev) => ({ ...prev, [fn]: { loading: true, result: raw, error: '' } }))
        },
        onDone: () => {
          setStates((prev) => ({ ...prev, [fn]: { loading: false, result: raw, error: '' } }))
        },
        onError: (errMsg) => {
          setStates((prev) => ({ ...prev, [fn]: { loading: false, result: '', error: errMsg } }))
        },
      })
    } catch (e) {
      setStates((prev) => ({ ...prev, [fn]: { loading: false, result: '', error: (e as Error).message } }))
    }
  }, [content, platform, model])

  const runAiEndpoint = React.useCallback(async (fn: AiFunction) => {
    if (!content.trim()) return
    setStates((prev) => ({ ...prev, [fn]: { loading: true, result: '', error: '', data: undefined } }))
    setOpenFn(fn)
    try {
      const title = extractTitle(content)
      const plat = platform ?? ''
      let data: AiEndpointData | undefined
      if (fn === 'seo') {
        const res = await analyzePublishSeo(title, content, plat)
        if (!res.success) throw new Error(res.error)
        data = res.data.seo
      } else if (fn === 'cover') {
        const res = await suggestPublishCovers(content)
        if (!res.success) throw new Error(res.error)
        data = res.data.covers
      } else if (fn === 'analyzeAll') {
        const res = await analyzePublishAll(content, title, plat)
        if (!res.success) throw new Error(res.error)
        data = res.data
      }
      setStates((prev) => ({ ...prev, [fn]: { loading: false, result: '', error: '', data } }))
    } catch (e) {
      setStates((prev) => ({ ...prev, [fn]: { loading: false, result: '', error: (e as Error).message } }))
    }
  }, [content, platform])

  const applyResult = React.useCallback((fn: AiFunction, result: string) => {
    switch (fn) {
      case 'titles': {
        const titles = parseTitles(result)
        if (titles[0]) onApplyTitle(titles[0])
        break
      }
      case 'polish':
        onApplyContent(result)
        break
      case 'tags':
        onApplyTags(parseTags(result))
        break
      case 'summary':
        onApplySummary(result.trim())
        break
    }
  }, [onApplyTitle, onApplyContent, onApplyTags, onApplySummary])

  /** 批量分析结果一键应用:标题[0] + 标签 + 摘要 */
  const applyAnalyzeAll = React.useCallback((data: AiAnalyzeAllResult) => {
    if (data.titles[0]) onApplyTitle(data.titles[0])
    if (data.tags.length > 0) onApplyTags(data.tags)
    if (data.summary) onApplySummary(data.summary)
  }, [onApplyTitle, onApplyTags, onApplySummary])

  const triggerFn = React.useCallback((fn: AiFunction, hasResult: boolean) => {
    if (hasResult) {
      setOpenFn(fn)
      return
    }
    if (STREAM_FNS.has(fn)) void runAi(fn)
    else void runAiEndpoint(fn)
  }, [runAi, runAiEndpoint])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        {t('ai.title')}
      </div>
      {AI_FUNCTIONS.map(({ fn, icon: Icon, labelKey }) => {
        const state = states[fn]
        const isOpen = openFn === fn
        const hasResult = Boolean(state.result || state.data)
        const isStream = STREAM_FNS.has(fn)
        return (
          <Collapsible key={fn} open={isOpen} onOpenChange={(o) => setOpenFn(o ? fn : null)}>
            <div className="rounded-md border border-border/60 bg-card">
              <CollapsibleTrigger
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent/40"
                onClick={() => {
                  if (!isOpen) triggerFn(fn, hasResult)
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1">{t(labelKey as never)}</span>
                {state.loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 rounded-b-md bg-muted/20 px-2.5 py-2">
                  {state.error ? (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{state.error}</p>
                  ) : state.loading && !hasResult ? (
                    <p className="text-[11px] text-muted-foreground">{t('ai.thinking')}</p>
                  ) : (
                    <>
                      {isStream ? (
                        <pre className={cn(
                          'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-[11px] leading-relaxed',
                        )}>
                          {state.result || t('ai.thinking')}
                        </pre>
                      ) : (
                        <EndpointResult fn={fn} data={state.data} loading={state.loading} />
                      )}
                      {hasResult && !state.loading && (
                        <div className="flex flex-wrap items-center gap-1">
                          {fn === 'titles' && parseTitles(state.result).map((title, i) => (
                            <Button
                              key={i}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => onApplyTitle(title)}
                            >
                              {t('ai.apply')} {i + 1}
                            </Button>
                          ))}
                          {isStream && fn !== 'titles' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => applyResult(fn, state.result)}
                            >
                              {t('ai.apply')}
                            </Button>
                          )}
                          {fn === 'analyzeAll' && state.data && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => applyAnalyzeAll(state.data as AiAnalyzeAllResult)}
                            >
                              {t('ai.apply')}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-muted-foreground"
                            onClick={() => triggerFn(fn, false)}
                          >
                            {t('ai.retry')}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      })}
      {!content.trim() && (
        <p className="px-1 text-[10px] text-muted-foreground">{t('ai.emptyContent')}</p>
      )}
    </div>
  )
}

/** seo/cover/analyzeAll 端点结构化结果展示 */
function EndpointResult({
  fn,
  data,
  loading,
}: {
  readonly fn: AiFunction
  readonly data: AiEndpointData | undefined
  readonly loading: boolean
}) {
  const t = useTranslations('publish')
  if (loading || !data) {
    return <p className="text-[11px] text-muted-foreground">{t('ai.thinking')}</p>
  }

  if (fn === 'seo') {
    const seo = data as SeoReport
    return (
      <div className="space-y-1.5 rounded bg-muted/40 p-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t('ai.seoScore')}</span>
          <span className="font-medium">{seo.score}</span>
          <span className="text-muted-foreground">/100</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">T:{seo.titleScore}</span>
          <span className="text-muted-foreground">C:{seo.contentScore}</span>
        </div>
        {Object.keys(seo.keywordDensity).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(seo.keywordDensity).slice(0, 6).map(([kw, pct]) => (
              <span key={kw} className="rounded bg-background px-1.5 py-0.5 text-[10px]">
                {kw} {pct}%
              </span>
            ))}
          </div>
        )}
        {seo.suggestions.length > 0 && (
          <ul className="space-y-0.5 pl-4 text-[10px] text-muted-foreground">
            {seo.suggestions.slice(0, 5).map((s, i) => (
              <li key={i} className="list-disc">{s}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (fn === 'cover') {
    const covers = data as string[]
    return (
      <ul className="space-y-0.5 rounded bg-muted/40 p-2 text-[11px] leading-relaxed">
        {covers.map((c, i) => (
          <li key={i} className="list-disc pl-3">{c}</li>
        ))}
      </ul>
    )
  }

  // analyzeAll
  const all = data as AiAnalyzeAllResult
  return (
    <div className="space-y-1.5 rounded bg-muted/40 p-2 text-[11px]">
      {all.titles.length > 0 && (
        <div>
          <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">{t('ai.generateTitles')}</div>
          <ul className="space-y-0.5 pl-4">
            {all.titles.slice(0, 3).map((tt, i) => (
              <li key={i} className="list-disc">{tt}</li>
            ))}
          </ul>
        </div>
      )}
      {all.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {all.tags.slice(0, 8).map((tg) => (
            <span key={tg} className="rounded bg-background px-1.5 py-0.5 text-[10px]">#{tg}</span>
          ))}
        </div>
      )}
      {all.summary && (
        <p className="text-[10px] text-muted-foreground">{all.summary}</p>
      )}
      {all.seo && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-muted-foreground">{t('ai.seoScore')}</span>
          <span className="font-medium">{all.seo.score}</span>
          <span className="text-muted-foreground">/100</span>
        </div>
      )}
      {all.covers.length > 0 && (
        <ul className="space-y-0.5 pl-4 text-[10px]">
          {all.covers.slice(0, 3).map((cv, i) => (
            <li key={i} className="list-disc">{cv}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
