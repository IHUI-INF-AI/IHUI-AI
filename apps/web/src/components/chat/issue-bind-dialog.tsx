// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D179 会话/新对话 Issue 绑定流(2026-09-30 用户拍板立项,竞品对标):
 * - bindIssue「绑定 Issue」:搜索对话框(来源 GitHub/Linear → searchIssues → 选中绑定/换绑)
 * - unbindIssue「改为独立任务」:解绑 = 清空会话绑定
 * - 空态:noIssues(还没有可以绑定的 Issue)/ noMatchingIssues(没有匹配的 Issue)
 * - highlights.linkedIssue「关联 Issue」:会话行徽章 + 监控区条目(带 url 跳转挂载)
 * 绑定只落会话业务元数据(chat_conversations.metadata.issueBinding),不碰身份元数据。
 */

import * as React from 'react'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ExternalLink, Link2, Loader2, Search, Unlink } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@ihui/ui-react'
import {
  bindIssue,
  getConversation,
  searchIssues,
  unbindIssue,
  type IssueBinding,
  type IssueProvider,
  type IssueSearchData,
  type IssueSearchItem,
} from '@ihui/api-client'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const PROVIDERS: IssueProvider[] = ['github', 'linear']

/** 从会话 metadata 里解析绑定(纯函数,导出供测试;非预期形态一律 null,不抛错)。 */
export function resolveIssueBinding(metadata: unknown): IssueBinding | null {
  if (!metadata || typeof metadata !== 'object') return null
  const candidate = (metadata as { issueBinding?: unknown }).issueBinding
  if (!candidate || typeof candidate !== 'object') return null
  const b = candidate as Record<string, unknown>
  if (
    (b.provider !== 'github' && b.provider !== 'linear') ||
    typeof b.id !== 'string' ||
    b.id === '' ||
    typeof b.title !== 'string' ||
    typeof b.url !== 'string' ||
    b.url === ''
  ) {
    return null
  }
  return {
    provider: b.provider,
    id: b.id,
    title: b.title,
    url: b.url,
    boundAt: typeof b.boundAt === 'string' ? b.boundAt : '',
  }
}

/** 会话行徽章(非交互 chip:行本身是 button,内嵌 <a> 属非法嵌套;跳转挂载在监控区条与对话框) */
export function LinkedIssueBadge({ binding }: { binding: IssueBinding }) {
  const t = useTranslations('chat')
  return (
    <span
      data-testid="conversation-linked-issue"
      aria-label={`${t('issueBinding')}: ${binding.title}`}
      className="inline-flex min-w-0 max-w-[96px] shrink-0 items-center gap-0.5 rounded-md bg-primary/10 px-1 text-[9px] leading-4 text-primary"
    >
      <Link2 className="h-2.5 w-2.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{binding.title}</span>
    </span>
  )
}

/** 监控条专用 QueryClient(自备干燥粮):宿主(如 AiSidePanelTools 的既有测试)可能没有
 *  QueryClientProvider,useQuery 没有 context 会直接抛错 —— 条内自带 provider 与宿主解耦,
 *  嵌套在全局 provider 下也合法(内层只遮蔽本条的子树)。 */
const stripQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

/** 监控区「关联 Issue」条(highlights.linkedIssue 展示 + 跳转挂载;未绑定时整条不渲染) */
export function LinkedIssueStrip({ conversationId }: { conversationId: string | null }) {
  return (
    <QueryClientProvider client={stripQueryClient}>
      <LinkedIssueStripInner conversationId={conversationId} />
    </QueryClientProvider>
  )
}

