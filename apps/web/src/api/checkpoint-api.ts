// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api'

/**
 * Checkpoint / Rewind 前端 API 客户端(2026-09-03 立,对标 Claude Code checkpoint /rewind)。
 *
 * 服务端契约(apps/ai-service 的 routers/checkpoint_rewind.py,已由后端挂载到 /api):
 *  - GET  /api/checkpoints?session_id=...            → 该会话可回滚的 checkpoint 列表
 *  - POST /api/checkpoints/{checkpoint_id}/restore   body { sessionId, scope }
 *         → 恢复到该 checkpoint(scope: conversation=仅对话 | code=仅文件 | both=对话+文件)
 *           (旧 rollbackFiles 布尔仍被服务端兼容接受)
 *
 * 响应统一用 ApiResult 包装,成功时 data 为对应结构体。
 */

/** 回退范围:仅回滚对话历史 / 仅回滚代码文件 / 两者都回滚 */
export type CheckpointScope = 'conversation' | 'code' | 'both'

/** checkpoint 元数据(列表项,不全量返回消息历史) */
export interface CheckpointMeta {
  checkpoint_id: string
  session_id: string
  iteration: number
  status: string
  created_at: number
  expires_at: number
  message_count: number
  metadata?: Record<string, unknown>
}

/** GET /api/checkpoints 响应 */
export interface CheckpointListResult {
  session_id: string
  total: number
  checkpoints: CheckpointMeta[]
}

/** POST /api/checkpoints/{checkpoint_id}/restore 响应 */
export interface CheckpointRestoreResult {
  checkpoint_id: string
  session_id: string
  iteration: number
  status: string
  restored_message_count: number
  file_changes: number
  file_versions: Array<{ path?: string; version_id?: string }>
  message: string
}

/** 影响预览中单个文件的变更信息 */
export interface CheckpointImpactFile {
  path: string
  oldContent: string
  newContent: string
  added: number
  deleted: number
  contentTruncated?: boolean
}

/** GET /api/checkpoints/{checkpoint_id}/impact 响应(回退前影响预览) */
export interface CheckpointImpactResult {
  checkpoint_id: string
  session_id: string
  scope: CheckpointScope
  restored_message_count: number
  files: CheckpointImpactFile[]
  total: number
  truncated: boolean
}

/** 列出指定会话可回滚的 checkpoint */
export async function listCheckpoints(sessionId: string): Promise<CheckpointListResult> {
  const r = await fetchApi<CheckpointListResult>(
    `/api/checkpoints?session_id=${encodeURIComponent(sessionId)}`,
  )
  if (!r.success) throw new Error(r.error || '加载 checkpoint 失败')
  return r.data
}

/** 恢复到指定 checkpoint(可指定回退范围:对话 / 文件 / 两者) */
export async function restoreCheckpoint(
  checkpointId: string,
  sessionId: string,
  scope: CheckpointScope = 'both',
): Promise<CheckpointRestoreResult> {
  const r = await fetchApi<CheckpointRestoreResult>(
    `/api/checkpoints/${encodeURIComponent(checkpointId)}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, scope }),
    },
  )
  if (!r.success) throw new Error(r.error || '恢复 checkpoint 失败')
  return r.data
}

/** 回退前的影响预览:影响文件清单 + 逐文件 diff 数据。
 *  scope 决定统计范围(conversation=仅对话无文件变更;code/both=含文件回滚)。 */
export async function getCheckpointImpact(
  checkpointId: string,
  sessionId: string,
  scope: CheckpointScope = 'both',
): Promise<CheckpointImpactResult> {
  const r = await fetchApi<CheckpointImpactResult>(
    `/api/checkpoints/${encodeURIComponent(checkpointId)}/impact` +
      `?session_id=${encodeURIComponent(sessionId)}&scope=${encodeURIComponent(scope)}`,
  )
  if (!r.success) throw new Error(r.error || '加载影响预览失败')
  return r.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
