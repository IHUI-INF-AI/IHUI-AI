// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Edit, Monitor, FileText, AlertTriangle, X, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ihui/ui-react'
import { Button, Checkbox } from '@ihui/ui-react'
import { buildToolPermissionPreview, type PermissionFileChangeKind } from '@ihui/shared'

import { cn } from '@/lib/utils'
import type { PendingToolCall } from './types'

/** 变更类别的图形记号(diff 惯例,语言中性,不新造 i18n 文案)。 */
const CHANGE_KIND_MARKS: Record<PermissionFileChangeKind, string> = {
  create: '+',
  modify: '~',
  delete: '-',
  unknown: '?',
}

interface PermissionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toolCall: PendingToolCall | null
  onConfirm?: (id: string, allowAll: boolean) => void
  onDeny?: (id: string) => void
}

/** 根据工具名选择图标 */
function getToolIcon(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes('write') || lower.includes('edit') || lower.includes('file')) {
    return <Edit className="h-5 w-5" />
  }
  if (
    lower.includes('run') ||
    lower.includes('command') ||
    lower.includes('exec') ||
    lower.includes('shell')
  ) {
    return <Monitor className="h-5 w-5" />
  }
  if (lower.includes('delete') || lower.includes('remove')) {
    return <AlertTriangle className="h-5 w-5 text-amber-500" />
  }
  return <FileText className="h-5 w-5" />
}

/**
 * PermissionConfirmDialog - Agent 权限确认对话框
 * 当 Agent 需要用户确认工具调用时弹出，提供允许/拒绝/本次会话全部允许
 */
export function PermissionConfirmDialog({
  open,
  onOpenChange,
  toolCall,
  onConfirm,
  onDeny,
}: PermissionConfirmDialogProps) {
  const t = useTranslations('ai.permissionConfirm')
  const tCommon = useTranslations('common')
  const [allowAll, setAllowAll] = React.useState(false)

  React.useEffect(() => {
    if (open) setAllowAll(false)
  }, [open])

  // G-673:预览判据住在 @ihui/shared(键别名族 + input/rawInput 双承载层 + 显示预算),
  // 端内只做渲染 —— 审批弹窗不得再直接 JSON.stringify(input)。
  const preview = React.useMemo(() => buildToolPermissionPreview(toolCall), [toolCall])

  const handleAllow = () => {
    if (!toolCall) return
    onConfirm?.(toolCall.id, allowAll)
    onOpenChange(false)
  }

  const handleDeny = () => {
    if (!toolCall) return
    onDeny?.(toolCall.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {toolCall && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  'bg-amber-500/10 text-amber-600',
                )}
              >
                {getToolIcon(toolCall.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">{t('tool')}</div>
                <div className="break-words font-medium">{toolCall.name}</div>
              </div>
              {toolCall.iteration !== null && toolCall.iteration !== undefined && (
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {t('iteration', { n: toolCall.iteration })}
                </span>
              )}
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {t('inputParams')}
              </div>
              {preview.hasContent ? (
                <div className="max-h-48 space-y-1 overflow-auto rounded-md border bg-zinc-950 p-3 text-xs text-zinc-100">
                  {preview.command !== null && (
                    <div className="font-mono">
                      <span className="text-zinc-400">$ </span>
                      <span className="break-all whitespace-pre-wrap">
                        {preview.command}
                        {preview.commandTruncated ? ' …' : ''}
                      </span>
                    </div>
                  )}
                  {preview.filePaths.length > 0 && (
                    <ul className="space-y-0.5">
                      {preview.filePaths.map((p) => (
                        <li key={p} className="break-all font-mono">
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  {preview.fileChanges.length > 0 && (
                    <ul className="space-y-0.5">
                      {preview.fileChanges.map((c, i) => (
                        <li key={i} className="break-all font-mono">
                          <span className="text-zinc-400">{CHANGE_KIND_MARKS[c.kind]} </span>
                          {c.path ?? '—'}
                        </li>
                      ))}
                    </ul>
                  )}
                  {preview.scope !== null && (
                    <div className="font-mono text-zinc-300">{preview.scope}</div>
                  )}
                  {preview.hiddenFileCount + preview.hiddenChangeCount > 0 && (
                    <div className="font-mono text-zinc-400">
                      +{preview.hiddenFileCount + preview.hiddenChangeCount}
                    </div>
                  )}
                </div>
              ) : (
                // 反例验收:全维空 ⇒ 明确"无可预览内容"(复用既有 common.noData),而不是渲染空白标题。
                <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  {tCommon('noData')}
                </p>
              )}
            </div>

            {toolCall.reason && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('confirmReason')}
                </div>
                <p className="rounded-md bg-muted/40 p-2 text-sm">{toolCall.reason}</p>
              </div>
            )}

            <span className="flex items-center gap-2 text-sm">
              <Checkbox checked={allowAll} onCheckedChange={(v) => setAllowAll(v === true)} />
              <span>{t('allowAllSession')}</span>
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="destructive" onClick={handleDeny} disabled={!toolCall}>
            <X className="h-4 w-4" />
            {t('deny')}
          </Button>
          <Button
            variant="default"
            className="bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={handleAllow}
            disabled={!toolCall}
          >
            <Check className="h-4 w-4" />
            {t('allow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PermissionConfirmDialog
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
