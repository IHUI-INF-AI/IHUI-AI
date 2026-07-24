'use client'

/**
 * GroupSidebar — 左侧分组栏(2026-07-22 立)
 *
 * 显示当前所有 provider 分组(按 group 折叠聚合),点击切换:
 *  - "all" 全部 provider
 *  - 各分组(显示分组名 + 该组下 provider 数 + 启用数)
 *  - "未分组" 未指定 group 的 provider
 *
 * 也支持添加新分组。
 */
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronRight, FolderPlus, Layers, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { createGroupV2 } from './helpers-v2'
import type { ProviderGroup } from './types-v2'

interface Props {
  groups: ProviderGroup[]
  activeGroup: string
  onChange: (group: string) => void
}

interface GroupStats {
  total: number
  enabled: number
}

export function GroupSidebar({ groups, activeGroup, onChange }: Props) {
  const t = useTranslations('llmSettings.v2.sidebar')
  const qc = useQueryClient()

  // 聚合各 group 的 provider 统计
  const stats = React.useMemo(() => {
    const map = new Map<string, GroupStats>()
    let allTotal = 0
    let allEnabled = 0
    for (const g of groups) {
      const total = g.providers.length
      const enabled = g.providers.filter((p) => p.enabled).length
      map.set(g.group, { total, enabled })
      allTotal += total
      allEnabled += enabled
    }
    map.set('__all__', { total: allTotal, enabled: allEnabled })
    return map
  }, [groups])

  // 创建新分组
  const [newGroupName, setNewGroupName] = React.useState('')
  const [showAddInput, setShowAddInput] = React.useState(false)
  const createGroupMut = useMutation({
    mutationFn: (label: string) => createGroupV2(label),
    onSuccess: (res) => {
      toast.success(t('groupCreated', { name: res.label }))
      setNewGroupName('')
      setShowAddInput(false)
      qc.invalidateQueries({ queryKey: ['v2-providers'] })
    },
    onError: (e: Error) => toast.error(t('createFailed'), { description: e.message }),
  })

  // 旧版 delGroupMut 已删除 — 当前 handleDeleteGroup 走 groupDeleteNotSupported 占位逻辑(2026-07-22 简化)

  function handleAddGroup(e: React.FormEvent) {
    e.preventDefault()
    const name = newGroupName.trim()
    if (!name) return
    createGroupMut.mutate(name)
  }

  function handleDeleteGroup(g: ProviderGroup, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(t('deleteGroupConfirm', { name: g.groupLabel }))) return
    // 用 group 名称作为 label 反查?后端只接 id。这里用 sortOrder 0 + label 模拟不够严谨。
    // 实际后端需要返回 group id。简化:提示用户先解绑 provider 再删
    if (g.providers.length > 0) {
      toast.error(t('groupNotEmpty', { count: g.providers.length }))
      return
    }
    // 找到 group id(从 group 中第一个 provider 的 extraMetadata?这里没有 id)
    // 兜底:用 group 名做临时 id(后端需要支持按 name 删除)
    // 暂跳过,UI 上隐藏
    toast.error(t('groupDeleteNotSupported'))
  }

  return (
    <aside className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          {t('title')}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setShowAddInput((s) => !s)}
          title={t('addGroup')}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showAddInput ? (
        <form onSubmit={handleAddGroup} className="space-y-1 px-2 pb-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={t('groupPlaceholder')}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            ref={(el) => {
              if (el) el.focus()
            }}
          />
          <div className="flex gap-1">
            <Button
              type="submit"
              size="sm"
              className="h-6 flex-1 text-xs"
              disabled={!newGroupName.trim() || createGroupMut.isPending}
            >
              {createGroupMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t('add')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                setShowAddInput(false)
                setNewGroupName('')
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {/* All providers */}
      <button
        type="button"
        onClick={() => onChange('__all__')}
        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          activeGroup === '__all__'
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-muted'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />
          {t('all')}
        </span>
        <span className="text-xs text-muted-foreground">
          {stats.get('__all__')?.total ?? 0}
        </span>
      </button>

      {/* Ungrouped(占位) */}
      {groups.filter((g) => g.group === 'default' || g.group === '' || g.group === null).length >
        0 && (
        <button
          type="button"
          onClick={() => onChange('__ungrouped__')}
          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
            activeGroup === '__ungrouped__'
              ? 'bg-primary/10 text-primary'
              : 'text-foreground hover:bg-muted'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3" />
            {t('ungrouped')}
          </span>
          <span className="text-xs text-muted-foreground">
            {groups
              .filter((g) => g.group === 'default' || g.group === '' || g.group === null)
              .reduce((acc, g) => acc + g.providers.length, 0)}
          </span>
        </button>
      )}

      {/* 各分组 */}
      {groups
        .filter((g) => g.group !== 'default' && g.group !== '' && g.group !== null)
        .map((g) => {
          const s = stats.get(g.group)
          return (
            <div
              key={g.group}
              className={`group flex items-center justify-between gap-1 rounded-md text-sm transition-colors ${
                activeGroup === g.group
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <button
                type="button"
                onClick={() => onChange(g.group)}
                className="flex flex-1 items-center justify-between gap-2 px-2 py-1.5 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3" />
                  {g.groupLabel}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s?.enabled ?? 0}/{s?.total ?? 0}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => handleDeleteGroup(g, e)}
                title={t('deleteGroup')}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
    </aside>
  )
}
