'use client'

import * as React from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/form'

export interface Column<T> {
  key: string
  title: string
  render?: (row: T, index: number) => React.ReactNode
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey?: (row: T, index: number) => string | number
  pagination?: { page: number; pageSize: number; total: number }
  onPageChange?: (page: number) => void
  selectable?: boolean
  onSelect?: (selectedRows: T[]) => void
  loading?: boolean
  className?: string
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

function DataTableImpl<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey = (_, i) => `row-${i}`,
  pagination,
  onPageChange,
  selectable = false,
  onSelect,
  loading = false,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<SortState>(null)
  const [selected, setSelected] = React.useState<Set<number>>(new Set())

  const sortedData = React.useMemo(() => {
    if (!sort) return data
    return [...data].sort((a, b) => {
      const av = a[sort.key] as unknown
      const bv = b[sort.key] as unknown
      if (av === bv) return 0
      const cmp = (av as number) > (bv as number) ? 1 : -1
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [data, sort])

  const handleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === 'asc' ? { key, dir: 'desc' } : null
      }
      return { key, dir: 'asc' }
    })
  }

  const allChecked = data.length > 0 && selected.size === data.length
  const toggleAll = () => {
    const next = allChecked ? new Set<number>() : new Set(data.map((_, i) => i))
    setSelected(next)
    onSelect?.(
      Array.from(next)
        .map((i) => data[i]!)
        .filter(Boolean) as T[],
    )
  }

  const toggleRow = (idx: number) => {
    const next = new Set(selected)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setSelected(next)
    onSelect?.(
      Array.from(next)
        .map((i) => data[i]!)
        .filter(Boolean) as T[],
    )
  }

  const alignMap = { left: 'text-left', center: 'text-center', right: 'text-right' }

  return (
    <div className={cn('w-full', className)}>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={allChecked} onChange={toggleAll} />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 font-medium',
                    alignMap[col.align ?? 'left'],
                    col.width,
                  )}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {col.title}
                      {sort?.key === col.key ? (
                        sort.dir === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  加载中...
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  暂无数据
                </td>
              </tr>
            ) : (
              sortedData.map((row, i) => (
                <tr key={rowKey(row, i)} className="border-t transition-colors hover:bg-muted/30">
                  {selectable && (
                    <td className="w-10 px-3 py-2.5">
                      <Checkbox checked={selected.has(i)} onChange={() => toggleRow(i)} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-3 py-2.5', alignMap[col.align ?? 'left'])}>
                      {col.render ? col.render(row, i) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {pagination.total} 条,第 {pagination.page}/
            {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export const DataTable = React.memo(DataTableImpl) as typeof DataTableImpl
