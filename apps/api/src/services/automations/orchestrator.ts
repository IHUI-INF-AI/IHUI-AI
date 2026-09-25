// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 修复编排器(2026-09-26 立)。
 *
 * 单轮 runOnce 的流水线:
 *   三源扫描 → 认领去重(ledger)→ 认领回帖(可选)→ 组装修复任务 →
 *   执行器执行 → 建分支 + 建 PR([automations] fix: <摘要>)→ 原 issue 回帖结果 → 审计。
 *
 * 韧性约定:单条目/单步骤失败只记审计、不影响其余条目;单源扫描失败降级为空集。
 * PAT 绝不落日志:所有日志走注入的 audit(实现侧已 redact),错误消息再过一次 redact 兜底。
 */

import type { AuditLogger, FixExecutor, FixTask, ScanItem, TickReport } from './types.js'
import type { GitHubClient } from './github-client.js'
import type { ClaimLedger } from './ledger.js'
import type { AutomationsConfig } from './config.js'
import { redactSecrets } from './redact.js'

const GOAL_LIMIT = 4000
const TITLE_LIMIT = 60

/** 组装修复任务 goal(纯函数,含 issue 正文/告警栈/失败日志链接)。 */
export function buildFixGoal(item: ScanItem, repo: string): string {
  const lines = [
    '【D30 无人值守修复任务】',
    `仓库:${repo}`,
    `来源:${item.source}`,
    `条目:${item.key}`,
    `标题:${item.title}`,
    item.url ? `链接:${item.url}` : '链接:(无)',
    '',
    '详情(问题正文/告警栈/失败日志线索):',
    item.detail || '(无详情,请根据标题与链接自行排查)',
    '',
    '要求:定位根因并实施修复;修复改动提交到独立分支,由编排层负责建 PR 并回帖原 issue。',
  ]
  return lines.join('\n').slice(0, GOAL_LIMIT)
}

/** PR 标题:[automations] fix: <摘要> */
export function prTitleFor(item: ScanItem): string {
  const summary = item.title.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT)
  return `[automations] fix: ${summary}`
}

/** 分支名:automations/fix-<source>-<key 序号>-<时间戳>(slug 化防非法字符) */
export function branchNameFor(item: ScanItem, now = new Date()): string {
  const seq = item.key.split(':')[1] ?? 'x'
  const stamp = now
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14)
  return `automations/fix-${item.source}-${seq}-${stamp}`
}

/** 认领回帖文案 */
export function claimCommentBody(item: ScanItem): string {
  return [
    '🤖 已认领(automations 无人值守修复闭环 D30):',
    `条目 \`${item.key}\` 已进入修复队列,完成后将以 PR 形式回帖结果。`,
    '本条消息由自动编排发出;若为误认领请联系管理员移除 label。',
  ].join('\n')
}

/** 结果回帖文案(成功含 PR 链接;失败含脱敏后的错误摘要) */
export function resultCommentBody(item: ScanItem, ok: boolean, summary: string, prUrl: string | null): string {
  const head = ok ? '✅ 修复任务已执行' : '❌ 修复任务执行失败'
  const lines = [
    `${head}(automations D30,条目 \`${item.key}\`):`,
    '',
    summary || '(无摘要)',
  ]
  if (prUrl) lines.push('', `PR:${prUrl}`)
  return lines.join('\n')
}

export interface OrchestratorDeps {
  config: AutomationsConfig
  github: GitHubClient
  ledger: ClaimLedger
  executor: FixExecutor
  audit?: AuditLogger
}

export interface Orchestrator {
  runOnce(): Promise<TickReport>
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  const { config, github, ledger, executor } = deps
  const audit = deps.audit
  const secrets = [config.pat]

  /** 兜底脱敏:即使调用方传来的错误对象里混入 PAT,落日志前也再洗一遍 */
  const safe = (text: string): string => redactSecrets(text, secrets)

