'use client'

import * as React from 'react'
import { useChatStore } from '@/stores/chat'
import { cn } from '@/lib/utils'

/** 自动压缩上下文状态栏(2026-08-16 立):
 *  - 在 AI 对话框底部、输入框上方显示
 *  - 压缩中:显示"正在压缩上下文..." + 扫光动效
 *  - 压缩完成:显示压缩结果(token 变化 + 压缩条数为摘要)
 *  - 3 秒后自动隐藏完成态 */
export function CompactionStatusBar() {
  const compactionStatus = useChatStore((s) => s.compactionStatus)
  const [visible, setVisible] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (!compactionStatus) {
      setVisible(false)
      return
    }

    setVisible(true)

    if (compactionStatus.phase === 'done') {
      // 压缩完成 3 秒后自动隐藏
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setVisible(false)
        // 延迟清空 store 状态,等动画结束
        setTimeout(() => {
          useChatStore.getState().setCompactionStatus(null)
        }, 300)
      }, 3000)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [compactionStatus])

  if (!visible || !compactionStatus) return null

  const isCompacting = compactionStatus.phase === 'compacting'

  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-300',
        visible ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0',
      )}
    >
      <div
        className={cn(
          'relative mx-4 mb-2 flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-xs',
          isCompacting
            ? 'bg-primary/10 text-primary'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        )}
      >
        {/* 扫光动效(仅压缩中显示) */}
        {isCompacting && (
          <span
            className="relative inline-flex h-2 w-2 shrink-0"
            aria-hidden
          >
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full bg-primary"
            />
          </span>
        )}

        {/* 完成图标(压缩完成显示) */}
        {!isCompacting && (
          <svg
            className="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}

        <span className="shrink-0 font-medium">
          {isCompacting ? '正在压缩上下文...' : '上下文已自动压缩'}
        </span>

        {/* 压缩详情(仅完成态显示) */}
        {!isCompacting && (
          <span className="text-muted-foreground">
            {compactionStatus.tokensBefore} → {compactionStatus.tokensAfter} tokens
            (压缩 {compactionStatus.removedCount} 条历史为摘要)
          </span>
        )}

        {/* 扫光条(压缩中:使用项目已有 shimmer 动画) */}
        {isCompacting && (
          <span
            className="absolute inset-0 -translate-x-full animate-shimmer"
            style={{
              backgroundImage:
                'linear-gradient(90deg, transparent, hsl(var(--color-primary) / 0.12), transparent)',
              backgroundSize: '200% 100%',
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}
