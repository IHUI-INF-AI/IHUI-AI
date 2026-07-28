'use client'

import * as React from 'react'
import { Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Popover } from '@/components/feedback'

interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  /** 命令类型(2026-07-25 立):
   * - 'template'(默认):选命令后填充模板到 textarea
   * - 'action':选命令后执行动作(如切换模式),不填充 textarea */
  kind?: 'template' | 'action'
}

interface SlashCommandPaletteProps {
  commands: Command[]
  onSelect: (id: string) => void
  open: boolean
  /** 受控开关回调:点击 trigger / ESC / 选命令 / 点外部 都通过此回调同步外部 state */
  onOpenChange: (open: boolean) => void
  /** trigger 元素(斜杠按钮),弹层锚定到该元素上方 */
  children: React.ReactElement
  /** hover 时显示的轻量文字提示(可选,由 Popover 内部 Tooltip 渲染) */
  tooltip?: React.ReactNode
}

/**
 * 斜杠命令面板(2026-07-29 重构:Dialog → Popover)。
 * 原实现用 Dialog 整页中间弹出 + 遮罩,过重;改为 Popover 锚定到 trigger 按钮
 * 上方(position=top, align=start, portal),无遮罩轻弹出,符合用户对"按钮上方轻弹出"
 * 的视觉预期。两种触发场景统一锚定到按钮:
 *  - 点击 `/` 按钮:Popover trigger=click 自动 toggle
 *  - textarea 输入 `/`:外部 setSlashOpen(true) 受控打开,弹层仍锚定到按钮
 */
export function SlashCommandPalette({
  commands,
  onSelect,
  open,
  onOpenChange,
  children,
  tooltip,
}: SlashCommandPaletteProps) {
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false),
    )
  }, [commands, query])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [filtered.length])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % Math.max(filtered.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[activeIndex]
      if (cmd) {
        onSelect(cmd.id)
        onOpenChange(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
    }
  }

  const content = (
    <div>
      <div className="border-b px-3 py-2">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索命令..."
          className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="max-h-72 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">无匹配命令</p>
        ) : (
          filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              type="button"
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => {
                onSelect(cmd.id)
                onOpenChange(false)
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                idx === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground',
              )}
            >
              {cmd.icon && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {cmd.icon}
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="break-words text-sm font-medium">{cmd.label}</span>
                {cmd.description && (
                  <span className="whitespace-pre-line break-words text-xs text-muted-foreground">
                    {cmd.description}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      content={content}
      position="top"
      align="start"
      trigger="click"
      portal
      tooltip={tooltip}
      className="w-72 overflow-hidden p-0"
    >
      {children}
    </Popover>
  )
}

export default SlashCommandPalette
