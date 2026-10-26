// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D07 残余②:web 空态「一键生成 AGENTS.md」数据面(2026-10-24)。
 *
 * 链路:POST /api/tools/init-agents-md → ai-service `init_agents_md` 工具
 * (2026-10-25 改走专属 HTTP 端点,与 /api/tools/* 同族;端点内部仍复用
 * MCP 的 workspace 白名单守卫,web 不直连 MCP 协议)。
 * **只取草稿**:本模块从不传 output_path,后端因此不会落盘;写盘由调用方在
 * 二次显式确认后走浏览器 File System Access 保存链(workspace-file-save.ts)。
 *
 * 文案归属:`ide.agentsMd`(五语词包),本模块只接收调用方传入的兜底错误串。
 */

import { fetchAiServiceJson } from '@ihui/api-client'

export const AGENTS_MD_FILENAME = 'AGENTS.md'

export interface AgentsMdDraftResult {
  ok: boolean
  draft?: string
  error?: string
}

interface InitAgentsMdEnvelope {
  ok?: boolean
  draft?: string
  error?: string
  errorCode?: string
  message?: string
}

/** 三条兜底错误串由调用方的词包提供(ide.agentsMd.error*),本模块不持中文文案。 */
export interface AgentsMdDraftErrorCopy {
  emptyWorkspace: string
  requestFailed: string
  noDraft: string
}

/** 生成草稿(不写盘):失败原因必须回传给 UI,不得静默降级为空草稿。 */
export async function generateAgentsMdDraft(
  workspaceRoot: string,
  copy: AgentsMdDraftErrorCopy,
): Promise<AgentsMdDraftResult> {
  const root = workspaceRoot.trim()
  if (!root) return { ok: false, error: copy.emptyWorkspace }
  const res = await fetchAiServiceJson<InitAgentsMdEnvelope>('/api/tools/init-agents-md', {
    method: 'POST',
    // 刻意不带 output_path:草稿只回传,写盘入口只有一个(人工二次确认)。
    body: JSON.stringify({ workspace_root: root }),
  })
  if (!res.success) return { ok: false, error: res.error ?? copy.requestFailed }
  const data = res.data
  if (!data || data.ok !== true || typeof data.draft !== 'string' || !data.draft.trim()) {
    return {
      ok: false,
      error: data?.message ?? data?.error ?? data?.errorCode ?? copy.noDraft,
    }
  }
  return { ok: true, draft: data.draft }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
