import * as React from 'react'
import { Search } from 'lucide-react'
import type { ChatMessage } from '@/stores/chat'
import {
  plainTextForClipboard,
  normalizeMarkdown,
} from '@/components/ai/progress-sections/message-context-menu'
import { useContextMenu, type ContextMenuAction } from '@/hooks/use-context-menu'
import { useChatStore } from '@/stores/chat'
import { toast } from '@/components/common'

export interface MessageListContextMenuOptions {
  t: (key: string) => string
  onRequestSearch: () => void
}

export interface MessageListContextMenuResult {
  contextMenu: ReturnType<typeof useContextMenu<ChatMessage>>
  handleContextMenuAction: (action: ContextMenuAction) => void
}

/** 右键菜单(2026-07-28 立,深度对标 Trae Work)。 */
export function useMessageListContextMenu({
  t,
  onRequestSearch,
}: MessageListContextMenuOptions): MessageListContextMenuResult {
  const contextMenu = useContextMenu<ChatMessage>({
    buildItems: (msg) => {
      const isAssistant = msg.role === 'assistant'
      return [
        {
          id: 'copy',
          label: t('contextMenu.copyText'),
          action: 'copy',
        },
        {
          id: 'copyMarkdown',
          label: t('contextMenu.copyMarkdown'),
          action: 'copyMarkdown',
          disabled: !isAssistant,
        },
        {
          id: 'search',
          label: t('search'),
          action: 'search',
          shortcut: 'Ctrl+F',
          icon: <Search className="h-3 w-3" aria-hidden />,
        },
        { id: 'sep-1', label: '', separator: true },
        {
          id: 'regenerate',
          label: t('contextMenu.regenerate'),
          action: 'regenerate',
          disabled: !isAssistant,
        },
        {
          id: 'feedback',
          label: t('contextMenu.feedback'),
          action: 'feedback',
          disabled: !isAssistant,
        },
        { id: 'sep-2', label: '', separator: true },
        {
          id: 'delete',
          label: t('contextMenu.deleteMessage'),
          action: 'delete',
          danger: true,
        },
      ]
    },
  })

  // 右键菜单项点击处理
  const handleContextMenuAction = React.useCallback(
    async (action: ContextMenuAction) => {
      const msg = contextMenu.data
      if (!msg) return
      contextMenu.close()
      try {
        if (action === 'copy') {
          const text = plainTextForClipboard(msg.content)
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            toast.success(t('toast.copiedText'))
          }
        } else if (action === 'copyMarkdown') {
          const md = normalizeMarkdown(msg.content)
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(md)
            toast.success(t('toast.copiedMarkdown'))
          }
        } else if (action === 'regenerate') {
          // 重新生成:转发到全局事件,由 message-input 监听后触发 sendAnswer
          window.dispatchEvent(
            new CustomEvent('ihui:regenerate-message', { detail: { messageId: msg.id } }),
          )
          toast.info(t('toast.regenerating'))
        } else if (action === 'feedback') {
          // 反馈:简单 toast 兜底(深度反馈系统不在本任务范围)
          toast.success(t('toast.feedbackRecorded'))
        } else if (action === 'search') {
          // Phase 23:打开搜索栏(等同于 Ctrl+F)
          onRequestSearch()
        } else if (action === 'delete') {
          // 删除:本地过滤 store(单端,服务端持久化由 message-input 流式回收)
          const store = useChatStore.getState()
          const next = store.messages.filter((m) => m.id !== msg.id)
          if (next.length !== store.messages.length) {
            useChatStore.setState({ messages: next })
            toast.success(t('toast.messageDeleted'))
          }
        }
      } catch (err) {
        toast.error(t('toast.operationFailed'), {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [contextMenu, t, onRequestSearch],
  )

  return { contextMenu, handleContextMenuAction }
}
