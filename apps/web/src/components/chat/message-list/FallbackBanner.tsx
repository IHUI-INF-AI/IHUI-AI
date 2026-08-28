import type { FallbackEvent } from '@ihui/api-client'

export interface FallbackBannerProps {
  fallbackNotice: FallbackEvent
  onClearFallbackNotice?: () => void
  t: (key: string, values?: Record<string, string | number | Date>) => string
}

/** P4-2: fallback 通知横幅(主模型失败切换到备用模型时展示,amber 警告色)。 */
export function FallbackBanner({ fallbackNotice, onClearFallbackNotice, t }: FallbackBannerProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
      <span>
        {t('fallbackNotice', {
          primary: fallbackNotice.primaryModel,
          backup: fallbackNotice.backupModel,
        })}
      </span>
      {onClearFallbackNotice && (
        <button
          type="button"
          onClick={onClearFallbackNotice}
          className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          aria-label="close"
        >
          ×
        </button>
      )}
    </div>
  )
}
