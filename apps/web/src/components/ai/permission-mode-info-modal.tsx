'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Hand, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'

import { Modal } from '@/components/feedback'
import { cn } from '@/lib/utils'

/** 工作区权限模式详细说明 modal(2026-07-25 深化,可解释性增强)
 *
 * 触发场景:
 *   - 在 message-input 标题栏的 mode 徽章右侧(只 bypass 模式时显示)点 ⓘ 按钮唤起
 *   - 接收一个 mode prop,3 种模式共用同一个组件,内容按 mode 切换
 *
 * 内容:每种模式 4 条 bullet(2026-07-25 深化)
 *   - default(请求批准):每次操作需批准 / 适合陌生项目 / 不会自动撤销
 *   - accept-edits(替我审批):编辑自动应用 / 命令仍需批准 / 不会自动撤销
 *   - bypass-permissions(完全访问):任何操作无确认 / 1h 自动降级 / 不可逆风险
 *
 * 实现:
 *   - 复用 FullAccessConfirmDialog 的 Modal 用法
 *   - 模式名/图标复用 permission-mode-popover 的 MODE_OPTIONS_LIST 逻辑(单独存,避免耦合)
 *   - i18n key 在 chat.permission.modeInfo.* 命名空间
 *
 * a11y:
 *   - role="dialog" + aria-modal="true" 由 Radix Dialog 提供
 *   - 标题用 DialogTitle,aria-labelledby 自动关联
 *   - 内容用 DialogDescription 描述
 */

interface PermissionModeInfoModalProps {
  /** 要展示的模式;null 时 modal 不渲染 */
  mode: WorkspacePermissionMode | null
  onClose: () => void
}

interface ModeVisual {
  icon: LucideIcon
  iconClass: string
  iconBgClass: string
  /** i18n key 指向 mode 短名(沿用 chat.permission.mode.{ask|auto|full}) */
  titleKey: 'mode.ask' | 'mode.auto' | 'mode.full'
}

const MODE_VISUAL: Record<WorkspacePermissionMode, ModeVisual> = {
  default: {
    icon: Hand,
    iconClass: 'text-muted-foreground',
    iconBgClass: 'bg-muted',
    titleKey: 'mode.ask',
  },
  'accept-edits': {
    icon: ShieldCheck,
    iconClass: 'text-emerald-500',
    iconBgClass: 'bg-emerald-500/10',
    titleKey: 'mode.auto',
  },
  'bypass-permissions': {
    icon: ShieldAlert,
    iconClass: 'text-amber-500',
    iconBgClass: 'bg-amber-500/10',
    titleKey: 'mode.full',
  },
}

export function PermissionModeInfoModal({ mode, onClose }: PermissionModeInfoModalProps) {
  const t = useTranslations('chat.permission')

  const visual = mode ? MODE_VISUAL[mode] : null
  const Icon = visual?.icon
  // 4 条 bullet 用 chat.permission.modeInfo.bullets.{mode}[i] 读取
  // (扁平 key 设计:bullets.default.0 / bullets.default.1 / ... / bullets.bypass-permissions.3)
  const bullets = mode
    ? [
        t(`modeInfoBullets.${mode}.0`),
        t(`modeInfoBullets.${mode}.1`),
        t(`modeInfoBullets.${mode}.2`),
        t(`modeInfoBullets.${mode}.3`),
      ]
    : []

  return (
    <Modal
      open={mode !== null}
      onClose={onClose}
      size="md"
      title={
        visual && Icon ? (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                visual.iconBgClass,
              )}
            >
              <Icon className={cn('h-4 w-4', visual.iconClass)} aria-hidden="true" />
            </div>
            <span>{t(visual.titleKey)}</span>
          </div>
        ) : null
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('modeInfoAcknowledge')}
        </button>
      }
    >
      {mode && (
        <ul className="space-y-2 text-sm text-foreground/90">
          {bullets.map((line, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-snug">
              <span
                className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                aria-hidden="true"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export default PermissionModeInfoModal
