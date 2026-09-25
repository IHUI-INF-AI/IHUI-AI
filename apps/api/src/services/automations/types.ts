// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 无人值守修复闭环 —— 共享类型(2026-09-26 立,PROJECT_PLAN 计划行 659)。
 *
 * 职责边界(范围控制):
 * - 只做「三源扫描 → 认领去重 → 修复编排 → PR 回帖 → 审计」的编排与通道对接;
 * - 不实现真实代码修复沙箱(真实修复由注入的执行器负责,默认 stub 仅登记)。
 * - 与 D15 GitHub App installation 体系解耦:走 PAT(env IHUI_GITHUB_PAT)。
 */

/** 注入式 HTTP transport(测试传 fake,生产传 global fetch 包装) */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** 结构化审计日志(与 utils/logger 的 FastifyLogger 同签名;实现侧负责 redact) */
export interface AuditLogger {
  info: (msg: string, meta?: object) => void
  warn: (msg: string, meta?: object) => void
  error: (msg: string, meta?: object) => void
}

/** 三源之一:GitHub issue(带指定 label 的 open issue) */
export type ScanSource = 'issue' | 'code-scanning' | 'workflow-run'

/** 归一化后的待修复条目(三源扫描产物) */
export interface ScanItem {
  /** 认领去重唯一键:issue:{n} / code-scanning:{n} / workflow-run:{id} */
  key: string
  source: ScanSource
  title: string
  /** 详情(issue 正文 / 告警栈摘要 / 失败日志链接),组装修复 goal 用 */
  detail: string
  /** 条目跳转链接(issue/alert/run 的 html_url) */
  url: string | null
  /** 回帖目标 issue 号(issue 源=自身;告警/失败 run 无对应 issue 时为 null → 不回帖) */
  issueNumber: number | null
}

/** 认领后组装的修复任务 */
export interface FixTask {
  key: string
  source: ScanSource
  repo: string
  title: string
  /** 组装给修复执行器的 goal 描述(含 issue 正文/告警栈/失败日志链接) */
  goal: string
  url: string | null
  issueNumber: number | null
}

/** 修复执行结果 */
export interface FixResult {
  ok: boolean
  summary: string
  error?: string
}

/** 修复执行器适配接口(注入式;stub 记录不执行,agent 走 ai-service 通道) */
export interface FixExecutor {
  readonly name: 'stub' | 'agent'
  execute(task: FixTask): Promise<FixResult>
}

/** 单轮 tick 报告(审计用) */
export interface TickReport {
  /** 本次扫描到的条目总数(三源之和) */
  scanned: number
  /** 本轮新认领数(已被 ledger 认领过的不计) */
  claimed: number
  /** 修复任务执行成功数 */
  fixed: number
  /** 修复任务执行失败数 */
  failed: number
}
