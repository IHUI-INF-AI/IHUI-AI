// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { AgentStreamEvent } from '@ihui/api-client'
import type { PlanStepStatus, TerminalTask } from '@/hooks/use-agent-progress'
import type { InlineDiffInfo } from '@/components/ai/types'
import { FALLBACK_MODELS } from '@/components/chat/fallback-models'

// 2026-09-09 0-6 组件拆分:MODEL_OPTIONS 由 agent-pane.tsx 收敛进 model(纯数据,无 JSX)
export const MODEL_OPTIONS: ReadonlyArray<{ value: string; labelKey?: string; label?: string }> = [
  { value: '', labelKey: 'agentPane.modelDefault' },
  ...FALLBACK_MODELS.map((m) => ({ value: m.value, label: m.label })),
]

export const CHANGE_TOOL_NAMES = new Set(['edit_file', 'write_file'])

export interface ToolEventData {
  id?: string
  name?: string
  toolName?: string
  args?: Record<string, unknown>
  arguments?: Record<string, unknown>
  result?: unknown
  error?: string
  iteration?: number
}

export function parseToolData(event: AgentStreamEvent): ToolEventData {
  return event as unknown as ToolEventData
}

export interface TerminalEventData {
  id?: string
  command?: string
  status?: string
  output?: string
  exitCode?: number
}

export function parseTerminalData(event: AgentStreamEvent): TerminalEventData {
  return event as unknown as TerminalEventData
}

export interface PlanStepData {
  step: string
  status?: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
}

export interface PlanEventData {
  explanation?: string
  plan?: PlanStepData[]
}

export function parsePlanData(event: AgentStreamEvent): PlanEventData {
  return event as unknown as PlanEventData
}

export function isPlanStepStatus(value: unknown): value is PlanStepStatus {
  return value === 'pending' || value === 'in_progress' || value === 'completed'
}

export function isTerminalStatus(value: unknown): value is TerminalTask['status'] {
  return value === 'running' || value === 'completed' || value === 'failed'
}

export function deriveDiffInfoFromArgs(
  toolName: string,
  args: Record<string, unknown>,
  unknownFileLabel: string,
): InlineDiffInfo | null {
  const pickString = (keys: string[]): string => {
    for (const key of keys) {
      const value = args[key]
      if (typeof value === 'string') return value
    }
    return ''
  }

  const filePath = pickString(['path', 'file_path', 'filePath', 'filename']) || unknownFileLabel

  if (toolName === 'edit_file') {
    const oldContent = pickString(['oldText', 'old_text', 'oldContent', 'old_content'])
    const newContent = pickString(['newText', 'new_text', 'newContent', 'new_content'])
    if (!oldContent && !newContent) return null
    return { file_path: filePath, old_content: oldContent, new_content: newContent }
  }

  if (toolName === 'write_file') {
    const content = pickString(['content', 'fileContent', 'file_content', 'text'])
    if (!content) return null
    return { file_path: filePath, old_content: '', new_content: content, is_new_file: true }
  }

  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
