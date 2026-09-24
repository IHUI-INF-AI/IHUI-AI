// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D66「编辑重发 = 回退文件修改并重新发送」确认弹层(G-89)。
// **包装/组合既有能力,不新建回退通道**:
//   · 逐文件 diff 详情直接内嵌既有 `CheckpointRollbackConfirm`(其自行走既有
//     `getCheckpointImpact` 通道取影响面,本组件不改它);
//   · 紧凑文件清单复用 D4 纯逻辑件 `prepareImpactFiles`;
//   · 确认后的回退执行由宿主经判定层 `composeEditResend` 回调注入既有
//     checkpoint 回退通道完成,本组件只展示判定层状态与预览。

import * as React from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'
import type { CheckpointScope } from '@/api/checkpoint-api'
import { CheckpointRollbackConfirm } from '@/components/ai/checkpoint-rollback-confirm'
import { prepareImpactFiles } from '@/components/ai/checkpoint-impact'
import {
  editResendPhaseKey,
  isEditResendFailurePhase,
  needsPartialRollbackWarning,
  previewView,
  type EditResendImpact,
  type EditResendPhase,
  type EditResendPreview,
} from '@ihui/shared/chat/edit-resend-rollback'

export interface EditResendRollbackConfirmProps {
  open: boolean
  checkpointId: string
  sessionId: string
  scope: CheckpointScope
  /** 宿主经既有 getCheckpointImpact(通道)映射出的影响面(含逐文件 recorded 标记) */
  impact: EditResendImpact | null
  /** 判定层相位(四组失败态逐一显式渲染,不得静默吞掉) */
  phase: EditResendPhase
  /** 确认:回调带上预览视图(宿主喂给 composeEditResend) */
  onConfirm: (preview: EditResendPreview | null) => void
  onCancel: () => void
}

export function EditResendRollbackConfirm({
  open,
  checkpointId,
  sessionId,
  scope,
  impact,
  phase,
  onConfirm,
  onCancel,
}: EditResendRollbackConfirmProps) {
  const t = useTranslations('ai.pane.editResend')
  const [detailOpen, setDetailOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) setDetailOpen(false)
  }, [open])

  if (!open) return null

  const preview = previewView(impact)
  const warning = needsPartialRollbackWarning(impact)
  const failure = isEditResendFailurePhase(phase) ? phase : null
  const imp = impact
  const prepared = imp
    ? prepareImpactFiles(
        imp.files.map((f) => ({
          path: f.path,
          oldContent: '',
          newContent: '',
          added: f.added ?? 0,
          deleted: f.deleted ?? 0,
        })),
      )
    : null
  const files = prepared
    ? prepared.display.map((f, i) => ({ ...f, recorded: imp?.files[i]?.recorded ?? true }))
    : []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col overflow-hidden">
        <div data-edit-resend-state={phase}>
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span className="min-w-0 break-words">{t('title')}</span>
            </DialogTitle>
            <DialogDescription className="break-words">{t('desc')}</DialogDescription>
          </DialogHeader>

          {/* 四组失败态 + 进行中 / 完成态:逐一显式渲染位,不得静默吞掉 */}
          {failure && (
            <p
              data-edit-resend-failure={phase}
              className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {t(`failure.${phase}`)}
            </p>
          )}
          {!failure && phase === 'executing' && (
            <p
              data-edit-resend-progress="executing"
              className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              <span>{t(editResendPhaseKey(phase))}</span>
            </p>
          )}
          {!failure && phase === 'completed' && (
            <p
              data-edit-resend-progress="completed"
              className="mt-2 flex items-center gap-2 text-xs text-emerald-600"
            >
              <Check className="h-3 w-3" aria-hidden />
              <span>{t(editResendPhaseKey(phase))}</span>
            </p>
          )}

          {/* 部分回退警示(本票灵魂):本轮改动未全部被检查点记录时必须出 */}
          {warning && (
            <p
              data-edit-resend-warning="partialRollback"
              className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-600"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{t('warning.partialRollback')}</span>
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto pt-2">
          {/* 预览:要回退的文件清单 */}
          <div data-edit-resend-section="files" className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t('previewFilesTitle')}</p>
            {files.map((f) => (
              <div
                key={f.path}
                data-edit-resend-file={f.path}
                data-edit-resend-recorded={f.recorded ? 'true' : 'false'}
                className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.path}</span>
                <Badge
                  className={
                    f.recorded
                      ? 'border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15'
                      : 'border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/15'
                  }
                >
                  {f.recorded ? t('fileRecorded') : t('fileUnrecorded')}
                </Badge>
              </div>
            ))}
            {prepared?.truncated && (
              <p className="text-xs text-muted-foreground">
                {t('previewFilesMore', { count: prepared.remaining })}
              </p>
            )}
            <Button
              variant="ghost"
              size="xs"
              className="px-2 text-xs text-muted-foreground hover:text-primary"
              onClick={() => setDetailOpen(true)}
              data-action="viewDiff"
            >
              {t('detailAction')}
            </Button>
          </div>

          {/* 预览:要重发的编辑内容 */}
          <div data-edit-resend-section="draft" className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t('previewEditTitle')}</p>
            <div
              data-edit-resend-draft
              className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs"
            >
              {preview?.editDraft ?? ''}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={phase === 'executing'}
            data-action="cancel"
          >
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(preview)}
            disabled={phase !== 'previewing' || !impact}
            data-action="confirm"
          >
            {phase === 'executing' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            <span>{t('confirm')}</span>
          </Button>
        </div>
      </DialogContent>

      {/* 逐文件 diff 详情:内嵌既有回退影响确认弹层(不改它),确认键仅作关闭返回 */}
      <CheckpointRollbackConfirm
        open={detailOpen}
        checkpointId={checkpointId}
        sessionId={sessionId}
        scope={scope}
        checkpointLabel={t('detailLabel')}
        onConfirm={() => setDetailOpen(false)}
        onClose={() => setDetailOpen(false)}
      />
    </Dialog>
  )
}

export default EditResendRollbackConfirm
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
