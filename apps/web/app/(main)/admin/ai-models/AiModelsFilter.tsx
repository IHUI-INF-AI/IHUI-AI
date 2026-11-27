// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import { Plus, RotateCcw } from 'lucide-react'
import { Button, SearchInput } from '@ihui/ui-react'

export type StatusFilter = 'all' | 'enabled' | 'disabled'
export type PublicFilter = 'all' | 'true' | 'false'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  provider: string
  providers: string[]
  onProviderChange: (v: string) => void
  status: StatusFilter
  onStatusChange: (v: StatusFilter) => void
  publicFilter: PublicFilter
  onPublicChange: (v: PublicFilter) => void
  onCreate: () => void
}

const SELECT_CLASS =
  'h-9 rounded-md border border-border bg-background px-2.5 text-label text-foreground outline-none focus-visible:ring-2 focus-visible:ring-stroke-focus'

export function AiModelsFilter({
  search,
  onSearchChange,
  provider,
  providers,
  onProviderChange,
  status,
  onStatusChange,
  publicFilter,
  onPublicChange,
  onCreate,
}: Props) {
  const hasFilter = provider !== '' || status !== 'all' || publicFilter !== 'all' || search !== ''

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-display font-bold tracking-tight">
          <span className="truncate">AI 模型配置</span>
        </h1>
        <Button size="sm" className="shrink-0" onClick={onCreate}>
          <Plus className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">新增</span>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="搜索模型名称..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          wrapperClassName="w-full max-w-sm"
        />
        <select
          className={SELECT_CLASS}
          value={provider}
          onChange={(e) => onProviderChange(e.target.value)}
          aria-label="按 Provider 筛选"
        >
          <option value="">全部 Provider</option>
          {providers.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          aria-label="按启用状态筛选"
        >
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已停用</option>
        </select>
        <select
          className={SELECT_CLASS}
          value={publicFilter}
          onChange={(e) => onPublicChange(e.target.value as PublicFilter)}
          aria-label="按公开状态筛选"
        >
          <option value="all">全部公开性</option>
          <option value="true">有公开模型</option>
          <option value="false">无公开模型</option>
        </select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange('')
              onProviderChange('')
              onStatusChange('all')
              onPublicChange('all')
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </Button>
        )}
      </div>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
