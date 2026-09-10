// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-10 0-6 组件拆分:调用栈区从 debug-panel.tsx 抽出(自订阅 debug store)
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useDebugStore } from '@/stores/debug'
import { cn } from '@/lib/utils'

/** 调用栈区:点击栈帧切换 currentFrameId,空态区分 loading */
export function CallStackSection() {
  const t = useTranslations('ide')
  const stackFrames = useDebugStore((s) => s.stackFrames)
  const currentFrameId = useDebugStore((s) => s.currentFrameId)
  const setCurrentFrameId = useDebugStore((s) => s.setCurrentFrameId)
  const loading = useDebugStore((s) => s.loading)

  return (
    <div className="mb-2">
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
        {t('debug.callStack')}
      </div>
      {stackFrames.length === 0 ? (
        <div className="px-3 py-0.5 text-xs text-muted-foreground">{loading ? '…' : '—'}</div>
      ) : (
        stackFrames.map((f) => (
          <button
            key={f.id}
            onClick={() => setCurrentFrameId(f.id)}
            className={cn(
              'flex w-full items-center gap-1 px-3 py-0.5 text-left text-xs hover:bg-muted/30',
              currentFrameId === f.id && 'bg-muted/40',
            )}
          >
            <span className="truncate text-blue-600 dark:text-blue-400">{f.name}</span>
            <span className="ml-auto truncate text-muted-foreground">
              {f.source?.name ?? f.source?.path ?? ''}:{f.line}
            </span>
          </button>
        ))
      )}
    </div>
  )
}
