'use client'

import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type ExpandedState,
  type Row,
  type SortingState,
} from '@tanstack/react-table'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Inbox,
  Search,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { Input } from './input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

export type DataTableColumn<TData> = ColumnDef<TData>

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  pageSize?: number
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
  enableColumnResize?: boolean
  enableColumnFilters?: boolean
  enableRowExpansion?: boolean
  expandOnRowClick?: boolean
  renderExpandedRow?: (row: Row<TData>) => React.ReactNode
  pageSizeOptions?: number[]
  manualPagination?: boolean
  pageCount?: number
  controlledPageIndex?: number
  controlledPageSize?: number
  controlledTotal?: number
  onPageIndexChange?: (i: number) => void
  onPageSizeChange?: (s: number) => void
  loading?: boolean
  error?: Error | null
  renderRow?: (row: Row<TData>, defaultRow: React.ReactNode) => React.ReactNode
  getRowId?: (row: TData, index: number) => string
  emptyText?: string
  loadingText?: string
  showPagination?: boolean
}

function DataTable<TData>({
  columns,
  data,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = '搜索...',
  className,
  enableColumnResize = false,
  enableColumnFilters = false,
  enableRowExpansion = false,
  expandOnRowClick = true,
  renderExpandedRow,
  pageSizeOptions = [10, 20, 50, 100],
  manualPagination = false,
  pageCount: controlledPageCount,
  controlledPageIndex,
  controlledPageSize,
  controlledTotal,
  onPageIndexChange,
  onPageSizeChange,
  loading = false,
  error = null,
  renderRow,
  getRowId,
  emptyText = '暂无数据',
  loadingText = '加载中...',
  showPagination = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  const table = useReactTable<TData>({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnSizing,
      expanded,
      ...(manualPagination
        ? {
            pagination: {
              pageIndex: controlledPageIndex ?? 0,
              pageSize: controlledPageSize ?? pageSize,
            },
          }
        : {}),
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    onExpandedChange: setExpanded,
    ...(manualPagination
      ? {
          pageCount: controlledPageCount ?? -1,
          manualPagination: true,
        }
      : {}),
    ...(enableColumnResize ? { columnResizeMode: 'onChange' as const } : {}),
    ...(enableRowExpansion ? { getExpandedRowModel: getExpandedRowModel() } : {}),
    ...(getRowId ? { getRowId } : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: manualPagination ? undefined : { pagination: { pageSize } },
  })

  const currentPageIndex = manualPagination
    ? (controlledPageIndex ?? 0)
    : table.getState().pagination.pageIndex
  const currentPageSize = manualPagination
    ? (controlledPageSize ?? pageSize)
    : table.getState().pagination.pageSize
  const currentPageCount = manualPagination
    ? Math.max(controlledPageCount ?? 0, 0)
    : table.getPageCount()
  const filteredTotal =
    controlledTotal ?? (manualPagination ? 0 : table.getFilteredRowModel().rows.length)

  const pageButtons = React.useMemo<(number | 'ellipsis')[]>(() => {
    const pages: (number | 'ellipsis')[] = []
    if (currentPageCount <= 7) {
      for (let i = 0; i < currentPageCount; i++) pages.push(i)
      return pages
    }
    pages.push(0)
    const start = Math.max(1, currentPageIndex - 1)
    const end = Math.min(currentPageCount - 2, currentPageIndex + 1)
    if (start > 1) pages.push('ellipsis')
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < currentPageCount - 2) pages.push('ellipsis')
    pages.push(currentPageCount - 1)
    return pages
  }, [currentPageCount, currentPageIndex])

  const handlePageChange = (i: number) => {
    if (manualPagination) onPageIndexChange?.(i)
    else table.setPageIndex(i)
  }
  const handlePageSizeChange = (s: number) => {
    if (manualPagination) onPageSizeChange?.(s)
    else table.setPageSize(s)
  }

  const totalColSpan = columns.length
  const showToolbar = searchable || pageSizeOptions.length > 0

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {searchable ? (
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>
          ) : (
            <div />
          )}
          {pageSizeOptions.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>每页</span>
              <select
                value={currentPageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {pageSizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span>条</span>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table
            style={
              enableColumnResize ? { width: table.getTotalSize(), tableLayout: 'fixed' } : undefined
            }
          >
            <TableHeader className="bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sorted = header.column.getIsSorted()
                    const ariaSort =
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                    const canFilter = enableColumnFilters && header.column.getCanFilter()
                    const headerWidth = enableColumnResize ? header.getSize() : undefined
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={canSort ? ariaSort : undefined}
                        style={
                          headerWidth ? { width: headerWidth, position: 'relative' } : undefined
                        }
                        className="px-2"
                      >
                        <div className={canFilter ? 'flex flex-col gap-1' : undefined}>
                          {canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              aria-label={`排序: ${sorted === 'asc' ? '升序' : sorted === 'desc' ? '降序' : '未排序'}`}
                              className="inline-flex items-center gap-1 text-left font-medium transition-colors hover:text-foreground"
                            >
                              <span>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </span>
                              {sorted === 'asc' ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : sorted === 'desc' ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                              )}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                          {canFilter ? (
                            <input
                              type="text"
                              value={(header.column.getFilterValue() as string) ?? ''}
                              onChange={(e) => header.column.setFilterValue(e.target.value)}
                              placeholder="筛选..."
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          ) : null}
                        </div>
                        {enableColumnResize && header.column.getCanResize() && (
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              'absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none',
                              'hover:bg-primary/40',
                              header.column.getIsResizing() && 'bg-primary',
                            )}
                          />
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={totalColSpan}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {loadingText}
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={totalColSpan} className="h-24 text-center text-destructive">
                    {error.message}
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => {
                  const canExpand = enableRowExpansion && row.getCanExpand()
                  const defaultRow = (
                    <TableRow
                      key={row.id}
                      className={cn('hover:bg-accent/50', row.getIsExpanded() && 'bg-accent/30')}
                      onClick={
                        expandOnRowClick && canExpand ? row.getToggleExpandedHandler() : undefined
                      }
                      style={expandOnRowClick && canExpand ? { cursor: 'pointer' } : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={
                            enableColumnResize
                              ? { width: cell.column.getSize(), overflow: 'hidden' }
                              : undefined
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                  const rendered = renderRow ? renderRow(row, defaultRow) : defaultRow
                  return (
                    <React.Fragment key={row.id}>
                      {rendered}
                      {enableRowExpansion && row.getIsExpanded() && renderExpandedRow && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={row.getVisibleCells().length}
                            className="bg-muted/30 p-4"
                          >
                            {renderExpandedRow(row)}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={totalColSpan}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {/* 空状态图标(2026-07-31 对标 Trae/Codex/Claude Code):
                        纯文本空状态过于单调,添加 Inbox 图标提升视觉友好度 */}
                    <div className="flex flex-col items-center gap-2">
                      <Inbox className="h-8 w-8 opacity-40" aria-hidden />
                      <span>{emptyText}</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {showPagination && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
          <span className="text-muted-foreground">
            共 {filteredTotal} 条 · 第 {currentPageIndex + 1} / {Math.max(currentPageCount, 1)} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(Math.max(0, currentPageIndex - 1))}
              disabled={currentPageIndex <= 0}
              aria-label="上一页"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageButtons.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={p}
                  onClick={() => handlePageChange(p)}
                  aria-current={p === currentPageIndex ? 'page' : undefined}
                  aria-label={`第 ${p + 1} 页`}
                  className={cn(
                    'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs transition-colors',
                    p === currentPageIndex
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {p + 1}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => handlePageChange(Math.min(currentPageCount - 1, currentPageIndex + 1))}
              disabled={currentPageIndex >= currentPageCount - 1}
              aria-label="下一页"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { DataTable }
