// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D165(2026-10-01 立):分组本身的三个动作 —— 重命名 / 置顶 / 删除。
//
// 为什么这是一个**容器**组件而不是 conversation-org-dialog 的又一组 props:
// 那个对话框的既定契约是"纯受控、不碰 store/网络"(会话级的文件夹归属仍走它的 onSubmit,由调用方写),
// 而"分组"在 D165 之后是服务端的一等行 —— 它的清单、重命名、置顶、删除都必然要读写同一个服务端 store。
// 把这些再逐层 prop-drill 回侧栏,等于让侧栏替分组实体背一份 API 面;所以实体级管理放在这里,
// 会话级归属仍保持受控。两者写的是同一个服务端 store,不存在第二份真相。
//
// 失败必须分类显示:七种 reason 各一句,并**只在**能自助的场合给动作
// (unauthorized → 去重新登录;offline → 重试;其余 → 说清是哪一格里没成)。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, FolderOpen, Loader2, Pencil, Pin, Trash2, X } from 'lucide-react'

import { ORG_FOLDER_MAX_LENGTH } from '@ihui/shared'

import { cn } from '@/lib/utils'
import { Button, Input } from '@ihui/ui-react'
import { useOrgSyncState } from '@/stores/conversation-org'
import { useAuthStore } from '@/stores/auth'
import {
  useOrgServerStore,
  type ConversationFolder,
  type OrgFailureReason,
} from '@ihui/shared/chat/conversation-org-server'

/** reason → i18n key。表住在这一处:两处各写一遍必然有一处漏掉新增的分类。 */
const REASON_KEY: Record<OrgFailureReason, string> = {
  offline: 'reasonOffline',
  'name-too-long': 'reasonNameTooLong',
  'duplicate-name': 'reasonDuplicateName',
  'not-found': 'reasonNotFound',
  forbidden: 'reasonForbidden',
  unauthorized: 'reasonUnauthorized',
  server: 'reasonServer',
  unknown: 'reasonUnknown',
}

export function ConversationFolderAdmin() {
  const t = useTranslations('aiChat.org')
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const { state, reason } = useOrgSyncState(userId)
  const folders = useOrgServerStore((s) => s.folders)
  const busy = useOrgServerStore((s) => s.loading)
  const refresh = useOrgServerStore((s) => s.refresh)
  const renameFolder = useOrgServerStore((s) => s.renameFolder)
  const togglePinFolder = useOrgServerStore((s) => s.togglePinFolder)
  const deleteFolder = useOrgServerStore((s) => s.deleteFolder)

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  /** 逐条失败原因:一次操作的红不得盖住另一条的绿,也不得清掉别的行(全局一条 error 就做不到)。 */
  const [rowError, setRowError] = React.useState<Record<string, string>>({})
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  if (!userId) return null
  // 服务端没接管之前不显示这一族控件:那会把"还没同步"演成"一个分组都没有",
  // 而后者会让人以为自己的文件夹丢了(实际只是没回来)。
  if (state !== 'synced') {
    return (
      <div className="space-y-1.5" data-testid="org-admin-notice">
        <p className="text-xs text-muted-foreground">{t('adminPending')}</p>
        {state === 'failed' && reason ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-destructive">{t(REASON_KEY[reason])}</span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="bg-muted"
              onClick={() => void refresh(userId)}
            >
              {t('retry')}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  const clearRow = (id: string) =>
    setRowError((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })

  const run = async (id: string, fn: () => Promise<{ ok: true } | { ok: false; reason: OrgFailureReason }>) => {
    setPendingId(id)
    clearRow(id)
    const r = await fn()
    setPendingId(null)
    if (!r.ok) setRowError((prev) => ({ ...prev, [id]: t(REASON_KEY[r.reason]) }))
  }

  const commitRename = (folder: ConversationFolder) => {
    const id = folder.id
    setEditingId(null)
    if (folder.name === draft.trim()) return
    void run(id, () => renameFolder(userId, id, draft))
  }

  return (
    <div className="space-y-1.5" data-testid="org-admin">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <FolderOpen className="h-3.5 w-3.5" />
          {t('adminTitle')}
        </span>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      </div>

      {folders.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="org-admin-empty">
          {t('adminEmpty')}
        </p>
      ) : (
        <ul className="space-y-1">
          {folders.map((f) => (
            <li
              key={f.id}
              data-testid={`org-admin-row-${f.id}`}
              className="flex items-center gap-1 rounded-sm border px-1.5 py-1"
            >
              {editingId === f.id ? (
                <>
                  <Input
                    value={draft}
                    maxLength={ORG_FOLDER_MAX_LENGTH}
                    onChange={(e) => setDraft(e.target.value)}
                    data-testid={`org-admin-rename-input-${f.id}`}
                    className="h-7 min-w-0 flex-1 text-xs"
                  />
                  <button
                    type="button"
                    aria-label={t('confirmRenameAria')}
                    data-testid={`org-admin-rename-save-${f.id}`}
                    onClick={() => commitRename(f)}
                    className="inline-flex shrink-0 items-center rounded-sm p-1 hover:bg-accent"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('cancelRenameAria')}
                    data-testid={`org-admin-rename-cancel-${f.id}`}
                    onClick={() => setEditingId(null)}
                    className="inline-flex shrink-0 items-center rounded-sm p-1 hover:bg-accent"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-xs">{f.name}</span>
                  <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                    {t('folderCount', { count: f.conversationCount })}
                  </span>
                  <button
                    type="button"
                    aria-label={f.pinned ? t('unpinAria') : t('pinAria')}
                    data-testid={`org-admin-pin-${f.id}`}
                    disabled={pendingId === f.id}
                    onClick={() => void run(f.id, () => togglePinFolder(userId, f.id))}
                    className={cn(
                      'inline-flex shrink-0 items-center rounded-sm p-1 transition-colors hover:bg-accent',
                      f.pinned ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('renameAria')}
                    data-testid={`org-admin-rename-${f.id}`}
                    disabled={pendingId === f.id}
                    onClick={() => {
                      setEditingId(f.id)
                      setDraft(f.name)
                      clearRow(f.id)
                    }}
                    className="inline-flex shrink-0 items-center rounded-sm p-1 text-muted-foreground hover:bg-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('deleteAria')}
                    data-testid={`org-admin-delete-${f.id}`}
                    disabled={pendingId === f.id}
                    onClick={() => void run(f.id, () => deleteFolder(userId, f.id))}
                    className="inline-flex shrink-0 items-center rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {Object.keys(rowError).length > 0 && (
        <ul className="space-y-0.5" data-testid="org-admin-errors">
          {Object.entries(rowError).map(([id, msg]) => (
            <li key={id} className="text-[11px] text-destructive">
              {folders.find((f) => f.id === id)?.name ?? id}: {msg}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">{t('adminDeleteHint')}</p>
    </div>
  )
}

export default ConversationFolderAdmin
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
