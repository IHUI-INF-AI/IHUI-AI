'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Bot,
  Code,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  Wand2,
  CheckCircle2,
  Send,
  XCircle,
  MessageSquare,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  getAiSkill,
  invokeAiSkill,
  getAiSkillRecommendations,
  exportAiSkill,
  type AiSkillMeta,
  type AiSkillInvokeResponse,
} from '@ihui/api-client/endpoints/ai-skills'
import { fetchApi } from '@ihui/api-client'
import { Badge } from '@/components/data'
import { cn } from '@/lib/utils'
import {
  getLabelKey,
  getPlaceholderKey,
  getMaxLen,
  isLongText,
  parseVariables,
} from '@/lib/ai-skill-variables'
import { useChatStore } from '@/stores/chat'

/**
 * AI Skill 详情页 — 2026-07-23 新增, 2026-08-08 深度重构
 *
 * 路由:`/ai-skills/[id]`
 *
 * 行为:
 * - 顶部:返回 + skill icon/name/status/sourceUrl
 * - 元数据区:description + tags + source 链接(若 available=false)
 * - 调用区(available=true):动态参数表单(基于共享 ai-skill-variables 模块)
 * - 结果区:text / html iframe / json 三种 contentType + 发送到聊天
 * - 占位 skill:不显示调用区,显示引导 + GitHub 链接
 *
 * 2026-08-08 深度重构:
 * - 使用共享 @ihui/shared/utils/ai-skill-variables 模块替代重复代码
 * - 使用 draftInput + router.push 实现无缝"发送到聊天"流程
 * - 结果区添加"发送到聊天"快捷按钮
 * - 输入字段级验证提示
 */

const CATEGORY_ICON: Record<
  AiSkillMeta['category'],
  React.ComponentType<{ className?: string }>
> = {
  code: Code,
  media: FileText,
  'ai-top': Sparkles,
}

async function fetchSkill(id: string): Promise<AiSkillMeta> {
  const r = await getAiSkill(id)
  if (!r.success || !r.data) throw new Error(r.error ?? 'not found')
  return r.data
}

