// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { FileText, FilePen, Edit3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { computeFileChanges } from '@ihui/shared/chat'
import type { ToolCall } from '@/stores/chat'
import { useIDEWorkspace, EXT_LANG } from '@/stores/ide-workspace'
import type { FileNode } from '@ihui/types'
import { cn } from '@/lib/utils'
import { StreamDelta } from '@/components/chat/stream/stream-ui'

/** 路径键统一成正斜杠,保证 computeFileChanges 与工具入参两边能对上 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').trim()
}

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
  /** 文件动作(chat.turnChanges.* 键后缀);读引用无动作词 */
  action: 'changedFile' | 'createdFile' | 'deletedFile' | null
}

/** 工具码名 → 本地化动作词键后缀(与"本轮变更"卡同一口径,单一来源在 chat.turnChanges.*) */
function fileAction(toolName: string): 'changedFile' | 'createdFile' | 'deletedFile' | null {
  if (
    FILE_REF_TOOLS.has(toolName) &&
    !WRITE_PEN_TOOLS.has(toolName) &&
    !EDIT_PEN_TOOLS.has(toolName)
  )
    return null
  if (toolName === 'create_file') return 'createdFile'
  if (toolName === 'delete_file') return 'deletedFile'
  return 'changedFile'
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
    out.push({ path: p, name: basename(p), icon, action: fileAction(tc.toolName) })
  }
  return out
}

export interface MessageFileChipsProps {
  toolCalls: ToolCall[] | undefined
}

export function MessageFileChips({ toolCalls }: MessageFileChipsProps) {
  const t = useTranslations('chat')
  // 文件动作词与"本轮变更"卡同一口径(chat.turnChanges.*),不再各自拼中文
  const actionText: Record<NonNullable<FileRef['action']>, string> = {
    changedFile: t('turnChanges.changedFile'),
    createdFile: t('turnChanges.createdFile'),
    deletedFile: t('turnChanges.deletedFile'),
  }
  const refs = React.useMemo(() => extractRefs(toolCalls), [toolCalls])
  // ±行数由 @ihui/shared/chat 统一计算(与"本轮变更"卡同一口径,端内不再数第二遍)
  const deltas = React.useMemo(() => {
    const map = new Map<string, { added: number; removed: number }>()
    for (const change of computeFileChanges(toolCalls)) {
      map.set(normalizePath(change.path), { added: change.added, removed: change.removed })
    }
    return map
  }, [toolCalls])

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
        const delta = deltas.get(normalizePath(ref.path))
        return (
          <button
            key={ref.path}
            type="button"
            onClick={() => handleOpen(ref)}
            aria-label={ref.action ? `${actionText[ref.action]} ${ref.path}` : ref.path}
            data-testid={`file-chip-${ref.name}`}
            className={cn(
              // 圆角/内距与 StreamTag 同档(rounded-sm + px-1 py-px + 11px + leading-none)
              'inline-flex max-w-full items-center gap-1 rounded-sm border border-border/60 px-1 py-px',
              'text-[11px] leading-none transition-colors hover:bg-muted/60',
            )}
          >
            <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate font-mono text-foreground/80">{ref.name}</span>
            <StreamDelta added={delta?.added ?? -1} removed={delta?.removed ?? -1} />
          </button>
        )
      })}
    </div>
  )
}

export default MessageFileChips
