'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Code2,
  FileSearch,
  GitBranch,
  Settings,
  Keyboard,
  ChevronRight,
} from 'lucide-react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { getFileColor, getFileIcon } from './file-icons'
import { cn } from '@/lib/utils'
import type { FileNode } from '@ihui/types'

const SHORTCUTS = [
  { keys: ['Ctrl', 'P'], labelKey: 'editorEmpty.scOpenFile' },
  { keys: ['Ctrl', 'Shift', 'F'], labelKey: 'editorEmpty.scGlobalSearch' },
  { keys: ['Ctrl', 'B'], labelKey: 'editorEmpty.scToggleSidebar' },
  { keys: ['Ctrl', '`'], labelKey: 'editorEmpty.scToggleTerminal' },
  { keys: ['Ctrl', 'G'], labelKey: 'editorEmpty.scGotoLine' },
] as const

interface RecentFile {
  id: string
  name: string
  path: string
}

const QUICK_ACTIONS = [
  { icon: FileSearch, labelKey: 'editorEmpty.browseFiles', view: 'files' as const },
  { icon: GitBranch, labelKey: 'editorEmpty.viewChanges', view: 'source-control' as const },
  { icon: Settings, labelKey: 'editorEmpty.settings', view: 'applications' as const },
]

export function EditorEmptyState() {
  const { setActiveView, openFile, fileTree, openTabs } = useIDEWorkspace()
  const t = useTranslations('ide')

  // 最近打开的文件:openTabs 优先,不足时从文件树补齐(最多 5 项)
  const recentFiles = React.useMemo<RecentFile[]>(() => {
    const collected: RecentFile[] = []
    const seen = new Set<string>()
    openTabs.forEach((tab) => {
      if (!seen.has(tab.fileId)) {
        seen.add(tab.fileId)
        collected.push({ id: tab.fileId, name: tab.filename, path: tab.path })
      }
    })
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (collected.length >= 5) return
        if (n.type === 'file' && !seen.has(n.id)) {
          seen.add(n.id)
          collected.push({ id: n.id, name: n.name, path: n.path })
        }
        if (n.children) walk(n.children)
      }
    }
    walk(fileTree)
    return collected.slice(0, 5)
  }, [openTabs, fileTree])

  const handleOpen = (fileId: string) => {
    const find = (nodes: FileNode[]): FileNode | undefined => {
      for (const n of nodes) {
        if (n.id === fileId) return n
        if (n.children) {
          const r = find(n.children)
          if (r) return r
        }
      }
      return undefined
    }
    const found = find(fileTree)
    if (found) openFile(found)
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/10 p-8">
      <div className="flex w-full max-w-2xl gap-8">
        {/* 左侧:品牌标识 + 引导 + 快捷操作 */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-muted/60 to-muted/20 p-5">
            <Code2 className="h-14 w-14 text-muted-foreground/70" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{t('editorEmpty.title')}</p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              {t('editorEmpty.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            {QUICK_ACTIONS.map((item) => (
              <button
                key={item.labelKey}
                onClick={() => setActiveView(item.view)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧:最近打开文件 + 快捷键提示 */}
        <div className="flex w-72 flex-col gap-4">
          {recentFiles.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('editorEmpty.recentFiles')}</p>
              <div className="flex flex-col gap-0.5">
                {recentFiles.map((file) => {
                  const Icon = getFileIcon(file.name)
                  return (
                    <button
                      key={file.id}
                      onClick={() => handleOpen(file.id)}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', getFileColor(file.name))} />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" />
              <span>{t('editorEmpty.shortcuts')}</span>
            </p>
            <div className="flex flex-col gap-1.5">
              {SHORTCUTS.map((s) => (
                <div key={s.labelKey} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/80">{t(s.labelKey)}</span>
                  <div className="flex items-center gap-0.5">
                    {s.keys.map((k, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-muted-foreground/50">+</span>}
                        <kbd className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {k}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
