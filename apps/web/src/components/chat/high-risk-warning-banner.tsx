'use client'

import * as React from 'react'
import { AlertTriangle, Clock3, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { isHighRiskPermissionMode } from '@/components/ai/permission-mode-popover'
import { usePermissionAutoRevert, formatRemaining } from '@/hooks/use-permission-auto-revert'
import { useAiPanelStore } from '@/stores/ai-panel'

/**
 * 高风险模式持久化视觉警告横幅(2026-07-25 深化,深度对标 Codex 高风险提示)
 *
 * 提取自 message-input.tsx(2026-07-30),行为零变更:
 * - bypass-permissions 模式时,输入框上方加琥珀色横幅
 * - 提醒用户 AI 当前可执行任何操作(无法撤回的破坏性操作的预防)
 * - 倒计时:显示"X 分钟后自动切回请求批准",可手动取消
 * - 非高风险模式时不渲染(返回 null,零开销)
 *
 * 数据流:
 * - 内部消费 useAiPanelStore 计算 isHighRisk(避免主组件多传一个 prop)
 * - 内部消费 useTranslations('chat')(与主组件 useTranslations 实例独立,但 next-intl 允许多实例)
 * - autoRevert 由主组件透传(主组件持有 hook 实例,标题栏倒计时与横幅倒计时共享同一份 tick)
 */
export function HighRiskWarningBanner(props: {
  autoRevert: ReturnType<typeof usePermissionAutoRevert>
}): React.JSX.Element | null {
  const t = useTranslations('chat')
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const activeWorkspaceMode = activeWorkspace?.mode
  const isHighRisk = isHighRiskPermissionMode(activeWorkspaceMode)
  const { autoRevert } = props

  if (!isHighRisk) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300 animate-pulse-soft"
    >
      <AlertTriangle
        className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 leading-snug">
        <div>{t('permission.inputWarning')}</div>
        {autoRevert.isActive ? (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
            <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              {t('permission.autoRevertIn', {
                time: formatRemaining(autoRevert.remainingMs),
              })}
            </span>
            <button
              type="button"
              onClick={autoRevert.cancelRevert}
              className="ml-1 inline-flex items-center gap-0.5 rounded-sm border border-amber-500/30 px-1.5 py-px text-[10px] font-medium transition-colors hover:bg-amber-500/10"
              aria-label={t('permission.cancelAutoRevert')}
            >
              <X className="h-2.5 w-2.5" aria-hidden="true" />
              {t('permission.cancelAutoRevert')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => autoRevert.extendRevert()}
            className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
          >
            {t('permission.reEnableAutoRevert')}
          </button>
        )}
      </div>
    </div>
  )
}
