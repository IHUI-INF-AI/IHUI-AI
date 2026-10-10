// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { api } from '@/lib/feedback'
import { dismissSubmissionJob, registerSubmissionJob } from '@ihui/shared/jobs/submission-job'
import type { FeedbackItem, FeedbackType } from './types'
import { FeedbackList } from './FeedbackList'
import { FeedbackForm } from './FeedbackForm'
import { BackButton } from '@/components/common'

/** i18n 静态映射表 — 用于消除 `t(\`tab_${var}\`)` 动态拼接 */
const TAB_KEY: Record<'list' | 'new', string> = {
  list: 'tab_list',
  new: 'tab_new',
}

export default function FeedbackPage() {
  const t = useTranslations('feedback')
  const qc = useQueryClient()

  const [tab, setTab] = React.useState<'list' | 'new'>('list')
  const [type, setType] = React.useState<FeedbackType>('bug')
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [contact, setContact] = React.useState('')
  const [images, setImages] = React.useState<string[]>([])
  const [formError, setFormError] = React.useState<string | null>(null)
  /**
   * D192:提交成功回执的反馈编号。
   * 真源:POST /api/feedbacks → `reply.status(201).send(success({ feedback }))`
   * (apps/api/src/routes/comments.ts),`createFeedback()` 用 `.returning()` 取回整行,
   * 而 `feedbacks.id` 是 `uuid('id').defaultRandom().primaryKey()`
   * (packages/database/src/schema/comments.ts)—— 服务端生成的编号,不是前端造的。
   * web 侧 `api<{ feedback: FeedbackItem }>()` 已把 envelope 的 data 解出来,
   * 所以这里拿得到 `data.feedback.id`。
   */
  const [submittedRequestId, setSubmittedRequestId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['feedbacks'],
    queryFn: () => api<{ list: FeedbackItem[] }>('/api/feedbacks').then((d) => d.list ?? []),
  })

  const createMut = useMutation({
    mutationFn: (input: {
      type: FeedbackType
      title: string
      content: string
      contact?: string
      images?: string[]
    }) =>
      api<{ feedback: FeedbackItem }>('/api/feedbacks', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (d) => {
      setSubmittedRequestId(d.feedback?.id ?? null)
      qc.invalidateQueries({ queryKey: ['feedbacks'] })
      setTab('list')
      setType('bug')
      setTitle('')
      setContent('')
      setContact('')
      setImages([])
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmittedRequestId(null)
    if (!title.trim() || !content.trim()) {
      setFormError(t('required'))
      return
    }
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    const trimmedContact = contact.trim() || undefined
    const payloadImages = images.length > 0 ? images : undefined
    // G-815964:提交瞬间把整份表单注册进全局作业注册表 —— jobId 冻结快照,
    // 提交在途期间可按 jobId 查询;终态后立即真删(终态删不得就是只进不出的泄漏)。
    // paused-log 守卫在本链路暂无触发点(此处没有"挂起等用户补日志"的分支),留给后续消费点。
    const jobId = `feedback-submit-${crypto.randomUUID()}`
    const job = registerSubmissionJob({
      jobId,
      form: { type, title: trimmedTitle, content: trimmedContent, contact: trimmedContact, images: payloadImages },
    })
    createMut.mutate(
      {
        type,
        title: trimmedTitle,
        content: trimmedContent,
        contact: trimmedContact,
        images: payloadImages,
      },
      {
        onSuccess: (d) => {
          job.succeed(d.feedback?.id)
          dismissSubmissionJob(jobId)
        },
        onError: (err: Error) => {
          job.fail(err.message)
          dismissSubmissionJob(jobId)
        },
      },
    )
  }

  const list = data ?? []

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-4xl space-y-4">
      <BackButton />
      <div>
        <h1 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* D192:提交成功回执 —— 编号来自服务端 .returning() 的 feedbacks.id(uuid),可直接对账 */}
      {submittedRequestId && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg bg-cta/10 px-3 py-2 text-sm min-w-0"
        >
          <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="shrink-0 font-medium text-foreground">{t('success')}</span>
          <span className="min-w-0 break-all text-muted-foreground">
            {t('requestIdSuffix', { requestId: submittedRequestId })}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {(['list', 'new'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={cn(
              'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
              tab === v
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(TAB_KEY[v] ?? 'tab_unknown')}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-(--duration-unified) ease-unified">
        {tab === 'list' ? (
          <FeedbackList list={list} isLoading={isLoading} error={error as Error | null} />
        ) : (
          <FeedbackForm
            type={type}
            setType={setType}
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            contact={contact}
            setContact={setContact}
            images={images}
            setImages={setImages}
            formError={formError}
            isPending={createMut.isPending}
            onSubmit={handleSubmit}
            onCancel={() => setTab('list')}
          />
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