  async function scanAll(): Promise<ScanItem[]> {
    const [issues, alerts, runs] = await Promise.all([
      github
        .scanIssues(config.label)
        .catch((err) => {
          audit?.warn('[automations] issue 扫描失败', { err: safe(String(err)) })
          return [] as ScanItem[]
        }),
      github.scanCodeScanningAlerts(),
      github
        .scanFailedRuns(config.maxRuns)
        .catch((err) => {
          audit?.warn('[automations] 失败 run 扫描失败', { err: safe(String(err)) })
          return [] as ScanItem[]
        }),
    ])
    return [...issues, ...alerts, ...runs]
  }

  async function handleItem(item: ScanItem, report: TickReport): Promise<void> {
    // ---- 认领去重(内存 + 文件双保险)----
    const claimed = ledger.claim(item.key, { title: item.title })
    if (!claimed) {
      report.scanned++
      return
    }
    report.scanned++
    report.claimed++
    audit?.info('[automations] 已认领条目', { key: item.key, source: item.source })

    // ---- 认领回帖(可选;仅 issue 源有可回帖面)----
    if (config.claimComment && item.issueNumber !== null) {
      try {
        await github.addIssueComment(item.issueNumber, claimCommentBody(item))
      } catch (err) {
        audit?.warn('[automations] 认领回帖失败(不影响认领)', {
          key: item.key,
          err: safe(String(err)),
        })
      }
    }

    // ---- 组装修复任务并执行 ----
    const task: FixTask = {
      key: item.key,
      source: item.source,
      repo: config.repo,
      title: item.title,
      goal: buildFixGoal(item, config.repo),
      url: item.url,
      issueNumber: item.issueNumber,
    }
    let ok = false
    let summary = ''
    try {
      const result = await executor.execute(task)
      ok = result.ok
      summary = safe(result.summary)
      if (!result.ok && result.error) {
        summary = `${summary} ${safe(result.error)}`.trim()
      }
    } catch (err) {
      ok = false
      summary = safe(String(err))
    }
    audit?.info('[automations] 修复任务执行完成', { key: item.key, ok, summary: summary.slice(0, 300) })

    if (ok) {
      report.fixed++
    } else {
      report.failed++
    }

    // ---- PR + 回帖(stub 模式也走完整链路,便于用注入 transport 验证)----
    let prUrl: string | null = null
    if (ok) {
      try {
        const branch = branchNameFor(item)
        const { base } = await github.createFixBranch(branch)
        const pr = await github.createPullRequest({
          title: prTitleFor(item),
          head: branch,
          base,
          body: [
            `Automated fix attempt for \`${item.key}\`(${item.source}).`,
            '',
            task.goal,
            '',
            '---',
            `Executor: ${executor.name}`,
            `Summary: ${summary}`,
          ].join('\n'),
        })
        prUrl = pr.url
        audit?.info('[automations] PR 已创建', { key: item.key, pr: prUrl, number: pr.number })
      } catch (err) {
        // PR 失败不回滚认领:下轮不会重复认领;错误进审计 + 回帖,便于人工接管
        audit?.warn('[automations] PR 创建失败', { key: item.key, err: safe(String(err)) })
        summary = `${summary} PR 创建失败:${safe(String(err))}`.trim()
      }
    }

    // ---- 原 issue 回帖结果 ----
    if (item.issueNumber !== null) {
      try {
        await github.addIssueComment(item.issueNumber, resultCommentBody(item, ok, summary, prUrl))
      } catch (err) {
        audit?.warn('[automations] 结果回帖失败', { key: item.key, err: safe(String(err)) })
      }
    }
  }

  return {
    async runOnce(): Promise<TickReport> {
      const report: TickReport = { scanned: 0, claimed: 0, fixed: 0, failed: 0 }
      const items = await scanAll()
      audit?.info('[automations] 扫描完成', { scanned: items.length })
      // 批次上限:单轮最多认领 batchLimit 条新条目,防突发风暴
      let budget = config.batchLimit
      for (const item of items) {
        if (budget <= 0) break
        const before = report.claimed
        await handleItem(item, report)
        if (report.claimed > before) budget--
      }
      audit?.info('[automations] 本轮结束', { ...report })
      return report
    },
  }
}
