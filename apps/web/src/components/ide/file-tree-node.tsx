'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { FileNode } from '@ihui/types'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { getFileIcon, getFileColor } from './file-icons'
import { ChevronRight, Folder, FolderOpen, FileText, Pencil, Trash2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  searchTerm?: string
}

export function FileTreeNode({ node, depth, searchTerm = '' }: FileTreeNodeProps) {
  const t = useTranslations('ide')
  const { expandedFolders, selectedFileId, toggleFolder, openFile, selectFile } = useIDEWorkspace()
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null)
  const isExpanded = node.type === 'folder' && expandedFolders.has(node.id)
  const isSelected = selectedFileId === node.id
  const Icon = node.type === 'folder' ? (isExpanded ? FolderOpen : Folder) : getFileIcon(node.name)

  const handleClick = () => {
    if (node.type === 'folder') toggleFolder(node.id)
    else { selectFile(node.id); openFile(node) }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  React.useEffect(() => {
    if (!menuPos) return
    const close = () => setMenuPos(null)
    document.addEventListener('click', close)
    document.addEventListener('contextmenu', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('contextmenu', close, true)
    }
  }, [menuPos])

  const handleCopyPath = async () => {
    try { await navigator.clipboard?.writeText(node.path) } catch { /* ignore */ }
    setMenuPos(null)
  }

  const renderName = () => {
    if (!searchTerm) return <span className="truncate">{node.name}</span>
    const idx = node.name.toLowerCase().indexOf(searchTerm.toLowerCase())
    if (idx === -1) return <span className="truncate">{node.name}</span>
    return (
      <span className="truncate">
        {node.name.slice(0, idx)}
        <span className="rounded-sm bg-yellow-500/30 text-foreground">{node.name.slice(idx, idx + searchTerm.length)}</span>
        {node.name.slice(idx + searchTerm.length)}
      </span>
    )
  }

  const menuItems = [
    { labelKey: 'fileTreeNode.open', icon: FileText, action: () => { if (node.type === 'file') { selectFile(node.id); openFile(node) } } },
    { labelKey: 'fileTreeNode.rename', icon: Pencil, action: () => {} },
    { labelKey: 'fileTreeNode.delete', icon: Trash2, action: () => {} },
    { labelKey: 'fileTreeNode.copyPath', icon: Copy, action: handleCopyPath },
  ]

  return (
    <div
      draggable={node.type === 'folder'}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', node.id); e.dataTransfer.effectAllowed = 'move' }}
      onDragOver={(e) => { if (node.type === 'folder') { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
        onContextMenu={handleContextMenu}
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded-sm py-0.5 pr-2 text-xs transition-colors',
          isSelected ? 'bg-muted text-foreground' : 'hover:bg-muted/50',
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {node.type === 'folder' ? (
          <ChevronRight className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150', isExpanded && 'rotate-90')} />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', node.type === 'file' && getFileColor(node.name))} />
        {renderName()}
      </div>

      {node.type === 'folder' && (
        <div
          style={{
            display: 'grid',
            gridTemplateRows: isExpanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 150ms ease-in-out',
          }}
        >
          <div className="overflow-hidden">
            {node.children?.map((child) => (
              <FileTreeNode key={child.id} node={child} depth={depth + 1} searchTerm={searchTerm} />
            ))}
          </div>
        </div>
      )}

      {menuPos && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-xs shadow-md"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuItems.map((item) => (
            <button
              key={item.labelKey}
              onClick={() => { item.action(); setMenuPos(null) }}
              className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-muted"
            >
              <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
