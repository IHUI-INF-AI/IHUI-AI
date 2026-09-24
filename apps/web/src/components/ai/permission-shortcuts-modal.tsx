// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * - 底部交叉指引:完整键位清单(含对话模式切换)由全局 Ctrl+/ 面板承载,本模态不重复列
 *
 * 数据流:
 * - 受控:open + onClose 双向绑定
 * - 不持久化 React 状态(防 SSR hydration mismatch)
 *
 * 边界:
 * - 编辑控件焦点(typing):? 键不触发,由 message-input 的 useEffect 提前拦截
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  X,
  Keyboard,
  ShieldAlert,
  ShieldCheck,
  History,
  Hand,
  Undo2,
  SquareSlash,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface ShortcutRow {
  /** 按键标签(纯展示,如 "Shift+Tab" / "?" / "/permission full") */
  key?: string
  /** 无键位、只有可点对象名时用 i18n 键(否则 kbd 里会漏硬编码中文) */
  labelKey?: string
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
    titleKey: 'shortcutsSectionSwitch',
    rows: [
      { key: 'Shift+Tab', descKey: 'shortcutsItemShiftTabKbd', icon: Hand },
      { key: '1 / 2 / 3', descKey: 'shortcutsItemNumberKbd', icon: Hand },
      {
        key: '/permission',
        descKey: 'shortcutsItemSlashAskKbd',
        icon: SquareSlash,
      },
    ],
  },
  {
    titleKey: 'shortcutsSectionGuard',
    rows: [{ key: '?', descKey: 'shortcutsItemQuestionMarkKbd', icon: Keyboard }],
  },
  {
    titleKey: 'shortcutsSectionAudit',
    rows: [
      { key: 'Undo 5s', descKey: 'shortcutsItemUndoKbd', icon: Undo2 },
      { labelKey: 'historyOpenExternal', descKey: 'shortcutsItemHistoryKbd', icon: History },
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
            {t('shortcutsModalTitle')}
          </DialogTitle>
          <DialogDescription>{t('shortcutsLearnMore')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.titleKey} className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.titleKey === 'shortcutsSectionSwitch' && <ShieldCheck className="h-3 w-3" />}
                {group.titleKey === 'shortcutsSectionGuard' && <ShieldAlert className="h-3 w-3" />}
                {group.titleKey === 'shortcutsSectionAudit' && <History className="h-3 w-3" />}
                <span>{t(group.titleKey)}</span>
              </div>
              <ul className="space-y-1.5">
                {group.rows.map((row) => {
                  const Icon = row.icon
                  return (
                    <li
                      key={row.labelKey ?? row.key ?? row.descKey}
                      className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1.5"
                    >
                      <kbd
                        className={cn(
                          'inline-flex min-w-[88px] items-center justify-center gap-1 rounded-md',
                          'border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground',
                        )}
                      >
                        {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
                        {row.labelKey ? t(row.labelKey) : row.key}
                      </kbd>
                      <span className="text-xs text-muted-foreground">{t(row.descKey)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {/* 交叉指引:完整键位清单(含 ChatMode 切换)统一由全局 Ctrl+/ 面板承载,此处不重复列 */}
          <div
            className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
            data-testid="permission-shortcuts-see-all"
          >
            <span className="text-xs text-muted-foreground">{t('shortcutsSeeAllKbd')}</span>
            <kbd
              className={cn(
                'inline-flex min-w-[88px] items-center justify-center gap-1 rounded-md',
                'border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground',
              )}
            >
              Ctrl+/
            </kbd>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-cta-foreground hover:bg-cta/90"
            data-testid="permission-shortcuts-close"
          >
            {t('shortcutsClose')}
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PermissionShortcutsModal
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
