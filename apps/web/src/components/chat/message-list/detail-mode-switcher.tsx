// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import {
  CONVERSATION_DETAIL_MODES,
  useConversationDetailModeStore,
  type ConversationDetailMode,
} from '@/stores/conversation-detail-mode'

/** 档位 → i18n 键(挂在 conversationDetailMode 命名空间下) */
const MODE_LABEL_KEYS: Record<ConversationDetailMode, string> = {
  steps: 'steps',
  commands: 'commands',
  narrative: 'narrative',
}

/**
 * D45 档位切换胶囊(2026-09-24 立):紧凑三选一,选中态用既有 primary 色。
 * 与 fold 策略入口(settings/fold-policy-card)语义正交,各自持久化互不覆盖。
 */
export function DetailModeSwitcher() {
  const t = useTranslations('conversationDetailMode')
  const mode = useConversationDetailModeStore((s) => s.mode)
  const setMode = useConversationDetailModeStore((s) => s.setMode)
  return (
    <div className="flex justify-center pb-1" data-testid="detail-mode-switcher">
      <div
        role="radiogroup"
        aria-label={t('label')}
        className="flex items-center gap-0.5 rounded-full bg-muted p-0.5"
      >
        {CONVERSATION_DETAIL_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            data-testid={`detail-mode-${m}`}
            onClick={() => setMode(m)}
            className={
              mode === m
                ? 'rounded-full bg-primary px-2.5 py-0.5 text-xs text-primary-foreground transition-colors'
                : 'rounded-full px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground'
            }
          >
            {t(MODE_LABEL_KEYS[m])}
          </button>
        ))}
      </div>
    </div>
  )
}

export default DetailModeSwitcher
