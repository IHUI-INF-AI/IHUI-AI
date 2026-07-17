'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { useChatStore } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useAuthStore } from '@/stores/auth'

interface ConversationItem {
  id: string
  title: string
  model: string
  lastMessageAt: string
  messageCount: number
}

async function fetchConversations(): Promise<ConversationItem[]> {
  const res = await fetchApi<{ conversations: ConversationItem[] }>('/api/chat/conversations')
  if (!res.success) throw new Error(res.error)
  return res.data.conversations
}

/**
 * 侧边栏内嵌的历史对话卡片(对齐旧架构 SidebarChatHistory.vue 视觉设计)。
 * - 卡片容器:border + rounded-md + bg-card
 * - 列表 max-h-220px 滚动
 * - hover/active 用 ::before 伪元素 inset-x-2 实现悬浮胶囊效果
 * - active 左侧 2px 高亮条
 * - 折叠态完全不渲染(避免无文字宽度)
 */
export function SidebarChatHistory({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('chatHistory')
  const tc = useTranslations('aiChat')
  const locale = useLocale()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const currentConversationId = useChatStore((s) => s.conversationId)
  const openPanel = useAiPanelStore((s) => s.openPanel)

  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: fetchConversations,
    enabled: isAuthenticated && !collapsed,
    staleTime: 30 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
  })

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  // 折叠态:完全不渲染(避免无文字宽度导致卡片畸形)
  if (collapsed || !isAuthenticated) return null

  const items = data ?? []

  const handleSelect = (item: ConversationItem) => {
    useChatStore.getState().setConversationId(item.id)
    openPanel()
    router.push(`/chat?conversationId=${encodeURIComponent(item.id)}`)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm(tc('confirmDeleteConversation'))) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="mx-2 mb-1 rounded-md border border-border bg-card p-1.5"
    >
      <div className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {tc('history')}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      ) : error ? (
        <div className="px-2 py-3 text-xs text-muted-foreground">{t('loading')}</div>
      ) : items.length === 0 ? (
        <div className="px-2 py-3 text-xs text-muted-foreground">{tc('noHistory')}</div>
      ) : (
        <ul className="thin-scroll max-h-[220px] overflow-y-auto pr-0.5">
          {items.map((item) => {
            const active = item.id === currentConversationId
            return (
              <li key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'group relative block w-full rounded-sm px-2.5 py-1.5 text-left transition-colors',
                    'before:absolute before:inset-x-2 before:inset-y-0 before:rounded-sm before:transition-colors',
                    'before:content-[""] before:-z-10',
                    active
                      ? 'text-primary before:bg-primary/10'
                      : 'hover:text-foreground before:hover:bg-muted',
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-primary"
                    />
                  )}
                  <span className="relative block truncate text-[12px] font-medium">
                    {item.title}
                  </span>
                  <span className="relative mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="truncate">{item.model}</span>
                    {item.lastMessageAt && (
                      <span className="shrink-0">{dateFmt.format(new Date(item.lastMessageAt))}</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, item.id)}
                  disabled={deleteMutation.isPending}
                  aria-label={t('delete')}
                  title={t('delete')}
                  className="absolute right-1 top-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default SidebarChatHistory
