// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D125 逐消息评论面板(2026-10-23 立,设计稿 docs/d125-session-collab-design.md §7)。
 *
 * 最小纵向切片的 web 消费面:挂在 MessageItem 操作行下方,列/发/删本条消息的评论。
 * 三条接线纪律:
 *  ① 数据面走 `@ihui/api-client` 端点(REST 唯一出口),不在这里拼 fetch;
 *  ② 实时面订阅 `collab:comment` 帧 —— 帧**不带正文**(拉取制,设计稿 §4.2),
 *     收到匹配帧只 invalidate 重取,不在客户端拼第二份评论真相;
 *  ③ 授权判定在服务端(属主/accepted 协作者),这里只按 `user.id` 收着显示删除钮,
 *     越权请求由 API 拒(403/404),前端不写第二套权限判据。
 *
 * 文案零新增 i18n 键:全部复用 `comments` 顶层命名空间既有键。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Input, Button } from '@ihui/ui-react'
import { Trash2, Loader2 } from 'lucide-react'
import {
  subscribeUserBroadcast,
  listMessageComments,
  addMessageComment,
  deleteMessageComment,
  type UserBroadcastConfig,
} from '@ihui/api-client'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/components/common'
// AGENTS §4:原生 confirm() 禁用 —— 删除评论的二次确认走项目自有弹窗出口
import { useConfirm } from '@/hooks/use-confirm'
import { formatMessageTimestamp } from './message-item-parts'
// D125 另批收口(2026-10-23):§7 面板头部出口 = 接受邀请(收件箱)+ 邀请管理(名单/档位/撤销)+ 发言锁
import { CollabInvitationInbox } from '../collab/CollabInvitationInbox'
import { CollabManagePanel } from '../collab/CollabManagePanel'

export interface MessageCommentPanelProps {
  conversationId: string
  messageId: string
  onClose: () => void
}

export function MessageCommentPanel({
  conversationId,
  messageId,
  onClose,
}: MessageCommentPanelProps) {
  const t = useTranslations('comments')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const userId = useAuthStore((s) => s.user?.id)
  const [draft, setDraft] = React.useState('')

  const queryKey = React.useMemo(
    () => ['chat', 'message-comments', conversationId, messageId] as const,
    [conversationId, messageId],
  )

  const commentsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await listMessageComments(conversationId, messageId)
      if (!res.success) throw new Error(res.error)
      return res.data.comments
    },
  })

  // collab:comment 帧 ⇒ 本条消息的评论集变了 ⇒ invalidate 重取(拉取制,帧不带正文)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const config: UserBroadcastConfig = {
      baseUrl: window.location.origin,
      tokenProvider: () => useAuthStore.getState().token,
    }
    const sub = subscribeUserBroadcast(config, {
      'collab:comment': (evt) => {
        if (evt.data.conversationId !== conversationId) return
        if (evt.data.messageId !== messageId) return
        void qc.invalidateQueries({ queryKey })
      },
    })
    return () => sub.close()
  }, [qc, queryKey, conversationId, messageId])

  const addMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await addMessageComment(conversationId, messageId, body)
      if (!res.success) throw new Error(res.error)
      return res.data.comment
    },
    onSuccess: () => {
      setDraft('')
      void qc.invalidateQueries({ queryKey })
    },
    onError: (e: Error) => toast.error(e.message || t('submitting')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await deleteMessageComment(conversationId, messageId, commentId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error(e.message || t('delete')),
  })

  const comments = commentsQuery.data ?? []

  return (
    <div
      className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm"
      data-testid={`message-comment-panel-${messageId}`}
    >
      <CollabInvitationInbox />
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-muted-foreground">{t('title')}</span>
        <div className="flex items-center gap-2">
          <CollabManagePanel conversationId={conversationId} />
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tc('close')}
          </Button>
        </div>
      </div>

      {commentsQuery.isLoading ? (
        <div className="flex items-center gap-2 py-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {tc('loading')}
        </div>
      ) : comments.length === 0 ? (
        <div className="py-2 text-muted-foreground">{t('empty')}</div>
      ) : (
        <ul className="mb-2 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="mr-2 font-medium">{c.authorName ?? c.userId}</span>
                <span className="break-words">{c.body}</span>
                <div className="text-xs text-muted-foreground">
                  {formatMessageTimestamp(Date.parse(c.createdAt))}
                </div>
              </div>
              {userId && c.userId === userId && (
                <button
                  type="button"
                  aria-label={t('delete')}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('delete'),
                      description: t('deleteConfirm'),
                      variant: 'destructive',
                    })
                    if (ok) deleteMutation.mutate(c.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const body = draft.trim()
          if (!body || addMutation.isPending) return
          addMutation.mutate(body)
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('replyPlaceholder')}
          maxLength={2000}
          aria-label={t('replyContent')}
        />
        <Button type="submit" size="sm" disabled={!draft.trim() || addMutation.isPending}>
          {addMutation.isPending ? t('submitting') : t('submitReply')}
        </Button>
      </form>
      {/* useConfirm 的弹窗必须挂进组件树,否则二次确认点了没反应 */}
      <ConfirmDialogRenderer />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
