// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 回退影响预览确认层(对标 Trae:恢复前展示影响文件 + 逐文件 diff 确认)。
// 打开时拉取 GET /api/checkpoints/{id}/impact,列出影响文件(路径 + 增/删徽章),
// 支持展开单文件 diff(复用 DiffPreview);确认后才由父级执行恢复。

import * as React from 'react'
import { Loader2, Check, ChevronDown, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import {
  getCheckpointImpact,
  type CheckpointScope,
  type CheckpointImpactResult,
} from '@/api/checkpoint-api'
import { prepareImpactFiles } from '@/components/ai/checkpoint-impact'
import { DiffPreview } from '@/components/ai/diff-preview'

interface CheckpointRollbackConfirmProps {
  open: boolean
  checkpointId: string
  sessionId: string
  scope: CheckpointScope
  checkpointLabel: string
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function CheckpointRollbackConfirm({
  open,
  checkpointId,
  sessionId,
  scope,
  checkpointLabel,
  onConfirm,
  onClose,
}: CheckpointRollbackConfirmProps) {
  const t = useTranslations('ai.checkpointHistory')
  const [impact, setImpact] = React.useState<CheckpointImpactResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [confirming, setConfirming] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    setImpact(null)
    setExpanded(new Set())
    getCheckpointImpact(checkpointId, sessionId, scope)
      .then((data) => {
        if (alive) setImpact(data)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : t('rollbackConfirmLoadFailed'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, checkpointId, sessionId, scope, t])

  if (!open) return null

  const prepared = impact ? prepareImpactFiles(impact.files) : null

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await onConfirm()
    } catch {
      setConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !confirming && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <span className="min-w-0 break-words">{t('rollbackConfirmTitle')}</span>
          </DialogTitle>
          <DialogDescription className="break-words">{checkpointLabel}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>{t('rollbackConfirmLoading')}</span>
            </div>
          )}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          {impact && !loading && (
            <div className="space-y-2">
              {prepared && prepared.display.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">{t('rollbackConfirmDesc')}</p>
                  {prepared.display.map((f) => {
                    const isOpen = expanded.has(f.path)
                    return (
                      <div key={f.path} className="rounded-md border bg-muted/30 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 truncate font-mono text-xs">
                            {f.path}
                          </span>
                          <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
                            {t('rollbackConfirmAdded', { count: f.added })}
                          </Badge>
                          <Badge className="border-transparent bg-rose-500/15 text-rose-600 hover:bg-rose-500/15">
                            {t('rollbackConfirmDeleted', { count: f.deleted })}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="px-2 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => toggle(f.path)}
                          >
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              aria-hidden
                            />
                            {isOpen ? t('rollbackConfirmHideDiff') : t('rollbackConfirmViewDiff')}
                          </Button>
                        </div>
                        {f.contentTruncated && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {t('rollbackConfirmContentTruncated')}
                          </p>
                        )}
                        {isOpen && (
                          <div className="mt-2">
                            <DiffPreview
                              oldContent={f.oldContent}
                              newContent={f.newContent}
                              filename={f.path}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {prepared.truncated && (
                    <p className="text-xs text-muted-foreground">
                      {t('rollbackConfirmMoreFiles', { count: prepared.remaining })}
                    </p>
                  )}
                </>
              ) : (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {t('rollbackConfirmNoFiles', { count: impact.restored_message_count })}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={confirming}>
            {t('rollbackConfirmCancel')}
          </Button>
          <Button size="sm" onClick={() => void handleConfirm()} disabled={confirming || loading}>
            {confirming ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            <span>{t('rollbackConfirmConfirm')}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CheckpointRollbackConfirm
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
