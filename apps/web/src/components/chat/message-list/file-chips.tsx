// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { FileText, FilePen, Edit3 } from 'lucide-react'
import type { ToolCall } from '@/stores/chat'
import { useIDEWorkspace, EXT_LANG } from '@/stores/ide-workspace'
import type { FileNode } from '@ihui/types'
import { cn } from '@/lib/utils'

// 文件引用类工具白名单(读 + 写/改)。口径与 tool-call-card.tsx 对齐:
// DIFF_TOOL_NAMES=['edit_file','write_file'] + MessageItem FILE_MODIFY_TOOLS
// + 任务描述的 read_file/apply_diff/patch/replace_in_file。
const FILE_REF_TOOLS = new Set<string>([
  'read_file',
  'write_file',
  'apply_diff',
  'edit_file',
  'file_edit',
  'create_file',
  'delete_file',
  'patch',
  'replace_in_file',
])

// 写/改类工具(图标区分:读=FileText,写=FilePen,改=Edit3)
const WRITE_PEN_TOOLS = new Set<string>(['write_file', 'create_file', 'delete_file'])
const EDIT_PEN_TOOLS = new Set<string>([
  'edit_file',
  'file_edit',
  'apply_diff',
  'patch',
  'replace_in_file',
])

// args 中可能出现的文件路径字段(兼容 camelCase / snake_case / 单字)
const PATH_ARG_KEYS = ['path', 'file_path', 'filePath', 'file', 'filename']

function pickPath(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  for (const k of PATH_ARG_KEYS) {
    const v = args[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function basename(p: string): string {
  const norm = p.replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx === -1 ? norm : norm.slice(idx + 1)
}

interface FileRef {
  path: string
  name: string
  icon: 'read' | 'write' | 'edit'
}

function extractRefs(toolCalls: ToolCall[] | undefined): FileRef[] {
  const seen = new Set<string>()
  const out: FileRef[] = []
  if (!toolCalls) return out
  for (const tc of toolCalls) {
    if (!FILE_REF_TOOLS.has(tc.toolName)) continue
    const p = pickPath(tc.args)
    if (!p || seen.has(p)) continue
    seen.add(p)
    let icon: FileRef['icon'] = 'read'
    if (EDIT_PEN_TOOLS.has(tc.toolName)) icon = 'edit'
    else if (WRITE_PEN_TOOLS.has(tc.toolName)) icon = 'write'
    out.push({ path: p, name: basename(p), icon })
  }
  return out
}

export interface MessageFileChipsProps {
  toolCalls: ToolCall[] | undefined
}

export function MessageFileChips({ toolCalls }: MessageFileChipsProps) {
  const refs = React.useMemo(() => extractRefs(toolCalls), [toolCalls])

  const handleOpen = React.useCallback((ref: FileRef) => {
    const ide = useIDEWorkspace.getState()
    const ext = ref.name.includes('.') ? (ref.name.split('.').pop() ?? '') : ''
    const file: FileNode = {
      id: ref.path,
      name: ref.name,
      path: ref.path,
      type: 'file',
      language: EXT_LANG[ext] ?? 'text',
    }
    ide.openFile(file)
    ide.setActiveTopTab('editor')
  }, [])

  if (refs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="message-file-chips">
      {refs.map((ref) => {
        const Icon = ref.icon === 'read' ? FileText : ref.icon === 'edit' ? Edit3 : FilePen
        return (
          <button
            key={ref.path}
            type="button"
            onClick={() => handleOpen(ref)}
            aria-label={ref.path}
            data-testid={`file-chip-${ref.name}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-xs',
              'hover:bg-muted/60 transition-colors',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{ref.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export default MessageFileChips
