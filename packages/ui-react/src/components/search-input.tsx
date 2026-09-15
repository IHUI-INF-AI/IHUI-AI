// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../lib/utils'

/**
 * SearchInput — 全项目统一搜索框(2026-09-15 立,web + extension 唯一样式来源)。
 *
 * 视觉规范(对标 file-mention-popover 圆角输入井):
 * - 圆角输入井: rounded-md border border-border bg-muted/40 px-2.5
 * - 聚焦反馈: focus-within:border-ring/60 focus-within:bg-muted/60
 * - 图标: Search(h-3.5 w-3.5 text-muted-foreground)
 * - 内部 input: border-0 bg-transparent px-0 shadow-none focus-visible:ring-0
 * - 可选清空按钮: h-5 w-5 rounded-sm hover:bg-accent
 */

/**
 * 圆角输入井样式常量(唯一视觉来源)。
 * 供无法直接替换为 <SearchInput> 的场景引用(如 cmdk CommandInput、
 * 依赖受控键盘导航的特殊输入),保证与 SearchInput 视觉完全一致。
 */
export const searchInputWellClassName =
  'rounded-md border border-border bg-muted/40 transition-colors focus-within:border-ring/60 focus-within:bg-muted/60'

type SearchInputSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<
  SearchInputSize,
  { input: string; icon: string; clear: string; clearIcon: string }
> = {
  sm: {
    input: 'h-7 text-xs',
    icon: 'h-3 w-3',
    clear: 'h-4 w-4',
    clearIcon: 'h-2.5 w-2.5',
  },
  md: {
    input: 'h-8 text-sm',
    icon: 'h-3.5 w-3.5',
    clear: 'h-5 w-5',
    clearIcon: 'h-3 w-3',
  },
  lg: {
    input: 'h-9 text-sm',
    icon: 'h-3.5 w-3.5',
    clear: 'h-5 w-5',
    clearIcon: 'h-3 w-3',
  },
}

export interface SearchInputProps extends Omit<React.ComponentProps<'input'>, 'size' | 'type'> {
  /** sm=h-7 / md=h-8(默认)/ lg=h-9 */
  size?: SearchInputSize
  /** 是否显示右侧清空按钮(有值时出现),默认 false */
  clearable?: boolean
  /** 清空按钮 aria-label(无障碍) */
  clearAriaLabel?: string
  /** 外层容器附加类(用于宽度约束,如 max-w-xs / w-full) */
  wrapperClassName?: string
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      size = 'md',
      clearable = false,
      clearAriaLabel,
      wrapperClassName,
      className,
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const s = sizeMap[size]
    const hasValue = typeof value === 'string' ? value.length > 0 : Boolean(value)
    return (
      <div className={cn('relative', wrapperClassName)}>
        <div className="relative flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 transition-colors focus-within:border-ring/60 focus-within:bg-muted/60">
          <Search className={cn('pointer-events-none shrink-0 text-muted-foreground', s.icon)} />
          <input
            ref={ref}
            value={value}
            onChange={onChange}
            className={cn(
              'min-w-0 flex-1 border-0 bg-transparent px-0 outline-none shadow-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
              s.input,
              className,
            )}
            {...props}
          />
          {clearable && hasValue && (
            <button
              type="button"
              onClick={() => {
                const target = {
                  target: { value: '', name: props.name },
                } as unknown as React.ChangeEvent<HTMLInputElement>
                onChange?.(target)
              }}
              aria-label={clearAriaLabel}
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                s.clear,
              )}
            >
              <X className={s.clearIcon} />
            </button>
          )}
        </div>
      </div>
    )
  },
)
SearchInput.displayName = 'SearchInput'

export { SearchInput }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
