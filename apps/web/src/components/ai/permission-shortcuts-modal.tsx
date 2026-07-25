'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Keyboard, ShieldCheck, ShieldAlert, History, Undo2 } from 'lucide-react'

import { Modal } from '@/components/feedback'
import { cn } from '@/lib/utils'

/** 权限模式快捷键帮助面板(2026-07-25 深化,深度对标 OpenAI Codex CLI /help)
 *
 * 触发场景:用户在 message-input 中按 ? 键(Shift+/)唤起,排除 textarea/input 内输入。
 * 关闭:点击 X / 按 Esc(由 Radix Dialog 处理)/ 点"知道了"按钮 / 再次按 ? 关闭。
 *
 * 内容分组(3 个):
 *   1. 模式切换 - Shift+Tab 循环 / 1/2/3 数字键(在 popover 打开时) / ? 唤起本面板
 *   2. 高风险护栏 - 1h 自动撤销 / 5min 警告 / 1min 紧急 / "再保持 1h" toast / 横幅"取消自动撤销"
 *   3. 撤销与审计 - 5s 撤销 toast / 危险命令检测 / 模式历史查看
 *
 * 实现细节:
 *   - 用项目内 Modal 组件(Radix Dialog,自带 focus trap + Esc 关闭 + portal)
 *   - 3 个分组用 icon + 标题 + bullet 列表,Codex CLI /help 风格
 *   - 底部"了解更多安全设计"链接 /docs/SECURITY
 *   - 主体宽度 480px(md size,Modal 自带 max-w)
 *
 * a11y:
 *   - role="dialog" + aria-modal="true" 由 Radix Dialog 提供
 *   - title 用 DialogTitle(Modal 内部封装),aria-labelledby 自动关联
 *   - 焦点 trap 自动,打开时焦点跳到关闭按钮
 */

interface PermissionShortcutsModalProps {
  open: boolean
  onClose: () => void
}

interface ShortcutItem {
  key: React.ReactNode
  label: string
}

/** 单个 kbd 快捷键徽章(Codex CLI /help 风格:等宽 + 描边胶囊) */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-foreground/80">
      {children}
    </kbd>
  )
}

export function PermissionShortcutsModal({ open, onClose }: PermissionShortcutsModalProps) {
  const t = useTranslations('chat.permission')

  const switchItems: ShortcutItem[] = [
    { key: <Kbd>Shift</Kbd>, label: t('shortcutsItemShiftTabKbd') },
    { key: <Kbd>1</Kbd>, label: t('shortcutsItemNumberKbd') },
    { key: <Kbd>?</Kbd>, label: t('shortcutsItemQuestionMarkKbd') },
  ]
  const guardItems: ShortcutItem[] = [
    { key: <Kbd>1h</Kbd>, label: t('shortcutsItemAutoRevert1hKbd') },
    { key: <Kbd>5m</Kbd>, label: t('shortcutsItemWarn5minKbd') },
    { key: <Kbd>1m</Kbd>, label: t('shortcutsItemWarn1minKbd') },
    { key: <Kbd>+1h</Kbd>, label: t('shortcutsItemExtendKbd') },
    { key: <Kbd>∞</Kbd>, label: t('shortcutsItemCancelAutoKbd') },
  ]
  const auditItems: ShortcutItem[] = [
    { key: <Kbd>5s</Kbd>, label: t('shortcutsItemUndoKbd') },
    { key: <Kbd>!</Kbd>, label: t('shortcutsItemDangerousKbd') },
    { key: <Kbd>H</Kbd>, label: t('shortcutsItemHistoryKbd') },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Keyboard className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <span>{t('shortcutsModalTitle')}</span>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-foreground/5 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          {t('shortcutsClose')}
        </button>
      }
    >
      <div className="space-y-4">
        {/* 分组 1:模式切换 */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            <span>{t('shortcutsSectionSwitch')}</span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {switchItems.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="shrink-0">{item.key}</span>
                <span className="text-foreground/85">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 分组 2:高风险护栏 */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            <span>{t('shortcutsSectionGuard')}</span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {guardItems.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="shrink-0">{item.key}</span>
                <span className="text-foreground/85">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 分组 3:撤销与审计 */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
            <Undo2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span>{t('shortcutsSectionAudit')}</span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {auditItems.map((item, idx) => (
              <li
                key={idx}
                className={cn(
                  'flex items-center gap-2',
                  idx === auditItems.length - 1 && 'text-muted-foreground',
                )}
              >
                <span className="shrink-0">{item.key}</span>
                <span className="text-foreground/85">
                  {idx === auditItems.length - 1 ? (
                    <>
                      {item.label}{' '}
                      <History className="ml-0.5 inline h-3 w-3 align-text-bottom text-muted-foreground/70" />
                    </>
                  ) : (
                    item.label
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 底部了解更多链接(Codex /help 风格) */}
        <div className="border-t border-border pt-2.5">
          <a
            href="/docs/SECURITY"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="underline-offset-2 hover:underline">{t('shortcutsLearnMore')}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </Modal>
  )
}

export default PermissionShortcutsModal
