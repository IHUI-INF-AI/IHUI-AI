'use client'
import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { FileTreeNode } from './file-tree-node'
import { getFileIcon, getFileColor } from './file-icons'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { toast } from '@/components/common/Toaster'
import { runCommand } from '@ihui/api-client'
import {
  Search, FilePlus, FolderPlus, RefreshCw, Pencil, Trash2,
  FunctionSquare, Box, Variable, Type,
  GitCommit, FileEdit, Save, ChevronRight,
} from 'lucide-react'
import type { FileNode, OutlineNode, TimelineEntry } from '@ihui/types'

type SubTab = 'files' | 'outline' | 'timeline'

/** 大纲数据占位(待接入 /api/symbols 或 codebase LSP 解析后替换为 useQuery 结果) */
const EMPTY_OUTLINE: OutlineNode[] = []

/** 时间线数据占位(待接入 /api/file-history 或 git log API 后替换为 useQuery 结果) */
const EMPTY_TIMELINE: TimelineEntry[] = []

const OUTLINE_ICON: Record<string, typeof FunctionSquare> = {
  function: FunctionSquare,
  method: FunctionSquare,
  class: Box,
  variable: Variable,
  interface: Type,
  type: Type,
}

const TIMELINE_ICON: Record<string, typeof GitCommit> = {
  edit: FileEdit,
  save: Save,
  commit: GitCommit,
}

const TIMELINE_COLOR: Record<string, string> = {
  edit: 'text-blue-500',
  save: 'text-green-500',
  commit: 'text-purple-500',
}

