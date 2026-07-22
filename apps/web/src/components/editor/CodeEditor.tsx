'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

/**
 * Monaco 编辑器 React 包装(@monaco-editor/react 动态 import 避免 SSR)。
 *
 * 暴露的能力:
 * - 受控 value / onChange(双向绑定)
 * - onSelectionChange(选区变化回调,1-based ISelection)
 * - onMount(editor, monaco)(把 monaco 实例透出给调用方,用于 executeEdits 等命令式操作)
 * - 自动跟随 next-themes 主题(vs-dark / vs)
 * - automaticLayout + minimap 关闭(满足 AGENTS.md §4 compact 约束)
 */

// 类型定义:从 @monaco-editor/react 透出(避免显式 import monaco-editor 类型)
type MonacoEditorInstance = {
  getValue(): string
  setValue(value: string): void
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
  getSelection(): {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
  getModel(): {
    getLanguageId(): string
  } | null
  updateOptions(opts: Record<string, unknown>): void
  getOption<T>(id: number): T
  onDidChangeCursorSelection(
    cb: (e: { selection: MonacoSelection; source: string }) => void,
  ): { dispose(): void }
  focus(): void
  layout(): void
}

type MonacoNamespace = {
  editor: {
    DefineTheme(opts: unknown): void
  }
}

export type MonacoSelection = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export interface CodeEditorProps {
  value: string
  language?: string
  onChange?: (value: string) => void
  onSelectionChange?: (selection: MonacoSelection, selectedText: string) => void
  onMount?: (editor: MonacoEditorInstance, monaco: MonacoNamespace) => void
  fontSize?: number
  className?: string
  /** 只读模式(默认 false) */
  readOnly?: boolean
  /** placeholder(显示在编辑器空白处,Monaco 无原生支持,实现为 overlay) */
  placeholder?: string
}

/** Monaco editor 组件的最小 props 类型(用于类型安全的渲染) */
interface MonacoEditorProps {
  height?: string | number
  language?: string
  value?: string
  theme?: string
  onChange?: (value: string | undefined) => void
  onMount?: (editor: unknown, monaco: unknown) => void
  loading?: React.ReactNode
  options?: Record<string, unknown>
}

/** 异步加载 @monaco-editor/react(SSR 安全) */
async function loadMonacoEditor(): Promise<React.ComponentType<MonacoEditorProps>> {
  const mod = await import('@monaco-editor/react')
  return mod.default as React.ComponentType<MonacoEditorProps>
}

const MonacoEditor = dynamic(loadMonacoEditor, {
  ssr: false,
  loading: () => <div className="p-2 text-xs text-muted-foreground">Loading editor...</div>,
})

export function CodeEditor({
  value,
  language = 'plaintext',
  onChange,
  onSelectionChange,
  onMount,
  fontSize = 14,
  className,
  readOnly = false,
  placeholder,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'dark' ? 'vs-dark' : 'vs'
  const editorRef = React.useRef<MonacoEditorInstance | null>(null)

  const handleMount = React.useCallback(
    (editor: unknown, monaco: unknown) => {
      const e = editor as MonacoEditorInstance
      editorRef.current = e
      // 选区变化:上报给调用方
      e.onDidChangeCursorSelection((ev) => {
        if (!onSelectionChange) return
        const sel = ev.selection
        const model = e.getModel()
        if (!model) return
        const lines = (e.getValue() || '').split('\n')
        // 精确截取选中文本(单行/多行均正确处理 column 边界)
        let selectedText: string
        if (sel.startLineNumber === sel.endLineNumber) {
          const line = lines[sel.startLineNumber - 1] ?? ''
          selectedText = line.slice(sel.startColumn - 1, sel.endColumn - 1)
        } else {
          const firstLine = (lines[sel.startLineNumber - 1] ?? '').slice(sel.startColumn - 1)
          const middleLines = lines.slice(sel.startLineNumber, sel.endLineNumber - 1)
          const lastLine = (lines[sel.endLineNumber - 1] ?? '').slice(0, sel.endColumn - 1)
          selectedText = [firstLine, ...middleLines, lastLine].join('\n')
        }
        onSelectionChange(sel, selectedText)
      })
      if (onMount) onMount(e, monaco as MonacoNamespace)
    },
    [onMount, onSelectionChange],
  )

  // 同步外部 fontSize / readOnly 变化
  React.useEffect(() => {
    const e = editorRef.current
    if (!e) return
    e.updateOptions({ fontSize, readOnly })
  }, [fontSize, readOnly])

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <MonacoEditor
        height="100%"
        language={language}
        value={value}
        theme={theme}
        onChange={(v) => onChange?.(v ?? '')}
        onMount={handleMount}
        loading={<div className="p-2 text-xs text-muted-foreground">Loading editor...</div>}
        options={{
          fontSize,
          readOnly,
          minimap: { enabled: false },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          roundedLineSelection: false,
          padding: { top: 8, bottom: 8 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontLigatures: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
        }}
      />
      {placeholder && !value && (
        <div className="pointer-events-none absolute left-3 top-2 z-10 text-sm text-muted-foreground/60">
          {placeholder}
        </div>
      )}
    </div>
  )
}
