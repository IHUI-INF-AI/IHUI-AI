// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import type { TerminalSplitDirection } from '@/stores/terminal'
import { Sparkles, Columns2, Rows2, X, Moon, Sun } from 'lucide-react'

interface TerminalPaneToolbarProps {
  isActive: boolean
  aiSuggestOpen: boolean
  onOpenSuggest: () => void
  onSplitRequest: (direction: TerminalSplitDirection) => void
  onClosePane: () => void
  canClosePane: boolean
  /** D199(2026-09-30):当前终端面板是否为暗色档(档位标签描述"将切到的目标档") */
  terminalDark?: boolean
  /** D199:切换终端深浅档(由 TerminalViewport 驱动 xterm theme) */
  onToggleTheme?: () => void
}

/** pane 工具条(右上角:深浅切换 + AI + 分屏 + 关闭),2026-07-22 深化 */
export function TerminalPaneToolbar({
  isActive,
  aiSuggestOpen,
  onOpenSuggest,
  onSplitRequest,
  onClosePane,
  canClosePane,
  terminalDark = false,
  onToggleTheme,
}: TerminalPaneToolbarProps) {
  const t = useTranslations('ide')
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded bg-background/80 p-0.5 backdrop-blur-sm">
        {/* D199 深浅切换钮:aria 描述的是**点击后将切到的目标档**(亮色面板 → switchToDark),
            与竞品串同一口径;档位本身由 TerminalViewport 的 resolveTerminalTheme 承载 */}
        {onToggleTheme && (
          <Tooltip
            content={t(terminalDark ? 'terminalPanel.switchToLight' : 'terminalPanel.switchToDark')}
          >
            <button
              type="button"
              data-testid="terminal-toggle-theme"
              className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={onToggleTheme}
              aria-label={t(
                terminalDark ? 'terminalPanel.switchToLight' : 'terminalPanel.switchToDark',
              )}
            >
              {terminalDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            </button>
          </Tooltip>
        )}
        {/* AI 建议按钮(2026-07-23 立,仅活跃 pane 显示) */}
        {isActive && (
          <Tooltip content={t('terminalPanel.aiSuggestTitle')}>
            <button
              type="button"
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
                aiSuggestOpen
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              onClick={onOpenSuggest}
              aria-label={t('terminalPanel.aiSuggestTitle')}
            >
              <Sparkles className="h-3 w-3" />
            </button>
          </Tooltip>
        )}
        <Tooltip content={t('terminalPanel.splitVerticalTitle')}>
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => onSplitRequest('vertical')}
            aria-label={t('terminalPanel.splitVerticalAria')}
          >
            <Columns2 className="h-3 w-3" />
          </button>
        </Tooltip>
        <Tooltip content={t('terminalPanel.splitHorizontalTitle')}>
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => onSplitRequest('horizontal')}
            aria-label={t('terminalPanel.splitHorizontalAria')}
          >
            <Rows2 className="h-3 w-3" />
          </button>
        </Tooltip>
        {canClosePane && (
          <Tooltip content={t('terminalPanel.closePane')}>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
              onClick={onClosePane}
              aria-label={t('terminalPanel.closePane')}
            >
              <X className="h-3 w-3" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
