'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { DiffFileStatus, DiffFile } from '@ihui/types'
import { getFileIcon, getFileColor } from './file-icons'
import type { DiffFilterType } from './diff-stats-bar'
import { cn } from '@/lib/utils'
import { Plus, RotateCcw } from 'lucide-react'

const STATUS_LABEL: Record<DiffFileStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
}

const STATUS_COLOR: Record<DiffFileStatus, string> = {
  added: 'text-green-600 dark:text-green-400',
  modified: 'text-amber-600 dark:text-amber-400',
  deleted: 'text-red-600 dark:text-red-400',
  renamed: 'text-blue-600 dark:text-blue-400',
}

const STATUS_GROUP: { key: DiffFileStatus; labelKey: string }[] = [
  { key: 'modified', labelKey: 'diffFileList.groupModified' },
  { key: 'added', labelKey: 'diffFileList.groupAdded' },
  { key: 'deleted', labelKey: 'diffFileList.groupDeleted' },
  { key: 'renamed', labelKey: 'diffFileList.groupRenamed' },
]

interface DiffFileListProps {
  filter?: DiffFilterType
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  showActions?: boolean
}

export function DiffFileList({
  filter = 'all',
  selectable = false,
  selectedIds,
  onSelectionChange,
  showActions = false,
}: DiffFileListProps) {
  const { diffFiles, activeDiffFileId, setActiveDiffFile } = useIDEWorkspace()
  const t = useTranslations('ide')

  const filtered = React.useMemo(
    () => (filter === 'all' ? diffFiles : diffFiles.filter((f) => f.status === filter)),
    [diffFiles, filter],
  )

  const groups = React.useMemo(() => {
    const map = new Map<DiffFileStatus, DiffFile[]>()
    for (const f of filtered) {
      if (!map.has(f.status)) map.set(f.status, [])
      map.get(f.status)!.push(f)
    }
    return map
  }, [filtered])

  const toggleSelect = (id: string) => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  return (
    <div className="flex flex-col gap-1">
      {STATUS_GROUP.map(({ key, labelKey }) => {
        const files = groups.get(key)
        if (!files?.length) return null
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 px-2 py-0.5 text-muted-foreground">
              <span className="font-medium">{t(labelKey)}</span>
              <span className="rounded bg-muted px-1 text-[10px]">{files.length}</span>
            </div>
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                isActive={activeDiffFileId === file.id}
                selectable={selectable}
                isSelected={selectedIds?.has(file.id) ?? false}
                onSelect={toggleSelect}
                onClick={setActiveDiffFile}
                showActions={showActions}
              />
            ))}
          </div>
        )
      })}
      {!filtered.length && (
        <div className="px-2 py-4 text-center text-muted-foreground">{t('diffFileList.noMatch')}</div>
      )}
    </div>
  )
}

interface FileRowProps {
  file: DiffFile
  isActive: boolean
  selectable: boolean
  isSelected: boolean
  onSelect: (id: string) => void
  onClick: (id: string) => void
  showActions: boolean
}

function FileRow({ file, isActive, selectable, isSelected, onSelect, onClick, showActions }: FileRowProps) {
  const Icon = getFileIcon(file.filename)
  const dir = file.filename.includes('/') ? file.filename.slice(0, file.filename.lastIndexOf('/')) : ''
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(file.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(file.id) } }}
      className={cn(
        'group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
        isActive ? 'bg-muted text-foreground' : 'hover:bg-muted/50',
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(file.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-3 w-3 shrink-0 accent-foreground"
        />
      )}
      <span className={cn('w-4 text-center font-mono', STATUS_COLOR[file.status])}>
        {STATUS_LABEL[file.status]}
      </span>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', getFileColor(file.filename))} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{file.filename.split('/').pop()}</span>
        {dir && <span className="truncate text-[10px] text-muted-foreground/50">{dir}</span>}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {showActions && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => e.stopPropagation()}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        )}
        <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
        <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
      </div>
    </div>
  )
}
