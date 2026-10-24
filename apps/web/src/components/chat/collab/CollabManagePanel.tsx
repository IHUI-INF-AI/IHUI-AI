// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D125 邀请管理面板(2026-10-23 另批收口,设计稿 docs/d125-session-collab-design.md §6/§7)。
 *
 * 协作名单 + 发言锁管理面:列协作者(含 pending/revoked 审计行)、改档位
 * (plan ⇄ 写档)、撤销;写锁(麦)实况与抢麦/接管/交麦入口。
 * 发言资格(属主或写档 accepted 协作者)与地板仲裁全在服务端判 ——
 * 前端只把按钮递出去,越权由 API 拒(403/409)、toast 出声,不写第二套权限判据(§7 纪律③)。
 * 实时面订阅 `collab:invitation`(名单变)与 `collab:lock`(麦变)帧,invalidate 重取(拉取制)。
 * 缺省折叠:评论面板头部保持安静,管理面点开才挂查询与订阅。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { ChevronDown, ChevronRight, Loader2, Mic, Users } from 'lucide-react'
import {
  subscribeUserBroadcast,
  listConversationCollaborators,
  updateConversationCollaboratorTier,
  revokeConversationCollaborator,
  getConversationCollabLock,
  acquireConversationCollabLock,
  releaseConversationCollabLock,
  type UserBroadcastConfig,
} from '@ihui/api-client'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/components/common'
// AGENTS §4:原生 confirm() 禁用 —— 撤销协作者的二次确认走项目自有弹窗出口
import { useConfirm } from '@/hooks/use-confirm'
import { PERMISSION_MODE_WIRE_VALUES } from '@ihui/types'
import { collabStatusLabelKey, collabTierLabelKey, type CollabTierWire } from './collab-parts'

export interface CollabManagePanelProps {
  conversationId: string
}

