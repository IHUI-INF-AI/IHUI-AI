// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:file-explorer.tsx(596 行)拆为文件夹结构。
// 主组件保留组合角色:SubTab 切换 + files 子面板(搜索/创建/重命名/删除流),
// Outline/Timeline 子面板与右键菜单已抽为独立子组件。
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { FileTreeNode } from './FileTreeNode'
import { OutlineTab } from './OutlineTab'
import { TimelineTab } from './TimelineTab'
import { FileContextMenu } from './FileContextMenu'
import { getFileIcon, getFileColor } from '../file-icons'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { toast } from '@/components/common/Toaster'
import { runCommand } from '@ihui/api-client'
import { Search, FilePlus, FolderPlus, RefreshCw } from 'lucide-react'
import type { FileNode } from '@ihui/types'
import { flattenFiles, getRenamedPath, isPathInWorkspace, validateFileName } from './model'

type SubTab = 'files' | 'outline' | 'timeline'

/** 搜索结果文件名高亮匹配片段 */
function highlightMatch(name: string, term: string) {
  if (!term) return name
  const idx = name.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return name
  return (
    <>
      {name.slice(0, idx)}
      <span className="rounded-sm bg-yellow-500/30 text-foreground">
        {name.slice(idx, idx + term.length)}
      </span>
      {name.slice(idx + term.length)}
    </>
  )
}

