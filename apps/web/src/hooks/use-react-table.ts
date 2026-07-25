'use client'

import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
  type VisibilityState,
  type ColumnPinningState,
  type ExpandedState,
  type Table,
  type Row,
} from '@tanstack/react-table'

/**
 * useClientTable — 直接包装 @tanstack/react-table 的共享 hook。
 *
 * 提供 D1+D4 el-table 能力:列宽自适应(columnSizing/size)、固定列(columnPinning)、
 * 行展开(expanded)、列拖拽(columnResizeMode)、筛选行(getFilteredRowModel)、
 * 排序(getSortedRowModel)、分页(getPaginationRowModel)。
 *
 * 状态可持久化到 localStorage(storageKey 非空时)。
 */
function loadState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveState<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota / serialization errors — ignore
  }
}

export interface UseClientTableOptions<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  storageKey?: string
  enableSorting?: boolean
  enableColumnVisibility?: boolean
  enableColumnPinning?: boolean
  enableColumnResize?: boolean
  enableRowExpansion?: boolean
  /** 客户端分页;默认 false(配合服务端分页时不应启用,否则会截断当前页数据) */
  enablePagination?: boolean
  initialPageSize?: number
  getRowId?: (row: TData, index: number) => string
}

export interface UseClientTableReturn<TData> {
  table: Table<TData>
  sorting: SortingState
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>
  columnVisibility: VisibilityState
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>
  columnPinning: ColumnPinningState
  setColumnPinning: React.Dispatch<React.SetStateAction<ColumnPinningState>>
  columnSizing: ColumnSizingState
  setColumnSizing: React.Dispatch<React.SetStateAction<ColumnSizingState>>
  expanded: ExpandedState
  setExpanded: React.Dispatch<React.SetStateAction<ExpandedState>>
}

export function useClientTable<TData>(
  options: UseClientTableOptions<TData>,
): UseClientTableReturn<TData> {
  const {
    data,
    columns,
    storageKey,
    enableSorting = true,
    enableColumnVisibility = true,
    enableColumnPinning = false,
    enableColumnResize = false,
    enableRowExpansion = false,
    enablePagination = false,
    initialPageSize = 10,
    getRowId,
  } = options

  const sk = storageKey ?? ''

  const [sorting, setSorting] = React.useState<SortingState>(() =>
    sk ? loadState<SortingState>(`${sk}:sorting`, []) : [],
  )
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() =>
    sk ? loadState<VisibilityState>(`${sk}:visibility`, {}) : {},
  )
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(() =>
    sk ? loadState<ColumnPinningState>(`${sk}:pinning`, { left: [], right: [] }) : { left: [], right: [] },
  )
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() =>
    sk ? loadState<ColumnSizingState>(`${sk}:sizing`, {}) : {},
  )
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  React.useEffect(() => {
    if (sk) saveState(`${sk}:sorting`, sorting)
  }, [sk, sorting])
  React.useEffect(() => {
    if (sk) saveState(`${sk}:visibility`, columnVisibility)
  }, [sk, columnVisibility])
  React.useEffect(() => {
    if (sk) saveState(`${sk}:pinning`, columnPinning)
  }, [sk, columnPinning])
  React.useEffect(() => {
    if (sk) saveState(`${sk}:sizing`, columnSizing)
  }, [sk, columnSizing])

  const table = useReactTable<TData>({
    data,
    columns,
    state: {
      sorting: enableSorting ? sorting : [],
      columnVisibility: enableColumnVisibility ? columnVisibility : {},
      columnPinning: enableColumnPinning ? columnPinning : { left: [], right: [] },
      columnSizing: enableColumnResize ? columnSizing : {},
      expanded,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: setColumnSizing,
    onExpandedChange: setExpanded,
    enableColumnPinning,
    enableColumnResizing: enableColumnResize,
    columnResizeMode: 'onChange',
    enableSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    ...(enableRowExpansion ? { getExpandedRowModel: getExpandedRowModel() } : {}),
    ...(getRowId ? { getRowId } : {}),
    ...(enablePagination ? { initialState: { pagination: { pageSize: initialPageSize } } } : {}),
  })

  return {
    table,
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    columnPinning,
    setColumnPinning,
    columnSizing,
    setColumnSizing,
    expanded,
    setExpanded,
  }
}

/** 派生排序后的数据(保留原始对象引用)。sorting 为空时返回原数组。 */
export function useSortedData<TData>(
  table: Table<TData>,
  data: TData[],
  sorting: SortingState,
): TData[] {
  return React.useMemo(() => {
    if (!sorting.length) return data
    return table.getRowModel().rows.map((r: Row<TData>) => r.original)
  }, [table, data, sorting])
}

export type {
  ColumnDef,
  SortingState,
  ColumnSizingState,
  VisibilityState,
  ColumnPinningState,
  ExpandedState,
  Table,
  Row,
} from '@tanstack/react-table'
