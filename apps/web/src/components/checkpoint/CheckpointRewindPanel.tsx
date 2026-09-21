// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  listCheckpoints,
  restoreCheckpoint,
  type CheckpointMeta,
  type CheckpointScope,
} from '@/api/checkpoint-api'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/components/common'

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
    } finally {
      setLoading(false)
    }
  }, [sessionId, t])

  useEffect(() => {
    void load()
  }, [load])

  const onRestore = useCallback(
    async (checkpointId: string) => {
      // 2026-09-12 立:回退不可撤销,复用项目既有 useConfirm 做二次确认
      const ok = await confirm({
        title: t('checkpoint.confirmTitle'),
        description: t('checkpoint.confirmDescription'),
        confirmText: t('checkpoint.confirmText'),
        variant: 'destructive',
      })
      if (!ok) return
      setRestoring(true)
      setError('')
      try {
        await restoreCheckpoint(checkpointId, sessionId, scope)
        toast.success(t('checkpoint.restoreSuccess'))
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        toast.error(t('checkpoint.restoreFailed'))
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
                {restoring ? t('checkpoint.restoring') : t('checkpoint.rollback')}
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
