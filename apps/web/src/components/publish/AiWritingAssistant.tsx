'use client'

/**
 * AI 辅助写作 — 标题生成 / 正文润色 / 标签推荐 / 摘要生成 / SEO 分析 / 封面建议。
 * 复用项目已有的 streamChat(/api/ai/chat/stream)SSE 基础设施,无需新后端端点。
 *
 * AGENTS.md §4:rounded-md / 无分割线 / 无渐变遮罩
 * AGENTS.md §3:禁 any,精确类型
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Sparkles, Wand2, Tag, FileText, Search, ImageIcon } from 'lucide-react'
import { streamChat } from '@ihui/api-client'
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

type AiFunction = 'titles' | 'polish' | 'tags' | 'summary' | 'seo' | 'cover'

interface AiState {
  readonly loading: boolean
  readonly result: string
  readonly error: string
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
    case 'seo':
      return `你是 SEO 分析专家。请分析以下正文(平台:${platformHint})的 SEO 质量,输出 JSON 格式:\n{"score":1-100,"titleScore":1-100,"contentScore":1-100,"keywordDensity":{"关键词":百分比},"suggestions":["建议1","建议2"]}\n只输出 JSON,不要其他文字:\n\n${truncated}`
    case 'cover':
      return `你是封面设计顾问。基于以下正文,建议 3 个封面设计方案(风格/配色/元素)。每个方案一行,简洁描述:\n\n${truncated}`
  }
}

function parseTags(raw: string): string[] {
  return raw.split(/[,，、\n]/).map((s) => s.trim().replace(/^#/, '')).filter(Boolean).slice(0, 10)
}

function parseTitles(raw: string): string[] {
  return raw.split('\n').map((s) => s.trim().replace(/^\d+[.、)]\s*/, '')).filter(Boolean).slice(0, 5)
}

const AI_FUNCTIONS: readonly { fn: AiFunction; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { fn: 'titles', icon: Sparkles, labelKey: 'ai.generateTitles' },
  { fn: 'polish', icon: Wand2, labelKey: 'ai.polishContent' },
  { fn: 'tags', icon: Tag, labelKey: 'ai.recommendTags' },
  { fn: 'summary', icon: FileText, labelKey: 'ai.generateSummary' },
  { fn: 'seo', icon: Search, labelKey: 'ai.seoAnalysis' },
  { fn: 'cover', icon: ImageIcon, labelKey: 'ai.coverSuggestion' },
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
  })
  const [openFn, setOpenFn] = React.useState<AiFunction | null>(null)

  const runAi = React.useCallback(async (fn: AiFunction) => {
    if (!content.trim()) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStates((prev) => ({ ...prev, [fn]: { loading: true, result: '', error: '' } }))
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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        {t('ai.title')}
      </div>
      {AI_FUNCTIONS.map(({ fn, icon: Icon, labelKey }) => {
        const state = states[fn]
        const isOpen = openFn === fn
        return (
          <Collapsible key={fn} open={isOpen} onOpenChange={(o) => setOpenFn(o ? fn : null)}>
            <div className="rounded-md border border-border/60 bg-card">
              <CollapsibleTrigger
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent/40"
                onClick={() => {
                  if (!isOpen && !state.result) void runAi(fn)
                  else if (!isOpen && state.result) setOpenFn(fn)
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
                  ) : state.loading && !state.result ? (
                    <p className="text-[11px] text-muted-foreground">{t('ai.thinking')}</p>
                  ) : (
                    <>
                      <pre className={cn(
                        'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-[11px] leading-relaxed',
                        fn === 'seo' && 'font-mono',
                      )}>
                        {state.result || t('ai.thinking')}
                      </pre>
                      {state.result && !state.loading && (
                        <div className="flex items-center gap-1">
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
                          {fn !== 'titles' && fn !== 'seo' && fn !== 'cover' && (
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-muted-foreground"
                            onClick={() => void runAi(fn)}
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