function LinkedIssueStripInner({ conversationId }: { conversationId: string | null }) {
  const t = useTranslations('chat')
  const query = useQuery({
    queryKey: ['chat', 'conversation-detail', conversationId],
    queryFn: async () => {
      const res = await getConversation(conversationId ?? '')
      if (!res.success) return null
      return resolveIssueBinding(res.data.conversation.metadata)
    },
    enabled: !!conversationId,
  })
  const binding = query.data ?? null
  if (!binding) return null
  return (
    <div
      data-testid="task-monitor-linked-issue"
      className="flex items-center gap-1.5 px-3 pb-1.5 text-xs text-muted-foreground"
    >
      <span className="shrink-0 font-medium text-foreground/80">{t('issueBinding')}</span>
      <a
        href={binding.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-0.5 text-primary transition-colors hover:text-primary/80 hover:underline"
      >
        <span className="min-w-0 truncate">{binding.title}</span>
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      </a>
    </div>
  )
}

/** 「绑定 Issue」搜索对话框:来源切换 → 搜索 → 选中绑定;已绑定时可解绑(改为独立任务)。 */
export function IssueBindDialog({
  conversationId,
  open,
  onOpenChange,
  binding,
}: {
  conversationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  binding: IssueBinding | null
}) {
  const t = useTranslations('chat')
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()
  const [provider, setProvider] = React.useState<IssueProvider>('github')
  const [query, setQuery] = React.useState('')
  const [submitted, setSubmitted] = React.useState<{ provider: IssueProvider; query: string } | null>(
    null,
  )
  // 会话行传入的绑定只在打开瞬间快照;解绑后就地隐藏,不等列表失效回填
  const [current, setCurrent] = React.useState<IssueBinding | null>(binding)
  React.useEffect(() => {
    if (open) setCurrent(binding)
  }, [open, binding])

  const invalidateConversations = () => {
    void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
  }

  const search = useQuery({
    queryKey: ['chat', 'issue-search', submitted?.provider, submitted?.query],
    queryFn: async (): Promise<IssueSearchData> => {
      const res = await searchIssues({
        provider: submitted?.provider ?? 'github',
        query: submitted?.query ?? '',
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: open && submitted !== null,
  })

  const bindMutation = useMutation({
    mutationFn: async (item: IssueSearchItem) => {
      const res = await bindIssue(conversationId ?? '', {
        provider: item.provider,
        id: item.id,
        title: item.title,
        url: item.url,
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      setCurrent(data.issueBinding)
      invalidateConversations()
      success(t('issueBindSuccess'))
      onOpenChange(false)
    },
    onError: (err: Error) => toastError(err.message || t('issueBindFailed')),
  })

  const unbindMutation = useMutation({
    mutationFn: async () => {
      const res = await unbindIssue(conversationId ?? '')
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      setCurrent(null)
      invalidateConversations()
      success(t('issueUnbindSuccess'))
    },
    onError: (err: Error) => toastError(err.message || t('issueUnbindFailed')),
  })

  const handleSearch = () => {
    const q = query.trim()
    if (!q) return
    setSubmitted({ provider, query: q })
  }

  const items = search.data?.items ?? []
  // 空态三态:来源未配置 → issueNotConfigured;已搜索无匹配 → noMatchingIssues;未发起搜索 → noIssues
  let emptyState: React.ReactNode = null
  if (submitted !== null && search.isSuccess) {
    if (!search.data.configured) {
      emptyState = <div className="px-2 py-3 text-xs text-muted-foreground">{t('issueNotConfigured')}</div>
    } else if (items.length === 0) {
      emptyState = <div className="px-2 py-3 text-xs text-muted-foreground">{t('noMatchingIssues')}</div>
    }
  } else if (submitted === null) {
    emptyState = <div className="px-2 py-3 text-xs text-muted-foreground">{t('noIssues')}</div>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-[640px]:max-w-md" data-testid="issue-bind-dialog">
        <DialogHeader>
          <DialogTitle>{t('bindIssue')}</DialogTitle>
          <DialogDescription>{t('searchIssues')}</DialogDescription>
        </DialogHeader>

        {current && (
          <div
            data-testid="issue-bind-current"
            className="flex items-center gap-1.5 rounded-sm bg-muted px-2 py-1.5 text-xs"
          >
            <Link2 className="h-3 w-3 shrink-0 text-primary" aria-hidden />
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-primary hover:underline"
            >
              {current.title}
            </a>
            <Button
              variant="ghost"
              size="xs"
              disabled={unbindMutation.isPending}
              onClick={() => unbindMutation.mutate()}
              data-testid="issue-unbind-action"
            >
              {unbindMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Unlink className="h-3 w-3" aria-hidden />
              )}
              <span>{t('unbindIssue')}</span>
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex gap-1" role="radiogroup" aria-label={t('bindIssue')}>
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={provider === p}
                onClick={() => setProvider(p)}
                data-testid={`issue-provider-${p}`}
                className={cn(
                  'rounded-sm px-2 py-1 text-xs transition-colors',
                  provider === p
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {p === 'github' ? 'GitHub' : 'Linear'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              placeholder={t('searchIssues')}
              data-testid="issue-search-input"
            />
            <Button
              size="sm"
              disabled={query.trim() === '' || search.isFetching}
              onClick={handleSearch}
              data-testid="issue-search-submit"
            >
              {search.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Search className="h-3.5 w-3.5" aria-hidden />
              )}
              <span>{t('searchIssues')}</span>
            </Button>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto" data-testid="issue-search-results">
          {emptyState}
          {items.map((item) => (
            <button
              key={`${item.provider}:${item.id}`}
              type="button"
              onClick={() => bindMutation.mutate(item)}
              disabled={bindMutation.isPending}
              data-testid={`issue-search-item-${item.id}`}
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
            >
              <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] uppercase leading-4 text-muted-foreground">
                {item.provider}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.id && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {item.id}
                </span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
