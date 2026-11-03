// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D30 无人值守修复闭环 —— 修复任务记录与状态机契约(2026-09-26 立,PROJECT_PLAN 计划行 659 / G-36)。
//
// 范围:三类输入源(GitHub issue / 代码扫描告警 / 失败 workflow run)归一后的
// 「修复任务」记录形态 + 状态机迁移合法性契约。api 端实现见
// apps/api/src/services/automation-repair-service.ts。

/** 修复任务状态机的全部合法状态 */
export type RepairTaskState = 'pending' | 'claimed' | 'running' | 'fixed' | 'failed'

/** 输入源三分型(与 apps/api automations/types.ts 的 ScanSource 同形,此处为跨端契约侧副本) */
export type RepairTaskSourceKind = 'issue' | 'code-scanning' | 'workflow-run'

/** 一次状态迁移的审计条目:who(by)/when(at)/结论摘要(note) */
export interface RepairTaskTransition {
  from: RepairTaskState
  to: RepairTaskState
  /** ISO 时间戳 */
  at: string
  /** 执行迁移的持有者标识(worker owner 或 'system:ingest' 等) */
  by: string
  /** 结论摘要(已脱敏);可为空 */
  note?: string
}

/** 修复任务记录(持久化形态) */
export interface RepairTaskRecord {
  /** 去重唯一键:issue:{n} / code-scanning:{n} / workflow-run:{id} */
  key: string
  source: RepairTaskSourceKind
  /** owner/repo */
  repo: string
  title: string
  /** 交给执行器的 goal(含正文/告警栈/失败日志线索) */
  goal: string
  /** 条目跳转链接 */
  url: string | null
  /** 回帖目标 issue 号(仅 issue 源有;告警/失败 run 无回帖面 → null) */
  issueNumber: number | null
  state: RepairTaskState
  /** 已执行次数(进入 running 时 +1) */
  attempts: number
  /** 重试上限(达到后 failed 即终态,不再可认领) */
  maxAttempts: number
  createdAt: string
  updatedAt: string
  /** 迁移审计流水(append-only) */
  history: RepairTaskTransition[]
}

/** 认领被拒的原因(每一种都必须可审计、可解释,不允许静默) */
export type RepairClaimRejection =
  /** 任务不存在 */
  | 'not_found'
  /** 已被认领/执行中(claimed|running) */
  | 'in_progress'
  /** 已修复(终态) */
  | 'already_fixed'
  /** 失败且重试已达上限(终态) */
  | 'retry_limit'
  /** 互斥锁被其他 worker 持有,或锁后端不可用(fail-closed) */
  | 'locked_by_other'

export interface RepairClaimResult {
  ok: boolean
  /** ok 时携带认领后的记录 */
  task?: RepairTaskRecord
  /** 拒绝原因(ok=false 时必有) */
  reason?: RepairClaimRejection
}

/** 单轮修复执行报告 */
export interface RepairRunReport {
  key: string
  /** 修复是否成功(running → fixed) */
  ok: boolean
  /** 执行摘要(脱敏后) */
  summary: string
  /** 回帖/开 PR 的结果;null = 无可回帖面(issueNumber 为 null 且未建 PR) */
  report: RepairReportResult | null
}

/** 出口(PR 开单 / issue 回帖)的结果;posted=false 必带 reason */
export interface RepairReportResult {
  posted: boolean
  channel: 'issue-comment' | 'pull-request'
  url?: string
  /** fail-closed 原因,如 github_app_credentials_missing / no_active_installation / github_http_403 */
  reason?: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
