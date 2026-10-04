// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, FileQuestion } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

/**
 * 答题记录(= `GET /api/exam/records` 的 `ExamRecord` 行,见 `exam_records` 表)。
 *
 * 字段映射注意(2026-10-04,改 URL 时逐字段核对过,别照 `title` 想当然):
 *  · 后端**没有 title**:`findMyExamRecords` 是裸 `select()`,没 join `exam_papers`
 *    (`exam-queries.ts:410`)。卷名要走 `/exam/papers/by-ids` 二次取或改后端(不在本票范围)。
 *    标题退回 `paperId` 前 8 位,与管理员批改页同一口径(`admin/exam-marking/page.tsx`)。
 *  · `score` 是 PG `numeric`,经 JSON 序列化后是**字符串**(不是 number)——
 *    原 `typeof e.score === 'number'` 判据会让分数整列不渲染,已改为显式 `Number()` 归一。
 *  · `status` 后端取值 `pending | submitted | graded`,与页面原 STATUS_STYLE 的
 *    `draft/published/completed/reviewing` 完全不同 ⇒ 旧表恒走 default 灰色兜底。
 *    现按后端真实取值映射到既有词条,不新增 i18n 键(5 语言 parity 守门)。
 *  · 链接必须用 `paperId`:`/exam/[id]` 读的是 `/api/exam/papers/${id}`,吃的是卷 id,
 *    传记录 id 会 404/空卷。
 */
interface ExamRecord {
  id: string
  paperId: string
  score: string | number
  status: 'pending' | 'submitted' | 'graded' | string
  createdAt: string
}

interface ExamListResponse {
  list?: ExamRecord[]
  total?: number
}

/** 后端 `pending|submitted|graded` → 页面四档展示态。 */
const STATUS_MAP: Record<string, 'draft' | 'published' | 'completed' | 'reviewing'> = {
  pending: 'draft',
  submitted: 'reviewing',
  graded: 'completed',
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-500/10 text-green-600',
  completed: 'bg-blue-500/10 text-blue-600',
  reviewing: 'bg-orange-500/10 text-orange-600',
}

async function fetchExams(): Promise<ExamRecord[]> {
  // 不传 userId:后端 `exam.ts:648` 用 `request.userId!` 从 JWT 取,查询参数里的 userId 会被忽略。
  // 继续传等于把"鉴权当查询参数传"的越权隐患留在代码里(哪天后端改成读 query 就成真漏洞)。
  const r = await fetchApi<ExamListResponse>('/api/exam/records')
  if (!r.success) return []
  return r.data?.list ?? []
}

export default function UserExamPage() {
  const t = useTranslations('user.exam')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)
  const STATUS_LABEL: Record<string, string> = {
    draft: t('statusDraft'),
    published: t('statusPublished'),
    completed: t('statusCompleted'),
    reviewing: t('statusReviewing'),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['user', 'exams', user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchExams(),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const items = data ?? []

  return (
    <div className="px-4 space-y-4 py-4">
      <BackButton />
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading', { default: '加载中…' })}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
          <FileQuestion className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((e) => {
            const display = STATUS_MAP[e.status] ?? 'draft'
            // 只有 pending(已开场未交卷)才是"进行中",可继续作答;graded/submitted 已终态。
            const inProgress = e.status === 'pending'
            // numeric 列经 JSON 变字符串,统一 Number() 归一(空/非数值为 null ⇒ 不渲染)
            const score = e.score === null || e.score === undefined ? null : Number(e.score)
            const hasScore = score !== null && Number.isFinite(score)
            return (
              <li
                key={e.id}
                className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {/* 后端无 title(见文件头字段映射说明):退回 paperId 前 8 位,
                          与管理员批改页 `r.paperTitle ?? r.paperId.slice(0, 8)` 同一口径。 */}
                      <h3 className="truncate text-sm font-semibold">{e.paperId.slice(0, 8)}</h3>
                      {e.status ? (
                        <span
                          className={cn(
                            'shrink-0 rounded-md px-2 py-0.5 text-xs',
                            STATUS_STYLE[display] ?? STATUS_STYLE.draft,
                          )}
                        >
                          {STATUS_LABEL[display] ?? display}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {hasScore ? (
                        <span>
                          {t('score')}: {score}
                        </span>
                      ) : null}
                      {e.createdAt ? <span>{dateFmt.format(new Date(e.createdAt))}</span> : null}
                    </div>
                  </div>
                  {inProgress ? (
                    <Link
                      href={`/exam/${e.paperId}`}
                      className="shrink-0 rounded-md bg-cta px-3 py-1 text-xs font-medium text-cta-foreground transition-colors hover:bg-cta/90"
                    >
                      {t('continue', { default: '继续考试' })}
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
