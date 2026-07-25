'use client'

/**
 * 权限模式详细说明 modal(2026-07-25 立,可解释性增强)
 *
 * 触发场景:
 * - 标题栏高风险模式(bypass-permissions)ⓘ 按钮点击
 * - 由 message-input 维护 [infoMode, setInfoMode] 状态,null 时关闭
 *
 * UI 组成:
 * - 顶部:模式图标 + 模式名 + 风险等级徽章
 * - 中部:4 条该模式详细行为 bullet
 * - 底部:"知道了"关闭按钮
 *
 * 数据流:
 * - 受控:mode 传 null → 关闭;非 null → 打开并展示对应模式详情
 * - 不持久化 React 状态
 *
 * 边界:
 * - mode 为 null → 不渲染(open=false)
 * - 与 PermissionShortcutsModal 互斥(同一时刻只一个打开,由父组件控制)
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Hand, ShieldCheck, ShieldAlert, Info, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'

type ModeConfig = {
  icon: React.ComponentType<{ className?: string }>
  titleKey: 'mode.ask' | 'mode.auto' | 'mode.full'
  riskKey: 'riskLow' | 'riskMedium' | 'riskHigh'
  riskCls: string
  /** 4 条详细行为 bullet i18n key */
  bullets: Array<'askBullet1' | 'askBullet2' | 'askBullet3' | 'askBullet4' | 'autoBullet1' | 'autoBullet2' | 'autoBullet3' | 'autoBullet4' | 'fullBullet1' | 'fullBullet2' | 'fullBullet3' | 'fullBullet4'>
}

const MODE_CONFIG: Record<WorkspacePermissionMode, ModeConfig> = {
  default: {
    icon: Hand,
    titleKey: 'mode.ask',
    riskKey: 'riskLow',
    riskCls: 'bg-muted text-muted-foreground',
    bullets: ['askBullet1', 'askBullet2', 'askBullet3', 'askBullet4'],
  },
  'accept-edits': {
    icon: ShieldCheck,
    titleKey: 'mode.auto',
    riskKey: 'riskMedium',
    riskCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    bullets: ['autoBullet1', 'autoBullet2', 'autoBullet3', 'autoBullet4'],
  },
  'bypass-permissions': {
    icon: ShieldAlert,
    titleKey: 'mode.full',
    riskKey: 'riskHigh',
    riskCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    bullets: ['fullBullet1', 'fullBullet2', 'fullBullet3', 'fullBullet4'],
  },
}

export interface PermissionModeInfoModalProps {
  /** null = 关闭,非 null = 打开并展示该模式详情 */
  mode: WorkspacePermissionMode | null
  onClose: () => void
}

export function PermissionModeInfoModal({ mode, onClose }: PermissionModeInfoModalProps) {
  const t = useTranslations('chat.permission')
  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        {mode ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" aria-hidden="true" />
                {t('infoModal.title')}
              </DialogTitle>
              <DialogDescription>{t('infoModal.description')}</DialogDescription>
            </DialogHeader>

            {(() => {
              const config = MODE_CONFIG[mode]
              const Icon = config.icon
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-lg',
                        config.riskCls,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {t(config.titleKey)}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 inline-flex w-fit items-center gap-0.5 rounded-sm px-1.5 py-px text-[10px] font-medium',
                          config.riskCls,
                        )}
                      >
                        {t(config.riskKey)}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-1.5">
                    {config.bullets.map((key) => (
                      <li
                        key={key}
                        className="flex items-start gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1.5"
                      >
                        <span
                          className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                        <span className="text-xs text-foreground">{t(`infoModal.${key}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                data-testid="permission-mode-info-close"
              >
                {t('infoModal.gotIt')}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export default PermissionModeInfoModal