export function FileExplorer() {
  const t = useTranslations('ide')
  const {
    fileTree,
    activeView,
    openFile,
    selectFile,
    loading,
    error,
    workspacePath,
    fetchFileTree,
    openTabs,
    activeTabId,
  } = useIDEWorkspace()
  const [subTab, setSubTab] = React.useState<SubTab>('files')
  const [search, setSearch] = React.useState('')

  // 创建/删除/重命名状态
  const [creating, setCreating] = React.useState<'file' | 'folder' | null>(null)
  const [createName, setCreateName] = React.useState('')
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number; node: FileNode } | null>(
    null,
  )
  const [renamingNode, setRenamingNode] = React.useState<FileNode | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const [deletingNode, setDeletingNode] = React.useState<FileNode | null>(null)

  const createInputRef = React.useRef<HTMLInputElement>(null)
  const renameInputRef = React.useRef<HTMLInputElement>(null)

  // 大纲:当前活动编辑器文件内容(OutlineTab 内本地正则解析顶层符号)
  const activeContent = openTabs.find((tab) => tab.id === activeTabId)?.content ?? ''

  // 右键菜单点击外部/Escape 关闭
  React.useEffect(() => {
    if (!menuPos) return
    const close = () => setMenuPos(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuPos(null)
    }
    document.addEventListener('click', close)
    document.addEventListener('contextmenu', close, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('contextmenu', close, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuPos])

  // 创建输入框自动聚焦
  React.useEffect(() => {
    if (creating) createInputRef.current?.focus()
  }, [creating])

  // 重命名输入框自动聚焦 + 选中文本
  React.useEffect(() => {
    if (renamingNode) {
      requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
    }
  }, [renamingNode])

  if (activeView !== 'files') return null

  /** 刷新文件树(清除 loadedFolders 以强制重新加载已展开文件夹子项) */
  const refreshTree = async () => {
    useIDEWorkspace.setState({ loadedFolders: new Set<string>() })
    await fetchFileTree()
  }

  const handleCreate = async () => {
    const name = createName.trim()
    if (!name || !workspacePath || !creating) return
    // 2026-08-02 修复: Bug 2 — 校验文件名,拒绝 shell 元字符
    const err = validateFileName(name)
    if (err) {
      toast.error(err)
      return
    }
    const fullPath = `${workspacePath}/${name}`
    if (!isPathInWorkspace(fullPath, workspacePath)) {
      toast.error('路径越界')
      return
    }
    const command = creating === 'file' ? `touch "${fullPath}"` : `mkdir "${fullPath}"`
    try {
      const result = await runCommand({ command, workspacePath, mode: 'workspace-write' })
      if (result.success) {
        toast.success(
          creating === 'file' ? t('fileExplorer.fileCreated') : t('fileExplorer.folderCreated'),
        )
        setCreating(null)
        setCreateName('')
        await refreshTree()
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleRename = async () => {
    if (!renamingNode || !workspacePath) return
    const newName = renameValue.trim()
    if (!newName || newName === renamingNode.name) {
      setRenamingNode(null)
      return
    }
    // 2026-08-02 修复: Bug 2 — 校验新文件名,拒绝 shell 元字符
    const err = validateFileName(newName)
    if (err) {
      toast.error(err)
      return
    }
    const newPath = getRenamedPath(renamingNode.path, newName)
    if (!isPathInWorkspace(newPath, workspacePath)) {
      toast.error('路径越界')
      return
    }
    try {
      const result = await runCommand({
        command: `mv "${renamingNode.path}" "${newPath}"`,
        workspacePath,
        mode: 'workspace-write',
      })
      if (result.success) {
        toast.success(t('fileExplorer.renamed'))
        setRenamingNode(null)
        await refreshTree()
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleDelete = async () => {
    if (!deletingNode || !workspacePath) return
    // 2026-08-02 修复: Bug 2 — rm -rf 校验路径必须在 workspacePath 子树内(防穿越越界删除)
    if (!isPathInWorkspace(deletingNode.path, workspacePath)) {
      toast.error('路径越界')
      return
    }
    const command =
      deletingNode.type === 'folder' ? `rm -rf "${deletingNode.path}"` : `rm "${deletingNode.path}"`
    try {
      const result = await runCommand({ command, workspacePath, mode: 'workspace-write' })
      if (result.success) {
        toast.success(t('fileExplorer.deleted'))
        setDeletingNode(null)
        await refreshTree()
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const matched = search ? flattenFiles(fileTree, search) : []
  const tabLabel = (tab: SubTab) =>
    tab === 'files'
      ? t('fileExplorer.tabFiles')
      : tab === 'outline'
        ? t('fileExplorer.tabOutline')
        : t('fileExplorer.tabTimeline')

  const renderCreateInput = () => {
    if (!creating) return null
    return (
      <div className="flex items-center gap-1 px-2 py-0.5">
        {creating === 'file' ? (
          <FilePlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <FolderPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <input
          ref={createInputRef}
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleCreate()
            }
            if (e.key === 'Escape') {
              setCreating(null)
              setCreateName('')
            }
          }}
          placeholder={
            creating === 'file'
              ? t('fileExplorer.fileNamePlaceholder')
              : t('fileExplorer.folderNamePlaceholder')
          }
          className="w-full rounded-md border border-border bg-background px-2 py-0.5 text-xs focus:outline-none"
        />
      </div>
    )
  }

  return (
    <div className="flex w-56 shrink-0 flex-col bg-muted/20">
      <div className="flex items-center gap-1 px-2 py-1.5">
        {(['files', 'outline', 'timeline'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={cn(
              'rounded px-2 py-0.5 text-xs transition-colors duration-150',
              subTab === tab
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {subTab === 'files' && (
        <div className="flex items-center gap-1 px-2 pb-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('fileExplorer.searchPlaceholder')}
              className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs focus:outline-none"
            />
          </div>
          <Tooltip content={t('fileExplorer.newFile')}>
            <button
              onClick={() => {
                setCreating('file')
                setCreateName('')
              }}
              disabled={!workspacePath}
              aria-label={t('fileExplorer.newFile')}
              className="rounded p-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-40"
            >
              <FilePlus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('fileExplorer.newFolder')}>
            <button
              onClick={() => {
                setCreating('folder')
                setCreateName('')
              }}
              disabled={!workspacePath}
              aria-label={t('fileExplorer.newFolder')}
              className="rounded p-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-40"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('fileExplorer.refresh')}>
            <button
              onClick={() => void fetchFileTree()}
              aria-label={t('fileExplorer.refresh')}
              className="rounded p-1 text-muted-foreground hover:bg-muted/50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      )}

      <div className="flex-1 overflow-auto py-1">
        {subTab === 'files' && workspacePath && renderCreateInput()}

        {subTab === 'files' &&
          (search ? (
            matched.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t('fileExplorer.noMatch')}
              </div>
            ) : (
              matched.map((node) => {
                const Icon = getFileIcon(node.name)
                const isRenaming = renamingNode?.id === node.id
                const isDeleting = deletingNode?.id === node.id
                return (
                  <div
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!isRenaming && !isDeleting) {
                        selectFile(node.id)
                        openFile(node)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectFile(node.id)
                        openFile(node)
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setMenuPos({ x: e.clientX, y: e.clientY, node })
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-sm px-2 py-0.5 text-xs hover:bg-muted/50"
                  >
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', getFileColor(node.name))} />
                    {isRenaming ? (
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
                            setRenamingNode(null)
                          }
                        }}
                        className="w-full rounded-sm border border-border bg-background px-1 text-xs focus:outline-none"
                      />
                    ) : isDeleting ? (
                      <div className="flex flex-1 items-center gap-1">
                        <span className="truncate text-red-500">
                          {t('fileExplorer.confirmDelete')}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDelete()
                          }}
                          className="rounded-sm bg-red-500 px-1.5 py-0.5 text-xs text-white hover:bg-red-600"
                        >
                          {t('fileExplorer.confirm')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingNode(null)
                          }}
                          className="rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                        >
                          {t('fileExplorer.cancel')}
                        </button>
                      </div>
                    ) : (
                      <span className="truncate">{highlightMatch(node.name, search)}</span>
                    )}
                  </div>
                )
              })
            )
          ) : !workspacePath ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t('editorEmpty.subtitle')}
            </div>
          ) : loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">...</div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-red-500">{error}</div>
          ) : fileTree.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t('fileExplorer.noMatch')}
            </div>
          ) : (
            fileTree.map((node) => <FileTreeNode key={node.id} node={node} depth={0} />)
          ))}

        {subTab === 'outline' && <OutlineTab source={activeContent} />}

        {subTab === 'timeline' && <TimelineTab workspacePath={workspacePath} />}
      </div>

      {/* 右键菜单(重命名/删除) */}
      {menuPos && (
        <FileContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onRename={() => {
            setRenamingNode(menuPos.node)
            setRenameValue(menuPos.node.name)
            setMenuPos(null)
          }}
          onDelete={() => {
            setDeletingNode(menuPos.node)
            setMenuPos(null)
          }}
        />
      )}
    </div>
  )
}
