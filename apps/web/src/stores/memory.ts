// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from '@/stores/persist-helpers'

/**
 * Typed Memory 记忆库(W25,2026-09-14 立,对标 Qoder/CodeBuddy):
 * - 四类记忆:rule(规则)/ fact(事实)/ preference(偏好)/ project(项目)
 * - zustand persist 本地持久化(localStorage key: ihui-memory)
 * - memoryToYaml() 把条目序列化为分组 YAML,供:
 *   1) 发送消息时 #Rule token 展开(send-message.ts expandRuleToken)
 *   2) MemoryCards UI 复制 / 导出
 * - YAML 仅含 value 安全字符:多行内容以 |- 块标量呈现
 */

export type MemoryCategory = 'rule' | 'fact' | 'preference' | 'project'

export const MEMORY_CATEGORIES: MemoryCategory[] = ['rule', 'fact', 'preference', 'project']

export interface MemoryEntry {
  id: string
  category: MemoryCategory
  content: string
  createdAt: number
  updatedAt: number
}

interface MemoryState {
  entries: MemoryEntry[]
  add: (category: MemoryCategory, content: string) => void
  remove: (id: string) => void
  clear: () => void
}

function genMemoryId(): string {
  return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set) => ({
      entries: [],
      add: (category, content) =>
        set((s) => {
          const trimmed = content.trim()
          if (!trimmed) return s
          const now = Date.now()
          const entry: MemoryEntry = {
            id: genMemoryId(),
            category,
            content: trimmed,
            createdAt: now,
            updatedAt: now,
          }
          return { entries: [...s.entries, entry] }
        }),
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    createPersistConfig<MemoryState>('ihui-memory'),
  ),
)

/** YAML 单行转义:含特殊字符时用双引号包裹 */
function yamlScalar(value: string): string {
  if (/[:#\-{}[\],&*?|>'"%@`\n]/.test(value)) {
    return JSON.stringify(value)
  }
  return value
}

/**
 * 把记忆条目序列化为分组 YAML:
 * rules:\n  - "…"\nfacts:\n  - |- 多行…
 * 空类目不输出。多行内容使用块标量 |-,逐行缩进两格。
 */
export function memoryToYaml(entries: MemoryEntry[]): string {
  const lines: string[] = []
  const groups: Array<{ key: string; category: MemoryCategory }> = [
    { key: 'rules', category: 'rule' },
    { key: 'facts', category: 'fact' },
    { key: 'preferences', category: 'preference' },
    { key: 'project', category: 'project' },
  ]
  for (const g of groups) {
    const items = entries.filter((e) => e.category === g.category)
    if (items.length === 0) continue
    lines.push(`${g.key}:`)
    for (const item of items) {
      if (item.content.includes('\n')) {
        lines.push('  |-')
        for (const row of item.content.split('\n')) {
          lines.push(`  ${row}`)
        }
      } else {
        lines.push(`  - ${yamlScalar(item.content)}`)
      }
    }
  }
  return lines.join('\n')
}

/**
 * #Rule token 展开(W25):发送前把正文中的 #Rule 替换为规则 YAML 内联块。
 * 无规则条目时原样返回,不展开(避免空块污染上下文)。
 */
export function expandRuleToken(text: string): string {
  if (!text.includes('#Rule')) return text
  const rules = useMemoryStore.getState().entries.filter((e) => e.category === 'rule')
  if (rules.length === 0) return text
  const yaml = memoryToYaml(rules)
  return text.replace(/#Rule\b/g, `\n<user_rules>\n${yaml}\n</user_rules>\n`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
