'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'
import type { FileNode } from '@ihui/types'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { runCommand } from '@ihui/api-client'
import { getFileIcon, getFileColor } from './file-icons'
import { ChevronRight, Folder, FolderOpen, FileText, Pencil, Trash2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  searchTerm?: string
}

/** 计算重命名后的新路径(替换最后一段路径分量) */
function getRenamedPath(oldPath: string, newName: string): string {
  const lastSep = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'))
  return lastSep >= 0 ? `${oldPath.substring(0, lastSep)}/${newName}` : newName
}

// 2026-08-02 修复: Bug 2 — Shell 命令注入防御(与 file-explorer.tsx 同源)。
// runCommand 拼接用户输入到 shell 命令(mv/rm -rf),
// 文件名含 shell 元字符会被注入;rm -rf 额外校验路径必须在 workspacePath 子树内。
const SHELL_UNSAFE_CHARS = /["`$;|&\\]/
function validateFileName(name: string): string | null {
  if (!name) return '文件名不能为空'
  if (name.includes('..')) return '文件名不能包含 ..'
  if (SHELL_UNSAFE_CHARS.test(name)) return '文件名包含非法字符'
  return null
}
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}
function isPathInWorkspace(target: string, workspace: string): boolean {
  const t = normalizePath(target)
  const w = normalizePath(workspace)
  if (t === w) return true
  return t.startsWith(`${w}/`)
}

/** 刷新文件树(清除 loadedFolders 强制重新加载已展开文件夹子项) */
function refreshFileTree() {
  useIDEWorkspace.setState({ loadedFolders: new Set<string>() })
  void useIDEWorkspace.getState().fetchFileTree()
}

export function FileTreeNode({ node, depth, searchTerm = '' }: FileTreeNodeProps) {
  const t = useTranslations('ide')
  const { expandedFolders, selectedFileId, toggleFolder, openFile, selectFile, workspacePath } =
    useIDEWorkspace()
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState('')
  const [deleting, setDeleting] = React.useState(false)
  const renameInputRef = React.useRef<HTMLInputElement>(null)
  const isExpanded = node.type === 'folder' && expandedFolders.has(node.id)
  const isSelected = selectedFileId === node.id
  const Icon = node.type === 'folder' ? (isExpanded ? FolderOpen : Folder) : getFileIcon(node.name)

  const handleClick = () => {
    if (renaming || deleting) return
    if (node.type === 'folder') toggleFolder(node.id)
    else {
      selectFile(node.id)
      openFile(node)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (renaming || deleting) return
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

  // 重命名输入框自动聚焦 + 选中文本
  React.useEffect(() => {
    if (renaming) {
      requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
    }
  }, [renaming])

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard?.writeText(node.path)
    } catch {
      /* ignore */
    }
    setMenuPos(null)
  }

  const startRename = () => {
    setRenaming(true)
    setRenameValue(node.name)
    setMenuPos(null)
  }

  const startDelete = () => {
    setDeleting(true)
    setMenuPos(null)
  }

  const handleRename = async () => {
    const newName = renameValue.trim()
    if (!newName || newName === node.name || !workspacePath) {
      setRenaming(false)
      return
    }
    // 2026-08-02 修复: Bug 2 — 校验新文件名,拒绝 shell 元字符
    const err = validateFileName(newName)
    if (err) {
      toast.error(err)
      return
    }
    const newPath = getRenamedPath(node.path, newName)
    if (!isPathInWorkspace(newPath, workspacePath)) {
      toast.error('路径越界')
      return
    }
    try {
      const result = await runCommand({
        command: `mv "${node.path}" "${newPath}"`,
        workspacePath,
        mode: 'workspace-write',
      })
      if (result.success) {
        toast.success(t('fileTreeNode.renamed'))
        setRenaming(false)
        refreshFileTree()
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleDelete = async () => {
    if (!workspacePath) return
    // 2026-08-02 修复: Bug 2 — rm -rf 校验路径必须在 workspacePath 子树内(防穿越越界删除)
    if (!isPathInWorkspace(node.path, workspacePath)) {
      toast.error('路径越界')
      return
    }
    const command = node.type === 'folder' ? `rm -rf "${node.path}"` : `rm "${node.path}"`
    try {
      const result = await runCommand({ command, workspacePath, mode: 'workspace-write' })
      if (result.success) {
        toast.success(t('fileTreeNode.deleted'))
        setDeleting(false)
        refreshFileTree()
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const renderName = () => {
    if (!searchTerm) return <span className="truncate">{node.name}</span>
    const idx = node.name.toLowerCase().indexOf(searchTerm.toLowerCase())
    if (idx === -1) return <span className="truncate">{node.name}</span>
    return (
      <span className="truncate">
        {node.name.slice(0, idx)}
        <span className="rounded-sm bg-yellow-500/30 text-foreground">
          {node.name.slice(idx, idx + searchTerm.length)}
        </span>
        {node.name.slice(idx + searchTerm.length)}
      </span>
    )
  }

  const menuItems = [
    {
      labelKey: 'fileTreeNode.open',
      icon: FileText,
      action: () => {
        if (node.type === 'file') {
          selectFile(node.id)
          openFile(node)
        }
      },
    },
    { labelKey: 'fileTreeNode.rename', icon: Pencil, action: startRename },
    { labelKey: 'fileTreeNode.delete', icon: Trash2, action: startDelete },
    { labelKey: 'fileTreeNode.copyPath', icon: Copy, action: handleCopyPath },
  ]

  return (
    <div
      draggable={node.type === 'folder'}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', node.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (node.type === 'folder') {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        onContextMenu={handleContextMenu}
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded-sm py-0.5 pr-2 text-xs transition-colors',
          isSelected ? 'bg-muted text-foreground' : 'hover:bg-muted/50',
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {node.type === 'folder' ? (
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon
          className={cn('h-3.5 w-3.5 shrink-0', node.type === 'file' && getFileColor(node.name))}
        />
        {renaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleRename()
              }
              if (e.key === 'Escape') {
                setRenaming(false)
              }
            }}
            className="w-full rounded-sm border border-border bg-background px-1 text-xs focus:outline-none"
          />
        ) : deleting ? (
          <div className="flex flex-1 items-center gap-1">
            <span className="truncate text-red-500">{t('fileTreeNode.confirmDelete')}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleDelete()
              }}
              className="rounded-sm bg-red-500 px-1.5 py-0.5 text-xs text-white hover:bg-red-600"
            >
              {t('fileTreeNode.confirm')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(false)
              }}
              className="rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              {t('fileTreeNode.cancel')}
            </button>
          </div>
        ) : (
          renderName()
        )}
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
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 右键菜单遮罩点击外部关闭;键盘用户通过 Escape/菜单项提供等价交互
        <div
          className="fixed z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-xs shadow-md"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuItems.map((item) => (
            <button
              key={item.labelKey}
              onClick={() => {
                item.action()
                setMenuPos(null)
              }}
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
