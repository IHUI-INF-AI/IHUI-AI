// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2,
  Trash2,
  MessageCirclePlus,
  MoreVertical,
  Download,
  Archive,
  ArchiveRestore,
  Pencil,
  FileText,
  FileCode,
  FileJson,
  Camera,
  Image as ImageIcon,
  Link2,
  LogIn,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { downloadText, slugifyForFilename, buildTimestamp } from '@/lib/download'
import {
  archiveConversation,
  unarchiveConversation,
  exportConversation,
  compressConversation,
} from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'
import {
  ConversationAttentionBadges,
  type ConversationAttentionById,
} from '@/components/chat/conversation-list'
import {
  isWaitingForConversation,
  resolveConversationAttention,
} from '@/hooks/use-sidebar'
import {
  downloadConversationJson,
  downloadConversationSnapshot,
  downloadConversationShareCard,
  copyConversationShareLink,
  type ExportRoleLabel,
} from '@/components/chat/conversation-export'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useAuthStore } from '@/stores/auth'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Button,
} from '@ihui/ui-react'

interface ConversationItem {
  id: string
  title: string
  model: string
  lastMessageAt: string
  messageCount: number
  archivedAt?: string | null
  /** D53 会话注意力态(G-64):该行未读更新数(>0 显示未读徽章);后端暂无字段时由 attentionById 覆盖 */
  unreadCount?: number
  /** D53:该行显式等待态(备用通道,主链路走 attentionById + pendingQuestion 联动) */
  hasPendingQuestion?: boolean
}

interface ConversationsResponse {
  conversations: ConversationItem[]
  total: number
  page: number
  pageSize: number
}

