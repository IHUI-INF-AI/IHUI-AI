// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { Play, Square, Trash2, Loader2, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopToolbarProps {
  isStreaming: boolean
  isStarting: boolean
  runError: string | null
  onRun: () => void
  onStop: () => void
  onClear: () => void
}

/** 顶部工具栏:Run(整图执行,当前降级为单节点试运行)+ Stop + 清空画布 */
export function TopToolbar({
  isStreaming,
  isStarting,
  runError,
  onRun,
  onStop,
  onClear,
}: TopToolbarProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className="mr-auto flex items-center gap-2 text-sm font-medium">
        Agent Canvas
        {isStreaming && (
          <span className="flex items-center gap-1 text-xs font-normal text-blue-500">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            实时追踪中
          </span>
        )}
        {runError && (
          <Tooltip content={runError}>
            <span className="max-w-[360px] truncate text-xs font-normal text-red-500">
              {runError}
            </span>
          </Tooltip>
        )}
      </span>
      <Button variant="outline" size="sm" onClick={onClear} disabled={isStreaming}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        清空画布
      </Button>
      {isStreaming ? (
        <Button variant="destructive" size="sm" onClick={onStop}>
          <Square className="mr-1.5 h-3.5 w-3.5" />
          停止
        </Button>
      ) : (
        <Button size="sm" onClick={onRun} disabled={isStarting}>
          {isStarting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          Run
        </Button>
      )}
      <span className={cn('sr-only', isStreaming && 'not-sr-only')}>运行中</span>
    </div>
  )
}
