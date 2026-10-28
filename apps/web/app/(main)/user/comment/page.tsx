// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, MessageSquare } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { pushError } from '@/stores/error-banner'
import { BackButton } from '@/components/common'

interface CommentItem {
  id: string
  content: string
  targetTitle?: string | null
  targetType?: string | null
  createdAt: string
}

const TYPE_BADGE: Record<string, string> = {
  article: 'bg-muted text-muted-foreground',
  course: 'bg-blue-500/10 text-blue-600',
  ask: 'bg-orange-500/10 text-orange-600',
}

export default function CommentPage() {
  const t = useTranslations('user.comment')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)
  // 2026-10-15 登录态门:未就绪/未登录不发注定 401 的查询。
  // 2026-10-27 改面:原先打 `/api/comments?authorId=` —— 该公开列表面的 query 模式只认
  // resourceType/resourceId/parentId,zod 默认剥未知键 ⇒ authorId 被静默丢弃,页面拿回的是
  // "全站顶级评论"而不是本人的(取错数据,比 404 更难发现)。现改打自范围面
  // GET /api/comments/mine,主体取自令牌,页面不再也不该自报用户 id(§5 认证不等于授权)。
  const { allow } = useAuthGate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', 'comment', user?.id],
    enabled: allow && !!user?.id,
    queryFn: async (): Promise<CommentItem[]> => {
      const r = await fetchApi<{ list?: CommentItem[] } | CommentItem[]>(`/api/comments/mine`)
      if (!r.success) {
        if (r.status === 404) return []
        throw new Error(r.error)
      }
      const d = r.data
      return Array.isArray(d) ? d : (d.list ?? [])
    },
  })

  // 2026-08-01 错误推送全局 banner(常驻 + 顶部滑下),替代 inline 英文错误显示
  React.useEffect(() => {
    if (error) pushError(error)
  }, [error])

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const items = data ?? []

  return (
    <div className="px-4 space-y-4 py-4">
      <BackButton />
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading', { default: '加载中...' })}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty', { default: '目前还没有数据' })}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
            >
              <div className="space-y-1.5">
                <p className="break-words text-sm">{item.content}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.targetTitle ? (
                    <span className="truncate">on {item.targetTitle}</span>
                  ) : null}
                  {item.targetType ? (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        TYPE_BADGE[item.targetType] ?? 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.targetType}
                    </span>
                  ) : null}
                  {item.createdAt ? (
                    <span className="ml-auto">{dateFmt.format(new Date(item.createdAt))}</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