async function fetchConversations(page = 1): Promise<ConversationsResponse> {
  const res = await fetchApi<ConversationsResponse>(`/api/chat/conversations?page=${page}`)
  if (!res.success) throw new Error(res.error)
  return res.data
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
 * 侧边栏内嵌的任务列表卡片(对齐旧架构 SidebarChatHistory.vue 视觉设计)。
 * - 卡片容器:border + rounded-md + bg-card,宽度与上方"新建任务"按钮一致(w-full,无 mx-2)
 * - 列表 max-h-220px 滚动
 * - hover/active 用 ::before 伪元素 inset-x-2 实现悬浮胶囊效果
 * - active 左侧 2px 高亮条
 * - 操作按钮:MoreVertical 三点菜单 + DropdownMenu(重命名 / 归档 / 导出 / 压缩 / 删除)
 * - 删除确认:用 ConfirmDialog,删除成功/失败用 sonner toast 反馈
 * - 重命名:用 Dialog + Input
 * - 按时间分组:今天 / 本周(7天内)/ 本月(30天内)
 * - 空状态:图标 + 文案 + "新建任务"引导按钮
 * - 折叠态完全不渲染(避免无文字宽度)
 */
export function SidebarChatHistory({
  collapsed,
  attentionById,
}: {
  collapsed: boolean
  /** D53 注意力覆盖表(可选,派生输入,不碰 store) */
  attentionById?: ConversationAttentionById
}) {
  const t = useTranslations('chatHistory')
  const tc = useTranslations('aiChat')
  const te = useTranslations('chat.exportMenu')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // 2026-09-02 ready 来源补充:bootstrap 未就绪时 isAuthenticated 可能是 localStorage
  // 残留的 true,需等 ready 后再按真实登录态渲染(与 LoginDialog/PageClient 同模式)。
  const { ready } = useAuthBootstrap()
  const currentConversationId = useChatStore((s) => s.conversationId)
  // D53 联动(store 只读):挂起的提问归属当前会话 → 当前行自动进入等待态
  const pendingQuestion = useChatStore((s) => s.pendingQuestion)
  const openPanel = useAiPanelStore((s) => s.openPanel)

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  const [pendingRenameId, setPendingRenameId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState<string>('')
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const renameInputRef = React.useRef<HTMLInputElement>(null)
  const isNavigatingRef = React.useRef(false)

  React.useEffect(() => {
    if (pendingRenameId) {
      const id = requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
      return () => cancelAnimationFrame(id)
    }
  }, [pendingRenameId])

  const {
    data,
    isLoading,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['chat', 'conversations', 'infinite'],
    queryFn: ({ pageParam = 1 }) => fetchConversations(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const totalPages = Math.ceil(last.total / last.pageSize)
      return last.page < totalPages ? last.page + 1 : undefined
    },
    enabled: isAuthenticated && !collapsed,
    staleTime: 30 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.success) throw new Error(res.error)
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      success(tc('deleteSuccess'))
      setPendingDeleteId(null)
    },
    onError: (err: Error) => {
      error(err.message || tc('deleteFailed'))
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await archiveConversation(id)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await unarchiveConversation(id)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })

  const exportMutation = useMutation({
    mutationFn: ({ id, format }: { id: string; format: 'txt' | 'md' }) =>
      exportConversation(id, format),
  })

  const compressMutation = useMutation({
    mutationFn: async ({ id, targetChars }: { id: string; targetChars: 200000 | 1000000 }) => {
      const res = await compressConversation(id, targetChars)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetchApi<{ conversation: ConversationItem }>(
        `/api/chat/conversations/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify({ title }) },
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
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

  if (collapsed) return null

  // 2026-09-02 修复:bootstrap 未就绪时,即使 localStorage 残留 isAuthenticated=true,
  // token 仍为 null,直接渲染对话列表会导致 401 或空状态闪现。
  // 等待 ready 后再按真实登录态渲染。
  if (!ready || !isAuthenticated) {
    return (
      <div
        role="region"
        aria-label={t('title')}
        className="mb-1 w-full rounded-md border border-border bg-card p-1.5"
      >
        <div className="flex items-center justify-between px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <span>{tc('history')}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-3 text-xs text-muted-foreground">
          <LogIn className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t('loginRequired')}</span>
        </div>
      </div>
    )
  }

  // items: flatten 所有已加载页的 conversations(infinite scroll 累积);
  // total: 后端真实总数(首页返回,所有页一致)
  const items = data?.pages.flatMap((p) => p.conversations) ?? []
  const total = data?.pages[0]?.total ?? 0

  const handleSelect = (item: ConversationItem) => {
    if (currentConversationId === item.id) {
      openPanel()
      return
    }
    if (isNavigatingRef.current) return

    isNavigatingRef.current = true
    useChatStore.getState().setConversationId(item.id)
    openPanel()

    setTimeout(() => {
      isNavigatingRef.current = false
    }, 400)
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setPendingDeleteId(id)
  }

  const confirmDelete = () => {
    if (pendingDeleteId) {
      setBusyId(pendingDeleteId)
      deleteMutation.mutate(pendingDeleteId, {
        onSettled: () => setBusyId(null),
      })
    }
  }

  const handleRename = (item: ConversationItem) => {
    setPendingRenameId(item.id)
    setRenameValue(item.title)
  }

  const confirmRename = () => {
    if (!pendingRenameId) return
    const title = renameValue.trim()
    if (!title) {
      error(tc('toast.renameEmpty'))
      return
    }
    setBusyId(pendingRenameId)
    renameMutation.mutate(
      { id: pendingRenameId, title },
      {
        onSettled: () => setBusyId(null),
        onSuccess: () => {
          setPendingRenameId(null)
          success(tc('toast.renamed'))
        },
        onError: () => error(tc('toast.renameFailed')),
      },
    )
  }

  const handleArchiveToggle = (item: ConversationItem) => {
    setBusyId(item.id)
    const mutation = item.archivedAt ? unarchiveMutation : archiveMutation
    mutation.mutate(item.id, {
      onSettled: () => setBusyId(null),
      onSuccess: () => {
        success(item.archivedAt ? tc('toast.unarchived') : tc('toast.archived'))
      },
      onError: () => error(tc('toast.archiveFailed')),
    })
  }

  const handleExport = (item: ConversationItem, format: 'txt' | 'md') => {
    setBusyId(item.id)
    exportMutation.mutate(
      { id: item.id, format },
      {
        onSettled: () => setBusyId(null),
        onSuccess: (content) => {
          downloadText(
            content,
            `${slugifyForFilename(item.title)}-${buildTimestamp()}.${format}`,
            format === 'md' ? 'text/markdown' : 'text/plain',
          )
          success(tc('toast.exported'))
        },
        onError: () => error(tc('toast.exportFailed')),
      },
    )
  }

  const handleCompress = (item: ConversationItem, targetChars: 200000 | 1000000) => {
    setBusyId(item.id)
    compressMutation.mutate(
      { id: item.id, targetChars },
      {
        onSettled: () => setBusyId(null),
        onSuccess: (data) => {
          downloadText(
            data.content,
            `${slugifyForFilename(item.title)}-compressed-${targetChars}-${buildTimestamp()}.md`,
            'text/markdown',
          )
          success(tc('toast.compressed'))
        },
        onError: () => error(tc('toast.compressFailed')),
      },
    )
  }

  const exportRoleLabel: ExportRoleLabel = {
    user: te('roleUser'),
    assistant: te('roleAssistant'),
  }

  // 导出/分享动作:按会话 ID 拉全量消息后本地生成,不依赖面板当前加载的会话
  const runExportAction = (id: string, successMsg: string, action: () => Promise<boolean>) => {
    setBusyId(id)
    void action()
      .then((done) => {
        if (done) success(successMsg)
      })
      .catch((err: unknown) => {
        error(err instanceof Error && err.message ? err.message : tc('toast.exportFailed'))
      })
      .finally(() => setBusyId(null))
  }

  const handleExportJson = (item: ConversationItem) => {
    runExportAction(item.id, te('exportStarted'), () =>
      downloadConversationJson(item.id, item.title),
    )
  }

  const handleSnapshot = (item: ConversationItem) => {
    runExportAction(item.id, te('exportStarted'), () =>
      downloadConversationSnapshot(item.id, item.title, exportRoleLabel),
    )
  }

  const handleShareCard = (item: ConversationItem) => {
    runExportAction(item.id, te('exportStarted'), () =>
      downloadConversationShareCard(item.id, item.title, te('shareCardUser')),
    )
  }

  const handleShareLink = (item: ConversationItem) => {
    runExportAction(item.id, te('shareLinkCopied'), () =>
      copyConversationShareLink(item.id, te('shareFailed')).then(() => true),
    )
  }

  const renderItem = (item: ConversationItem) => {
    const active = item.id === currentConversationId
    // D53:每行注意力态独立派生,pendingQuestion 只联动当前会话行
    const unreadRaw = attentionById?.[item.id]?.unread ?? item.unreadCount ?? 0
    const unread = Number.isFinite(unreadRaw) && unreadRaw > 0 ? Math.floor(unreadRaw) : 0
    const waiting = isWaitingForConversation({
      conversationId: item.id,
      currentConversationId,
      hasPendingQuestion: pendingQuestion !== null,
      explicitWaiting: attentionById?.[item.id]?.waiting ?? item.hasPendingQuestion,
    })
    const attentionState = resolveConversationAttention({
      hasPendingQuestion: waiting,
      unreadCount: unread,
    })
    return (
      <li key={item.id} className="group relative">
        <button
          type="button"
          onClick={() => handleSelect(item)}
          aria-current={active ? 'true' : undefined}
          // D22 会话拖入输入框引用(2026-09-19 立,对标 Qoder 0.2.x):会话行可拖拽,
          // dataTransfer 携带会话 JSON,输入框 handleDropWithConversation 消费
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              'application/x-ihui-conversation',
              JSON.stringify({ id: item.id, title: item.title }),
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
          className={cn(
            'relative block w-full rounded-sm px-2.5 py-1.5 pr-7 text-left transition-colors',
            'before:absolute before:inset-x-2 before:inset-y-0 before:rounded-sm before:transition-colors',
            'before:content-[""] before:-z-10',
            active
              ? 'text-primary before:bg-primary/10'
              : 'hover:text-foreground hover:before:bg-muted',
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
            <span className="min-w-0 truncate">{item.model}</span>
            {item.lastMessageAt && (
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                {dateFmt.format(new Date(item.lastMessageAt))}
              </span>
            )}
            <ConversationAttentionBadges state={attentionState} unreadCount={unread} />
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              disabled={busyId === item.id}
              aria-label={tc('actions.menu')}
              data-testid="conversation-more-menu"
              className={cn(
                'absolute right-0.5 top-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-all',
                'text-muted-foreground opacity-0 group-hover:opacity-100',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'data-[state=open]:opacity-100 data-[state=open]:bg-accent',
              )}
            >
              {busyId === item.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MoreVertical className="h-3 w-3" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleRename(item)
              }}
              disabled={busyId === item.id}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.rename')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleArchiveToggle(item)
              }}
              disabled={busyId === item.id}
            >
              {item.archivedAt ? (
                <>
                  <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                  <span>{tc('actions.unarchive')}</span>
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-3.5 w-3.5" />
                  <span>{tc('actions.archive')}</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleExport(item, 'md')
              }}
              disabled={busyId === item.id}
            >
              <FileCode className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.exportMd')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleExport(item, 'txt')
              }}
              disabled={busyId === item.id}
            >
              <FileText className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.exportTxt')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleExportJson(item)
              }}
              disabled={busyId === item.id}
            >
              <FileJson className="mr-2 h-3.5 w-3.5" />
              <span>{te('exportJson')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleSnapshot(item)
              }}
              disabled={busyId === item.id}
            >
              <Camera className="mr-2 h-3.5 w-3.5" />
              <span>{te('snapshot')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleShareCard(item)
              }}
              disabled={busyId === item.id}
            >
              <ImageIcon className="mr-2 h-3.5 w-3.5" />
              <span>{te('exportCard')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleShareLink(item)
              }}
              disabled={busyId === item.id}
            >
              <Link2 className="mr-2 h-3.5 w-3.5" />
              <span>{te('share')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleCompress(item, 200000)
              }}
              disabled={busyId === item.id}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.compressTo200k')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleCompress(item, 1000000)
              }}
              disabled={busyId === item.id}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.compressTo1m')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteClick(e, item.id)
              }}
              disabled={busyId === item.id}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              data-testid="conversation-delete-action"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        <div className="flex items-center justify-between px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <span className="min-w-0 truncate">{tc('history')}</span>
          {total > 0 && (
            <span className="ml-1 shrink-0 rounded-sm bg-muted px-2 py-1 text-[10px] font-medium whitespace-nowrap tabular-nums leading-none text-muted-foreground">
              {total}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{t('loading')}</span>
          </div>
        ) : queryError ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">{tCommon('loadFailed')}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-4 text-center">
            <MessageCirclePlus className="h-5 w-5 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">{tc('noHistory')}</span>
          </div>
        ) : (
          <div className="flex flex-col">
            <div
              className="thin-scroll max-h-[220px] overflow-y-auto pr-0.5 pb-2"
              onScroll={(e) => {
                const el = e.currentTarget
                if (
                  el.scrollTop + el.clientHeight >= el.scrollHeight - 24 &&
                  hasNextPage &&
                  !isFetchingNextPage
                ) {
                  fetchNextPage()
                }
              }}
            >
              {groupByDate(items).map((group) => (
                <div key={group.key} className="mb-0.5 last:mb-0">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                    {tc(group.key)}
                  </div>
                  <ul>{group.items.map(renderItem)}</ul>
                </div>
              ))}
              {isFetchingNextPage && (
                <div className="flex justify-center py-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <Link
              href="/chat/history"
              className="mt-1 flex items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span>{t('viewAll')}</span>
              {total > 0 && <span className="tabular-nums">{total}</span>}
            </Link>
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

      <Dialog
        open={pendingRenameId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRenameId(null)
        }}
      >
        <DialogContent className="min-[640px]:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tc('renameDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {tc('renameDialog.label')}
            </label>
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={tc('renameDialog.placeholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="bg-muted" onClick={() => setPendingRenameId(null)}>
              {tc('renameDialog.cancel')}
            </Button>
            <Button onClick={confirmRename} disabled={renameMutation.isPending}>
              {tc('renameDialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default SidebarChatHistory
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
