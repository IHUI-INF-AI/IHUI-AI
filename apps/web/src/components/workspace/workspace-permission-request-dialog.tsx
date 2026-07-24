'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronRight, Code, FileText, Folder, Loader2, X } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { usePermissionRequest, type PermissionRequestPayload } from '@/hooks/use-permission-request'
import { TruncatedText } from '@/components/common'
import { cn } from '@/lib/utils'

interface WorkspacePermissionRequestDialogProps {
  userId?: string
  /** 自定义挂载点;不传则用内置 Dialog */
  className?: string
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'fs.read': FileText,
  'fs.write': FileText,
  'fs.edit': Code,
  'fs.delete': X,
  'fs.grep': ChevronRight,
  'fs.glob': Folder,
  'fs.run': ChevronRight,
}

/** 把 `fs.read` 转为 i18n flat key `fsRead`(next-intl namespace key 不允许包含 '.') */
function toolNameToI18nKey(tool: string): string {
  return tool.replace(/\.([a-z])/g, (_, c: string) => c.toUpperCase())
}

function renderArgsSummary(args: Record<string, unknown>): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = []
  const path = args.path
  if (typeof path === 'string' && path) items.push({ label: 'path', value: path })
  const command = args.command
  if (typeof command === 'string' && command) items.push({ label: 'command', value: command })
  const pattern = args.pattern
  if (typeof pattern === 'string' && pattern) items.push({ label: 'pattern', value: pattern })
  const glob = args.glob
  if (typeof glob === 'string' && glob) items.push({ label: 'glob', value: glob })
  return items.slice(0, 3)
}

/**
 * 工作区人工审计确认弹窗。
 *
 * 监听 workspace.permission.request WebSocket 事件,展示待决请求队列,
 * 一次只处理队首请求,用户决策后调 /api/workspace/permission/requests/:id/resolve
 * 解锁后端等待中的 FS 工具调用。
 */
export function WorkspacePermissionRequestDialog({
  userId,
  className,
}: WorkspacePermissionRequestDialogProps) {
  const t = useTranslations('workspace.permission.auditRequest')
  const { pendingRequests, resolve } = usePermissionRequest({ userId })
  const [busy, setBusy] = React.useState(false)

  const current: PermissionRequestPayload | undefined = pendingRequests[0]
  const open = Boolean(current)
  const queueCount = pendingRequests.length - 1

  const handleDecision = React.useCallback(
    async (approved: boolean) => {
      if (!current) return
      setBusy(true)
      try {
        await resolve(current.requestId, approved)
      } finally {
        setBusy(false)
      }
    },
    [current, resolve],
  )

  const Icon = (current && TOOL_ICONS[current.tool]) || ChevronRight
  const argsSummary = current ? renderArgsSummary(current.args) : []

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className={cn('max-w-md', className)}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {current && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-amber-500" />
                {t('title')}
              </DialogTitle>
              <DialogDescription>{t('description')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{t('tool')}</span>
                <span className="font-medium">
                  {t(`toolNames.${toolNameToI18nKey(current.tool)}` as never) || current.tool}
                </span>
              </div>
              {current.workspacePath && (
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">{t('workspace')}</span>
                  <TruncatedText value={current.workspacePath} className="font-mono text-xs" />
                </div>
              )}
              {argsSummary.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-1 text-xs text-muted-foreground">{t('details')}</div>
                  <div className="space-y-1 text-xs">
                    {argsSummary.map((a) => (
                      <div key={a.label} className="flex items-start gap-2">
                        <span className="shrink-0 font-medium text-muted-foreground">
                          {a.label}:
                        </span>
                        <code className="break-all font-mono">{a.value}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {queueCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  {t('queue', { count: queueCount })}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void handleDecision(false)}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                {t('deny')}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void handleDecision(true)}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {t('allow')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
