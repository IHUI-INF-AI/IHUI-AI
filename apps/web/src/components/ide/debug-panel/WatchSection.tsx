// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-10 0-6 组件拆分:Watch 表达式区从 debug-panel.tsx 抽出(输入/求值展示/删除)
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useDebugStore } from '@/stores/debug'
import { Plus, X } from 'lucide-react'
import { toast } from '@/components/common'

/** Watch 区:表达式输入 + 求值结果展示 + 删除(求值逻辑由主组件 effect 驱动) */
export function WatchSection() {
  const t = useTranslations('ide')
  const watches = useDebugStore((s) => s.watches)
  const watchValues = useDebugStore((s) => s.watchValues)
  const addWatchAction = useDebugStore((s) => s.addWatch)
  const removeWatchAction = useDebugStore((s) => s.removeWatch)
  const [watchInput, setWatchInput] = React.useState('')

  const addWatch = () => {
    if (!watchInput.trim()) return
    if (!addWatchAction(watchInput)) {
      toast.error(t('debug.watchDuplicate'))
      return
    }
    setWatchInput('')
  }

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
        <span>{t('debug.watch')}</span>
      </div>
      <div className="flex items-center gap-1 px-2 pb-1">
        <input
          value={watchInput}
          onChange={(e) => setWatchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addWatch()}
          placeholder={t('debug.watchPlaceholder')}
          className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none"
        />
        <button
          onClick={addWatch}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted/50"
          aria-label={t('debug.add')}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {watches.map((w, i) => (
        <div
          key={i}
          className="group flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-muted/30"
        >
          <span className="truncate text-blue-600 dark:text-blue-400">{w}</span>
          <span className="text-muted-foreground">:</span>
          <span className="ml-auto truncate text-green-600 dark:text-green-400">
            {watchValues[i] ?? '—'}
          </span>
          <button
            onClick={() => removeWatchAction(i)}
            className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
            aria-label={t('debug.delete')}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
