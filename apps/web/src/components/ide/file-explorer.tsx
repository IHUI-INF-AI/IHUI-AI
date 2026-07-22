'use client'
import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { FileTreeNode } from './file-tree-node'
import { getFileIcon, getFileColor } from './file-icons'
import { cn } from '@/lib/utils'
import {
  Search, FilePlus, RefreshCw,
  FunctionSquare, Box, Variable, Type,
  GitCommit, FileEdit, Save, ChevronRight,
} from 'lucide-react'
import type { FileNode, OutlineNode, TimelineEntry } from '@ihui/types'

type SubTab = 'files' | 'outline' | 'timeline'

/** mock 大纲数据(占位,待接入 codebase LSP 解析) */
const MOCK_OUTLINE: OutlineNode[] = []

/** mock 时间线数据(占位,待接入 git log / file history) */
const MOCK_TIMELINE: TimelineEntry[] = []

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

export function FileExplorer() {
  const t = useTranslations('ide')
  const locale = useLocale()
  const { fileTree, activeView, openFile, selectFile, loading, error, workspacePath, fetchFileTree } = useIDEWorkspace()
  const [subTab, setSubTab] = React.useState<SubTab>('files')
  const [search, setSearch] = React.useState('')

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

  const matched = search ? flattenFiles(fileTree, search) : []
  const tabLabel = (tab: SubTab) =>
    tab === 'files' ? t('fileExplorer.tabFiles') : tab === 'outline' ? t('fileExplorer.tabOutline') : t('fileExplorer.tabTimeline')

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
          <button className="rounded p-1 text-muted-foreground hover:bg-muted/50" title={t('fileExplorer.newFile')}>
            <FilePlus className="h-3.5 w-3.5" />
          </button>
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
        {subTab === 'files' && (
          search ? (
            matched.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t('fileExplorer.noMatch')}</div>
            ) : matched.map((node) => {
              const Icon = getFileIcon(node.name)
              return (
                <div
                  key={node.id}
                  onClick={() => { selectFile(node.id); openFile(node) }}
                  className="flex cursor-pointer items-center gap-1 rounded-sm px-2 py-0.5 text-xs hover:bg-muted/50"
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', getFileColor(node.name))} />
                  <span className="truncate">{highlightMatch(node.name, search)}</span>
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

        {subTab === 'outline' && (MOCK_OUTLINE.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t('fileExplorer.noMatch')}</div>
        ) : MOCK_OUTLINE.map((item) => {
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

        {subTab === 'timeline' && (MOCK_TIMELINE.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t('fileExplorer.noMatch')}</div>
        ) : MOCK_TIMELINE.map((item) => {
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
    </div>
  )
}
