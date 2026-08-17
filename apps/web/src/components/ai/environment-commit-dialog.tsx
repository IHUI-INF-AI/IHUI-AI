'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, GitCommit, ArrowDownToLine } from 'lucide-react'
import { toast } from '@/components/common'
import { Modal } from '@/components/feedback'
import { useEnvironmentInfoStore } from '@/stores/environment-info'
import { useAiPanelStore } from '@/stores/ai-panel'
import { runCommand } from '@ihui/api-client'

/**
 * EnvironmentCommitDialog — "提交或推送"弹窗(2026-08-17 Phase4,对齐 Cursor 弹窗交互)。
 *
 * 触发:环境信息弹窗点击"提交或推送"行 → store.commitDialogOpen。
 * 交互:
 * - commit message textarea(必填)
 * - 三按钮:「仅提交」「提交并推送」「取消」
 * - 流程:git add -A → git commit -m "msg" →(提交并推送)git push origin HEAD
 * - 提交成功 → toast + 关闭 + 刷新环境信息
 */
export function EnvironmentCommitDialog() {
  const t = useTranslations('aiChat.envInfo')
  const tcommon = useTranslations('common')
  const open = useEnvironmentInfoStore((s) => s.commitDialogOpen)
  const closeCommitDialog = useEnvironmentInfoStore((s) => s.closeCommitDialog)
  const fetchStatus = useEnvironmentInfoStore((s) => s.fetchStatus)
  const snapshot = useEnvironmentInfoStore((s) => s.snapshot)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)

  const [commitMsg, setCommitMsg] = React.useState('')
  const [busy, setBusy] = React.useState<'commit' | 'push' | null>(null)

  const workspacePath = activeWorkspace?.path ?? null
  const hasRemote = snapshot?.hasRemote ?? false

  // 打开时清空输入 + 默认聚焦
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    if (open) {
      setCommitMsg('')
      setBusy(null)
      // 延迟聚焦(等 Modal 动画完成)
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  const runCommitPush = async (push: boolean) => {
    if (!commitMsg.trim() || !workspacePath || busy) return
    setBusy(push ? 'push' : 'commit')
    try {
      const addRes = await runCommand({
        command: 'git add -A',
        workspacePath,
        mode: 'workspace-write',
        timeoutMs: 10000,
      })
      if (!addRes.success) throw new Error(addRes.error ?? 'git add 失败')
      const commitRes = await runCommand({
        command: `git commit -m "${commitMsg.trim().replace(/"/g, '\\"')}"`,
        workspacePath,
        mode: 'workspace-write',
        timeoutMs: 15000,
      })
      if (!commitRes.success) throw new Error(commitRes.error ?? 'git commit 失败')

      if (push) {
        const pushRes = await runCommand({
          command: 'git push origin HEAD',
          workspacePath,
          mode: 'workspace-write',
          timeoutMs: 30000,
        })
        if (!pushRes.success) throw new Error(pushRes.error ?? 'git push 失败')
        toast.success(t('pushOk'))
      } else if (!hasRemote) {
        toast.success(t('commitNoRemote'))
      } else {
        toast.success(t('commitOk'))
      }

      setCommitMsg('')
      closeCommitDialog()
      void fetchStatus(workspacePath)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('commitFail'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeCommitDialog}
      title={t('commitPush')}
      description={workspacePath ? undefined : t('noWorkspace')}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={() => closeCommitDialog()}
            disabled={busy !== null}
            className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            data-testid="env-commit-cancel"
          >
            {tcommon('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void runCommitPush(false)}
            disabled={!commitMsg.trim() || busy !== null || !workspacePath}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            data-testid="env-commit-only"
          >
            {busy === 'commit' ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <GitCommit className="h-3 w-3" aria-hidden />
            )}
            {t('commitOnly')}
          </button>
          <button
            type="button"
            onClick={() => void runCommitPush(true)}
            disabled={!commitMsg.trim() || busy !== null || !workspacePath}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            data-testid="env-commit-push"
          >
            {busy === 'push' ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <ArrowDownToLine className="h-3 w-3" aria-hidden />
            )}
            {t('submitAndPush')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <textarea
          ref={inputRef}
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Enter 快捷提交并推送
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void runCommitPush(true)
            }
          }}
          placeholder={t('commitPlaceholder')}
          rows={3}
          className="h-auto min-h-[64px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
          data-testid="env-commit-textarea"
        />
        {hasRemote && (
          <p className="text-[11px] text-muted-foreground/70" data-testid="env-commit-remote-hint">
            {t('commitPushRemoteHint')}
          </p>
        )}
      </div>
    </Modal>
  )
}

export default EnvironmentCommitDialog
