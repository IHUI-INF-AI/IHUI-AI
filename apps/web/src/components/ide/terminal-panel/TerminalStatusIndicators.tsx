// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback/Tooltip'
import { cn } from '@/lib/utils'

interface TerminalStatusIndicatorsProps {
  connected: boolean
  wsError: string | null
  fontSize: number
  /** 连接异常(未连接)时手动立即重连 */
  onReconnect?: () => void
  /** 忽略(清除)错误提示 */
  onDismissError?: () => void
}

/**
 * 终端面板统一底栏:连接状态点 + 错误信息 + 重连/忽略按钮 + 字号状态。
 * 2026-09-17 根治重叠 BUG:原先错误横幅(absolute bottom-2 全宽)与左下状态指示器、
 * 右下字号指示器(bottom-1)物理层叠。现合并为单一 flex 底栏,布局上不可能重叠。
 * 连接状态点不使用 rounded-full(AGENTS.md §4),用 inline borderRadius:50% 的紧凑小点。
 */
export function TerminalStatusIndicators({
  connected,
  wsError,
  fontSize,
  onReconnect,
  onDismissError,
}: TerminalStatusIndicatorsProps) {
  const t = useTranslations('ide')
  return (
    // 底栏本身 pointer-events-none,避免遮挡 xterm 底部交互;按钮单独恢复 pointer-events
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex h-6 items-center gap-2 bg-float-indicator-bg px-2 text-[11px] text-muted-foreground">
      {/* 连接状态点 + 文案 */}
      <span className="flex shrink-0 items-center gap-1.5">
        <span
          className={cn(
            'inline-block h-1.5 w-1.5',
            connected ? 'bg-green-500' : wsError ? 'bg-red-500' : 'bg-muted-foreground',
          )}
          style={{ borderRadius: '50%' }} // radius-exempt: 6×6 连接状态指示圆点(装饰点几何正圆,方档化会变方块)
        />
        <span>
          {connected
            ? t('terminalPanel.connected')
            : wsError
              ? t('terminalPanel.connectionError')
              : t('terminalPanel.connecting')}
        </span>
      </span>

      {/* 错误信息(占满中间,超长截断,悬停 Tooltip 看全文) */}
      {wsError ? (
        <Tooltip content={wsError}>
          <span className="min-w-0 flex-1 truncate text-destructive">{wsError}</span>
        </Tooltip>
      ) : (
        <span className="flex-1" />
      )}

      {/* 断连且有错误 → 手动重连按钮 */}
      {wsError && !connected && onReconnect && (
        <Tooltip content={t('terminalPanel.reconnectTitle')}>
          <button
            type="button"
            onClick={onReconnect}
            className="pointer-events-auto shrink-0 rounded px-1.5 py-0.5 text-[11px] text-foreground hover:bg-accent"
          >
            {t('terminalPanel.reconnect')}
          </button>
        </Tooltip>
      )}

      {/* 忽略(清除)错误按钮 */}
      {wsError && onDismissError && (
        <Tooltip content={t('terminalPanel.dismissErrorTitle')}>
          <button
            type="button"
            onClick={onDismissError}
            className="pointer-events-auto shrink-0 rounded px-1 text-xs leading-none text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ×
          </button>
        </Tooltip>
      )}

      {/* 字号状态(右侧) */}
      <span className="flex shrink-0 items-center gap-2">
        <span>{fontSize}px</span>
        <span className="opacity-60">Ctrl+/−/0</span>
      </span>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
