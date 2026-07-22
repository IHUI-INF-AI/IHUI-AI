'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { EditorEmptyState } from './editor-empty-state'
import { EditorTabBar } from './editor-tab-bar'
import { CodeEditor, type MonacoSelection } from '@/components/editor/CodeEditor'
import { InlineEditDialog } from '@/components/ai/inline-edit-dialog'
import { useInlineEdit } from '@/hooks/use-inline-edit'
import { useInlineEditStore, type InlineEditSelection } from '@/stores/inline-edit'
import { ChevronRight, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const LANG_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript React',
  js: 'JavaScript',
  jsx: 'JavaScript React',
  json: 'JSON',
  css: 'CSS',
  html: 'HTML',
  md: 'Markdown',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  sh: 'Shell',
  yml: 'YAML',
  yaml: 'YAML',
  text: 'Plain Text',
}

const DEFAULT_FONT_SIZE = 14
const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 24

/** Monaco editor 实例的最小类型(仅用到的子集) */
interface MonacoEditorLike {
  executeEdits(
    source: string,
    edits: Array<{
      range: {
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
      }
      text: string | null
      forceMoveMarkers?: boolean
    }>,
  ): boolean
  focus(): void
}

export function CodeEditorPane() {
  const { openTabs, activeTabId } = useIDEWorkspace()
  const t = useTranslations('ide')
  const activeTab = openTabs.find((tab) => tab.id === activeTabId)
  // tab 内容为空字符串表示正在异步加载
  const isLoadingContent = Boolean(activeTab && activeTab.content === '')
  const [fontSize, setFontSize] = React.useState(DEFAULT_FONT_SIZE)

  // 最新选区 ref(供 'global-shortcut:inline-edit' 事件读取)
  const selectionRef = React.useRef<{
    selection: MonacoSelection
    selectedText: string
  } | null>(null)
  const editorRef = React.useRef<MonacoEditorLike | null>(null)
  const tabIdRef = React.useRef<string | null>(null)

  const { openInlineEdit } = useInlineEdit()
  const registerApplyPatchCallback = useInlineEditStore((s) => s.registerApplyPatchCallback)

  /** 更新 tab content 到 IDE workspace store(标记 isDirty) */
  const updateTabContent = React.useCallback(
    (tabId: string, content: string) => {
      useIDEWorkspace.setState((s) => ({
        openTabs: s.openTabs.map((tab) =>
          tab.id === tabId ? { ...tab, content, isDirty: true } : tab,
        ),
      }))
    },
    [],
  )

  /** onMount:缓存 editor 实例 + 注册 applyPatch callback */
  const handleEditorMount = React.useCallback(
    (editor: MonacoEditorLike) => {
      editorRef.current = editor
      // 注册 patch 应用回调:用 executeEdits 替换选区文本
      registerApplyPatchCallback((patch, sel) => {
        const e = editorRef.current
        if (!e) return
        e.executeEdits('inline-edit', [
          {
            range: {
              startLineNumber: sel.startLineNumber,
              startColumn: sel.startColumn,
              endLineNumber: sel.endLineNumber,
              endColumn: sel.endColumn,
            },
            text: patch,
            forceMoveMarkers: true,
          },
        ])
        e.focus()
      })
    },
    [registerApplyPatchCallback],
  )

  /** onSelectionChange:缓存选区到 ref */
  const handleSelectionChange = React.useCallback(
    (selection: MonacoSelection, selectedText: string) => {
      selectionRef.current = { selection, selectedText }
    },
    [],
  )

  // 切换 tab 时重置选区缓存 + 同步 tabIdRef
  React.useEffect(() => {
    tabIdRef.current = activeTabId ?? null
    selectionRef.current = null
  }, [activeTabId])

  // 监听 'global-shortcut:inline-edit' 事件 → 弹 InlineEditDialog
  React.useEffect(() => {
    const handler = () => {
      const tabId = tabIdRef.current
      const cached = selectionRef.current
      if (!tabId || !activeTab) return
      // 选区为空时:不允许 inline edit(避免误触)
      if (!cached || !cached.selectedText) return
      const sel: InlineEditSelection = {
        tabId,
        filePath: activeTab.path,
        language: activeTab.language,
        startLineNumber: cached.selection.startLineNumber,
        startColumn: cached.selection.startColumn,
        endLineNumber: cached.selection.endLineNumber,
        endColumn: cached.selection.endColumn,
        selectedText: cached.selectedText,
      }
      openInlineEdit(sel)
    }
    window.addEventListener('global-shortcut:inline-edit', handler)
    return () => window.removeEventListener('global-shortcut:inline-edit', handler)
  }, [activeTab, openInlineEdit])

  // 卸载时注销 applyPatch callback(防止悬空调用)
  React.useEffect(() => {
    return () => {
      registerApplyPatchCallback(null)
    }
  }, [registerApplyPatchCallback])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <EditorTabBar />
      {activeTab ? (
        <>
          {/* 面包屑 + 语言指示器 */}
          <div className="flex h-7 shrink-0 items-center gap-1 px-3 text-xs text-muted-foreground">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {activeTab.path
                .split('/')
                .filter(Boolean)
                .map((seg, i, arr) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                    <span
                      className={cn(
                        i === arr.length - 1 ? 'min-w-0 truncate text-foreground' : 'shrink-0',
                      )}
                    >
                      {seg}
                    </span>
                  </React.Fragment>
                ))}
            </div>
            <span className="shrink-0 text-muted-foreground/70">
              {LANG_LABELS[activeTab.language] ?? activeTab.language}
            </span>
          </div>

          {/* 编辑器主体:Monaco + InlineEditDialog 浮层 + 字号控制 */}
          <div className="relative flex flex-1 overflow-hidden">
            {isLoadingContent ? (
              <div className="flex h-full flex-1 items-center justify-center text-xs text-muted-foreground">...</div>
            ) : (
              <CodeEditor
                value={activeTab.content}
                language={activeTab.language}
                fontSize={fontSize}
                onChange={(v) => updateTabContent(activeTab.id, v)}
                onSelectionChange={handleSelectionChange}
                onMount={handleEditorMount}
                className="flex-1"
              />
            )}

            {/* InlineEditDialog 浮在编辑器顶部居中 */}
            <InlineEditDialog />

            {/* 字号控制:- / 当前 / + */}
            {!isLoadingContent && (
              <div className="absolute bottom-2 right-3 z-10 flex items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm">
                <button
                  onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 1))}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t('codeEditor.zoomOut')}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="min-w-[2ch] text-center text-xs tabular-nums text-muted-foreground">
                  {fontSize}
                </span>
                <button
                  onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 1))}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t('codeEditor.zoomIn')}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <EditorEmptyState />
      )}
    </div>
  )
}
