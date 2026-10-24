// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// i18n-content-exempt-file: 中文均为审查 finding 的派单 payload/模板内容(问题/说明/建议/约束),不是界面 chrome;UI 文案走 t()
// D115(2026-10-23,G-229):review 模式的审查结论卡。消费 `@ihui/api-client` 的
// `onReviewFinding` 已解析的 finding 帧(一 finding 一帧,载荷契约唯一事实源在
// `packages/shared/src/sse/contract.ts` 的 `review-finding` 成员;生产点
// `apps/ai-service/app/core/review_findings.py`)。本卡只分组与渲染,不重算、不新增
// 第二份 schema:行类型直接由 shared 契约的判别联合投影而来。
//
// 点击落点复用仓内既有 IDE 出口(`useIDEWorkspace.openFile` + `setActiveTopTab('editor')`,
// 与 file-chips / diff-file-list 同一条腿)。`line > 0` 时再调 store 上的编辑器揭示入口
// (`revealAt`,由 CodeEditorPane 挂载期注册 → CodeEditor 的 pendingReveal 单点消费),
// 目标 tab 内容加载完成后滚动定位到该行;`line = 0` 是整文件级 finding,只开文件不揭示。
//
// 「派发修复」按票面口径**不新造派发实现**:每条 finding 一个按钮,点击把
// `buildFixDispatchPreset` 的预填值交给**既有** `DispatchSubagentDialog`
// (其提交腿即 `/api/subagents/dispatch`,即票面要求的 dispatch_subagent;
// 成功/失败的可见反馈沿用该对话框既有成功面板与 toast),由用户确认后派单。

import * as React from 'react'
import { Wrench } from 'lucide-react'

import type { SSEEventPayload } from '@ihui/shared'
import type { FileNode } from '@ihui/types'

import type { DispatchPreset } from '@/components/ai/dispatch-subagent-dialog'
import { cn } from '@/lib/utils'
import { EXT_LANG, useIDEWorkspace } from '@/stores/ide-workspace'

/** 线帧 `review-finding` 的端内投影(唯一 schema 在 shared contract,这里只取类型)。 */
export type ReviewFinding = Extract<SSEEventPayload, { type: 'review-finding' }>

/** 严重度三档(与生产端 REVIEW_SEVERITIES 同序:阻塞 → 建议 → 细节)。 */
const SEVERITY_ORDER = ['P1', 'P2', 'Nit'] as const

/** 档位 → 色档(与 StreamAlertBar 的 warning/critical 同族,单色不拼新视觉语言)。 */
const SEVERITY_STYLES: Record<(typeof SEVERITY_ORDER)[number], string> = {
  P1: 'bg-red-500/10 text-red-700 dark:text-red-400',
  P2: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  Nit: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
}

/** 路径比较统一成正斜杠(与 file-chips / turn-changes-card 同口径)。 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').trim()
}

function basename(p: string): string {
  const normalized = normalizePath(p)
  const slash = normalized.lastIndexOf('/')
  return slash < 0 ? normalized : normalized.slice(slash + 1)
}

/** 行号 > 0 ⇒ `文件:行`;0 = 整文件级(生产端口径,不补假行号)。 */
export function reviewFindingLocation(finding: ReviewFinding): string {
  return finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file
}

/**
 * 「派发修复」的派单正文(goal):只投影 finding 自身已有字段,不补推断内容。
 * 顺序固定(严重度+位置 / 问题 / 说明 / 建议)便于用例逐字断言。
 */
export function buildFixDispatchPrompt(finding: ReviewFinding): string {
  const lines = [`修复审查发现(${finding.severity}):${reviewFindingLocation(finding)}`]
  lines.push(`问题:${finding.title}`)
  if (finding.detail !== '') lines.push(`说明:${finding.detail}`)
  if (finding.suggestion !== '') lines.push(`修复建议:${finding.suggestion}`)
  return lines.join('\n')
}

/**
 * 「派发修复」的派单预填值 —— 交给既有 `DispatchSubagentDialog`(本仓唯一派发表单,
 * 其提交即 `/api/subagents/dispatch`),不另造派发链路。只投影该条 finding 自身字段:
 * 摘要/文件行进 goal 与 affectedFiles,严重度进 priority,其余 finding 一概不参与。
 */