export function CollabManagePanel({ conversationId }: CollabManagePanelProps) {
  const t = useTranslations('collab')
  const qc = useQueryClient()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const userId = useAuthStore((s) => s.user?.id)
  const [open, setOpen] = React.useState(false)

  const collaboratorsKey = React.useMemo(
    () => ['chat', 'collaborators', conversationId] as const,
    [conversationId],
  )
  const lockKey = React.useMemo(
    () => ['chat', 'collab-lock', conversationId] as const,
    [conversationId],
  )

  const collaboratorsQuery = useQuery({
    queryKey: collaboratorsKey,
    enabled: open,
    queryFn: async () => {
      const res = await listConversationCollaborators(conversationId)
      if (!res.success) throw new Error(res.error)
      return res.data.collaborators
    },
  })

  const lockQuery = useQuery({
    queryKey: lockKey,
    enabled: open,
    queryFn: async () => {
      const res = await getConversationCollabLock(conversationId)
      if (!res.success) throw new Error(res.error)
      return res.data.lock
    },
  })

  // 帧只做失效信号(拉取制):名单帧 ⇒ 重取协作者,麦帧 ⇒ 重取锁;命中本会话才动
  React.useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const config: UserBroadcastConfig = {
      baseUrl: window.location.origin,
      tokenProvider: () => useAuthStore.getState().token,
    }
    const sub = subscribeUserBroadcast(config, {
      'collab:invitation': (evt) => {
        if (evt.data.conversationId !== conversationId) return
        void qc.invalidateQueries({ queryKey: collaboratorsKey })
      },
      'collab:lock': (evt) => {
        if (evt.data.conversationId !== conversationId) return
        void qc.invalidateQueries({ queryKey: lockKey })
      },
    })
    return () => sub.close()
  }, [open, qc, conversationId, collaboratorsKey, lockKey])

  const tierMutation = useMutation({
    mutationFn: async (input: { targetUserId: string; tier: CollabTierWire }) => {
      const res = await updateConversationCollaboratorTier(
        conversationId,
        input.targetUserId,
        input.tier,
      )
      if (!res.success) throw new Error(res.error)
      return res.data.collaborator
    },
    onSuccess: () => {
      toast.success(t('tierUpdated'))
      void qc.invalidateQueries({ queryKey: collaboratorsKey })
    },
    onError: (e: Error) => toast.error(e.message || t('tierUpdateFailed')),
  })

  const revokeMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await revokeConversationCollaborator(conversationId, targetUserId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success(t('revokeDone'))
      void qc.invalidateQueries({ queryKey: collaboratorsKey })
      // 撤销在服务端顺带夺回被撤销人持有的麦(幽灵锁收口),麦实况跟着重取
      void qc.invalidateQueries({ queryKey: lockKey })
    },
    onError: (e: Error) => toast.error(e.message || t('revokeFailed')),
  })

  const acquireMutation = useMutation({
    mutationFn: async (takeover: boolean) => {
      const res = await acquireConversationCollabLock(conversationId, { takeover })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: ({ takenFrom }) => {
      toast.success(takenFrom ? t('lockTaken') : t('lockAcquired'))
      void qc.invalidateQueries({ queryKey: lockKey })
    },
    onError: (e: Error) => toast.error(e.message || t('lockFailed')),
  })

  const releaseMutation = useMutation({
    mutationFn: async () => {
      const res = await releaseConversationCollabLock(conversationId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success(t('lockReleased'))
      void qc.invalidateQueries({ queryKey: lockKey })
    },
    onError: (e: Error) => toast.error(e.message || t('lockFailed')),
  })

  const collaborators = collaboratorsQuery.data ?? []
  const lock = lockQuery.data ?? null
  const holderIsMe = !!lock && !!userId && lock.holderUserId === userId

  return (
    <div className="text-xs" data-testid="collab-manage-panel">
      <button
        type="button"
        className="flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('manageTitle')}
      </button>

      {open && (
        <div className="mt-1 w-72 rounded-md border border-border bg-muted/30 p-2">
          {/* 发言锁(麦)实况 + 抢麦/接管/交麦入口 */}
          <div
            className="mb-2 flex items-center justify-between gap-2"
            data-testid="collab-lock-row"
          >
            <span className="flex shrink-0 items-center gap-1 font-medium text-muted-foreground">
              <Mic className="h-3.5 w-3.5" aria-hidden />
              {t('lockTitle')}
            </span>
            {lockQuery.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : lock ? (
              <span className="flex min-w-0 items-center justify-end gap-2">
                <span className="truncate text-muted-foreground" data-testid="collab-lock-holder">
                  {t('lockHeldBy', { user: holderIsMe ? t('you') : lock.holderUserId })}
                </span>
                {holderIsMe ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={releaseMutation.isPending}
                    onClick={() => releaseMutation.mutate()}
                  >
                    {t('lockRelease')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={acquireMutation.isPending}
                    onClick={() => acquireMutation.mutate(true)}
                  >
                    {t('lockTakeover')}
                  </Button>
                )}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-muted-foreground" data-testid="collab-lock-holder">
                  {t('lockFree')}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={acquireMutation.isPending}
                  onClick={() => acquireMutation.mutate(false)}
                >
                  {t('lockAcquire')}
                </Button>
              </span>
            )}
          </div>

          {/* 协作名单 */}
          <div className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {t('collaboratorsTitle')}
          </div>
          {collaboratorsQuery.isLoading ? (
            <div className="flex items-center py-1 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            </div>
          ) : collaborators.length === 0 ? (
            <div className="py-1 text-muted-foreground">{t('collaboratorsEmpty')}</div>
          ) : (
            <ul className="space-y-1">
              {collaborators.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2"
                  data-testid="collab-collaborator-row"
                >
                  <span className="min-w-0 truncate">
                    {c.userId === userId ? t('you') : c.userId}
                    <span className="ml-1 text-muted-foreground">
                      ({t(collabStatusLabelKey(c.status))})
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <select
                      className="rounded border border-border bg-background px-1 py-0.5"
                      aria-label={t('tierLabel')}
                      data-testid="collab-tier-select"
                      value={c.tier}
                      disabled={c.status === 'revoked' || tierMutation.isPending}
                      onChange={(e) =>
                        tierMutation.mutate({
                          targetUserId: c.userId,
                          tier: e.target.value as CollabTierWire,
                        })
                      }
                    >
                      {PERMISSION_MODE_WIRE_VALUES.map((wire) => (
                        <option key={wire} value={wire}>
                          {t(collabTierLabelKey(wire))}
                        </option>
                      ))}
                    </select>
                    {c.status !== 'revoked' && (
                      <button
                        type="button"
                        aria-label={t('revoke')}
                        data-testid="collab-revoke-button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          const ok = await confirm({
                            title: t('revoke'),
                            description: t('revokeConfirm'),
                            variant: 'destructive',
                          })
                          if (ok) revokeMutation.mutate(c.userId)
                        }}
                      >
                        {t('revoke')}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* useConfirm 的弹窗必须挂进组件树,否则二次确认点了没反应 */}
      <ConfirmDialogRenderer />
    </div>
  )
}
