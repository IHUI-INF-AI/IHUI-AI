// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-10 0-6 组件拆分:变量树行从 debug-panel.tsx 抽出(自订阅 debug store)
import * as React from 'react'
import { useDebugStore, type VariableNode } from '@/stores/debug'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'

/** 变量树行:子树经 variablesByRef 懒加载(首次展开时按 variablesReference 拉取) */
export function VariableRow({ v, depth = 0 }: { v: VariableNode; depth?: number }) {
  const sessionId = useDebugStore((s) => s.sessionId)
  const expanded = useDebugStore((s) => !!s.expandedRefs[v.variablesReference ?? 0])
  const children = useDebugStore((s) => s.variablesByRef[v.variablesReference ?? 0])
  const loading = useDebugStore((s) => !!s.loadingRefs[v.variablesReference ?? 0])
  const toggleVariable = useDebugStore((s) => s.toggleVariable)
  const ref = v.variablesReference ?? 0
  const hasChildren = ref > 0
  return (
    <div data-testid={`debug-variable-${v.name}`}>
      <div
        className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-muted/30"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => sessionId && toggleVariable(sessionId, ref)}
            className="text-muted-foreground"
            aria-label={`expand ${v.name}`}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="text-blue-600 dark:text-blue-400">{v.name}</span>
        <span className="text-muted-foreground">:</span>
        <span
          className={cn(
            'ml-auto truncate',
            v.type === 'string' && 'text-green-600 dark:text-green-400',
            v.type === 'number' && 'text-purple-600 dark:text-purple-400',
            v.type === 'boolean' && 'text-orange-600 dark:text-orange-400',
          )}
        >
          {v.value}
        </span>
      </div>
      {hasChildren &&
        expanded &&
        (children ?? []).map((c) => <VariableRow key={c.name} v={c} depth={depth + 1} />)}
    </div>
  )
}
