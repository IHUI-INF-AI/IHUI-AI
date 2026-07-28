'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Clock, Loader2, Plus, Search, Star } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'
import { ErrorBoundary } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { Button, Input } from '@ihui/ui-react'
import { ConversationList, type Conversation } from '@/components/chat/conversation-list'

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetchApi<{ conversations: Conversation[] }>('/api/chat/conversations')
  if (!res.success) throw new Error(res.error)
  return res.data.conversations
}

/**
 * /chat 路由:作为 AI docked 面板的快捷入口。
 * 进入此路由自动打开侧边面板(AISidePanel),逻辑已迁移到 AISidePanel。
 * 右侧工作区改为渲染对话历史列表(2026-07-28 用户反馈:右侧原先的 "开始新的任务" 空状态
 * 与 AI 面板的欢迎页完全重复,用户期望看到正常页面内容 → 改为对话历史列表,
 * 用户可在此挑选历史会话加载到 AI 面板,或点击"新建对话"开始新任务)。
 */
function ChatEntry() {
  const tHistory = useTranslations('chatHistory')
  const openPanel = useAiPanelStore((s) => s.openPanel)
  const setConversationId = useChatStore((s) => s.setConversationId)
  const [q, setQ] = React.useState('')

  React.useEffect(() => {
    openPanel()
  }, [openPanel])

  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: fetchConversations,
  })

  const keyword = q.trim().toLowerCase()
  const items = (data ?? []).filter(
    (c) => !c.archivedAt && (!keyword || c.title.toLowerCase().includes(keyword)),
  )
  const total = data?.length ?? 0

  // 点击 ConversationList 的会话项会:
  // 1) setConversationId(已内置) 2) openPanel(已内置) 3) router.push('/')(已内置)
  // 用户被带回首页营销落地页,AI 面板(全局 docked)加载选中的会话。
  // 这里只暴露"新建对话":清空当前会话,让 AI 面板回到欢迎页。
  const handleNewChat = () => {
    setConversationId(null)
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="h-6 w-6 text-primary" />
            {tHistory('title')}
            {total > 0 && (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums leading-none text-muted-foreground">
                {total}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{tHistory('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            asChild
            title={tHistory('viewFavorites')}
          >
            <Link href="/chat/favorites">
              <Star className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="sm" onClick={handleNewChat}>
            <Plus className="mr-1.5 h-4 w-4" />
            {tHistory('newChat')}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tHistory('searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {tHistory('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Clock className="h-8 w-8 opacity-40" />
          <p className="text-sm">{keyword ? tHistory('noResults') : tHistory('empty')}</p>
        </div>
      ) : (
        <ConversationList items={items} />
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={null}>
        <ChatEntry />
      </React.Suspense>
    </ErrorBoundary>
  )
}
