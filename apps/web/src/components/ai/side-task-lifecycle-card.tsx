// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D75 侧边任务生命周期卡(G-102) —— 对话流内渲染件。
//
// **数据面纪律(与 D72 `worktree-card` 同)**:本卡**不取数**。任务对象与已清理清单由调用方
// 注入(`onAction` 回调),四态判定一律走 `@ihui/shared/chat/side-task-lifecycle`
// —— 端内不得另写 `state === 'expired' ? … : …` 这类第二套判定。
//
// 三条用户可感的硬要求在这里落地:
//   1. **显式声明**:「临时任务关闭后消失」占独立文案位,四态**全部**渲染(刚创建时
//      就告知,而不是等清理后才告诉用户东西没了);
//   2. **已清理也留痕**:cleaned 态渲染「来自已清理的 {标题}」,批量清理出来的清单
//      逐条同键渲染,内容丢了但来源说得清;
//   3. **关闭前确认**:判据 `needsCloseConfirm` 在判定层,本卡只把它渲染成
//      `data-side-task-needs-close-confirm`;是否弹层由宿主决定(`confirmOpen`),
//      纯已完成态(无产物无子进程)不打扰。
//
// **与 /side 队列语义的关系**:本卡不接 `sideQueueByConversation`、不接 W27
// `pendingMessages`,不含任何发送 / 入队能力 —— 预备消息优先出队的规则
// (`message-input.tsx` 流结束 effect)不受本卡影响(见 `__tests__` 源码级用例)。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  sideTaskView,
  type CleanedSideTaskEntry,
  type SideTask,
  type SideTaskAction,
  type SideTaskTone,
} from '@ihui/shared/chat/side-task-lifecycle'

/** 语义色档 → 样式(判定层只给语义,端内只做这一处样式映射) */
const TONE_CLASS: Record<SideTaskTone, string> = {
  info: 'text-sky-600 dark:text-sky-500',
  success: 'text-emerald-600 dark:text-emerald-500',
  warning: 'text-amber-600 dark:text-amber-500',
  neutral: 'text-muted-foreground',
}

export interface SideTaskLifecycleCardProps {
  /** 侧边任务(含生命周期四态);缺省 ⇒ 渲染空态 */
  task?: SideTask | null
  /** 已批量清理出来的任务清单(渲染「来自已清理的 {标题}」);本卡不自行清理 */
  cleaned?: readonly CleanedSideTaskEntry[]
  /** 是否展开关闭确认弹层(宿主依据 needsCloseConfirm(task) 决定是否给用户看) */
  confirmOpen?: boolean
  /** 动作回调。数据面在调用方,本卡只负责触发;不传则不渲染动作按钮 */
  onAction?: (action: SideTaskAction) => void
  className?: string
  'data-testid'?: string
}

export function SideTaskLifecycleCard({
  task,
  cleaned,
  confirmOpen = false,
  onAction,
  className,
  'data-testid': testId,
}: SideTaskLifecycleCardProps) {
  const t = useTranslations('ai.pane.sideTask')

  const view = sideTaskView(task)
  const cleanedList = cleaned ?? []

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-side-task-state={view?.state ?? 'none'}
      data-side-task-tone={view?.tone ?? 'none'}
      data-side-task-needs-close-confirm={view?.needsCloseConfirm ? 'true' : 'false'}
    >
      {view ? (
        <React.Fragment>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t('title')}</span>
            <span
              className={cn('text-xs font-medium', TONE_CLASS[view.tone])}
              data-side-task-state-label={view.state}
            >
              {t(view.titleKey)}
            </span>
          </div>

          {/* 显式声明:四态恒渲染 —— 创建时就告知「临时任务关闭后消失」 */}
          <p className="text-[11px] text-muted-foreground" data-side-task-ephemeral-notice="true">
            {t(view.ephemeralNoticeKey)}
          </p>

          {view.hintKey ? (
            <p
              className={cn(
                'text-[11px]',
                view.tone === 'warning' ? TONE_CLASS.warning : 'text-muted-foreground',
              )}
              data-side-task-hint={view.hintKey}
            >
              {t(view.hintKey)}
            </p>
          ) : null}

          {/* 并行运行位置:同文件夹 / 同环境 —— 用户得知道自己改动落在哪儿 */}
          <p className="text-[11px] text-muted-foreground/80" data-side-task-location={view.location}>
            {`${t('location.label')} · ${t(view.locationKey)}`}
          </p>

          {/* 文件变更计数:n = 0 走明确空态文案,不显示孤零零的「0」 */}
          <p
            className="text-[11px] text-muted-foreground/80"
            data-side-task-files={view.files.count}
            data-side-task-files-empty={view.files.empty ? 'true' : 'false'}
          >
            {view.files.values
              ? `${t('files.label')} · ${t(view.files.key, { ...view.files.values })}`
              : `${t('files.label')} · ${t(view.files.key)}`}
          </p>

          {view.cleanedFrom ? (
            <p
              className="text-[11px] text-muted-foreground/70"
              data-side-task-cleaned-from={view.cleanedFrom.title}
            >
              {t(view.cleanedFrom.key, { ...view.cleanedFrom.values })}
            </p>
          ) : null}

          {onAction ? (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => onAction('close')}
                data-action="close"
                className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t('action.close')}
              </button>
              {view.state === 'expired' ? (
                <button
                  type="button"
                  onClick={() => onAction('cleanup')}
                  data-action="cleanup"
                  className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {t('action.cleanup')}
                </button>
              ) : null}
            </div>
          ) : null}

          {confirmOpen && view.needsCloseConfirm ? (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label={t('closeConfirm.title')}
              data-side-task-confirm="open"
              className="flex flex-col gap-2 rounded-md border border-border/60 bg-background p-2"
            >
              <p className="text-xs font-medium" data-side-task-confirm-title="true">
                {t('closeConfirm.title')}
              </p>
              <p className="text-[11px] text-muted-foreground" data-side-task-confirm-desc="true">
                {t('closeConfirm.desc', {
                  artifacts: String(view.unsavedArtifacts),
                  children: String(view.runningChildProcesses),
                })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onAction?.('confirmClose')}
                  data-action="confirmClose"
                  className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {t('closeConfirm.confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => onAction?.('cancelClose')}
                  data-action="cancelClose"
                  className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {t('closeConfirm.cancel')}
                </button>
              </div>
            </div>
          ) : null}
        </React.Fragment>
      ) : cleanedList.length === 0 ? (
        <p className="text-[11px] text-muted-foreground" data-side-task-empty="true">
          {t('empty')}
        </p>
      ) : null}

      {cleanedList.length > 0 ? (
        <ul className="flex flex-col gap-1" data-side-task-cleaned-list="true">
          {cleanedList.map((entry) => (
            <li
              key={entry.id}
              className="text-[11px] text-muted-foreground/70"
              data-side-task-cleaned-from={entry.title}
            >
              {t(entry.labelKey, { ...entry.values })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
