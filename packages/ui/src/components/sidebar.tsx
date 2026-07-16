import * as React from 'react'
import { cn } from '../lib/utils.js'

const SidebarContext = React.createContext<boolean>(false)
const useSidebarCollapsed = () => React.useContext(SidebarContext)

function SidebarScrollHideStyles() {
  return (
    <style>{`
      [data-sidebar] .sidebar-scroll-hide {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      [data-sidebar] .sidebar-scroll-hide::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
    `}</style>
  )
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean
  onToggle?: () => void
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ collapsed = false, onToggle: _onToggle, children, className, ...props }, ref) => {
    return (
      <SidebarContext.Provider value={collapsed}>
        <aside
          ref={ref}
          data-sidebar=""
          data-collapsed={collapsed || undefined}
          className={cn(
            'flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out',
            collapsed ? 'w-[54px]' : 'w-[200px]',
            className,
          )}
          {...props}
        >
          <SidebarScrollHideStyles />
          <nav className="sidebar-scroll-hide flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2">
            {children}
          </nav>
        </aside>
      </SidebarContext.Provider>
    )
  },
)
Sidebar.displayName = 'Sidebar'

export interface SidebarGroupProps {
  title?: string
  children: React.ReactNode
  className?: string
}

export const SidebarGroup = React.forwardRef<HTMLDivElement, SidebarGroupProps>(
  ({ title, children, className }, ref) => {
    const collapsed = useSidebarCollapsed()
    return (
      <div ref={ref} className={cn('flex flex-col gap-0.5', className)}>
        {title && !collapsed && (
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {title}
          </div>
        )}
        {children}
      </div>
    )
  },
)
SidebarGroup.displayName = 'SidebarGroup'

export interface SidebarItemProps {
  icon?: React.ReactNode
  label: string
  href?: string
  active?: boolean
  level?: 0 | 1 | 2
  onClick?: () => void
  children?: React.ReactNode
  className?: string
}

const levelPadding = ['pl-3', 'pl-8', 'pl-13']

export const SidebarItem = React.forwardRef<HTMLElement, SidebarItemProps>(
  ({ icon, label, href, active = false, level = 0, onClick, children, className }, ref) => {
    const collapsed = useSidebarCollapsed()
    const [expanded, setExpanded] = React.useState(false)
    const hasChildren = React.Children.count(children) > 0

    const baseClass = cn(
      'flex h-9 min-w-0 items-center gap-2 rounded-md pr-3 text-sm font-medium whitespace-nowrap transition-colors',
      levelPadding[level] ?? levelPadding[0],
      active
        ? 'bg-sidebar-active text-sidebar-foreground'
        : 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground',
      collapsed && 'justify-center px-0',
      className,
    )

    const content = (
      <>
        {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>}
        {!collapsed && <span className="truncate">{label}</span>}
      </>
    )

    if (collapsed) {
      const Tag = href ? 'a' : 'button'
      return (
        <Tag
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={ref as any}
          href={href}
          onClick={onClick}
          title={label}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={baseClass}
        >
          {content}
        </Tag>
      )
    }

    if (hasChildren) {
      return (
        <div ref={ref as React.Ref<HTMLDivElement>} className="flex flex-col">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className={cn(baseClass, 'w-full')}
          >
            {content}
            <svg
              className={cn(
                'ml-auto h-3.5 w-3.5 shrink-0 transition-transform',
                expanded && 'rotate-180',
              )}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expanded && <div className="flex flex-col gap-0.5">{children}</div>}
        </div>
      )
    }

    if (href) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          onClick={onClick}
          aria-current={active ? 'page' : undefined}
          className={baseClass}
        >
          {content}
        </a>
      )
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={baseClass}
      >
        {content}
      </button>
    )
  },
)
SidebarItem.displayName = 'SidebarItem'
