// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Bot } from 'lucide-react'
import { isTauri } from '@/lib/tauri-bridge'
import { useAiPanelStore } from '@/stores/ai-panel'
import { loadBrowserWorkspaceContextByName } from '@/hooks/use-chat/workspace'
import { logger } from '@/lib/logger'
import type { ReferenceItem } from '@/hooks/use-message-references'

/** agent 规则文件名(与 workspace-context-loader 的 AGENT_FILE_NAMES 保持一致) */
const AGENT_FILE_NAMES = new Set(['AGENTS.md', 'CLAUDE.md', 'agent.md', 'claude.md'])

/** agent 参考块 id 前缀(用于区分普通引用,支持单独移除) */
export const AGENT_REF_PREFIX = 'agent-ref:'

/**
 * 从 context 文本中提取所有 agent 规则文件(任意目录层级)。
 * 格式:### path\n```\ncontent\n```
 */
function extractAgentFiles(text: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = []
  const regex = /### (.+)\n```\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const path = match[1]?.trim()
    const content = match[2]?.trim()
    if (!path || !content) continue
    const baseName = path.slice(path.lastIndexOf('/') + 1)
    if (AGENT_FILE_NAMES.has(baseName)) {
      results.push({ path, content })
    }
  }
  return results
}

/**
 * 强制加载工作区所有 agent 规则文件(AGENTS.md/CLAUDE.md 等,任意目录层级)
 * 作为参考块展示(2026-08-29)。
 *
 * - 订阅 activeWorkspace 变化,切换工作区自动重新加载
 * - 复用 use-chat/workspace 的缓存(带 agent 文件签名校验,变更自动重索引)
 * - 仅用于展示:内容注入走 workspaceContext(system prompt),
 *   不参与 useMessageSend 的 references(doSend 会把 references 附加到消息正文)
 * - 无文件或读取失败时返回空数组(不显示参考块)
 */
export function useAgentMdReference(): ReferenceItem[] {
  const [refs, setRefs] = React.useState<ReferenceItem[]>([])
  // 订阅 activeWorkspace(切换/解绑工作区时重新加载)
  const workspaceName = useAiPanelStore((s) => s.activeWorkspace?.name)

  React.useEffect(() => {
    if (isTauri() || !workspaceName) {
      setRefs([])
      return
    }

    let cancelled = false
    loadBrowserWorkspaceContextByName(workspaceName)
      .then((text) => {
        if (cancelled) return
        if (!text) {
          setRefs([])
          return
        }
        const agentFiles = extractAgentFiles(text)
        setRefs(
          agentFiles.map((f) => {
            const preview = f.content.length > 120 ? `${f.content.slice(0, 120)}...` : f.content
            return {
              // 路径作为 id 的一部分,保证跨工作区唯一且切换后可正确刷新
              id: `${AGENT_REF_PREFIX}${workspaceName}/${f.path}`,
              type: 'text' as const,
              label: f.path,
              preview,
              icon: Bot,
              iconColor: 'text-blue-500',
            }
          }),
        )
      })
      .catch((err) => {
        if (!cancelled) setRefs([])
        logger.warn('[agent-md-ref] load failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceName])

  return refs
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