export default function AiSkillDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const t = useTranslations('aiSkillDetail')
  const tp = useTranslations('aiSkillsPage')

  const {
    data: skill,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ai-skills', 'detail', id],
    queryFn: () => fetchSkill(id),
    enabled: !!id,
  })

  // 变量输入态(键为变量名)
  const [variables, setVariables] = React.useState<Record<string, string>>({})
  const [running, setRunning] = React.useState(false)
  const [result, setResult] = React.useState<AiSkillInvokeResponse | null>(null)
  const [invokeError, setInvokeError] = React.useState<string | null>(null)
  // 字段级验证:记录缺失的字段名
  const [missingFields, setMissingFields] = React.useState<Set<string>>(new Set())

  // 切换 skill 时重置
  React.useEffect(() => {
    setVariables({})
    setResult(null)
    setInvokeError(null)
    setRunning(false)
    setMissingFields(new Set())
  }, [id])

  /** 发送结果到对话:设置 draftInput 后跳转到 /chat */
  const sendToChat = React.useCallback(
    (content: string) => {
      useChatStore.setState({ draftInput: content })
      router.push('/chat')
    },
    [router],
  )

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl py-8">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{tp('loading')}</span>
        </div>
      </div>
    )
  }

  if (error || !skill) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <BackLink />
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t('notFound')}
        </div>
      </div>
    )
  }

  const Icon = CATEGORY_ICON[skill.category] ?? Wand2
  const detectedVars = parseVariables(skill.promptTemplate)
  const renderVars = detectedVars.length > 0 ? detectedVars : skill.available ? ['content'] : []

  const handleSubmit = async () => {
    if (running) return
    // 字段级校验:标记所有缺失字段
    const newMissing = new Set<string>()
    for (const k of renderVars) {
      if (!variables[k]?.trim()) {
        newMissing.add(k)
      }
    }
    if (newMissing.size > 0) {
      setMissingFields(newMissing)
      setInvokeError(t('invokeMissingVariable'))
      return
    }
    setMissingFields(new Set())
    setRunning(true)
    setInvokeError(null)
    setResult(null)
    try {
      const r = await invokeAiSkill(skill.id, { variables })
      if (r.success && r.data) {
        if (r.data.ok) {
          setResult(r.data)
        } else {
          setInvokeError(r.data.error || r.data.guidance || t('invokeError'))
        }
      } else {
        setInvokeError(t('invokeError'))
      }
    } catch {
      setInvokeError(t('invokeError'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4">
      <BackLink />

      {/* 头部:icon + name + 状态徽章 + sourceUrl */}
      <header className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{skill.name}</h1>
            <Badge variant={skill.available ? 'success' : 'default'}>
              {skill.available ? t('statusAvailable') : t('statusComingSoon')}
            </Badge>
            {skill.available && (
              <Link
                href="/models/openclaw"
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Bot className="h-3.5 w-3.5" />
                {t('addToAgent')}
              </Link>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {tp(
              `category${skill.category === 'ai-top' ? 'AiTop' : skill.category === 'code' ? 'Code' : 'Media'}` as 'categoryCode',
            )}
            <span className="mx-1.5">·</span>
            <span className="font-mono">{skill.id}</span>
          </div>
        </div>
      </header>

      {/* 元数据区 */}
      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('sectionMeta')}
        </h2>
        <p className="text-sm leading-relaxed text-foreground/90">{skill.description}</p>
        {skill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skill.tags.map((tag: string) => (
              <span
                key={tag}
                className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {skill.sourceUrl && !skill.available && (
          <a
            href={skill.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
          >
            <Code className="h-3.5 w-3.5" />
            {t('openGitHub')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {/* 导出按钮 */}
        <button
          type="button"
          onClick={async () => {
            try {
              const r = await exportAiSkill(skill.id)
              if (r.success && r.data) {
                const blob = new Blob([JSON.stringify(r.data, null, 2)], {
                  type: 'application/json',
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${skill.id}.json`
                a.click()
                URL.revokeObjectURL(url)
                toast.success(t('exportSuccess'))
              } else {
                toast.error(r.error ?? t('exportError'))
              }
            } catch {
              toast.error(t('exportError'))
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" />
          {t('exportBtn')}
        </button>
        {/* 版本信息 */}
        {(skill as unknown as Record<string, unknown>).version ||
        (skill as unknown as Record<string, unknown>).updatedAt ? (
          <p className="text-xs text-muted-foreground">
            {(skill as unknown as Record<string, unknown>).version ? (
              <>
                {t('versionLabel')}: v
                {String((skill as unknown as Record<string, unknown>).version)}
              </>
            ) : null}
            {(skill as unknown as Record<string, unknown>).version &&
            (skill as unknown as Record<string, unknown>).updatedAt ? (
              <span className="mx-1">·</span>
            ) : null}
            {(skill as unknown as Record<string, unknown>).updatedAt ? (
              <>
                {t('updatedAt')}{' '}
                {String((skill as unknown as Record<string, unknown>).updatedAt).slice(0, 10)}
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      {/* 调用区(available=true) */}
      {skill.available ? (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('sectionInvoke')}
          </h2>

          <div className="space-y-2.5">
            {renderVars.map((key) => {
              const labelKey = getLabelKey(key) as 'inputContent'
              const placeholderKey = getPlaceholderKey(key) as 'placeholderContent'
              const maxLen = getMaxLen(key)
              const long = isLongText(key)
              const isMissing = missingFields.has(key)
              const val = variables[key] ?? ''
              return (
                <div key={key} className="space-y-1">
                  <label
                    htmlFor={`var-${key}`}
                    className={cn(
                      'text-xs font-medium',
                      isMissing ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {t(labelKey)}
                    {isMissing && (
                      <span className="ml-1 text-[10px] text-destructive">
                        *{t('invokeRequired')}
                      </span>
                    )}
                  </label>
                  {long ? (
                    <textarea
                      id={`var-${key}`}
                      value={val}
                      onChange={(e) => {
                        setVariables((prev) => ({
                          ...prev,
                          [key]: e.target.value.slice(0, maxLen),
                        }))
                        if (isMissing && e.target.value.trim()) {
                          setMissingFields((prev) => {
                            const next = new Set(prev)
                            next.delete(key)
                            return next
                          })
                        }
                      }}
                      placeholder={t(placeholderKey)}
                      aria-label={t(labelKey)}
                      maxLength={maxLen}
                      rows={key === 'content' || key === 'text' ? 4 : 3}
                      className={cn(
                        'thin-scroll w-full resize-none rounded-md border bg-background px-3 py-1.5 text-sm leading-snug outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30',
                        isMissing ? 'border-destructive/60' : 'border-border',
                      )}
                    />
                  ) : (
                    <input
                      id={`var-${key}`}
                      type="text"
                      value={val}
                      onChange={(e) => {
                        setVariables((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                        if (isMissing && e.target.value.trim()) {
                          setMissingFields((prev) => {
                            const next = new Set(prev)
                            next.delete(key)
                            return next
                          })
                        }
                      }}
                      placeholder={t(placeholderKey)}
                      aria-label={t(labelKey)}
                      className={cn(
                        'w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30',
                        isMissing ? 'border-destructive/60' : 'border-border',
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {invokeError && (
            <div className="flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{invokeError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={running}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                running
                  ? 'cursor-not-allowed bg-muted text-muted-foreground/60'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {running ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t('invokeRunning')}</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>{t('invokeButton')}</span>
                </>
              )}
            </button>
          </div>
        </section>
      ) : (
        /* 占位 skill:不显示调用区,显示引导 */
        <section className="space-y-2 rounded-lg border border-dashed bg-muted/30 p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            {t('comingSoonTitle')}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('comingSoonHint')}</p>
        </section>
      )}

      {/* 结果区 */}
      {result && (
        <section className="space-y-2 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {t('result')}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {result.model && (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono">{result.model}</span>
              )}
              <span className="rounded-sm bg-muted px-1.5 py-0.5">{result.duration_ms}ms</span>
            </div>
          </div>
          <ResultContent result={result} />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => sendToChat(result.content)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <MessageSquare className="h-3 w-3" />
              {t('sendToChat')}
            </button>
          </div>
        </section>
      )}

      {/* 使用反馈(仅当有调用结果时) */}
      {result && <FeedbackSection skillId={skill.id} t={t} />}

      {/* 相关推荐 */}
      <RecommendationsSection skillName={skill.name} t={t} />
    </div>
  )
}

function BackLink() {
  const t = useTranslations('aiSkillDetail')
  return (
    <Link
      href="/ai-skills"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {t('backToList')}
    </Link>
  )
}

interface ResultContentProps {
  result: AiSkillInvokeResponse
}

function ResultContent({ result }: ResultContentProps) {
  const t = useTranslations('aiSkillDetail')
  if (result.contentType === 'html') {
    return (
      <iframe
        srcDoc={result.content}
        title={result.skillId}
        sandbox=""
        className="thin-scroll h-[280px] w-full rounded-md border border-border bg-background"
      />
    )
  }
  if (result.contentType === 'json') {
    let pretty = result.content
    try {
      pretty = JSON.stringify(JSON.parse(result.content), null, 2)
    } catch {
      /* keep raw */
    }
    return (
      <pre className="thin-scroll max-h-[280px] overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed">
        {pretty}
      </pre>
    )
  }
  return (
    <div className="thin-scroll max-h-[280px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
      {result.content || t('resultEmpty')}
    </div>
  )
}

/** 使用反馈区块 */
function FeedbackSection({
  skillId,
  t,
}: {
  skillId: string
  t: ReturnType<typeof useTranslations<'aiSkillDetail'>>
}) {
  const [rating, setRating] = React.useState(0)
  const [hoverRating, setHoverRating] = React.useState(0)
  const [comment, setComment] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error(t('feedbackRequired'))
      return
    }
    setSubmitting(true)
    try {
      const r = await fetchApi<{ ok: boolean }>(
        `/api/ai-skills/${encodeURIComponent(skillId)}/feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ skillId, rating, comment: comment.trim() || undefined }),
        },
      )
      if (r.success) {
        setSubmitted(true)
        toast.success(t('feedbackSubmitted'))
      } else {
        toast.error(t('feedbackError'))
      }
    } catch {
      toast.error(t('feedbackError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('feedbackTitle')}
      </h2>
      {submitted ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          {t('feedbackSubmitted')}
        </p>
      ) : (
        <div className="space-y-3">
          {/* 评分 */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground">{t('feedbackRating')}</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-colors hover:text-amber-400"
                  aria-label={`${star} star`}
                >
                  <Star
                    className={cn(
                      'h-5 w-5',
                      star <= (hoverRating || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          {/* 评价 */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">{t('feedbackComment')}</label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('feedbackCommentPlaceholder')}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
            />
          </div>
          {/* 提交按钮 */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                submitting
                  ? 'cursor-not-allowed bg-muted text-muted-foreground/60'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t('feedbackSubmit')}</span>
                </>
              ) : (
                <span>{t('feedbackSubmit')}</span>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** 相关推荐技能区块 */
function RecommendationsSection({
  skillName,
  t,
}: {
  skillName: string
  t: ReturnType<typeof useTranslations<'aiSkillDetail'>>
}) {
  const { data: result, isLoading } = useQuery({
    queryKey: ['ai-skills', 'recommendations', skillName],
    queryFn: () => getAiSkillRecommendations({ context: skillName, top_k: 4 }),
    enabled: !!skillName,
  })

  const recommendations = result?.success ? result.data : []

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="space-y-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('relatedTitle')}
        </h2>
        <p className="text-[11px] text-muted-foreground/70">{t('relatedHint')}</p>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{t('relatedLoading')}</span>
        </div>
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('relatedEmpty')}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {recommendations.map((rec) => (
            <Link
              key={rec.skill_id}
              href={`/ai-skills/${rec.skill_id}`}
              className="group flex w-64 shrink-0 flex-col gap-2 rounded-md border border-border bg-background p-3 transition-colors hover:border-foreground/20 hover:bg-accent/50"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Wand2 className="h-4 w-4" />
                </div>
                <span className="truncate text-sm font-medium">{rec.name}</span>
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground">{rec.description}</p>
              {rec.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {rec.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {rec.reason && (
                <p className="text-[10px] leading-tight text-muted-foreground/60">
                  {t('reason')} {rec.reason}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
