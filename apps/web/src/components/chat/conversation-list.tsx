'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Archive,
  ArchiveRestore,
  Clock,
  Shrink,
  FileCode,
  FileText,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { downloadText, slugifyForFilename, buildTimestamp } from '@/lib/download'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@ihui/ui-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Tooltip } from '@/components/feedback'
import { useToast } from '@/hooks/use-toast'
import {
  archiveConversation,
  batchOperateConversations,
  compressConversation,
  exportConversation,
  unarchiveConversation,
  type BatchConversationAction,
} from '@ihui/api-client'

export interface Conversation {
  id: string
  title: string
  model: string
  lastMessageAt: string
  messageCount: number
  favorite: boolean
  archivedAt?: string | null
}

/** history 与 favorites 页共用的对话行列表,含删除 / 收藏切换 / 重命名 / 归档 / 导出 / 压缩 */
export function ConversationList({ items }: { items: Conversation[] }) {
  const t = useTranslations('chatHistory')
  const tCommon = useTranslations('common')
  const tc = useTranslations('aiChat')
  const locale = useLocale()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingBatchDelete, setPendingBatchDelete] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['chat', 'favorites'] }),
    ])

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.success) throw new Error(res.error)
      return res
    },
    onSuccess: () => invalidateAll(),
    onError: (err: Error) => {
      error(err.message || tc('deleteFailed'))
    },
  })

  // P1 乐观更新(2026-07-23):收藏/归档即时反馈,不等 API 返回
  const favMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}/favorite`, { method: 'POST' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'conversations'] })
      await queryClient.cancelQueries({ queryKey: ['chat', 'favorites'] })
      const prevConv = queryClient.getQueryData<Conversation[]>(['chat', 'conversations'])
      const prevFav = queryClient.getQueryData<Conversation[]>(['chat', 'favorites'])
      const toggle = (list: Conversation[] | undefined) =>
        list?.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c))
      queryClient.setQueryData(['chat', 'conversations'], toggle)
      queryClient.setQueryData(['chat', 'favorites'], toggle)
      return { prevConv, prevFav }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevConv) queryClient.setQueryData(['chat', 'conversations'], ctx.prevConv)
      if (ctx?.prevFav) queryClient.setQueryData(['chat', 'favorites'], ctx.prevFav)
    },
    onSettled: () => invalidateAll(),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveConversation(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'conversations'] })
      await queryClient.cancelQueries({ queryKey: ['chat', 'favorites'] })
      const prevConv = queryClient.getQueryData<Conversation[]>(['chat', 'conversations'])
      const prevFav = queryClient.getQueryData<Conversation[]>(['chat', 'favorites'])
      const remove = (list: Conversation[] | undefined) => list?.filter((c) => c.id !== id)
      queryClient.setQueryData(['chat', 'conversations'], remove)
      queryClient.setQueryData(['chat', 'favorites'], remove)
      return { prevConv, prevFav }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevConv) queryClient.setQueryData(['chat', 'conversations'], ctx.prevConv)
      if (ctx?.prevFav) queryClient.setQueryData(['chat', 'favorites'], ctx.prevFav)
    },
    onSettled: () => invalidateAll(),
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => unarchiveConversation(id),
    onSuccess: () => invalidateAll(),
  })

  const exportMutation = useMutation({
    mutationFn: ({ id, format }: { id: string; format: 'txt' | 'md' }) =>
      exportConversation(id, format),
  })

  const compressMutation = useMutation({
    mutationFn: ({ id, targetChars }: { id: string; targetChars: 200000 | 1000000 }) =>
      compressConversation(id, targetChars),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => invalidateAll(),
  })

  // 批量操作 mutation(2026-07-31 立,对话历史批量删除/收藏/归档)
  const batchMutation = useMutation({
    mutationFn: ({ action, ids }: { action: BatchConversationAction; ids: string[] }) =>
      batchOperateConversations(action, ids),
    onSuccess: (_data, { action }) => {
      invalidateAll()
      const msgMap: Record<BatchConversationAction, string> = {
        delete: t('batchDeleteSuccess'),
        favorite: t('batchFavoriteSuccess'),
        unfavorite: t('batchUnfavoriteSuccess'),
        archive: t('batchArchiveSuccess'),
        unarchive: t('batchUnarchiveSuccess'),
      }
      success(msgMap[action])
      if (action === 'delete') setSelectedIds(new Set())
    },
    onError: (err: Error) => error(err.message || tc('deleteFailed')),
  })

  const allSelected = items.length > 0 && selectedIds.size === items.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(items.map((i) => i.id)) : new Set())
  }

  const invertSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set<string>()
      for (const item of items) {
        if (!prev.has(item.id)) next.add(item.id)
      }
      return next
    })
  }

  const runBatch = (action: BatchConversationAction) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (action === 'delete') {
      setPendingBatchDelete(true)
      return
    }
    setBatchBusy(true)
    batchMutation.mutate({ action, ids }, { onSettled: () => setBatchBusy(false) })
  }

  const confirmBatchDelete = () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBatchBusy(true)
    batchMutation.mutate(
      { action: 'delete', ids },
      {
        onSettled: () => {
          setBatchBusy(false)
          setPendingBatchDelete(false)
        },
      },
    )
  }

  const handleRename = (item: Conversation) => {
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

  const handleArchiveToggle = (item: Conversation) => {
    setBusyId(item.id)
    const mutation = item.archivedAt ? unarchiveMutation : archiveMutation
    mutation.mutate(item.id, {
      onSettled: () => setBusyId(null),
      onSuccess: () => success(item.archivedAt ? tc('toast.unarchived') : tc('toast.archived')),
      onError: () => error(tc('toast.archiveFailed')),
    })
  }

  const handleExport = (item: Conversation, format: 'txt' | 'md') => {
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

  const handleCompress = (item: Conversation, targetChars: 200000 | 1000000) => {
    setBusyId(item.id)
    compressMutation.mutate(
      { id: item.id, targetChars },
      {
        onSettled: () => setBusyId(null),
        onSuccess: (result) => {
          if (!result.success || !result.data) {
            error(tc('toast.compressFailed'))
            return
          }
          downloadText(
            result.data.content,
            `${slugifyForFilename(item.title)}-compressed-${targetChars}-${buildTimestamp()}.md`,
            'text/markdown',
          )
          success(tc('toast.compressed'))
        },
        onError: () => error(tc('toast.compressFailed')),
      },
    )
  }

  const confirmDelete = () => {
    if (pendingDeleteId) {
      deleteMutation.mutate(pendingDeleteId, {
        onSettled: () => setPendingDeleteId(null),
      })
    }
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-2 shadow-sm">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(checked) => toggleAll(checked === true)}
            aria-label={t('selectAll')}
          />
          <span className="text-sm font-medium tabular-nums">
            {t('selectedCount', { count: selectedIds.size })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={invertSelection}
            disabled={batchMutation.isPending || batchBusy}
          >
            {t('invertSelection')}
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runBatch('favorite')}
              disabled={batchMutation.isPending || batchBusy}
            >
              <Star className="mr-1 h-3.5 w-3.5" />
              {t('batchFavorite')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runBatch('unfavorite')}
              disabled={batchMutation.isPending || batchBusy}
            >
              {t('batchUnfavorite')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runBatch('archive')}
              disabled={batchMutation.isPending || batchBusy}
            >
              <Archive className="mr-1 h-3.5 w-3.5" />
              {t('batchArchive')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runBatch('unarchive')}
              disabled={batchMutation.isPending || batchBusy}
            >
              <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
              {t('batchUnarchive')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setPendingBatchDelete(true)}
              disabled={batchMutation.isPending || batchBusy}
              data-testid="batch-delete-btn"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t('batchDelete')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={batchMutation.isPending || batchBusy}
            >
              {t('cancelSelection')}
            </Button>
          </div>
        </div>
      )}
      <ul className="space-y-1 rounded-lg border p-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
          >
            <Checkbox
              checked={selectedIds.has(item.id)}
              onCheckedChange={(checked) => toggleSelection(item.id, checked === true)}
              aria-label={t('select')}
              data-testid={`conversation-checkbox-${item.id}`}
            />
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            <button
              type="button"
              onClick={() => {
                // AI 对话是全局 docked 面板,与 Sidebar 同性质:点击历史项只触发
                // 1) 写入 store 作为当前会话  2) 打开面板
                // 3) 跳回 /,首页是营销落地页 + 右侧 AI 面板作为对话入口
                useChatStore.getState().setConversationId(item.id)
                useAiPanelStore.getState().openPanel()
                router.push('/')
              }}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{item.model}</span>
                <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap tabular-nums">
                  <Clock className="h-3 w-3" />
                  {dateFmt.format(new Date(item.lastMessageAt))}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">{t('messageCount', { count: item.messageCount })}</span>
              </p>
            </button>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Tooltip content={item.favorite ? t('unfavorite') : t('favorite')}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => favMutation.mutate(item.id)}
                  disabled={favMutation.isPending}
                  aria-label={item.favorite ? t('unfavorite') : t('favorite')}
                >
                  <Star
                    className={cn('h-3.5 w-3.5', item.favorite && 'fill-amber-400 text-amber-400')}
                  />
                </Button>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={busyId === item.id}
                    aria-label={tc('actions.menu')}
                    data-testid="conversation-more-menu"
                  >
                    {busyId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MoreVertical className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 space-y-0.5">
                  <DropdownMenuItem
                    onClick={() => handleRename(item)}
                    disabled={busyId === item.id}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    <span>{tc('actions.rename')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleArchiveToggle(item)}
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
                    onClick={() => handleExport(item, 'md')}
                    disabled={busyId === item.id}
                  >
                    <FileCode className="mr-2 h-3.5 w-3.5" />
                    <span>{tc('actions.exportMd')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExport(item, 'txt')}
                    disabled={busyId === item.id}
                  >
                    <FileText className="mr-2 h-3.5 w-3.5" />
                    <span>{tc('actions.exportTxt')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCompress(item, 200000)}
                    disabled={busyId === item.id}
                  >
                    <Shrink className="mr-2 h-3.5 w-3.5" />
                    <span>{tc('actions.compressTo200k')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCompress(item, 1000000)}
                    disabled={busyId === item.id}
                  >
                    <Shrink className="mr-2 h-3.5 w-3.5" />
                    <span>{tc('actions.compressTo1m')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setPendingDeleteId(item.id)}
                    disabled={busyId === item.id}
                    className="text-destructive focus:bg-destructive/20 focus:text-destructive"
                    data-testid="conversation-delete-action"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    <span>{tc('actions.delete')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={tc('deleteConversation')}
        content={tc('confirmDeleteConversation')}
        confirmText={t('delete')}
        cancelText={tCommon('cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      <Dialog
        open={pendingRenameId !== null}
        onOpenChange={(open) => !open && setPendingRenameId(null)}
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

      <ConfirmDialog
        open={pendingBatchDelete}
        title={t('batchDelete')}
        content={t('confirmBatchDelete', { count: selectedIds.size })}
        confirmText={t('batchDelete')}
        cancelText={t('cancelSelection')}
        variant="danger"
        loading={batchMutation.isPending || batchBusy}
        onConfirm={confirmBatchDelete}
        onCancel={() => setPendingBatchDelete(false)}
      />
    </>
  )
}

export default ConversationList
