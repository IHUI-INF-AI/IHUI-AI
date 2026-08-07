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
import { Tooltip } from '@/components/feedback'
import { TruncatedText } from '@/components/common'
import { createGroupV2, deleteGroupV2 } from './helpers-v2'
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

  const deleteGroupMut = useMutation({
    mutationFn: (id: number) => deleteGroupV2(id),
    onSuccess: () => {
      toast.success(t('groupDeleted'))
      void qc.invalidateQueries({ queryKey: ['v2-providers'] })
      void qc.invalidateQueries({ queryKey: ['v2-groups'] })
    },
    onError: (e: Error) => toast.error(t('deleteFailed'), { description: e.message }),
  })

  function handleAddGroup(e: React.FormEvent) {
    e.preventDefault()
    const name = newGroupName.trim()
    if (!name) return
    createGroupMut.mutate(name)
  }

  function handleDeleteGroup(g: ProviderGroup, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(t('deleteGroupConfirm', { name: g.groupLabel }))) return
    // 分组下仍有 provider 时先解绑再删
    if (g.providers.length > 0) {
      toast.error(t('groupNotEmpty', { count: g.providers.length }))
      return
    }
    // 聚合接口不带 group 实体 id,由 PageClient 按 label 注入;缺 id 说明后端无对应实体
    if (g.id === undefined) {
      toast.error(t('groupDeleteNotSupported'))
      return
    }
    deleteGroupMut.mutate(g.id)
  }

  return (
    <aside className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          {t('title')}
        </h2>
        <Tooltip content={t('addGroup')}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setShowAddInput((s) => !s)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
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
        <span className="text-xs text-muted-foreground">{stats.get('__all__')?.total ?? 0}</span>
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
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <TruncatedText value={g.groupLabel} className="max-w-[140px]" />
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {s?.enabled ?? 0}/{s?.total ?? 0}
                </span>
              </button>
              <Tooltip content={t('deleteGroup')}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => handleDeleteGroup(g, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </Tooltip>
            </div>
          )
        })}
    </aside>
  )
}
