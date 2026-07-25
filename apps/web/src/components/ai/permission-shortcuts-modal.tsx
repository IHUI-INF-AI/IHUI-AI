'use client'

/**
 * 权限模式快捷键帮助面板(2026-07-25 立,深度对标 OpenAI Codex CLI /help)
 *
 * 触发场景:
 * - ? 键(Shift+/)全局唤起/关闭,由 message-input 内 useEffect 监听
 * - 也可由外部组件通过 props.open = true 强制打开
 *
 * UI 组成:
 * - 标题栏:图标 + "权限模式快捷键" + 关闭按钮
 * - 3 分组:模式切换 / 高风险护栏 / 撤销与审计
 * - 每行:按键 + 动作描述
 *
 * 数据流:
 * - 受控:open + onClose 双向绑定
 * - 不持久化 React 状态(防 SSR hydration mismatch)
 *
 * 边界:
 * - 编辑控件焦点(typing):? 键不触发,由 message-input 的 useEffect 提前拦截
 * - 与 PermissionModeInfoModal 互斥(同一时刻只一个打开)
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X, Keyboard, ShieldCheck, ShieldAlert, History, Hand, Undo2, TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface ShortcutRow {
  /** 按键标签(纯展示,如 "Shift+Tab" / "?" / "/permission full") */
  key: string
  /** 动作描述 i18n key */
  descKey: string
  /** 可选图标 */
  icon?: React.ComponentType<{ className?: string }>
}

interface ShortcutGroup {
  /** 分组标题 i18n key */
  titleKey: string
  rows: ShortcutRow[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: 'shortcuts.modeGroup',
    rows: [
      { key: 'Shift+Tab', descKey: 'shortcuts.cycleMode', icon: Hand },
      { key: '1 / 2 / 3', descKey: 'shortcuts.pickByNumber', icon: Hand },
      { key: '/permission ask', descKey: 'shortcuts.slashAsk' },
      { key: '/permission auto', descKey: 'shortcuts.slashAuto' },
      { key: '/permission full', descKey: 'shortcuts.slashFull' },
    ],
  },
  {
    titleKey: 'shortcuts.guardGroup',
    rows: [
      { key: '?', descKey: 'shortcuts.toggleHelp', icon: Keyboard },
      { key: 'ⓘ', descKey: 'shortcuts.infoButton', icon: ShieldAlert },
    ],
  },
  {
    titleKey: 'shortcuts.undoGroup',
    rows: [
      { key: 'Undo 5s', descKey: 'shortcuts.undoSwitch', icon: Undo2 },
      { key: '1h', descKey: 'shortcuts.autoRevert', icon: TriangleAlert },
      { key: '查看历史', descKey: 'shortcuts.history', icon: History },
    ],
  },
]

export interface PermissionShortcutsModalProps {
  open: boolean
  onClose: () => void
}

export function PermissionShortcutsModal({ open, onClose }: PermissionShortcutsModalProps) {
  const t = useTranslations('chat.permission')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            {t('shortcuts.title')}
          </DialogTitle>
          <DialogDescription>{t('shortcuts.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.titleKey} className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.titleKey === 'shortcuts.modeGroup' && <ShieldCheck className="h-3 w-3" />}
                {group.titleKey === 'shortcuts.guardGroup' && <ShieldAlert className="h-3 w-3" />}
                {group.titleKey === 'shortcuts.undoGroup' && <History className="h-3 w-3" />}
                <span>{t(group.titleKey)}</span>
              </div>
              <ul className="space-y-1.5">
                {group.rows.map((row) => {
                  const Icon = row.icon
                  return (
                    <li
                      key={row.key}
                      className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1.5"
                    >
                      <kbd
                        className={cn(
                          'inline-flex min-w-[88px] items-center justify-center gap-1 rounded-md',
                          'border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground',
                        )}
                      >
                        {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
                        {row.key}
                      </kbd>
                      <span className="text-xs text-muted-foreground">{t(row.descKey)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-testid="permission-shortcuts-close"
          >
            {t('shortcuts.gotIt')}
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PermissionShortcutsModal
