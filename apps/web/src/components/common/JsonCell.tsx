'use client'

/**
 * JsonCell — 把 `JSON.stringify(value, null, 2)` 在 render 中重复计算的模式统一封装。
 *
 * 替代历史上散落的 `<pre>{JSON.stringify(data, null, 2)}</pre>` 写法:
 *   - 每次 render 都重新 stringify(即使 value 引用未变),大对象累积开销显著
 *   - 父组件无关 state 变化(搜索框输入 / tab 切换等)触发重渲染 → 重复 stringify
 *
 * 优化:
 *   - useMemo 缓存 stringify 结果,仅 value 引用变化才重算
 *   - 父组件重渲染时,value 引用稳定 → 直接复用缓存字符串,跳过 stringify
 *   - null/undefined 显示 "(空)",避免 "null" 字符串误导
 *
 * 用法:
 *   <JsonCell value={task.input} />
 *   <JsonCell value={wf.steps} className="max-h-80" />
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

interface JsonCellProps {
  /** 要序列化展示的值 */
  value: unknown
  /** 容器额外 className,通常含 max-h-* / 文字大小 */
  className?: string
  /** 空值占位文本 */
  emptyPlaceholder?: string
}

export function JsonCell({
  value,
  className,
  emptyPlaceholder = '(空)',
}: JsonCellProps) {
  // 性能修复(2026-07-25):JSON.stringify 是 O(n) 操作,大对象(嵌套 5+ 层 / 数百键)
  // 在 render 中每次重算累积开销可观。useMemo 仅在 value 引用变化时重算,
  // 父组件无关 state 变化(搜索 / tab 切换 / 输入框输入等)不再触发重复 stringify。
  const text = React.useMemo(() => {
    if (value === null || value === undefined) return emptyPlaceholder
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      // 循环引用等无法序列化的情况
      return String(value)
    }
  }, [value, emptyPlaceholder])

  return (
    <pre
      className={cn(
        'overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed',
        className,
      )}
    >
      {text}
    </pre>
  )
}

export type { JsonCellProps }
