// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Clock, Loader2, LogIn, Plus, Star } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { sortPinnedFirst } from '@ihui/shared'
import { BackButton } from '@/components/common'
import { Button, SearchInput } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { ConversationList, type Conversation } from '@/components/chat/conversation-list'
import { useAuthStore } from '@/stores/auth'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'

interface ConversationsResponse {
  conversations: Conversation[]
  total: number
  page: number
  pageSize: number
}

async function fetchConversations(): Promise<ConversationsResponse> {
  const res = await fetchApi<ConversationsResponse>('/api/chat/conversations?pageSize=100')
  if (!res.success) throw new Error(res.error)
  return res.data
}

export default function ChatHistoryPage() {
  const t = useTranslations('chatHistory')
  const router = useRouter()
  const [q, setQ] = useState('')

  // 2026-09-30:登录态门。此前 useQuery 无 enabled 门,未登录/会话过期时照样发请求:
  // 401 → TanStack 重试三轮(「加载中...」空转约 8s)→ 落到「操作失败,请稍后重试」,
  // 未登录用户全程得不到任何登录引导。改为 ready+isAuthenticated 双门,
  // 未登录直接渲染登录提示(与 ModelsMarketplace enabled 门、sidebar-chat-history
  // 登录早退同一模式);会话过期 = isAuthenticated=false 同样吃到该分支。
  const { ready } = useAuthBootstrap()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: fetchConversations,
    enabled: ready && isAuthenticated,
  })

  const keyword = q.trim().toLowerCase()
  // 列表渲染序必须过唯一排序出口:ConversationList 的置顶乐观更新只翻标记,
  // 不在这里排的话,"取消置顶"那一行会原地停到下次 refetch 才落位。
  const items = sortPinnedFirst(
    (data?.conversations ?? []).filter((c) => !keyword || c.title.toLowerCase().includes(keyword)),
  )
  const total = data?.total ?? items.length

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="h-6 w-6 text-primary" />
            {t('title')}
            {total > 0 && (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums leading-none text-muted-foreground">
                {total}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={t('viewFavorites')}>
            <Button variant="outline" size="icon" asChild>
              <Link href="/chat/favorites">
                <Star className="h-4 w-4" />
              </Link>
            </Button>
          </Tooltip>
          <Button size="sm" onClick={() => router.push('/chat')}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('newChat')}
          </Button>
        </div>
      </div>

      <SearchInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('searchPlaceholder')}
      />

      {!ready || !isAuthenticated ? (
        // 未登录/会话过期:登录引导,而非发注定 401 的请求再报「操作失败」
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
          <LogIn className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('loginRequired')}</p>
          <Button
            size="sm"
            onClick={() => openLoginDialogOnce('/chat/history')}
          >
            {t('loginRequired')}
          </Button>
        </div>
      ) : isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
          <Clock className="h-8 w-8 opacity-40" />
          <p className="text-sm">{keyword ? t('noResults') : t('empty')}</p>
        </div>
      ) : (
        <ConversationList items={items} />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