function flattenFiles(nodes: FileNode[], term: string): FileNode[] {
  const out: FileNode[] = []
  const lower = term.toLowerCase()
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (n.type === 'file' && n.name.toLowerCase().includes(lower)) out.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function highlightMatch(name: string, term: string) {
  if (!term) return name
  const idx = name.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return name
  return (
    <>
      {name.slice(0, idx)}
      <span className="rounded-sm bg-yellow-500/30 text-foreground">{name.slice(idx, idx + term.length)}</span>
      {name.slice(idx + term.length)}
    </>
  )
}

/** 计算重命名后的新路径(替换最后一段路径分量) */
function getRenamedPath(oldPath: string, newName: string): string {
  const lastSep = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'))
  return lastSep >= 0 ? `${oldPath.substring(0, lastSep)}/${newName}` : newName
}

export function FileExplorer() {
  const t = useTranslations('ide')
  const locale = useLocale()
  const { fileTree, activeView, openFile, selectFile, loading, error, workspacePath, fetchFileTree } = useIDEWorkspace()
  const [subTab, setSubTab] = React.useState<SubTab>('files')
  const [search, setSearch] = React.useState('')

  // 创建/删除/重命名状态
  const [creating, setCreating] = React.useState<'file' | 'folder' | null>(null)
  const [createName, setCreateName] = React.useState('')
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number; node: FileNode } | null>(null)
  const [renamingNode, setRenamingNode] = React.useState<FileNode | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const [deletingNode, setDeletingNode] = React.useState<FileNode | null>(null)

  const createInputRef = React.useRef<HTMLInputElement>(null)
  const renameInputRef = React.useRef<HTMLInputElement>(null)

  // 右键菜单点击外部/Escape 关闭
  React.useEffect(() => {
    if (!menuPos) return
    const close = () => setMenuPos(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuPos(null) }
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

  const formatTime = (ts: number): string => {
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60000)
    if (m < 1) return t('fileExplorer.justNow')
    if (m < 60) return t('fileExplorer.minutesAgo', { count: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t('fileExplorer.hoursAgo', { count: h })
    return new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' }).format(ts)
  }

  if (activeView !== 'files') return null

  /** 刷新文件树(清除 loadedFolders 以强制重新加载已展开文件夹子项) */
  const refreshTree = async () => {
    useIDEWorkspace.setState({ loadedFolders: new Set<string>() })
    await fetchFileTree()
  }

  const handleCreate = async () => {
    const name = createName.trim()
    if (!name || !workspacePath || !creating) return
    const fullPath = `${workspacePath}/${name}`
    const command = creating === 'file' ? `touch "${fullPath}"` : `mkdir "${fullPath}"`
    try {
      const result = await runCommand({ command, workspacePath, mode: 'workspace-write' })
      if (result.success) {
        toast.success(creating === 'file' ? t('fileExplorer.fileCreated') : t('fileExplorer.folderCreated'))
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
    const newPath = getRenamedPath(renamingNode.path, newName)
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
    const command = deletingNode.type === 'folder'
      ? `rm -rf "${deletingNode.path}"`
      : `rm "${deletingNode.path}"`
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
    tab === 'files' ? t('fileExplorer.tabFiles') : tab === 'outline' ? t('fileExplorer.tabOutline') : t('fileExplorer.tabTimeline')

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
            if (e.key === 'Enter') { e.preventDefault(); void handleCreate() }
            if (e.key === 'Escape') { setCreating(null); setCreateName('') }
          }}
          placeholder={creating === 'file' ? t('fileExplorer.fileNamePlaceholder') : t('fileExplorer.folderNamePlaceholder')}
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
              subTab === tab ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
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
              onClick={() => { setCreating('file'); setCreateName('') }}
              disabled={!workspacePath}
              className="rounded p-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-40"
            >
              <FilePlus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('fileExplorer.newFolder')}>
            <button
              onClick={() => { setCreating('folder'); setCreateName('') }}
              disabled={!workspacePath}
              className="rounded p-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-40"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <button
            onClick={() => void fetchFileTree()}
            className="rounded p-1 text-muted-foreground hover:bg-muted/50"
            title={t('fileExplorer.refresh')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto py-1">
        {subTab === 'files' && workspacePath && renderCreateInput()}

        {subTab === 'files' && (
          search ? (
            matched.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t('fileExplorer.noMatch')}</div>
            ) : matched.map((node) => {
              const Icon = getFileIcon(node.name)
              const isRenaming = renamingNode?.id === node.id
              const isDeleting = deletingNode?.id === node.id
              return (
                <div
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { if (!isRenaming && !isDeleting) { selectFile(node.id); openFile(node) } }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectFile(node.id); openFile(node) } }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenuPos({ x: e.clientX, y: e.clientY, node }) }}
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
                        if (e.key === 'Enter') { e.preventDefault(); void handleRename() }
                        if (e.key === 'Escape') { setRenamingNode(null) }
                      }}
                      className="w-full rounded-sm border border-border bg-background px-1 text-xs focus:outline-none"
                    />
                  ) : isDeleting ? (
                    <div className="flex flex-1 items-center gap-1">
                      <span className="truncate text-red-500">{t('fileExplorer.confirmDelete')}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete() }}
                        className="rounded-sm bg-red-500 px-1.5 py-0.5 text-xs text-white hover:bg-red-600"
                      >{t('fileExplorer.confirm')}</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingNode(null) }}
                        className="rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                      >{t('fileExplorer.cancel')}</button>
                    </div>
                  ) : (
                    <span className="truncate">{highlightMatch(node.name, search)}</span>
                  )}
                </div>
              )
            })
          ) : !workspacePath ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t('editorEmpty.subtitle')}</div>
          ) : loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">...</div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-red-500">{error}</div>
          ) : fileTree.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t('fileExplorer.noMatch')}</div>
          ) : (
            fileTree.map((node) => (
              <FileTreeNode key={node.id} node={node} depth={0} />
            ))
          )
        )}

        {subTab === 'outline' && (EMPTY_OUTLINE.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t('fileExplorer.noMatch')}</div>
        ) : EMPTY_OUTLINE.map((item) => {
          const OIcon = OUTLINE_ICON[item.type] ?? FunctionSquare
          return (
            <div key={item.id}>
              <div
                className="flex cursor-pointer items-center gap-1 rounded-sm px-2 py-0.5 text-xs hover:bg-muted/50"
                style={{ paddingLeft: 12 }}
              >
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <OIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                <span className="truncate">{item.label}</span>
                <span className="ml-auto text-muted-foreground">{item.line}</span>
              </div>
              {item.children?.map((c) => {
                const CIcon = OUTLINE_ICON[c.type] ?? Variable
                return (
                  <div
                    key={c.id}
                    className="flex cursor-pointer items-center gap-1 rounded-sm px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/50"
                    style={{ paddingLeft: 28 }}
                  >
                    <CIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.label}</span>
                    <span className="ml-auto">{c.line}</span>
                  </div>
                )
              })}
            </div>
          )
        }))}

        {subTab === 'timeline' && (EMPTY_TIMELINE.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t('fileExplorer.noMatch')}</div>
        ) : EMPTY_TIMELINE.map((item) => {
          const TIcon = TIMELINE_ICON[item.type] ?? FileEdit
          return (
            <div
              key={item.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-xs hover:bg-muted/50"
            >
              <TIcon className={cn('h-3.5 w-3.5 shrink-0', TIMELINE_COLOR[item.type])} />
              <div className="flex flex-1 flex-col">
                <span className="truncate">{item.label}</span>
                <span className="text-muted-foreground">{item.author} · {formatTime(item.timestamp)}</span>
              </div>
            </div>
          )
        }))}
      </div>

      {/* 右键菜单(重命名/删除) */}
      {menuPos && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 右键菜单弹窗;键盘用户通过 Escape + 菜单项 Enter 提供等价交互
        <div
          className="fixed z-50 min-w-32 rounded-md border border-border bg-popover p-1 text-xs shadow-md"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setRenamingNode(menuPos.node); setRenameValue(menuPos.node.name); setMenuPos(null) }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{t('fileExplorer.rename')}</span>
            </button>
            <button
              onClick={() => { setDeletingNode(menuPos.node); setMenuPos(null) }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-red-500 hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span>{t('fileExplorer.delete')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
