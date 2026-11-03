// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  getCheckpointImpact,
  listCheckpoints,
  restoreCheckpoint,
  type CheckpointMeta,
  type CheckpointScope,
} from '@/api/checkpoint-api'
import {
  buildUndoSnapshot,
  classifyUndoWorkspace,
  isUndoPartial,
  resolveUndoFailureKey,
  type UndoWorkspaceSnapshot,
} from '@/lib/undo-fact-check'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/components/common'

/**
 * D163:采集工作区快照(以影响预览里"磁盘侧恢复前内容"为指纹源)。
 * 取不到快照(接口失败 / 读失败文件被剔除)返回 null —— 调用方据此落
 * "无法确认",绝不许在没事实的情况下说"工作区未发生变化"。
 */
async function captureImpactSnapshot(
  checkpointId: string,
  sessionId: string,
  scope: CheckpointScope,
): Promise<UndoWorkspaceSnapshot | null> {
  try {
    const impact = await getCheckpointImpact(checkpointId, sessionId, scope)
    return buildUndoSnapshot(
      impact.files
        .filter((f) => !f.readError && !f.snapshotError)
        .map((f) => ({ path: f.path, content: f.oldContent })),
    )
  } catch {
    return null
  }
}

/**
 * Checkpoint / Rewind 撤销面板(独立组件,2026-09-03 立)。
 *
 * 对标 Claude Code `checkpoint /rewind`:让用户列出某个会话的所有可回滚 checkpoint,
 * 并一键恢复到任一点(对话历史 + 迭代数 + tool state,可选文件回滚)。
 *
 * 独立组件、独立命名,不改动既有共享布局/路由;接入方只需传 `sessionId` 放置即可。
 *
 * @param sessionId 会话 id
 * @param scope 恢复时的回退范围:conversation=仅对话 | code=仅文件 | both=对话+文件(默认 conversation)
 */
export default function CheckpointRewindPanel({
  sessionId,
  scope = 'conversation',
}: {
  sessionId: string
  scope?: CheckpointScope
}) {
  const t = useTranslations('aiChat')
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const [checkpoints, setCheckpoints] = useState<CheckpointMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')

  const load = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError('')
    try {
      const data = await listCheckpoints(sessionId)
      setCheckpoints(data.checkpoints)
      setMessage(t('checkpoint.total', { count: data.total }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setCheckpoints([])
      // D163:conversation 面板从不触碰工作区文件,检查点服务不可用 ≠ 文件被动过
      // —— 这一事实成立才允许用基准键("工作区未发生变化");否则透传原始错误。
      if (scope === 'conversation') setError(t('checkpoint.undoUnavailable'))
    } finally {
      setLoading(false)
    }
  }, [sessionId, scope, t])

  useEffect(() => {
    void load()
  }, [load])

  const onRestore = useCallback(
    async (checkpointId: string) => {
      // 2026-09-12 立:回退不可撤销,复用项目既有 useConfirm 做二次确认
      const ok = await confirm({
        title: t('checkpoint.undoConfirm'),
        description: t('checkpoint.confirmDescription'),
        confirmText: t('checkpoint.confirmText'),
        variant: 'destructive',
      })
      if (!ok) return
      setRestoring(true)
      setError('')
      // D163:撤销前记快照 —— conversation 范围不碰文件("未发生变化"是事实);
      // code/both 真碰文件,必须拿快照留底,失败后才有得比对。
      const before =
        scope === 'conversation' ? null : await captureImpactSnapshot(checkpointId, sessionId, scope)
      try {
        const result = await restoreCheckpoint(checkpointId, sessionId, scope)
        if (isUndoPartial(result.file_versions)) {
          toast.warning(t('checkpoint.undoPartialWarning'))
        } else {
          toast.success(t('checkpoint.undoSucceeded', { count: result.file_changes }))
        }
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        // D163:失败后重取快照比对 —— 比对成立才说"未发生变化",
        // 文件集变了明说"已变化",没有快照只能说"无法确认"。
        const after =
          scope === 'conversation'
            ? null
            : await captureImpactSnapshot(checkpointId, sessionId, scope)
        const verdict =
          scope === 'conversation'
            ? 'unchanged'
            : classifyUndoWorkspace(before, after)
        toast.error(t(`checkpoint.${resolveUndoFailureKey('restore-failed', verdict)}`))
      } finally {
        setRestoring(false)
      }
    },
    [confirm, t, sessionId, scope, load],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? t('checkpoint.loading') : t('checkpoint.refresh')}
        </button>
        <span>{message}</span>
      </div>
      {error && <span style={{ color: '#d33' }}>{error}</span>}
      {checkpoints.length === 0 && !loading && <span>{t('checkpoint.empty')}</span>}
      {checkpoints.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {checkpoints.map((cp) => (
            <li key={cp.checkpoint_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>
                {t('checkpoint.item', {
                  iteration: cp.iteration,
                  status: cp.status,
                  count: cp.message_count,
                })}
              </span>
              <button
                type="button"
                onClick={() => void onRestore(cp.checkpoint_id)}
                disabled={restoring}
              >
                {restoring ? t('checkpoint.undoPreparing') : t('checkpoint.rollback')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* 2026-09-12 立:useConfirm 的弹窗必须挂载到组件树中,否则二次确认不显示 */}
      <ConfirmDialogRenderer />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
