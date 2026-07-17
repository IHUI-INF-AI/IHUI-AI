'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Trash2, MessageCirclePlus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { useChatStore } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'

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

type GroupKey = 'today' | 'thisWeek' | 'thisMonth'

function groupByDate(items: ConversationItem[]): { key: GroupKey; items: ConversationItem[] }[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const DAY = 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 7 * DAY

  const buckets: Record<GroupKey, ConversationItem[]> = {
    today: [],
    thisWeek: [],
    thisMonth: [],
  }
  for (const item of items) {
    const t = item.lastMessageAt ? new Date(item.lastMessageAt).getTime() : 0
    if (t >= startOfToday) buckets.today.push(item)
    else if (t >= startOfWeek) buckets.thisWeek.push(item)
    else buckets.thisMonth.push(item)
  }
  return (Object.keys(buckets) as GroupKey[])
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, items: buckets[k] }))
}

/**
 * 侧边栏内嵌的历史对话卡片(对齐旧架构 SidebarChatHistory.vue 视觉设计)。
 * - 卡片容器:border + rounded-md + bg-card,宽度与上方"新建对话"按钮一致(w-full,无 mx-2)
 * - 列表 max-h-220px 滚动
 * - hover/active 用 ::before 伪元素 inset-x-2 实现悬浮胶囊效果
 * - active 左侧 2px 高亮条
 * - 删除按钮:group 类在 <li> 上(不是内层 button),hover 整行时显示;hover 删除按钮本身用 destructive 色反馈
 * - 删除确认:用 ConfirmDialog(替代 window.confirm),删除成功/失败用 sonner toast 反馈
 * - 按时间分组:今天 / 本周(7天内)/ 本月(30天内)
 * - 空状态:图标 + 文案 + "新建对话"引导按钮
 * - 折叠态完全不渲染(避免无文字宽度)
 */
export function SidebarChatHistory({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('chatHistory')
  const tc = useTranslations('aiChat')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const currentConversationId = useChatStore((s) => s.conversationId)
  const openPanel = useAiPanelStore((s) => s.openPanel)

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: fetchConversations,
    enabled: isAuthenticated && !collapsed,
    staleTime: 30 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      success(tc('deleteSuccess'))
      setPendingDeleteId(null)
    },
    onError: () => {
      error(tc('deleteFailed'))
    },
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

  if (collapsed || !isAuthenticated) return null

  const items = data ?? []

  const handleSelect = (item: ConversationItem) => {
    useChatStore.getState().setConversationId(item.id)
    openPanel()
    router.push(`/chat?conversationId=${encodeURIComponent(item.id)}`)
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setPendingDeleteId(id)
  }

  const confirmDelete = () => {
    if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId)
  }

  const renderItem = (item: ConversationItem) => {
    const active = item.id === currentConversationId
    return (
      <li key={item.id} className="group relative">
        <button
          type="button"
          onClick={() => handleSelect(item)}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'relative block w-full rounded-sm px-2.5 py-1.5 pr-7 text-left transition-colors',
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
          <span className="relative block truncate text-[12px] font-medium">{item.title}</span>
          <span className="relative mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="truncate">{item.model}</span>
            {item.lastMessageAt && (
              <span className="shrink-0">{dateFmt.format(new Date(item.lastMessageAt))}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => handleDeleteClick(e, item.id)}
          disabled={deleteMutation.isPending}
          aria-label={t('delete')}
          title={t('delete')}
          className={cn(
            'absolute right-0.5 top-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-all',
            'text-muted-foreground opacity-0 group-hover:opacity-100',
            'hover:bg-destructive/10 hover:text-destructive',
            'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive',
          )}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </li>
    )
  }

  return (
    <>
      <div
        role="region"
        aria-label={t('title')}
        className="mb-1 w-full rounded-md border border-border bg-card p-1.5"
      >
        <div className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {tc('history')}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{t('loading')}</span>
          </div>
        ) : queryError ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">{t('loading')}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-4 text-center">
            <MessageCirclePlus className="h-5 w-5 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">{tc('noHistory')}</span>
            <button
              type="button"
              onClick={openPanel}
              className="mt-0.5 inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
            >
              {tc('newConversation')}
            </button>
          </div>
        ) : (
          <div className="thin-scroll max-h-[220px] overflow-y-auto pr-0.5">
            {groupByDate(items).map((group) => (
              <div key={group.key} className="mb-0.5 last:mb-0">
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                  {tc(group.key)}
                </div>
                <ul>{group.items.map(renderItem)}</ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={tc('deleteConversation')}
        content={tc('confirmDeleteConversation')}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  )
}

export default SidebarChatHistory
