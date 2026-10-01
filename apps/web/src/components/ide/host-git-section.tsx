// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-28 V3 #72 —— 桌面宿主 git 通道的界面出口:授权当前 workspace → 列本地变更。
//
// 为什么要它:宿主侧三个 command(`git_authorize_workspace` / `git_workspace_status` /
// `git_channel_info`)此前只存在于 Rust 与它自己的单测里,前端**零消费者** —— 机制在位、
// 没有人能够得着(本仓"造好没装车"那一族的又一实例,见守门 64/70/81/115)。
//
// **渲染纪律(票面硬性要求)**:宿主的结论有三格,`undetermined` 必须显式渲染成
// 「取不到 / 判不了」并把宿主给的原因原样带出,**禁止与「没有改动」同形**。宿主刻意把
// 两者分家、且在 undetermined 时返回空 entries —— 前端若按"数组为空 ⇒ 干净"折叠回去,
// 就等于把它的判据废掉。因此下面每个分支都按 `state` 判,`entries.length` 只在
// `state === 'facts'` 之内参与渲染。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  GitBranch,
  RefreshCw,
  ShieldCheck,
  CircleSlash,
  TriangleAlert,
  FileDiff,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useHostGitWorkspace } from '@/hooks/use-host-git-workspace'

/** 一行结论的语义档:只影响配色,文字与 data-state 才是可分辨信息 */
const STATE_CLASS = {
  facts: 'text-emerald-600 dark:text-emerald-500',
  command_failed: 'text-destructive',
  undetermined: 'text-amber-600 dark:text-amber-500',
  rejected: 'text-destructive',
  pending: 'text-muted-foreground',
} as const

type StateKey = keyof typeof STATE_CLASS

const STATE_ICON: Record<StateKey, typeof GitBranch> = {
  facts: GitBranch,
  command_failed: TriangleAlert,
  undetermined: CircleSlash,
  rejected: TriangleAlert,
  pending: CircleSlash,
}

function StateLine({
  state,
  testId,
  children,
}: {
  state: StateKey
  testId: string
  children: React.ReactNode
}) {
  const Icon = STATE_ICON[state]
  return (
    <div
      className={cn('flex items-start gap-1.5 text-xs', STATE_CLASS[state])}
      data-testid={testId}
      data-state={state}
      role="status"
    >
      <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span className="flex-1 break-all">{children}</span>
    </div>
  )
}

export function HostGitSection() {
  const t = useTranslations('ide')
  const { workspacePath } = useIDEWorkspace()
  const { inHost, status, info, error, busy, authorize, refresh } = useHostGitWorkspace()

  // 非桌面宿主 ⇒ 这条能力结构性不适用(不是"没有改动",也不是"判不了")。
  // 整块不渲染,以免浏览器里出现一个永远点不动的授权钮。
  if (!inHost) return null

  const root = workspacePath?.trim() ?? ''
  const facts = status?.state === 'facts' ? status : null
  const undetermined = status?.state === 'undetermined' ? status : null
  const commandFailed = status?.state === 'command_failed' ? status : null

  return (
    <div className="shrink-0 space-y-1.5 bg-card px-2 py-1.5" data-testid="host-git-section">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">{t('hostGit.title')}</span>
        <button
          type="button"
          onClick={() => void authorize(root)}
          disabled={!root || busy !== null}
          className="inline-flex h-6 items-center gap-1 rounded-sm border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="host-git-authorize-btn"
          data-has-root={root ? 'true' : 'false'}
        >
          <ShieldCheck className="h-3 w-3" aria-hidden />
          <span>{t('hostGit.authorize')}</span>
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy !== null}
          className="inline-flex h-6 items-center gap-1 rounded-sm border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="host-git-refresh-btn"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          <span>{t('hostGit.refresh')}</span>
        </button>
      </div>

      {!root && (
        <StateLine state="pending" testId="host-git-line">
          {t('hostGit.noWorkspace')}
        </StateLine>
      )}

      {error?.kind === 'host-rejected' && (
        <StateLine state="rejected" testId="host-git-line">
          {t('hostGit.hostRejected', { reason: error.message })}
        </StateLine>
      )}

      {!error && !status && root && (
        <StateLine state="pending" testId="host-git-line">
          {t('hostGit.noVerdict')}
        </StateLine>
      )}

      {facts && facts.verdict === 'clean' && (
        <StateLine state="facts" testId="host-git-line">
          {t('hostGit.clean')}
        </StateLine>
      )}

      {facts && facts.verdict !== 'clean' && (
        <>
          <StateLine state="facts" testId="host-git-line">
            <span className="inline-flex items-center gap-1">
              <FileDiff className="h-3 w-3" aria-hidden />
              <span>{t('hostGit.dirty', { count: facts.total })}</span>
            </span>
          </StateLine>
          <ul className="max-h-40 overflow-y-auto text-[11px]" data-testid="host-git-entry-list">
            {facts.entries.map((entry) => (
              <li
                key={`${entry.kind}:${entry.path}`}
                className="flex items-center gap-1.5 text-muted-foreground"
                data-testid="host-git-entry"
                data-kind={entry.kind}
              >
                <span className="w-16 shrink-0 font-mono text-[10px]">{entry.kind}</span>
                <span className="flex-1 truncate">{entry.path}</span>
                {entry.old_path && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                    {entry.old_path}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {commandFailed && (
        <StateLine state="command_failed" testId="host-git-line">
          {t('hostGit.commandFailed', {
            reason: commandFailed.reason,
            verdict: commandFailed.verdict,
          })}
        </StateLine>
      )}

      {/* 这一格是本条存在的主要理由:宿主说"判不了"时,entries 是空的,但界面上
          绝不能出现"干净/没有改动"字样 —— 那是把一次失明写成一次结论。 */}
      {undetermined && (
        <StateLine state="undetermined" testId="host-git-line">
          {t('hostGit.undetermined', { reason: undetermined.reason })}
        </StateLine>
      )}

      {info && (
        <div className="text-[10px] text-muted-foreground/70" data-testid="host-git-binary">
          {info.gitBinary
            ? t('hostGit.binary', { path: info.gitBinary })
            : t('hostGit.binaryMissing')}
        </div>
      )}
    </div>
  )
}

export default HostGitSection
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
