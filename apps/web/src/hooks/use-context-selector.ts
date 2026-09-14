// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  BookOpen,
  CircleAlert,
  Code2,
  FileText,
  FolderOpen,
  Globe,
  History,
  ScrollText,
  Terminal,
} from 'lucide-react'

import { MAX_LENGTH, type WebInputCoreHandle } from '@/components/chat/web-input-core'

// ============================================================================
// W20 九类 # 上下文选择器(对标 Trae)
// ============================================================================

/** 上下文选择器九类目 */
export type ContextSelectorKind =
  'file' | 'folder' | 'code' | 'problems' | 'terminal' | 'web' | 'doc' | 'pastChats' | 'rule'

/** i18n label key(chat.contextSelector.kind*) */
export type ContextSelectorLabelKey =
  | 'kindFile'
  | 'kindFolder'
  | 'kindCode'
  | 'kindProblems'
  | 'kindTerminal'
  | 'kindWeb'
  | 'kindDoc'
  | 'kindPastChats'
  | 'kindRule'

/** i18n desc key(chat.contextSelector.desc*) */
export type ContextSelectorDescKey =
  | 'descFile'
  | 'descFolder'
  | 'descCode'
  | 'descProblems'
  | 'descTerminal'
  | 'descWeb'
  | 'descDoc'
  | 'descPastChats'
  | 'descRule'

export interface ContextSelectorCategory {
  kind: ContextSelectorKind
  /** 随消息发送的 # token(插入正文) */
  token: string
  labelKey: ContextSelectorLabelKey
  descKey: ContextSelectorDescKey
  icon: React.ComponentType<{ className?: string }>
  /** 图标颜色 class(弹层列表与引用 chip 共用) */
  colorClass: string
}

/** 九类目常量(token 命名对齐 Trae) */
export const CONTEXT_SELECTOR_CATEGORIES: ContextSelectorCategory[] = [
  {
    kind: 'file',
    token: '#File',
    labelKey: 'kindFile',
    descKey: 'descFile',
    icon: FileText,
    colorClass: 'text-sky-500',
  },
  {
    kind: 'folder',
    token: '#Folder',
    labelKey: 'kindFolder',
    descKey: 'descFolder',
    icon: FolderOpen,
    colorClass: 'text-amber-500',
  },
  {
    kind: 'code',
    token: '#Code',
    labelKey: 'kindCode',
    descKey: 'descCode',
    icon: Code2,
    colorClass: 'text-violet-500',
  },
  {
    kind: 'problems',
    token: '#Problems',
    labelKey: 'kindProblems',
    descKey: 'descProblems',
    icon: CircleAlert,
    colorClass: 'text-rose-500',
  },
  {
    kind: 'terminal',
    token: '#Terminal',
    labelKey: 'kindTerminal',
    descKey: 'descTerminal',
    icon: Terminal,
    colorClass: 'text-emerald-500',
  },
  {
    kind: 'web',
    token: '#Web',
    labelKey: 'kindWeb',
    descKey: 'descWeb',
    icon: Globe,
    colorClass: 'text-cyan-500',
  },
  {
    kind: 'doc',
    token: '#Doc',
    labelKey: 'kindDoc',
    descKey: 'descDoc',
    icon: BookOpen,
    colorClass: 'text-indigo-500',
  },
  {
    kind: 'pastChats',
    token: '#PastChats',
    labelKey: 'kindPastChats',
    descKey: 'descPastChats',
    icon: History,
    colorClass: 'text-purple-500',
  },
  {
    kind: 'rule',
    token: '#Rule',
    labelKey: 'kindRule',
    descKey: 'descRule',
    icon: ScrollText,
    colorClass: 'text-orange-500',
  },
]

/**
 * 从输入值提取行首/空格后的 # 触发 query;非触发态返回 null。
 * 例:"修复 #ter" → "ter";"issue #12" → null(# 前非空格)。
 */
function extractHashQuery(value: string): string | null {
  const match = value.match(/(?:^|\s)#([^\s#]*)$/)
  return match?.[1] ?? null
}

/**
 * W20 九类 # 上下文选择器 hook(对标 Trae):
 * - 输入行首/空格后的 `#` 触发浮层,继续输入过滤九类目
 * - ↑/↓ 导航,Enter/Tab 选中,Esc 关闭;选中后:
 *   1. 正文尾部 `#query` 替换为类目 token(如 `#Problems `)
 *   2. onAddChip 回调渲染类型徽章 chip(随消息发送)
 * - open 状态由 value 派生:query 为 null 或 Esc 关闭后自动复位
 */
export function useContextSelector(options: {
  /** 当前输入值(open 状态由 value 派生) */
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  inputRef: React.RefObject<WebInputCoreHandle | null>
  onAddChip: (category: ContextSelectorCategory) => void
}): {
  open: boolean
  query: string
  filtered: ContextSelectorCategory[]
  activeIndex: number
  setActiveIndex: (idx: number) => void
  select: (category: ContextSelectorCategory) => void
  /** textarea keydown 前置拦截;返回 true 表示事件已被选择器消费 */
  handleKeyDown: (e: React.KeyboardEvent) => boolean
} {
  const { setValue, inputRef, onAddChip } = options
  const [dismissed, setDismissed] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  const query = React.useMemo(() => extractHashQuery(options.value), [options.value])

  // query 消失(空格/删除/选中)后复位 Esc 关闭标记
  React.useEffect(() => {
    if (query === null) setDismissed(false)
  }, [query])

  const open = query !== null && !dismissed

  const filtered = React.useMemo(() => {
    const q = (query ?? '').trim().toLowerCase()
    if (!q) return CONTEXT_SELECTOR_CATEGORIES
    return CONTEXT_SELECTOR_CATEGORIES.filter(
      (c) => c.token.toLowerCase().includes(q) || c.kind.toLowerCase().includes(q),
    )
  }, [query])

  // query 变化时重置高亮到首项
  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const select = React.useCallback(
    (category: ContextSelectorCategory) => {
      setValue((prev) => {
        const next = prev.replace(/#[^\s#]*$/, `${category.token} `)
        return next.slice(0, MAX_LENGTH)
      })
      setDismissed(true)
      onAddChip(category)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.resize()
      })
    },
    [setValue, onAddChip, inputRef],
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!open) return false
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        return true
      }
      if (e.key === 'ArrowUp' && filtered.length > 0) {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        // 无匹配项时不拦截,让 Enter 正常发送
        if (filtered.length === 0) return false
        e.preventDefault()
        const current = filtered[Math.min(activeIndex, filtered.length - 1)]
        if (current) select(current)
        return true
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissed(true)
        return true
      }
      return false
    },
    [open, filtered, activeIndex, select],
  )

  return {
    open,
    query: query ?? '',
    filtered,
    activeIndex,
    setActiveIndex,
    select,
    handleKeyDown,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
