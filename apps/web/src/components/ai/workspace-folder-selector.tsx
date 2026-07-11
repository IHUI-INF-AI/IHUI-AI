'use client'

import * as React from 'react'
import { Folder, FolderOpen, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FolderNode {
  id: string
  name: string
  path: string
  children?: unknown[]
}

interface WorkspaceFolderSelectorProps {
  folders: FolderNode[]
  selected?: string
  onSelect: (id: string) => void
}

function FolderTreeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FolderNode
  depth: number
  selected?: string
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = React.useState(depth < 1)
  const children = (node.children ?? []) as FolderNode[]
  const hasChildren = children.length > 0
  const isSel = node.id === selected

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(node.id)
          }
        }}
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-sm transition-colors',
          isSel ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={handleToggle}
            className="flex h-4 w-4 shrink-0 items-center justify-center"
            aria-label={expanded ? '折叠' : '展开'}
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform',
                expanded && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        {expanded && hasChildren ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-500" />
        )}
        <span className="break-words">{node.name}</span>
      </div>
      {hasChildren && expanded && (
        <ul>
          {children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function WorkspaceFolderSelector({
  folders,
  selected,
  onSelect,
}: WorkspaceFolderSelectorProps) {
  return (
    <div className="rounded-xl border bg-card p-2">
      {folders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">暂无文件夹</p>
      ) : (
        <ul>
          {folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              node={folder}
              depth={0}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default WorkspaceFolderSelector
