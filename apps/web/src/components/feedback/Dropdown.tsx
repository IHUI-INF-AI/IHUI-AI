'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

export interface DropdownItem {
  key: string
  label: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
  danger?: boolean
  divider?: boolean
  onSelect?: () => void
}

interface DropdownProps {
  items: DropdownItem[]
  trigger: React.ReactElement
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function Dropdown({ items, trigger, align = 'end', side = 'bottom', className }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={4}
          className={cn(
            'z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            className,
          )}
        >
          {items.map((item) =>
            item.divider ? (
              <DropdownMenu.Separator key={item.key} className="my-1 h-px bg-muted" />
            ) : (
              <DropdownMenu.Item
                key={item.key}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                  'focus:bg-accent focus:text-accent-foreground',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  item.danger && 'text-destructive focus:bg-destructive/10',
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
