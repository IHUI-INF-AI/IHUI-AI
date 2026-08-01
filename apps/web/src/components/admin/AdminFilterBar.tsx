'use client'

import * as React from 'react'
import { Search, Plus, Download } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'

export interface AdminFilterBarProps {
  /** 页面标题 */
  title: string
  /** 标题图标 */
  icon?: React.ReactNode
  /** 搜索值 */
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  /** 创建按钮 */
  createLabel?: string
  onCreate?: () => void
  createPermission?: string
  /** 导出按钮 */
  exportLabel?: string
  onExport?: () => void
  /** 额外操作区(渲染在按钮组左侧) */
  extraActions?: React.ReactNode
}

/**
 * 管理端筛选栏 — 标题 + 搜索框 + 创建/导出按钮的通用布局。
 *
 * 替代 ~80 个 XxxFilter.tsx + page.tsx 顶部 header 的重复布局。
 */
export function AdminFilterBar({
  title,
  icon,
  search,
  onSearchChange,
  searchPlaceholder,
  createLabel,
  onCreate,
  createPermission,
  exportLabel,
  onExport,
  extraActions,
}: AdminFilterBarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {extraActions}
        {onSearchChange && (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder ?? '搜索...'}
              className="h-9 pl-8"
            />
          </div>
        )}
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" />
            {exportLabel ?? '导出'}
          </Button>
        )}
        {onCreate && (
          createPermission ? (
            <HasPermi code={createPermission}>
              <Button size="sm" onClick={onCreate}>
                <Plus className="h-4 w-4" />
                {createLabel ?? '新建'}
              </Button>
            </HasPermi>
          ) : (
            <Button size="sm" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              {createLabel ?? '新建'}
            </Button>
          )
        )}
      </div>
    </div>
  )
}
