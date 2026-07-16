'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, Building2, Users, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@ihui/ui'
import { fetchDeptList } from './helpers'
import type { DeptItem } from './types'

interface DeptNode extends DeptItem {
  children: DeptNode[]
}

interface Props {
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function buildTree(list: DeptItem[]): DeptNode[] {
  const map = new Map<number, DeptNode>()
  list.forEach((d) => map.set(d.deptId, { ...d, children: [] }))
  const roots: DeptNode[] = []
  map.forEach((node) => {
    const parent = map.get(node.parentId)
    if (parent && parent !== node) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function filterTree(nodes: DeptNode[], keyword: string): DeptNode[] {
  if (!keyword) return nodes
  const kw = keyword.toLowerCase()
  const walk = (list: DeptNode[]): DeptNode[] => {
    const out: DeptNode[] = []
    list.forEach((n) => {
      const matched = n.deptName.toLowerCase().includes(kw)
      const kids = walk(n.children)
      if (matched || kids.length > 0) {
        out.push({ ...n, children: kids })
      }
    })
    return out
  }
  return walk(nodes)
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  forceExpand,
}: {
  node: DeptNode
  depth: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  forceExpand: boolean
}) {
  const [expanded, setExpanded] = React.useState(true)
  const isOpen = forceExpand || expanded
  const hasChildren = node.children.length > 0
  const idStr = String(node.deptId)
  const selected = selectedId === idStr
  return (
    <div>
      <div
        className={cn(
          'flex h-8 items-center gap-1 rounded-sm pr-2 text-sm transition-colors hover:bg-accent',
          selected && 'bg-primary/10 font-medium',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent-foreground/10"
            aria-label={isOpen ? '折叠' : '展开'}
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(idStr)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.deptName}</span>
        </button>
      </div>
      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.deptId}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DeptTree({ selectedId, onSelect }: Props) {
  const [keyword, setKeyword] = React.useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'dept', 'list'],
    queryFn: fetchDeptList,
    staleTime: 5 * 60 * 1000,
  })

  const tree = React.useMemo(() => {
    const built = buildTree(data?.list ?? [])
    return filterTree(built, keyword.trim())
  }, [data, keyword])

  const forceExpand = keyword.trim().length > 0

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-card/30">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3 text-xs font-medium text-muted-foreground">
        部门
      </div>
      <div className="shrink-0 border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索部门"
            className="h-7 pl-7 text-xs"
            aria-label="搜索部门"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'mb-1 flex h-8 w-full items-center gap-1.5 rounded-sm px-2 text-sm transition-colors hover:bg-accent',
            selectedId === null && 'bg-primary/10 font-medium',
          )}
        >
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span>全部用户</span>
        </button>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">部门加载失败</div>
        ) : tree.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            {keyword.trim() ? '无匹配部门' : '暂无部门'}
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.deptId}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              forceExpand={forceExpand}
            />
          ))
        )}
      </div>
    </div>
  )
}
