'use client'

import * as React from 'react'
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { cn } from '../lib/utils.js'

export interface TreeNode {
  id: string
  label: string
  pid: string | null
  children?: TreeNode[]
}

export interface TreeSelectProps {
  value?: string | null
  onChange: (value: string | null) => void
  data: TreeNode[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

interface TreeNodeBuilt extends TreeNode {
  children: TreeNodeBuilt[]
}

function buildTree(nodes: TreeNode[]): TreeNodeBuilt[] {
  const map = new Map<string, TreeNodeBuilt>()
  const roots: TreeNodeBuilt[] = []
  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] })
  }
  for (const n of nodes) {
    const node = map.get(n.id)
    if (!node) continue
    if (n.pid === null) {
      roots.push(node)
    } else {
      const parent = map.get(n.pid)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  }
  return roots
}

function findPath(nodes: TreeNodeBuilt[], id: string): TreeNodeBuilt[] | null {
  for (const n of nodes) {
    if (n.id === id) return [n]
    if (n.children.length) {
      const sub = findPath(n.children, id)
      if (sub) return [n, ...sub]
    }
  }
  return null
}

function filterVisible(nodes: TreeNodeBuilt[], q: string): Set<string> {
  const visible = new Set<string>()
  const lower = q.toLowerCase()
  const walk = (list: TreeNodeBuilt[]): boolean => {
    let matched = false
    for (const n of list) {
      const self = n.label.toLowerCase().includes(lower)
      const child = n.children.length ? walk(n.children) : false
      if (self || child) {
        visible.add(n.id)
        matched = true
      }
    }
    return matched
  }
  walk(nodes)
  return visible
}

const TreeSelect = React.forwardRef<HTMLButtonElement, TreeSelectProps>(
  ({ value, onChange, data, placeholder = '请选择', disabled, className }, ref) => {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState('')
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
    const containerRef = React.useRef<HTMLDivElement>(null)

    const tree = React.useMemo(() => buildTree(data), [data])

    React.useEffect(() => {
      if (!value) return
      const path = findPath(tree, value)
      if (!path) return
      setExpanded((prev) => {
        const next = new Set(prev)
        for (const n of path) next.add(n.id)
        return next
      })
    }, [value, tree])

    React.useEffect(() => {
      if (!open) {
        setSearch('')
        return
      }
      const onDown = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false)
        }
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false)
      }
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
      return () => {
        document.removeEventListener('mousedown', onDown)
        document.removeEventListener('keydown', onKey)
      }
    }, [open])

    const selectedPath = React.useMemo(() => (value ? findPath(tree, value) : null), [value, tree])

    const visibleIds = React.useMemo(() => {
      const q = search.trim()
      return q ? filterVisible(tree, q) : null
    }, [tree, search])

    const triggerLabel = selectedPath ? selectedPath.map((n) => n.label).join(' / ') : placeholder

    const toggleExpand = (id: string) =>
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })

    const handleSelect = (id: string) => {
      onChange(id)
      setOpen(false)
    }

    const renderNodes = (nodes: TreeNodeBuilt[], depth: number): React.ReactNode =>
      nodes.map((node) => {
        if (visibleIds && !visibleIds.has(node.id)) return null
        const hasChildren = node.children.length > 0
        const isExpanded = visibleIds ? true : expanded.has(node.id)
        return (
          <div key={node.id} role="group">
            <div
              role="treeitem"
              aria-selected={value === node.id}
              aria-expanded={hasChildren ? isExpanded : undefined}
              aria-level={depth + 1}
              className={cn(
                'flex cursor-default select-none items-center gap-1 rounded-sm py-1.5 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                value === node.id && 'bg-accent text-accent-foreground',
              )}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => handleSelect(node.id)}
            >
              {hasChildren ? (
                <button
                  type="button"
                  tabIndex={-1}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm hover:bg-accent-foreground/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpand(node.id)
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                  )}
                </button>
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1 truncate">{node.label}</span>
              {value === node.id && <Check className="h-4 w-4 shrink-0" />}
            </div>
            {hasChildren && isExpanded && renderNodes(node.children, depth + 1)}
          </div>
        )
      })

    return (
      <div ref={containerRef} className={cn('relative', className)}>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((p) => !p)}
          className={cn(
            'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            !selectedPath && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')}
          />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-popover rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="flex items-center gap-2 border-b px-2 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <input
                className="flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="搜索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-auto p-1" role="tree" aria-label="树形选择">
              {tree.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">暂无数据</div>
              ) : (
                renderNodes(tree, 0)
              )}
            </div>
          </div>
        )}
      </div>
    )
  },
)
TreeSelect.displayName = 'TreeSelect'

export { TreeSelect }
