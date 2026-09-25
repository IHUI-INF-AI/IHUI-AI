// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 单条目版本流对话框(G-35,2026-09-26)
 * GET /items/:itemId/revisions 按版本序展示:动作 / 角色 / 改动说明 / 前后摘要(title+长度+digest)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import {
  listKnowledgeItemRevisions,
  type KnowledgeItemDTO,
  type KnowledgeRevisionDTO,
} from '@ihui/api-client'

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function RevisionHistoryDialog({
  item,
  onClose,
}: {
  item: KnowledgeItemDTO
  onClose: () => void
}) {
  const t = useTranslations('teamKnowledge')
  const [rows, setRows] = React.useState<KnowledgeRevisionDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    listKnowledgeItemRevisions(item.id)
      .then((data) => {
        if (alive) setRows(data)
      })
      .catch((e: unknown) => {
        if (alive) setError((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [item.id])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-sm">{t('historyTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 p-3">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
          {!loading && rows.length === 0 && (
            <div className="text-muted-foreground text-sm">{t('emptyHistory')}</div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="bg-muted/40 rounded px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="bg-background rounded px-1.5 py-0.5 font-mono">
                  r{r.revisionNo}
                </span>
                <span className="font-medium">{t(`action.${r.action}`)}</span>
                {r.actorRole && (
                  <span className="text-muted-foreground">{t(`role.${r.actorRole}`)}</span>
                )}
                <span className="text-muted-foreground ml-auto">{formatDate(r.createdAt)}</span>
              </div>
              {r.changeNote && <p className="text-muted-foreground mt-1">{r.changeNote}</p>}
              {(r.beforeSummary || r.afterSummary) && (
                <p className="text-muted-foreground mt-1 font-mono">
                  {r.beforeSummary
                    ? `${r.beforeSummary.length}B·${r.beforeSummary.digest.slice(0, 8)}`
                    : '—'}
                  {' → '}
                  {r.afterSummary
                    ? `${r.afterSummary.length}B·${r.afterSummary.digest.slice(0, 8)}`
                    : '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
