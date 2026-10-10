// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D165(承 V4 §9.4②):「移动到分组」对话框 —— 单选移动与批量移动所选共用同一受控组件。
// 契约与 ConversationOrgDialog 同款:纯受控,不直接碰 store / 网络;分组列表、置顶集合
// 由调用方(sidebar-chat-history)注入。失败不在这里报 —— 提交结果由调用方判定
// (resolveMoveToGroup),失败时调用方保持本弹层打开 = 可重试出口。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen, Pin, PinOff } from 'lucide-react'

import { normalizeOrgName, ORG_FOLDER_MAX_LENGTH } from '@ihui/shared'

import { cn } from '@/lib/utils'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@ihui/ui-react'

export interface MoveToGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 候选分组(调用方已做置顶优先排序) */
  folders: readonly string[]
  /** 已置顶分组集合(用于行内 Pin 徽标与切换态) */
  pinnedFolders: readonly string[]
  /** 分组置顶/取消置顶(分组维度第三动作的入口之一) */
  onTogglePin: (folder: string) => void
  /** 提交目标分组;null = 未分组 */
  onSubmit: (target: string | null) => void
}

export function MoveToGroupDialog({
  open,
  onOpenChange,
  folders,
  pinnedFolders,
  onTogglePin,
  onSubmit,
}: MoveToGroupDialogProps) {
  const t = useTranslations('chatHistory')

  const [selected, setSelected] = React.useState<string | null>(null)
  const [newInput, setNewInput] = React.useState('')

  // 每次 open 重置本地编辑态(关闭即弃,与 ConversationOrgDialog 同款纪律)
  React.useEffect(() => {
    if (open) {
      setSelected(null)
      setNewInput('')
    }
  }, [open])

  const handleSubmit = () => {
    const created = normalizeOrgName(newInput, ORG_FOLDER_MAX_LENGTH)
    if (created) {
      onSubmit(created)
      return
    }
    onSubmit(selected)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-[640px]:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('moveDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2" data-testid="move-to-group-dialog">
          <button
            type="button"
            onClick={() => setSelected(null)}
            data-testid="move-target-none"
            className={cn(
              'flex w-full items-center gap-1.5 rounded-sm border px-2 py-1.5 text-left text-xs transition-colors',
              selected === null && !newInput.trim()
                ? 'border-brand-accent-deep bg-primary/5'
                : 'hover:bg-muted',
            )}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">{t('moveDialog.none')}</span>
          </button>
          {folders.map((folder) => {
            const pinned = pinnedFolders.includes(folder)
            return (
              <div
                key={folder}
                className={cn(
                  'flex items-center gap-1 rounded-sm border pr-1 transition-colors',
                  selected === folder && !newInput.trim()
                    ? 'border-brand-accent-deep bg-primary/5'
                    : 'hover:bg-muted',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(folder)}
                  data-testid={`move-target-${folder}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-xs"
                >
                  {pinned && (
                    <Pin className="h-3 w-3 shrink-0 fill-current text-primary" aria-hidden />
                  )}
                  <span className="min-w-0 truncate">{folder}</span>
                </button>
                <button
                  type="button"
                  aria-label={pinned ? t('groupUnpin') : t('groupPin')}
                  data-testid={`move-dialog-pin-toggle-${folder}`}
                  onClick={() => onTogglePin(folder)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </button>
              </div>
            )
          })}
          <Input
            value={newInput}
            onChange={(e) => setNewInput(e.target.value)}
            placeholder={t('moveDialog.newPlaceholder')}
            maxLength={ORG_FOLDER_MAX_LENGTH}
            data-testid="move-dialog-new-input"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" className="bg-muted" onClick={() => onOpenChange(false)}>
            {t('moveDialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} data-testid="move-dialog-submit">
            {t('moveDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
