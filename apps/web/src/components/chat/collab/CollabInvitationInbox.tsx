// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D125 邀请收件箱(2026-10-23 另批收口,设计稿 docs/d125-session-collab-design.md §7)。
 *
 * 接受邀请的 web 出口:列本人待处理的协作邀请,一键接受。三条接线纪律与
 * MessageCommentPanel 同款:
 *  ① 数据面走 `@ihui/api-client` 端点(REST 唯一出口),不在这里拼 fetch;
 *  ② 实时面订阅 `collab:invitation` 帧 —— 帧只做失效信号(拉取制,设计稿 §4.1),
 *     我的邀请集合的任何变化(建/接受/撤销)都 invalidate 重取,不在端上拼第二份真相;
 *  ③ 授权判定在服务端(被邀请人本人才能接受),前端不写第二套权限判据,
 *     越权请求由 API 拒、toast 出声。
 * 空列表不渲染(面板头部保持安静);文案走 `collab` 命名空间 —— 设计稿 §7
 * 「零新增 i18n」只覆盖评论切片,另批管理 UI 有新增词表(五语齐)。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { Inbox } from 'lucide-react'
import {
  subscribeUserBroadcast,
  listMyCollaboratorInvitations,
  acceptCollaboratorInvitation,
  type UserBroadcastConfig,
} from '@ihui/api-client'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/components/common'
import { collabTierLabelKey } from './collab-parts'

const INVITATIONS_QUERY_KEY = ['chat', 'collab-invitations'] as const

export function CollabInvitationInbox() {
  const t = useTranslations('collab')
  const qc = useQueryClient()

  const invitationsQuery = useQuery({
    queryKey: INVITATIONS_QUERY_KEY,
    queryFn: async () => {
      const res = await listMyCollaboratorInvitations()
      if (!res.success) throw new Error(res.error)
      return res.data.invitations
    },
  })

  // collab:invitation 帧 ⇒ 我的邀请集合变了 ⇒ invalidate 重取(帧不带正文)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const config: UserBroadcastConfig = {
      baseUrl: window.location.origin,
      tokenProvider: () => useAuthStore.getState().token,
    }
    const sub = subscribeUserBroadcast(config, {
      'collab:invitation': () => {
        void qc.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY })
      },
    })
    return () => sub.close()
  }, [qc])

  const acceptMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await acceptCollaboratorInvitation(conversationId)
      if (!res.success) throw new Error(res.error)
      return res.data.collaborator
    },
    onSuccess: () => {
      toast.success(t('invitationAcceptDone'))
      void qc.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY })
    },
    onError: (e: Error) => toast.error(e.message || t('invitationAcceptFailed')),
  })

  const invitations = invitationsQuery.data ?? []
  if (invitationsQuery.isLoading || invitations.length === 0) return null

  return (
    <div
      className="mb-2 rounded-md border border-border bg-muted/40 p-2 text-xs"
      data-testid="collab-invitation-inbox"
    >
      <div className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
        <Inbox className="h-3.5 w-3.5" aria-hidden />
        {t('invitationTitle')}
      </div>
      <ul className="space-y-1">
        {invitations.map((inv) => (
          <li
            key={inv.invitationId}
            className="flex items-center justify-between gap-2"
            data-testid="collab-invitation-row"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              {t('invitationConversation')}: {inv.conversationId}
              <span className="mx-1">·</span>
              {t('invitationInvitedBy')}: {inv.invitedBy}
              <span className="mx-1">·</span>
              {t(collabTierLabelKey(inv.tier))}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate(inv.conversationId)}
            >
              {acceptMutation.isPending ? t('invitationAccepting') : t('invitationAccept')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