export function buildFixDispatchPreset(finding: ReviewFinding): DispatchPreset {
  return {
    goal: buildFixDispatchPrompt(finding),
    affectedFiles: [normalizePath(finding.file)],
    priority: finding.severity === 'P1' ? 'urgent' : finding.severity === 'P2' ? 'high' : 'low',
    constraints: `只修 ${reviewFindingLocation(finding)} 这一处,不改无关代码,不引入新依赖`,
    deliverables: '修复该 finding,并自验(typecheck / lint / 相关用例)通过',
  }
}

export interface ReviewFindingsCardProps {
  findings: readonly ReviewFinding[]
  /** 点击 finding 的落点出口;缺省走 IDE 面板(与 file-chips 同一条腿)。 */
  onOpenFinding?: (finding: ReviewFinding) => void
  /** 「派发修复」出口;缺省不渲染按钮(纯展示卡不擅自派单)。 */
  onDispatchFix?: (finding: ReviewFinding) => void
}

/**
 * 按严重度分组的审查卡:组序恒为 P1 → P2 → Nit(空档不渲染),组内保持帧到达顺序。
 * 无 finding 时整卡不渲染(不占位)。
 */
export function ReviewFindingsCard({
  findings,
  onOpenFinding,
  onDispatchFix,
}: ReviewFindingsCardProps) {
  const groups = React.useMemo(
    () =>
      SEVERITY_ORDER.map((severity) => ({
        severity,
        items: findings.filter((f) => f.severity === severity),
      })),
    [findings],
  )

  const openFinding = React.useCallback(
    (finding: ReviewFinding) => {
      if (onOpenFinding) {
        onOpenFinding(finding)
        return
      }
      const path = normalizePath(finding.file)
      const name = basename(path)
      const ext = name.includes('.') ? (name.split('.').pop() ?? '') : ''
      const file: FileNode = {
        id: path,
        name,
        path,
        type: 'file',
        language: EXT_LANG[ext] ?? 'text',
      }
      const ide = useIDEWorkspace.getState()
      ide.openFile(file)
      ide.setActiveTopTab('editor')
      // 行号 > 0 才揭示到行;line=0 是整文件级 finding,只开文件(不补假行号也不定位)
      if (finding.line > 0) ide.revealAt?.(path, finding.line, 1)
    },
    [onOpenFinding],
  )

  if (findings.length === 0) return null

  return (
    <div data-testid="review-findings-card" className="space-y-1.5">
      {groups.map(({ severity, items }) => {
        if (items.length === 0) return null
        return (
          <section
            key={severity}
            data-testid={`review-group-${severity}`}
            data-severity={severity}
            className="ui-card min-w-0 rounded-lg px-3 py-2"
          >
            <header className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  'shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none',
                  SEVERITY_STYLES[severity],
                )}
              >
                {severity}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground/70">{items.length}</span>
            </header>
            <ul className="mt-1 space-y-1.5">
              {items.map((finding) => {
                const location = reviewFindingLocation(finding)
                return (
                  <li key={finding.findingId} className="min-w-0 text-xs">
                    <button
                      type="button"
                      onClick={() => openFinding(finding)}
                      aria-label={location}
                      data-testid={`review-finding-${finding.findingId}`}
                      className={cn(
                        'flex w-full min-w-0 items-start gap-1.5 rounded-sm px-1 py-0.5 text-left',
                        'transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none',
                      )}
                    >
                      <span className="shrink-0 font-mono text-muted-foreground/80">
                        {location}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-foreground/80">
                        {finding.title}
                      </span>
                    </button>
                    {finding.detail !== '' && (
                      <p className="mt-0.5 pl-1 text-muted-foreground/70 break-words">
                        {finding.detail}
                      </p>
                    )}
                    {finding.suggestion !== '' && (
                      <p className="mt-0.5 pl-1 text-muted-foreground/60 break-words">
                        {finding.suggestion}
                      </p>
                    )}
                    {onDispatchFix && (
                      <button
                        type="button"
                        data-testid={`review-dispatch-${finding.findingId}`}
                        aria-label={`dispatch-fix:${location}`}
                        onClick={() => onDispatchFix(finding)}
                        className={cn(
                          'mt-0.5 inline-flex items-center gap-1 rounded-sm px-1 py-0.5',
                          'text-[10px] text-muted-foreground/80 transition-colors',
                          'hover:bg-accent/40 hover:text-foreground focus-visible:bg-accent/40 focus-visible:outline-none',
                        )}
                      >
                        <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export default ReviewFindingsCard
